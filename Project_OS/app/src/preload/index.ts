import { contextBridge, ipcRenderer } from 'electron'
import type {
  AnalysisProgress,
  AnalyzeResult,
  JobStatus,
  GraphResponse,
  NodeDetailResponse,
  NodeContext,
  ProjectContext,
  DebugContext,
} from '../shared/types'
import { IPC } from '../shared/types'

const api = {
  engine: {
    openProjectDialog: (): Promise<string | null> =>
      ipcRenderer.invoke(IPC.OPEN_PROJECT_DIALOG),

    analyze: (projectPath: string): Promise<AnalyzeResult> =>
      ipcRenderer.invoke(IPC.ANALYZE, projectPath),

    getJobStatus: (jobId: string): Promise<JobStatus | null> =>
      ipcRenderer.invoke(IPC.GET_JOB_STATUS, jobId),

    getGraph: (projectId: string): Promise<GraphResponse | null> =>
      ipcRenderer.invoke(IPC.GET_GRAPH, projectId),

    getNodeDetail: (projectId: string, nodeId: string): Promise<NodeDetailResponse | null> =>
      ipcRenderer.invoke(IPC.GET_NODE_DETAIL, projectId, nodeId),

    fileSaved: (projectId: string, filePath: string): Promise<void> =>
      ipcRenderer.invoke(IPC.FILE_SAVED, projectId, filePath),

    // M1
    buildContext: (projectId: string, nodeId: string): Promise<NodeContext | null> =>
      ipcRenderer.invoke(IPC.BUILD_CONTEXT, projectId, nodeId),

    buildProjectContext: (projectId: string): Promise<ProjectContext | null> =>
      ipcRenderer.invoke(IPC.BUILD_PROJECT_CONTEXT, projectId),

    // M2
    submitPrompt: (projectId: string, nodeId: string, prompt: string): Promise<any> =>
      ipcRenderer.invoke(IPC.SUBMIT_PROMPT, projectId, nodeId, prompt),

    confirmExecution: (cardId: string): Promise<any> =>
      ipcRenderer.invoke(IPC.CONFIRM_EXECUTION, cardId),

    getExecutionStatus: (jobId: string): Promise<any> =>
      ipcRenderer.invoke(IPC.GET_EXECUTION_STATUS, jobId),

    getAgentFlowLog: (jobId: string): Promise<any> =>
      ipcRenderer.invoke(IPC.GET_AGENT_FLOW_LOG, jobId),

    // M3
    reportError: (raw: string): Promise<DebugContext> =>
      ipcRenderer.invoke(IPC.REPORT_ERROR, raw),

    buildDebugContext: (errorId: string): Promise<any> =>
      ipcRenderer.invoke(IPC.BUILD_DEBUG_CONTEXT, errorId),

    fixBug: (errorId: string): Promise<any> =>
      ipcRenderer.invoke(IPC.FIX_BUG, errorId),

    // Event listeners
    onProgress: (callback: (progress: AnalysisProgress) => void) => {
      const handler = (_event: any, progress: AnalysisProgress) => callback(progress)
      ipcRenderer.on(IPC.PROGRESS, handler)
      return () => ipcRenderer.removeListener(IPC.PROGRESS, handler)
    },

    onComplete: (callback: (data: { jobId: string; projectId: string }) => void) => {
      const handler = (_event: any, data: { jobId: string; projectId: string }) => callback(data)
      ipcRenderer.on(IPC.COMPLETE, handler)
      return () => ipcRenderer.removeListener(IPC.COMPLETE, handler)
    },

    onError: (callback: (data: { jobId: string; code: string; message: string }) => void) => {
      const handler = (_event: any, data: { jobId: string; code: string; message: string }) => callback(data)
      ipcRenderer.on(IPC.ERROR, handler)
      return () => ipcRenderer.removeListener(IPC.ERROR, handler)
    },
  },
}

contextBridge.exposeInMainWorld('projectOS', api)

export type ProjectOSApi = typeof api
