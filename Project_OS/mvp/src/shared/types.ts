export interface ProjectGraph {
  version: '0.2.0'
  projectId: string
  projectName: string
  projectType: ProjectType
  analyzedAt: string
  analysisStatus: AnalysisStatus
  analysisError: string | null
  topology: TopologyMeta
  nodes: FunctionalNode[]
  edges: FunctionalEdge[]
  fileIndex: FileEntry[]
}

export interface TopologyMeta {
  rootIds: string[]
  maxDepth: number
  totalNodes: number
}

export type ProjectType = 'nextjs-app' | 'nextjs-pages'
export type AnalysisStatus = 'complete' | 'partial' | 'error'

export interface FunctionalNode {
  id: string
  type: NodeType
  name: string
  nameEn: string
  status: NodeStatus
  description: string
  summary: string
  parentId: string | null
  children: string[]
  refs: string[]
  depth: number
  linkedFiles: LinkedFile[]
  upstream: string[]
  downstream: string[]
  preview: NodePreview | null
  confidence: number
  tags: string[]
}

export type NodeType = 'capability' | 'suggested'
export type NodeStatus = 'active' | 'in_progress' | 'error' | 'suggested'

export interface LinkedFile {
  path: string
  role: FileRole
  summary?: string
}

export type FileRole = 'primary' | 'supporting' | 'config' | 'test'

export interface NodePreview {
  route: string | null
  thumbnail: string | null
}

export interface FunctionalEdge {
  id: string
  source: string
  target: string
  relation: EdgeRelation
  confidence: number
  evidence?: string
}

export type EdgeRelation =
  | 'depends_on'
  | 'redirects_to'
  | 'data_flows_to'
  | 'imports'
  | 'shares_data'

export interface FileEntry {
  path: string
  type: FileType
  nodeIds: string[]
  imports: string[]
  exports: string[]
  size: number
  lastModified: string
}

export type FileType =
  | 'page'
  | 'component'
  | 'api'
  | 'lib'
  | 'config'
  | 'style'
  | 'test'
  | 'asset'
  | 'other'

export interface RouteEntry {
  urlPath: string
  filePath: string
  type: 'page' | 'api' | 'layout' | 'middleware' | 'loading' | 'error'
  isDynamic: boolean
  params: string[]
}

export interface DependencyEntry {
  source: string
  target: string
  type: 'import' | 'dynamic_import' | 'require'
}

export interface AnalysisProgress {
  jobId: string
  stage:
    | 'file_scan'
    | 'route_detection'
    | 'import_analysis'
    | 'clustering'
    | 'edge_inference'
    | 'finalize'
  percent: number
  message: string
}

export interface GraphResponse {
  projectId: string
  projectName: string
  projectType: ProjectType
  analysisStatus: AnalysisStatus
  topology: TopologyMeta
  nodes: FunctionalNode[]
  edges: FunctionalEdge[]
  fileIndex: FileEntry[]
}

export interface NodeDetailResponse {
  id: string
  name: string
  nameEn: string
  status: NodeStatus
  description: string
  summary: string
  files: LinkedFile[]
  upstream: { id: string; name: string }[]
  downstream: { id: string; name: string }[]
  preview: NodePreview | null
  tags: string[]
}

export interface AnalyzeResult {
  success: boolean
  jobId?: string
  projectId?: string
  error?: { code: string; message: string }
}

export interface JobStatus {
  jobId: string
  status: 'queued' | 'analyzing' | 'clustering' | 'complete' | 'error'
  progress: number
  stage: string
  error: string | null
}

// ═══ Memory (Stello-inspired) ══════════════════════════════════

export interface MemoryEntry {
  slug: string
  body: string
  category: MemoryCategory
  nodeId: string | null
  createdAt: string
  updatedAt: string
}

export type MemoryCategory =
  | 'project'
  | 'node'
  | 'session'
  | 'user'

export interface MemoryStore {
  list(category?: MemoryCategory): Promise<MemoryEntry[]>
  get(slug: string): Promise<MemoryEntry | null>
  upsert(slug: string, body: string, category: MemoryCategory, nodeId?: string | null): Promise<void>
  remove(slug: string): Promise<void>
  listByNode(nodeId: string): Promise<MemoryEntry[]>
  renderContext(nodeId?: string): Promise<string>
}

// ═══ Topology Rendering ═════════════════════════════════════════

export interface TopologyRenderOptions {
  focusNodeId?: string
  maxDepth?: number
  includeFiles?: boolean
  includeMemory?: boolean
}

// ═══ C4 Navigation ══════════════════════════════════════════════

export type C4Level = 'system' | 'container' | 'component' | 'code'

export interface BreadcrumbEntry {
  level: C4Level
  label: string
  id: string
}

export interface NavigationState {
  level: C4Level
  path: BreadcrumbEntry[]
  focusId: string | null
}

// ═══ IPC Channels ════════════════════════════════════════════════

export const IPC = {
  ANALYZE: 'engine:analyze',
  GET_JOB_STATUS: 'engine:getJobStatus',
  GET_GRAPH: 'engine:getGraph',
  GET_NODE_DETAIL: 'engine:getNodeDetail',
  FILE_SAVED: 'engine:fileSaved',
  PROGRESS: 'engine:progress',
  COMPLETE: 'engine:complete',
  ERROR: 'engine:error',
  OPEN_PROJECT_DIALOG: 'dialog:openProject',
  MEMORY_LIST: 'memory:list',
  MEMORY_GET: 'memory:get',
  MEMORY_UPSERT: 'memory:upsert',
  MEMORY_REMOVE: 'memory:remove',
  MEMORY_BY_NODE: 'memory:byNode',
  RENDER_TOPOLOGY: 'engine:renderTopology',
  GET_ASSEMBLED_CONTEXT: 'engine:getAssembledContext',
} as const
