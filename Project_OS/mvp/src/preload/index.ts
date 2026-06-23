import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/types'
import type {
  AnalysisProgress, GraphResponse, NodeDetailResponse,
  AnalyzeResult, JobStatus, MemoryEntry
} from '../shared/types'

const api = {
  openProjectDialog: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC.OPEN_PROJECT_DIALOG),

  analyze: (projectPath: string): Promise<AnalyzeResult> =>
    ipcRenderer.invoke(IPC.ANALYZE, projectPath),

  getJobStatus: (jobId: string): Promise<JobStatus | null> =>
    ipcRenderer.invoke(IPC.GET_JOB_STATUS, jobId),

  getGraph: (projectId: string): Promise<GraphResponse> =>
    ipcRenderer.invoke(IPC.GET_GRAPH, projectId),

  getNodeDetail: (nodeId: string): Promise<NodeDetailResponse> =>
    ipcRenderer.invoke(IPC.GET_NODE_DETAIL, nodeId),

  // Memory
  memoryList: (category?: string): Promise<MemoryEntry[]> =>
    ipcRenderer.invoke(IPC.MEMORY_LIST, category),

  memoryGet: (slug: string): Promise<MemoryEntry | null> =>
    ipcRenderer.invoke(IPC.MEMORY_GET, slug),

  memoryUpsert: (slug: string, body: string, category: string, nodeId?: string): Promise<void> =>
    ipcRenderer.invoke(IPC.MEMORY_UPSERT, slug, body, category, nodeId),

  memoryRemove: (slug: string): Promise<void> =>
    ipcRenderer.invoke(IPC.MEMORY_REMOVE, slug),

  memoryByNode: (nodeId: string): Promise<MemoryEntry[]> =>
    ipcRenderer.invoke(IPC.MEMORY_BY_NODE, nodeId),

  // Topology
  renderTopology: (projectId: string, focusNodeId?: string): Promise<string> =>
    ipcRenderer.invoke(IPC.RENDER_TOPOLOGY, projectId, focusNodeId),

  getAssembledContext: (projectId: string, nodeId?: string): Promise<string> =>
    ipcRenderer.invoke(IPC.GET_ASSEMBLED_CONTEXT, projectId, nodeId),

  // Events
  onProgress: (callback: (progress: AnalysisProgress) => void): (() => void) => {
    const handler = (_event: any, progress: AnalysisProgress) => callback(progress)
    ipcRenderer.on(IPC.PROGRESS, handler)
    return () => ipcRenderer.removeListener(IPC.PROGRESS, handler)
  },

  onComplete: (callback: (data: { jobId: string; projectId: string; graph: GraphResponse }) => void): (() => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on(IPC.COMPLETE, handler)
    return () => ipcRenderer.removeListener(IPC.COMPLETE, handler)
  },

  onError: (callback: (data: { jobId: string; error: string }) => void): (() => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on(IPC.ERROR, handler)
    return () => ipcRenderer.removeListener(IPC.ERROR, handler)
  }
}

contextBridge.exposeInMainWorld('projectOS', api)

export type ProjectOSApi = typeof api
