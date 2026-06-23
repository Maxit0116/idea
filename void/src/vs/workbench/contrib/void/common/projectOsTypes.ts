/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

// ═══ Graph Schema (Demo: R-D01) ══════════════════════════════════
// Inspired by Stello's session topology — nodes form a hierarchical
// graph with parent/child nesting and cross-references.

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
  // Topology (Stello-inspired)
  parentId: string | null
  children: string[]
  refs: string[]
  depth: number
  // Content
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
  | 'page' | 'component' | 'api' | 'lib'
  | 'config' | 'style' | 'test' | 'asset' | 'other'

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

// ═══ Analysis Jobs (Demo: R-D08) ═════════════════════════════════

export interface AnalysisProgress {
  jobId: string
  stage: AnalysisStage
  percent: number
  message: string
}

export type AnalysisStage =
  | 'file_scan' | 'route_detection' | 'import_analysis'
  | 'clustering' | 'edge_inference' | 'finalize'

export interface JobStatus {
  jobId: string
  status: 'queued' | 'analyzing' | 'clustering' | 'complete' | 'error'
  progress: number
  stage: string
  error: string | null
}

// ═══ Context (M1: R-M103) ════════════════════════════════════════

export interface NodeContext {
  nodeId: string
  nodeName: string
  description: string
  summary: string
  files: LinkedFile[]
  fileSummaries: FileSummary[]
  upstream: { id: string; name: string; summary: string }[]
  downstream: { id: string; name: string; summary: string }[]
  recentChanges: RecentChange[]
}

export interface FileSummary {
  path: string
  summary: string
  exports: string[]
  lineCount: number
}

export interface RecentChange {
  file: string
  type: 'modified' | 'added' | 'deleted'
  timestamp: string
}

export interface ProjectContext {
  projectName: string
  projectType: ProjectType
  nodeCount: number
  topNodes: { id: string; name: string }[]
  recentActivity: RecentChange[]
}

// ═══ Prompt Understanding (M2: R-M201) ═══════════════════════════

export interface UnderstandingCard {
  id: string
  nodeId: string
  originalPrompt: string
  understood: {
    action: string
    scope: string
    constraints: string[]
    affectedFiles: string[]
  }
  ambiguities: {
    question: string
    options: string[]
  }[]
  suggestions: {
    text: string
    reason: string
  }[]
  confidence: number
  timestamp: string
}

// ═══ Agent Execution (M2: R-M202) ════════════════════════════════

export interface ExecutionJob {
  jobId: string
  nodeId: string
  cardId: string
  status: ExecutionStatus
  steps: AgentStep[]
  result: ExecutionResult | null
  startedAt: string
  completedAt: string | null
}

export type ExecutionStatus =
  | 'pending' | 'understanding' | 'retrieving' | 'analyzing'
  | 'generating' | 'applying' | 'verifying' | 'complete' | 'error'

export interface AgentStep {
  id: string
  type: AgentStepType
  status: 'pending' | 'running' | 'complete' | 'error' | 'skipped'
  label: string
  detail: string
  input?: string
  output?: string
  startedAt: string | null
  completedAt: string | null
  filesInvolved: string[]
}

export type AgentStepType =
  | 'understand' | 'retrieve_context' | 'analyze_files'
  | 'generate_plan' | 'apply_changes' | 'verify'

export interface ExecutionResult {
  success: boolean
  filesChanged: { path: string; action: 'modified' | 'created' | 'deleted' }[]
  summary: string
  diff?: string
  nodeStatusUpdate?: NodeStatus
}

// ═══ Agent Flow Log (M2: R-M203/R-M204) ══════════════════════════

export interface AgentFlowLog {
  jobId: string
  nodeId: string
  steps: AgentStep[]
  status: ExecutionStatus
  startedAt: string
  completedAt: string | null
}

// ═══ Debug Context (M3: R-M301/R-M302) ═══════════════════════════

export interface DebugContext {
  errorId: string
  source: 'terminal' | 'compiler' | 'runtime'
  raw: string
  parsed: {
    message: string
    file: string | null
    line: number | null
    stack: string[]
  }
  relatedNodeId: string | null
  relatedFiles: string[]
  severity: 'error' | 'warning'
}

export interface BugFixJob {
  jobId: string
  errorId: string
  debugContext: DebugContext
  status: 'diagnosing' | 'fixing' | 'verifying' | 'complete' | 'error'
  rootCause: string | null
  fixSummary: string | null
  filesChanged: string[]
}

// ═══ Cloud (M3: R-M401–R-M405) ═══════════════════════════════════

export interface CloudConfig {
  enabled: boolean
  apiUrl: string
  authToken: string | null
}

export interface CloudAuthResponse {
  token: string
  expiresAt: string
  userId: string
}

// ═══ Project Memory (Stello-inspired SharedMemoryStore) ══════════
// Three-layer context: Project Memory (persistent) + Node Context
// (per-node) + Session Insight (ephemeral). Adapts Stello's
// systemPrompt/insight/memory slots to our function-map model.

export interface MemoryEntry {
  slug: string
  body: string
  category: MemoryCategory
  nodeId: string | null
  createdAt: string
  updatedAt: string
}

