import { mkdir, writeFile, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { existsSync } from 'fs'
import { v4 as uuid } from 'uuid'
import type {
  ProjectGraph, ProjectType, FileEntry, FunctionalNode,
  FunctionalEdge, RouteEntry, DependencyEntry, AnalysisProgress
} from '../../shared/types'
import { scanFiles, readPackageJson, type ScannedFile } from './file-scanner'
import { detectRoutes } from './route-detector'
import { parseImports, extractExports } from './import-parser'
import { clusterFiles } from './clustering'
import { inferEdges } from './edge-inference'

export interface AnalysisCallbacks {
  onProgress: (progress: AnalysisProgress) => void
  onComplete: (graph: ProjectGraph) => void
  onError: (error: string) => void
}

export async function analyzeProject(
  projectPath: string,
  jobId: string,
  callbacks: AnalysisCallbacks
): Promise<void> {
  try {
    callbacks.onProgress({
      jobId, stage: 'file_scan', percent: 5, message: '扫描文件...'
    })

    const files = await scanFiles(projectPath)
    if (files.length === 0) {
      callbacks.onError('未检测到源代码文件')
      return
    }

    callbacks.onProgress({
      jobId, stage: 'file_scan', percent: 15, message: `发现 ${files.length} 个文件`
    })

    const pkg = await readPackageJson(projectPath)
    if (!pkg) {
      callbacks.onError('缺少 package.json')
      return
    }

    const projectType = detectProjectType(files, pkg)
    if (!projectType) {
      callbacks.onError('当前仅支持 Next.js 项目')
      return
    }

    callbacks.onProgress({
      jobId, stage: 'route_detection', percent: 25, message: '检测路由...'
    })

    const routes = detectRoutes(files, projectType)

    callbacks.onProgress({
      jobId, stage: 'import_analysis', percent: 40, message: '分析依赖关系...'
    })

    const dependencies = parseImports(files, projectPath)

    callbacks.onProgress({
      jobId, stage: 'clustering', percent: 55, message: 'AI 分析功能结构...'
    })

    const nodes = clusterFiles({
      files,
      routes,
      dependencies,
      packageDeps: { ...pkg.dependencies, ...pkg.devDependencies }
    })

    callbacks.onProgress({
      jobId, stage: 'edge_inference', percent: 75, message: '推断功能关系...'
    })

    const edges = inferEdges(nodes, dependencies, routes)

    callbacks.onProgress({
      jobId, stage: 'finalize', percent: 90, message: '生成功能地图...'
    })

    const fileIndex = buildFileIndex(files, nodes)

    let projectId: string
    const existingGraph = await loadExistingGraph(projectPath)
    if (existingGraph) {
      projectId = existingGraph.projectId
    } else {
      projectId = uuid()
    }

    for (const node of nodes) {
      if (!node.parentId) node.parentId = null
      if (!node.children) node.children = []
      if (!node.refs) node.refs = []
      if (!node.depth) node.depth = 0
    }

    const rootIds = nodes.filter(n => n.parentId === null).map(n => n.id)
    const maxDepth = Math.max(0, ...nodes.map(n => n.depth))

    const graph: ProjectGraph = {
      version: '0.2.0',
      projectId,
      projectName: pkg.name,
      projectType,
      analyzedAt: new Date().toISOString(),
      analysisStatus: 'complete',
      analysisError: null,
      topology: { rootIds, maxDepth, totalNodes: nodes.length },
      nodes,
      edges,
      fileIndex
    }

    await saveGraph(projectPath, graph)

    callbacks.onProgress({
      jobId, stage: 'finalize', percent: 100, message: '分析完成'
    })

    callbacks.onComplete(graph)
  } catch (err: any) {
    callbacks.onError(err.message || '分析过程中出现未知错误')
  }
}

function detectProjectType(
  files: ScannedFile[],
  pkg: { dependencies: Record<string, string> }
): ProjectType | null {
  if (!pkg.dependencies['next'] && !pkg.dependencies['next']) return null

  const hasAppDir = files.some((f) => {
    const p = f.relativePath.replace(/\\/g, '/')
    return p.match(/^(src\/)?app\/.*page\.(tsx?|jsx?)$/)
  })

  if (hasAppDir) return 'nextjs-app'

  const hasPagesDir = files.some((f) => {
    const p = f.relativePath.replace(/\\/g, '/')
    return p.match(/^(src\/)?pages\/.*\.(tsx?|jsx?)$/)
  })

  if (hasPagesDir) return 'nextjs-pages'

  return 'nextjs-app'
}

function buildFileIndex(files: ScannedFile[], nodes: FunctionalNode[]): FileEntry[] {
  const fileToNodes = new Map<string, string[]>()
  for (const node of nodes) {
    for (const lf of node.linkedFiles) {
      if (!fileToNodes.has(lf.path)) fileToNodes.set(lf.path, [])
      fileToNodes.get(lf.path)!.push(node.id)
    }
  }

  return files
    .filter((f) => f.content !== undefined)
    .map((f) => ({
      path: f.relativePath,
      type: f.type,
      nodeIds: fileToNodes.get(f.relativePath) || [],
      imports: [], // populated by import-parser if needed
      exports: f.content ? extractExports(f.content) : [],
      size: f.size,
      lastModified: f.lastModified
    }))
}

async function saveGraph(projectPath: string, graph: ProjectGraph): Promise<void> {
  const dir = join(projectPath, '.projectos')
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
  await writeFile(join(dir, 'graph.json'), JSON.stringify(graph, null, 2), 'utf-8')
}

async function loadExistingGraph(projectPath: string): Promise<ProjectGraph | null> {
  try {
    const raw = await readFile(join(projectPath, '.projectos', 'graph.json'), 'utf-8')
    return JSON.parse(raw) as ProjectGraph
  } catch {
    return null
  }
}
