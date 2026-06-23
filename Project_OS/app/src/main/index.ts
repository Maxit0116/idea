import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import { v4 as uuid } from 'uuid'
import { is } from '@electron-toolkit/utils'
import { analyzeProject } from './engine/graph/builder'
import { renderTopologyMarkdown } from './engine/graph/topology-render'
import { buildNodeContext, buildProjectContext } from './engine/context'
import { buildDebugContext, createBugFixJob, diagnoseBug } from './engine/debug'
import { createJob, getJob, updateJob, completeJob, failJob } from './engine/jobs'
import { FileMemoryStore } from './engine/memory'
import type {
  ProjectGraph,
  AnalysisProgress,
  JobStatus,
  GraphResponse,
  NodeDetailResponse,
  AnalyzeResult,
  IPC as IPCType,
  BugFixJob,
} from '../shared/types'
import { IPC } from '../shared/types'

const graphs = new Map<string, ProjectGraph>()
const bugFixJobs = new Map<string, BugFixJob>()
let memoryStore: FileMemoryStore | null = null

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

function registerIpcHandlers(): void {
  // ═══ Demo APIs ═══════════════════════════════════════════════════

  ipcMain.handle(IPC.OPEN_PROJECT_DIALOG, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Open Project',
      buttonLabel: 'Analyze',
    })
    if (result.canceled || !result.filePaths[0]) return null
    return result.filePaths[0]
  })

  ipcMain.handle(IPC.ANALYZE, async (event, projectPath: string): Promise<AnalyzeResult> => {
    const jobId = uuid()
    const win = BrowserWindow.fromWebContents(event.sender)

    createJob(jobId)

    analyzeProject(projectPath, jobId, {
      onProgress(progress: AnalysisProgress) {
        updateJob(jobId, {
          status: 'analyzing',
          progress: progress.percent,
          stage: progress.stage,
        })
        win?.webContents.send(IPC.PROGRESS, progress)
      },
      async onComplete(graph: ProjectGraph) {
        graphs.set(graph.projectId, graph)
        // Initialize memory store for this project
        const memPath = join(projectPath, '.projectos', 'memory.json')
        memoryStore = new FileMemoryStore(memPath)
        await memoryStore.load()

        completeJob(jobId)
        win?.webContents.send(IPC.COMPLETE, {
          jobId,
          projectId: graph.projectId,
        })
      },
      onError(error: Error) {
        failJob(jobId, error.message)
        win?.webContents.send(IPC.ERROR, {
          jobId,
          code: 'ANALYSIS_FAILED',
          message: error.message,
        })
      },
    })

    return { success: true, jobId }
  })

  ipcMain.handle(IPC.GET_JOB_STATUS, async (_event, jobId: string): Promise<JobStatus | null> => {
    return getJob(jobId)
  })

  ipcMain.handle(IPC.GET_GRAPH, async (_event, projectId: string): Promise<GraphResponse | null> => {
    const graph = graphs.get(projectId)
    if (!graph) return null
    return {
      projectId: graph.projectId,
      projectName: graph.projectName,
      projectType: graph.projectType,
      analysisStatus: graph.analysisStatus,
      nodes: graph.nodes,
      edges: graph.edges,
    }
  })

  ipcMain.handle(IPC.GET_NODE_DETAIL, async (_event, projectId: string, nodeId: string): Promise<NodeDetailResponse | null> => {
    const graph = graphs.get(projectId)
    if (!graph) return null
    const node = graph.nodes.find(n => n.id === nodeId)
    if (!node) return null
    return {
      id: node.id,
      name: node.name,
      nameEn: node.nameEn,
      status: node.status,
      description: node.description,
      summary: node.summary,
      files: node.linkedFiles,
      upstream: node.upstream
        .map(id => graph.nodes.find(n => n.id === id))
        .filter(Boolean)
        .map(n => ({ id: n!.id, name: n!.name })),
      downstream: node.downstream
        .map(id => graph.nodes.find(n => n.id === id))
        .filter(Boolean)
        .map(n => ({ id: n!.id, name: n!.name })),
      preview: node.preview,
      tags: node.tags,
    }
  })

  ipcMain.handle(IPC.FILE_SAVED, async (_event, projectId: string, filePath: string) => {
    // Demo: no-op. M1 will trigger incremental re-index.
    return { acknowledged: true }
  })

  // ═══ M1 Context APIs ═════════════════════════════════════════════

  ipcMain.handle(IPC.BUILD_CONTEXT, async (_event, projectId: string, nodeId: string) => {
    const graph = graphs.get(projectId)
    if (!graph) return null
    return buildNodeContext(graph, nodeId)
  })

  ipcMain.handle(IPC.BUILD_PROJECT_CONTEXT, async (_event, projectId: string) => {
    const graph = graphs.get(projectId)
    if (!graph) return null
    return buildProjectContext(graph)
  })

  // ═══ Memory APIs (Stello-inspired) ════════════════════════════════

  ipcMain.handle(IPC.MEMORY_LIST, async (_event, category?: string) => {
    if (!memoryStore) return []
    return memoryStore.list(category as any)
  })

  ipcMain.handle(IPC.MEMORY_GET, async (_event, slug: string) => {
    if (!memoryStore) return null
    return memoryStore.get(slug)
  })

  ipcMain.handle(IPC.MEMORY_UPSERT, async (_event, slug: string, body: string, category: string, nodeId?: string) => {
    if (!memoryStore) return
    return memoryStore.upsert(slug, body, category as any, nodeId)
  })

  ipcMain.handle(IPC.MEMORY_REMOVE, async (_event, slug: string) => {
    if (!memoryStore) return
    return memoryStore.remove(slug)
  })

  ipcMain.handle(IPC.MEMORY_BY_NODE, async (_event, nodeId: string) => {
    if (!memoryStore) return []
    return memoryStore.listByNode(nodeId)
  })

  ipcMain.handle(IPC.RENDER_TOPOLOGY, async (_event, projectId: string, focusNodeId?: string) => {
    const graph = graphs.get(projectId)
    if (!graph) return ''
    return renderTopologyMarkdown(graph, { focusNodeId, includeFiles: true })
  })

  ipcMain.handle(IPC.GET_ASSEMBLED_CONTEXT, async (_event, projectId: string, nodeId?: string) => {
    const graph = graphs.get(projectId)
    if (!graph) return ''
    const topology = renderTopologyMarkdown(graph, { focusNodeId: nodeId, includeFiles: !!nodeId })
    const memory = memoryStore ? await memoryStore.renderContext(nodeId) : ''
    return `<topology>\n${topology}\n</topology>\n\n${memory}`
  })

  // ═══ M2 Agent APIs (stubs) ═══════════════════════════════════════

  ipcMain.handle(IPC.SUBMIT_PROMPT, async (_event, _projectId: string, _nodeId: string, _prompt: string) => {
    return { error: 'Prompt understanding not available until M2' }
  })

  ipcMain.handle(IPC.CONFIRM_EXECUTION, async (_event, _cardId: string) => {
    return { error: 'Agent execution not available until M2' }
  })

  ipcMain.handle(IPC.GET_EXECUTION_STATUS, async (_event, _jobId: string) => {
    return null
  })

  ipcMain.handle(IPC.GET_AGENT_FLOW_LOG, async (_event, _jobId: string) => {
    return null
  })

  // ═══ M3 Debug APIs (functional stubs) ═════════════════════════════

  ipcMain.handle(IPC.REPORT_ERROR, async (_event, raw: string) => {
    const latestGraph = Array.from(graphs.values()).pop() ?? null
    const debug = buildDebugContext(raw, latestGraph)
    return debug
  })

  ipcMain.handle(IPC.BUILD_DEBUG_CONTEXT, async (_event, errorId: string) => {
    return { error: 'Full debug context not available until M3' }
  })

  ipcMain.handle(IPC.FIX_BUG, async (_event, errorId: string) => {
    return { error: 'Automated bug fix not available until M3' }
  })
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