export type MemoryCategory =
  | 'project'    // project-level knowledge (architecture decisions, conventions)
  | 'node'       // per-node understanding (what this feature does, known issues)
  | 'session'    // ephemeral current-session insight (debugging trail, recent changes)
  | 'user'       // user preferences and habits

export interface MemoryStore {
  list(category?: MemoryCategory): Promise<MemoryEntry[]>
  get(slug: string): Promise<MemoryEntry | null>
  upsert(slug: string, body: string, category: MemoryCategory, nodeId?: string | null): Promise<void>
  remove(slug: string): Promise<void>
  listByNode(nodeId: string): Promise<MemoryEntry[]>
  renderContext(nodeId?: string): Promise<string>
}

// ═══ Topology Rendering ═════════════════════════════════════════
// Render the function map as structured context for LLM injection.
// Adapts Stello's renderTopologyMarkdown — the AI sees the map
// as a labeled tree with "← YOU ARE HERE" on the focused node.

export interface TopologyRenderOptions {
  focusNodeId?: string
  maxDepth?: number
  includeFiles?: boolean
  includeMemory?: boolean
}

// ═══ Engine Layers (Stello-inspired) ═════════════════════════════
// Refines our architecture into proper layers:
// AnalysisRunner → ProjectEngine → SessionOrchestrator → ProjectAgent

export interface ProjectEngine {
  analyze(projectPath: string): Promise<ProjectGraph>
  getGraph(): ProjectGraph | null
  getNodeContext(nodeId: string): Promise<NodeContext | null>
  getMemory(): MemoryStore
  renderTopology(options?: TopologyRenderOptions): string
}

export interface SessionOrchestrator {
  currentSessionId: string
  focusNodeId: string | null
  setFocus(nodeId: string | null): void
  getAssembledContext(): Promise<string>
}

// ═══ Branch Guard (Stello SplitGuard-inspired) ═══════════════════
// Controls when agent execution can branch into sub-tasks.

export interface BranchGuardConfig {
  minSteps: number
  cooldownSteps: number
}

export interface BranchCheckResult {
  canBranch: boolean
  reason?: string
}

// ═══ API Response Types ══════════════════════════════════════════

export interface GraphResponse {
  projectId: string
  projectName: string
  projectType: ProjectType
  analysisStatus: AnalysisStatus
  projectPath: string
  nodes: FunctionalNode[]
  edges: FunctionalEdge[]
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

// ═══ IPC Channels ════════════════════════════════════════════════

export const IPC = {
  // Demo
  ANALYZE: 'engine:analyze',
  GET_JOB_STATUS: 'engine:getJobStatus',
  GET_GRAPH: 'engine:getGraph',
  GET_NODE_DETAIL: 'engine:getNodeDetail',
  FILE_SAVED: 'engine:fileSaved',
  PROGRESS: 'engine:progress',
  COMPLETE: 'engine:complete',
  ERROR: 'engine:error',
  OPEN_PROJECT_DIALOG: 'dialog:openProject',
  // M1
  BUILD_CONTEXT: 'engine:buildContext',
  BUILD_PROJECT_CONTEXT: 'engine:buildProjectContext',
  // M2
  SUBMIT_PROMPT: 'engine:submitPrompt',
  CONFIRM_EXECUTION: 'engine:confirmExecution',
  GET_EXECUTION_STATUS: 'engine:getExecutionStatus',
  GET_AGENT_FLOW_LOG: 'engine:getAgentFlowLog',
  // Memory
  MEMORY_LIST: 'memory:list',
  MEMORY_GET: 'memory:get',
  MEMORY_UPSERT: 'memory:upsert',
  MEMORY_REMOVE: 'memory:remove',
  MEMORY_BY_NODE: 'memory:byNode',
  RENDER_TOPOLOGY: 'engine:renderTopology',
  GET_ASSEMBLED_CONTEXT: 'engine:getAssembledContext',
  // M3
  REPORT_ERROR: 'engine:reportError',
  BUILD_DEBUG_CONTEXT: 'engine:buildDebugContext',
  FIX_BUG: 'engine:fixBug',
} as const

// ═══ Project OS Service (Void integration) ═══════════════════════

export type ProjectOsAnalysisState =
  | { status: 'idle' }
  | { status: 'analyzing'; progress: AnalysisProgress }
  | { status: 'ready'; graph: GraphResponse }
  | { status: 'error'; message: string }

export interface ProjectOsSelection {
	nodeId: string | null
	detail: NodeDetailResponse | null
}

export interface IProjectOsService {
  readonly _serviceBrand: undefined
  readonly state: ProjectOsAnalysisState
  readonly selection: ProjectOsSelection
  readonly onDidChangeState: Event<ProjectOsAnalysisState>
  readonly onDidChangeSelection: Event<ProjectOsSelection>
  analyze(projectPath: string): Promise<void>
  tryLoadFromWorkspace(projectPath: string): Promise<boolean>
  getNodeDetail(projectId: string, nodeId: string): Promise<NodeDetailResponse | null>
  selectNode(projectId: string, nodeId: string): Promise<void>
  clearSelection(): void
}

export const IProjectOsService = createDecorator<IProjectOsService>('projectOsService')

export const PROJECT_OS_CHANNEL = 'void-channel-projectOs'
