import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { v4 as uuid } from 'uuid'
import { IPC } from '../shared/types'
import type {
  ProjectGraph, GraphResponse, NodeDetailResponse,
  AnalysisProgress, JobStatus
} from '../shared/types'
import { analyzeProject } from './engine/graph-builder'
import { renderTopologyMarkdown } from './engine/topology-render'
import { FileMemoryStore } from './engine/memory-store'

let mainWindow: BrowserWindow | null = null

const jobs = new Map<string, JobStatus>()
const graphs = new Map<string, ProjectGraph>()
let memoryStore: FileMemoryStore | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC.OPEN_PROJECT_DIALOG, async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
      title: 'Open Project'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(IPC.ANALYZE, async (_event, projectPath: string) => {
    if (!projectPath) {
      return { success: false, error: { code: 'PATH_NOT_FOUND', message: '项目路径不存在' } }
    }

    const jobId = uuid()
    const projectId = uuid()

    jobs.set(jobId, {
      jobId,
      status: 'analyzing',
      progress: 0,
      stage: '准备中...',
      error: null
    })

    analyzeProject(projectPath, jobId, {
      onProgress: (progress: AnalysisProgress) => {
        const job = jobs.get(jobId)
        if (job) {
          job.progress = progress.percent
          job.stage = progress.message
          if (progress.percent >= 100) job.status = 'complete'
        }
        mainWindow?.webContents.send(IPC.PROGRESS, progress)
      },
      onComplete: async (graph: ProjectGraph) => {
        const job = jobs.get(jobId)
        if (job) {
          job.status = 'complete'
          job.progress = 100
        }
        graphs.set(graph.projectId, graph)

        const memPath = join(projectPath, '.projectos', 'memory.json')
        memoryStore = new FileMemoryStore(memPath)
        await memoryStore.load()

        mainWindow?.webContents.send(IPC.COMPLETE, {
          jobId,
          projectId: graph.projectId,
          graph: toGraphResponse(graph)
        })
      },
      onError: (error: string) => {
        const job = jobs.get(jobId)
        if (job) {
          job.status = 'error'
          job.error = error
        }
        mainWindow?.webContents.send(IPC.ERROR, { jobId, error })
      }
    })

    return { success: true, jobId, projectId }
  })

  ipcMain.handle(IPC.GET_JOB_STATUS, async (_event, jobId: string) => {
    return jobs.get(jobId) || null
  })

  ipcMain.handle(IPC.GET_GRAPH, async (_event, projectId: string) => {
    const graph = graphs.get(projectId)
    if (!graph) {
      return { success: false, error: { code: 'NOT_ANALYZED', message: '项目尚未分析' } }
    }
    return toGraphResponse(graph)
  })

  ipcMain.handle(IPC.GET_NODE_DETAIL, async (_event, nodeId: string) => {
    for (const graph of graphs.values()) {
      const node = graph.nodes.find((n) => n.id === nodeId)
      if (node) {
        const detail: NodeDetailResponse = {
          id: node.id,
          name: node.name,
          nameEn: node.nameEn,
          status: node.status,
          description: node.description,
          summary: node.summary,
          files: node.linkedFiles,
          upstream: node.upstream.map((uid) => {
            const u = graph.nodes.find((n) => n.id === uid)
            return { id: uid, name: u?.name || uid }
          }),
          downstream: node.downstream.map((did) => {
            const d = graph.nodes.find((n) => n.id === did)
            return { id: did, name: d?.name || did }
          }),
          preview: node.preview,
          tags: node.tags
        }
        return detail
      }
    }
    return { success: false, error: { code: 'NODE_NOT_FOUND', message: '节点不存在' } }
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

  // ═══ Topology APIs ════════════════════════════════════════════════

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
}

function toGraphResponse(graph: ProjectGraph): GraphResponse {
  return {
    projectId: graph.projectId,
    projectName: graph.projectName,
    projectType: graph.projectType,
    analysisStatus: graph.analysisStatus,
    topology: graph.topology,
    nodes: graph.nodes,
    edges: graph.edges,
    fileIndex: graph.fileIndex
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.projectos.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
