import * as fs from 'fs/promises'
import * as path from 'path'
import { projectOsUuid } from '../projectOsUuid.js'
import {
  scanFiles,
  readPackageJson,
  detectRoutes,
  parseImports,
  extractExports,
  detectProjectType,
} from '../analyzer/index.js'
import { clusterFiles } from './clustering.js'
import { inferEdges } from './edge-inference.js'
import { enrichTopology, computeTopologyMeta } from './topology-hierarchy.js'
import { expandSubmoduleNodes } from './submodule-expansion.js'
import type {
  ProjectGraph,
  AnalysisProgress,
  AnalysisStage,
  FileEntry,
  ProjectOsAnalyzeLlmConfig,
  AnalysisOptions,
  FunctionalNode,
  AnalysisMeta,
} from '../../../../common/projectOsTypes.js'
import { DEFAULT_ANALYSIS_OPTIONS } from '../../../../common/projectOsTypes.js'
import { isStaleFunctionMapGraph } from '../../../../common/projectOsTypes.js'
import type { IMetricsService } from '../../../../common/metricsService.js'
import { enrichArchitectureWithLlm } from '../llm/llm-architecture-enricher.js'
import { buildAiFunctionTree } from './ai-function-tree.js'
import { migrateGraph } from './graph-migrate.js'
import { mergeGraphNodes } from './graph-merge.js'
import { appendChangelog } from './graph-changelog.js'

// ── Types ───────────────────────────────────────────────────────

interface AnalysisCallbacks {
  onProgress: (progress: AnalysisProgress) => void
  onComplete: (graph: ProjectGraph) => void
  onError: (error: Error) => void
}

// ── File Index Builder ──────────────────────────────────────────

function buildFileIndex(
  graph: Omit<ProjectGraph, 'fileIndex'>,
  files: Awaited<ReturnType<typeof scanFiles>>,
  dependencies: Awaited<ReturnType<typeof parseImports>>,
): FileEntry[] {
  const fileNodeMap = new Map<string, string[]>()
  for (const node of graph.nodes) {
    for (const linkedFile of node.linkedFiles) {
      const existing = fileNodeMap.get(linkedFile.path) ?? []
      existing.push(node.id)
      fileNodeMap.set(linkedFile.path, existing)
    }
    for (const anchor of node.anchors ?? []) {
      const existing = fileNodeMap.get(anchor.path) ?? []
      if (!existing.includes(node.id)) {
        existing.push(node.id)
      }
      fileNodeMap.set(anchor.path, existing)
    }
  }

  const importMap = new Map<string, string[]>()
  for (const dep of dependencies) {
    const existing = importMap.get(dep.source) ?? []
    existing.push(dep.target)
    importMap.set(dep.source, existing)
  }

  return files.map((file) => {
    const relPath = file.relativePath.replace(/\\/g, '/')
    const exports = file.content ? extractExports(file.content) : []

    return {
      path: relPath,
      type: file.type,
      nodeIds: fileNodeMap.get(relPath) ?? [],
      imports: importMap.get(relPath) ?? [],
      exports,
      size: file.size,
      lastModified: file.lastModified,
    }
  })
}

// ── Load / Save Graph ───────────────────────────────────────────

async function loadExistingGraph(
  projectPath: string,
): Promise<ProjectGraph | null> {
  const graphPath = path.join(projectPath, '.projectos', 'graph.json')
  try {
    const raw = await fs.readFile(graphPath, 'utf-8')
    return migrateGraph(JSON.parse(raw) as ProjectGraph)
  } catch {
    return null
  }
}

async function saveGraph(
  projectPath: string,
  graph: ProjectGraph,
): Promise<void> {
  const dir = path.join(projectPath, '.projectos')
  await fs.mkdir(dir, { recursive: true })
  const graphPath = path.join(dir, 'graph.json')
  await fs.writeFile(graphPath, JSON.stringify(graph, null, 2), 'utf-8')
}

