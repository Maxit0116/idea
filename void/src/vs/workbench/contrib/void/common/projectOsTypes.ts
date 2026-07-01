/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import type { ChatMode, ModelSelection, ModelSelectionOptions, OverridesOfModel, SettingsOfProvider } from './voidSettingsTypes.js';

// ═══ Graph Schema (Demo: R-D01) ══════════════════════════════════
// Inspired by Stello's session topology — nodes form a hierarchical
// graph with parent/child nesting and cross-references.

export type GraphVersion = '0.2.0' | '0.3.0'

const STALE_NODE_ID_PATTERN = /^(mod_|static_|contrib_)/

/** True when cached graph is directory-mirror era (v0.2.0 or majority mod_/static_/contrib_ ids). */
export function isStaleFunctionMapGraph(graph: Pick<ProjectGraph, 'version' | 'nodes'>): boolean {
  if (graph.version < '0.3.0') {
    return true
  }
  const featureNodes = graph.nodes.filter(n => n.id !== 'sys_root')
  if (featureNodes.length === 0) {
    return false
  }
  const staleCount = featureNodes.filter(n => STALE_NODE_ID_PATTERN.test(n.id)).length
  return staleCount / featureNodes.length > 0.5
}

export interface ProjectGraph {
  version: GraphVersion
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
  /** Technical dependency graph (AI-only, not rendered on Function Map) */
  internalArchitecture?: {
    importEdges: FunctionalEdge[]
    analyzedAt: string
  }
  analysisMeta?: AnalysisMeta
}

export interface TopologyMeta {
  rootIds: string[]
  maxDepth: number
  totalNodes: number
}

export type ProjectType = 'nextjs-app' | 'nextjs-pages' | 'react-spa' | 'vscode-fork' | 'monorepo' | 'generic'
export type AnalysisStatus = 'complete' | 'partial' | 'error'

export type AnalysisProfile = 'quick' | 'standard' | 'deep'

export type TokenBudget = number | 'unlimited'

export type CrossBranchEdgeMode = 'always' | 'on-select' | 'never'

export type ArchitectureGuardMode = 'off' | 'warn' | 'block'

export type NodeGranularity = 'project' | 'module' | 'feature' | 'subfeature' | 'unit'

export type AnchorSymbolKind = 'function' | 'class' | 'component' | 'hook' | 'module' | 'block'

export interface CodeAnchor {
  path: string
  startLine: number
  endLine: number
  symbolName?: string
  symbolKind?: AnchorSymbolKind
  role: FileRole
  summary?: string
}

export interface NodeLineage {
  slug: string
  aliases: string[]
  createdBy: 'static' | 'ai' | 'user'
  createdAt: string
}

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
  anchors?: CodeAnchor[]
  granularity?: NodeGranularity
  lineage?: NodeLineage
  crossRefs?: string[]
  sourceClusterIds?: string[]
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

export type FileRole = 'primary' | 'core' | 'api' | 'supporting' | 'config' | 'test'

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
  | 'clustering' | 'edge_inference' | 'llm_enrichment'
  | 'entry_discovery' | 'ai_pass1' | 'ai_pass2'
  | 'ai_function_tree' | 'anchor_validation' | 'graph_merge' | 'finalize'

export interface AnalysisMeta {
  profile: AnalysisProfile
  pipeline: 'static' | 'entry_driven' | 'ai_pass1' | 'ai_pass2'
  entryCount: number
}

export interface AnalysisOptions {
  profile: AnalysisProfile
  tokenBudget: TokenBudget
  lazyRefinement: boolean
  maxUnitNodesPerFeature?: number
}

export const DEFAULT_ANALYSIS_OPTIONS: AnalysisOptions = {
  profile: 'standard',
  tokenBudget: 'unlimited',
	lazyRefinement: false,
  maxUnitNodesPerFeature: 20,
}

export interface GraphChangelogEntry {
  at: string
  fromId?: string
  toId: string
  reason: 'reanalyze' | 'user_edit' | 'ai_refine' | 'merge' | 'split'
  note?: string
}

export type GraphEditType = 'rename' | 'merge' | 'delete' | 'reparent' | 'update_anchors'

export interface GraphEdit {
  type: GraphEditType
  nodeId: string
  targetNodeId?: string
  newParentId?: string
  name?: string
  nameEn?: string
  anchors?: CodeAnchor[]
}

export type GuardSeverity = 'ok' | 'warning' | 'critical'

export interface GuardAlternative {
  label: string
  description: string
  patch: GraphEdit
}

export interface ValidateEditResponse {
  allowed: boolean
  severity: GuardSeverity
  impacts: string[]
  alternatives: GuardAlternative[]
}

export interface RefineNodeResponse {
  suggestions: GuardAlternative[]
}

export interface ApplyGraphEditResponse {
  success: boolean
  graph?: GraphResponse
  validation?: ValidateEditResponse
  error?: string
}

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
  routes: string[]
  apis: string[]
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
  topNodes: { id: string; name: string; summary: string }[]
  recentActivity: RecentChange[]
  topologySummary: string
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
  version?: GraphVersion
  analysisStatus: AnalysisStatus
  analysisError?: string | null
  analysisMeta?: AnalysisMeta
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
  anchors?: CodeAnchor[]
  granularity?: NodeGranularity
  lineage?: NodeLineage
  crossRefs?: string[]
  upstream: { id: string; name: string }[]
  downstream: { id: string; name: string }[]
  preview: NodePreview | null
  tags: string[]
  routes: string[]
  apis: string[]
}

