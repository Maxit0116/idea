import * as fs from 'fs/promises'
import * as path from 'path'
import { v4 as uuid } from 'uuid'
import {
  scanFiles,
  readPackageJson,
  detectRoutes,
  parseImports,
  extractExports,
} from '../analyzer'
import { clusterFiles } from './clustering'
import { inferEdges } from './edge-inference'
import type {
  ProjectGraph,
  ProjectType,
  AnalysisProgress,
  AnalysisStage,
  FileEntry,
} from '../../shared/types'

// ── Types ───────────────────────────────────────────────────────

interface AnalysisCallbacks {
  onProgress: (progress: AnalysisProgress) => void
  onComplete: (graph: ProjectGraph) => void
  onError: (error: Error) => void
}

// ── Project Type Detection ──────────────────────────────────────

async function detectProjectType(
  projectPath: string,
  dependencies: Record<string, string>,
): Promise<ProjectType> {
  if (!dependencies['next']) {
    // Default to nextjs-app even without next dep (for analysis purposes)
    return 'nextjs-app'
  }

  // Check for App Router (app/ directory)
  try {
    const stat = await fs.stat(path.join(projectPath, 'app'))
    if (stat.isDirectory()) return 'nextjs-app'
  } catch {
    // Not found
  }

  // Check for Pages Router (pages/ directory)
  try {
    const stat = await fs.stat(path.join(projectPath, 'pages'))
    if (stat.isDirectory()) return 'nextjs-pages'
  } catch {
    // Not found
  }

  return 'nextjs-app'
}

// ── File Index Builder ──────────────────────────────────────────

function buildFileIndex(
  graph: Omit<ProjectGraph, 'fileIndex'>,
  files: Awaited<ReturnType<typeof scanFiles>>,
  dependencies: Awaited<ReturnType<typeof parseImports>>,
): FileEntry[] {
  // Build a map of node memberships per file
  const fileNodeMap = new Map<string, string[]>()
  for (const node of graph.nodes) {
    for (const linkedFile of node.linkedFiles) {
      const existing = fileNodeMap.get(linkedFile.path) ?? []
      existing.push(node.id)
      fileNodeMap.set(linkedFile.path, existing)
    }
  }

  // Build import/export maps
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

// ── Load Existing Graph ─────────────────────────────────────────

async function loadExistingGraph(
  projectPath: string,
): Promise<ProjectGraph | null> {
  const graphPath = path.join(projectPath, '.projectos', 'graph.json')
  try {
    const raw = await fs.readFile(graphPath, 'utf-8')
    return JSON.parse(raw) as ProjectGraph
  } catch {
    return null
  }
}

// ── Save Graph ──────────────────────────────────────────────────

async function saveGraph(
  projectPath: string,
  graph: ProjectGraph,
): Promise<void> {
  const dir = path.join(projectPath, '.projectos')
  await fs.mkdir(dir, { recursive: true })
  const graphPath = path.join(dir, 'graph.json')
  await fs.writeFile(graphPath, JSON.stringify(graph, null, 2), 'utf-8')
}

// ── Progress Helper ─────────────────────────────────────────────

function emitProgress(
  callbacks: AnalysisCallbacks,
  jobId: string,
  stage: AnalysisStage,
  percent: number,
  message: string,
): void {
  callbacks.onProgress({ jobId, stage, percent, message })
}

// ── Main Analysis Pipeline ──────────────────────────────────────

export async function analyzeProject(
  projectPath: string,
  jobId: string,
  callbacks: AnalysisCallbacks,
): Promise<void> {
  try {
    // Stage 1: File scan
    emitProgress(callbacks, jobId, 'file_scan', 5, '扫描项目文件...')
    const files = await scanFiles(projectPath)
    emitProgress(callbacks, jobId, 'file_scan', 15, `发现 ${files.length} 个文件`)

    // Read package.json
    const pkg = await readPackageJson(projectPath)
    const allDeps = {
      ...(pkg?.dependencies ?? {}),
      ...(pkg?.devDependencies ?? {}),
    }

    // Detect project type
    const projectType = await detectProjectType(projectPath, allDeps)

    // Stage 2: Route detection
    emitProgress(callbacks, jobId, 'route_detection', 25, '检测路由结构...')
    const routes = detectRoutes(files, projectType)

    // Stage 3: Import analysis
    emitProgress(callbacks, jobId, 'import_analysis', 40, '分析模块依赖...')
    const dependencies = await parseImports(files, projectPath)

    // Stage 4: Clustering
    emitProgress(callbacks, jobId, 'clustering', 55, '聚类功能模块...')
    const nodes = clusterFiles({
      files,
      routes,
      dependencies,
      packageDeps: allDeps,
    })

    // Stage 5: Edge inference
    emitProgress(callbacks, jobId, 'edge_inference', 75, '推断模块关系...')
    const edges = inferEdges(nodes, dependencies, routes)

    // Stage 6: Finalize
    emitProgress(callbacks, jobId, 'finalize', 90, '构建文件索引...')

    // Reuse existing projectId if available
    const existing = await loadExistingGraph(projectPath)
    const projectId = existing?.projectId ?? uuid()

    // Populate topology fields on nodes (Stello-inspired)
    for (const node of nodes) {
      if (!node.parentId) node.parentId = null
      if (!node.children) node.children = []
      if (!node.refs) node.refs = []
      if (!node.depth) node.depth = 0
    }

    const rootIds = nodes.filter(n => n.parentId === null).map(n => n.id)
    const maxDepth = Math.max(0, ...nodes.map(n => n.depth))

    const graphWithoutIndex = {
      version: '0.2.0' as const,
      projectId,
      projectName: pkg?.name ?? path.basename(projectPath),
      projectType,
      analyzedAt: new Date().toISOString(),
      analysisStatus: 'complete' as const,
      analysisError: null,
      topology: { rootIds, maxDepth, totalNodes: nodes.length },
      nodes,
      edges,
    }

    const fileIndex = buildFileIndex(graphWithoutIndex, files, dependencies)

    const graph: ProjectGraph = {
      ...graphWithoutIndex,
      fileIndex,
    }

    // Save to .projectos/graph.json
    await saveGraph(projectPath, graph)

    emitProgress(callbacks, jobId, 'finalize', 100, '分析完成')
    callbacks.onComplete(graph)
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    callbacks.onError(error)
  }
}