function emitProgress(
  callbacks: AnalysisCallbacks,
  jobId: string,
  stage: AnalysisStage,
  percent: number,
  message: string,
): void {
  callbacks.onProgress({ jobId, stage, percent, message })
}

function useAiTree(profile: AnalysisOptions['profile'], llm?: ProjectOsAnalyzeLlmConfig): boolean {
  return !!llm && (profile === 'standard' || profile === 'deep')
}

// ── Main Analysis Pipeline ──────────────────────────────────────

export async function analyzeProject(
  projectPath: string,
  jobId: string,
  callbacks: AnalysisCallbacks,
  options?: {
    llm?: ProjectOsAnalyzeLlmConfig
    metricsService?: IMetricsService
    analysisOptions?: AnalysisOptions
  },
): Promise<void> {
  const analysisOptions: AnalysisOptions = {
    ...DEFAULT_ANALYSIS_OPTIONS,
    ...options?.analysisOptions,
  }

  try {
    emitProgress(callbacks, jobId, 'file_scan', 5, '扫描项目文件...')
    const files = await scanFiles(projectPath)
    emitProgress(callbacks, jobId, 'file_scan', 15, `发现 ${files.length} 个文件`)

    const pkg = await readPackageJson(projectPath)
    const allDeps = {
      ...(pkg?.dependencies ?? {}),
      ...(pkg?.devDependencies ?? {}),
    }

    const projectType = await detectProjectType(projectPath, pkg, files)
    emitProgress(callbacks, jobId, 'route_detection', 20, `项目类型: ${projectType}`)

    emitProgress(callbacks, jobId, 'route_detection', 25, '检测路由与模块结构...')
    const routes = (projectType === 'nextjs-app' || projectType === 'nextjs-pages')
      ? detectRoutes(files, projectType)
      : []

    emitProgress(callbacks, jobId, 'import_analysis', 40, '分析模块依赖...')
    const dependencies = await parseImports(files, projectPath)

    emitProgress(callbacks, jobId, 'clustering', 55, '聚类功能模块...')
    const staticNodes = await clusterFiles({
      projectPath,
      projectType,
      files,
      routes,
      dependencies,
      packageDeps: allDeps,
      packageJson: pkg,
    })

    if (staticNodes.length === 0) {
      throw new Error('未能从项目中识别出可可视化的模块结构，请确认已打开包含源代码的项目文件夹。')
    }

    const projectName = pkg?.name ?? path.basename(projectPath)
    let nodes: FunctionalNode[] = staticNodes
    let edges = inferEdges(staticNodes, dependencies, routes)

    const aiTree = useAiTree(analysisOptions.profile, options?.llm)
    let aiTreeSucceeded = false
    let usedStaticFallback = false
    let analysisMeta: AnalysisMeta | undefined
    let analysisError: string | null = null

    if (aiTree && options?.llm && options.metricsService) {
      emitProgress(callbacks, jobId, 'entry_discovery', 60, '发现产品入口...')
      try {
        const aiResult = await buildAiFunctionTree({
          projectPath,
          projectName,
          projectType,
          profile: analysisOptions.profile,
          files,
          routes,
          staticNodes,
          packageJson: pkg,
          llm: options.llm,
          metricsService: options.metricsService,
          options: analysisOptions,
          onStage: (stage, message) => {
            emitProgress(callbacks, jobId, stage, stage === 'entry_discovery' ? 62 : stage === 'ai_pass1' ? 68 : 74, message)
          },
        })
        nodes = aiResult.nodes
        edges = aiResult.edges
        aiTreeSucceeded = true
        analysisMeta = {
          profile: analysisOptions.profile,
          pipeline: aiResult.pipeline,
          entryCount: aiResult.entryCount,
        }
        emitProgress(callbacks, jobId, 'ai_pass1', 75, 'AI 功能树构建完成')
      } catch (aiErr) {
        const msg = aiErr instanceof Error ? aiErr.message : String(aiErr)
        usedStaticFallback = true
        analysisError = `AI 功能树失败: ${msg}`
        emitProgress(callbacks, jobId, 'ai_function_tree', 75, analysisError)
        // standard/deep: do NOT fall back to enrichArchitectureWithLlm — it keeps mod_* ids (directory mirror)
        nodes = staticNodes
        edges = inferEdges(staticNodes, dependencies, routes)
      }
    } else if (options?.llm && options.metricsService) {
      emitProgress(callbacks, jobId, 'llm_enrichment', 82, 'AI 理解项目架构（语义命名与关系）...')
      try {
        const llmResult = await Promise.race([
          enrichArchitectureWithLlm({
            projectName,
            projectType,
            nodes: staticNodes,
            edges,
            llm: options.llm,
            metricsService: options.metricsService,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('AI 分析超时，已使用静态分析结果')), 45_000),
          ),
        ])
        nodes = llmResult.nodes
        edges = llmResult.edges
        emitProgress(callbacks, jobId, 'llm_enrichment', 88, 'AI 架构分析完成')
      } catch (llmErr) {
        const msg = llmErr instanceof Error ? llmErr.message : String(llmErr)
        emitProgress(callbacks, jobId, 'llm_enrichment', 88, `AI 分析跳过: ${msg}`)
      }
    }

    emitProgress(callbacks, jobId, 'edge_inference', 76, '推断模块关系...')
    if (!aiTreeSucceeded) {
      edges = inferEdges(nodes, dependencies, routes)
    }

    emitProgress(callbacks, jobId, 'graph_merge', 82, '合并历史节点标识...')
    const existing = await loadExistingGraph(projectPath)
    const skipMerge = aiTreeSucceeded && existing !== null
    const { nodes: mergedNodes, changelog: mergeChangelog } = skipMerge
      ? { nodes, changelog: [] as Awaited<ReturnType<typeof mergeGraphNodes>>['changelog'] }
      : mergeGraphNodes(existing, nodes)
    nodes = mergedNodes

    emitProgress(callbacks, jobId, 'finalize', 85, '构建架构拓扑...')
    let topologyNodes = enrichTopology(
      nodes.filter(n => n.id !== 'sys_root'),
      edges,
      projectName,
      { preserveHierarchy: aiTreeSucceeded },
    )

    if (!aiTreeSucceeded && analysisOptions.profile === 'quick') {
      topologyNodes = expandSubmoduleNodes(topologyNodes)
    }

    const topology = computeTopologyMeta(topologyNodes)

    emitProgress(callbacks, jobId, 'finalize', 90, '构建文件索引...')

    const projectId = existing?.projectId ?? projectOsUuid()

    const staticImportEdges = inferEdges(staticNodes, dependencies, routes).filter(e => e.relation === 'imports')
    const importEdges = aiTreeSucceeded
      ? staticImportEdges
      : edges.filter(e => e.relation === 'imports')
    const displayEdges = edges.filter(e => e.relation !== 'imports')

    const analysisStatus: ProjectGraph['analysisStatus'] =
      aiTreeSucceeded ? 'complete'
        : (usedStaticFallback || !options?.llm) ? 'partial'
          : 'complete'

    const graphWithoutIndex = {
      version: '0.3.0' as const,
      projectId,
      projectName,
      projectType,
      analyzedAt: new Date().toISOString(),
      analysisStatus,
      analysisError,
      topology,
      nodes: topologyNodes,
      edges: displayEdges,
      internalArchitecture: {
        importEdges,
        analyzedAt: new Date().toISOString(),
      },
      analysisMeta,
    }

    const fileIndex = buildFileIndex(graphWithoutIndex, files, dependencies)

    const graph: ProjectGraph = {
      ...graphWithoutIndex,
      fileIndex,
    }

    await saveGraph(projectPath, graph)
    for (const entry of mergeChangelog) {
      await appendChangelog(projectPath, entry)
    }

    emitProgress(callbacks, jobId, 'finalize', 100, '分析完成')
    callbacks.onComplete(graph)
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    callbacks.onError(error)
  }
}