export interface ProjectDetailResponse {
  projectId: string
  projectName: string
  projectType: ProjectType
  moduleCount: number
  topModules: { id: string; name: string; fileCount: number }[]
  topologySummary: string
  analysisMeta?: AnalysisMeta
  analysisStatus?: AnalysisStatus
  analysisError?: string | null
  graphVersion?: GraphVersion
}

/** Registry key for project-level chat thread (sys_root) */
export const PROJECT_NODE_KEY = '__project__'

/** Binds a Void chat thread to a Function Map node or project root */
export interface FunctionMapThreadBinding {
  projectId: string
  nodeKey: string
  level: 'node' | 'project'
  label: string
  nodeId: string | null
}

/** Formal buildContext response (R-M103) */
export interface BuildContextResponse {
  level: 'node' | 'project'
  context: NodeContext | ProjectContext
  markdown: string
  primaryFilePaths: string[]
}

export interface SelectNodeContextResponse {
  detail: NodeDetailResponse | null
  pack: BuildContextResponse | null
  projectDetail?: ProjectDetailResponse | null
}

export interface SubmitPromptResponse {
  stub: true
  nodeId: string
  accepted: boolean
  message: string
}

/** Injected into AI Chat when a Function Map node or project root is selected */
export interface ProjectOsChatContext {
  level: 'project' | 'node'
  label: string
  nodeId: string | null
  markdown: string
  primaryFilePaths: string[]
  summary?: string
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
  // Function Map v0.3
  EXPAND_NODE_ANALYSIS: 'engine:expandNodeAnalysis',
  REFINE_NODE: 'engine:refineNode',
  VALIDATE_EDIT: 'engine:validateEdit',
  GET_CHANGELOG: 'engine:getChangelog',
  EXPORT_CHANGELOG: 'engine:exportChangelog',
  APPLY_GRAPH_EDIT: 'engine:applyGraphEdit',
  RESOLVE_NODE_ID: 'engine:resolveNodeId',
} as const

// ═══ Project OS Service (Void integration) ═══════════════════════

export type ProjectOsAnalysisState =
  | { status: 'idle' }
  | { status: 'analyzing'; progress: AnalysisProgress }
  | { status: 'ready'; graph: GraphResponse }
  | { status: 'error'; message: string }

export interface ProjectOsSelection {
	nodeId: string | null
	level: 'none' | 'project' | 'node'
	detail: NodeDetailResponse | null
	projectDetail: ProjectDetailResponse | null
}

export interface ProjectOsAnalyzeLlmConfig {
	modelSelection: ModelSelection
	settingsOfProvider: SettingsOfProvider
	modelSelectionOptions: ModelSelectionOptions | undefined
	overridesOfModel: OverridesOfModel
	chatMode: ChatMode
}

export interface ProjectOsAnalyzeRequest {
	projectPath: string
	jobId: string
	llm?: ProjectOsAnalyzeLlmConfig
	options?: AnalysisOptions
}

export interface IProjectOsService {
  readonly _serviceBrand: undefined
  readonly state: ProjectOsAnalysisState
  readonly selection: ProjectOsSelection
  readonly chatContext: ProjectOsChatContext | null
  readonly expandedNodeIds: ReadonlySet<string>
  readonly focusNodeId: string | null
  readonly onDidChangeState: Event<ProjectOsAnalysisState>
  readonly onDidChangeSelection: Event<ProjectOsSelection>
  readonly onDidChangeChatContext: Event<ProjectOsChatContext | null>
  readonly onDidChangeExpandedNodes: Event<ReadonlySet<string>>
  readonly onDidChangeFocusNode: Event<string | null>
  analyze(projectPath: string, options?: AnalysisOptions): Promise<void>
  tryLoadFromWorkspace(projectPath: string): Promise<boolean>
  /** Load cached graph or run analysis when none exists. */
  loadOrAnalyzeWorkspace(projectPath: string): Promise<void>
  scheduleReanalyze(projectPath: string): void
  expandNodeAnalysis(projectId: string, nodeId: string): Promise<void>
  refineNode(projectId: string, nodeId: string): Promise<RefineNodeResponse>
  validateGraphEdit(projectId: string, edit: GraphEdit): Promise<ValidateEditResponse>
  applyGraphEdit(projectId: string, edit: GraphEdit, force?: boolean): Promise<ApplyGraphEditResponse>
  getChangelog(projectId: string, nodeId?: string): Promise<GraphChangelogEntry[]>
  exportChangelog(projectId: string): Promise<string>
  resolveNodeId(projectId: string, nodeIdOrAlias: string): Promise<string | null>
  getNodeDetail(projectId: string, nodeId: string): Promise<NodeDetailResponse | null>
  selectNode(projectId: string, nodeId: string): Promise<void>
  selectProject(projectId: string): Promise<void>
  /** M2 stub: validate nodeId against current thread binding */
  submitPrompt(nodeId: string, text: string): Promise<SubmitPromptResponse>
  clearSelection(): void
  toggleNodeExpanded(nodeId: string): void
  collapseAllNodes(): void
  isNodeExpanded(nodeId: string): boolean
  /** Drill-down: show map centered on this node (null = project overview). */
  setFocusNode(nodeId: string | null): void
  drillIntoNode(nodeId: string): void
  navigateFocusUp(): void
}

export const IProjectOsService = createDecorator<IProjectOsService>('projectOsService')

export const PROJECT_OS_CHANNEL = 'void-channel-projectOs'
