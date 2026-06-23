import { useState, useEffect, useCallback } from 'react'
import type {
  GraphResponse, NodeDetailResponse, AnalysisProgress,
  NavigationState, C4Level,
} from '../shared/types'
import { FunctionMap } from './components/FunctionMap'
import { NodeInspector } from './components/NodeInspector'
import { ProgressOverlay } from './components/ProgressOverlay'
import { WelcomeScreen } from './components/WelcomeScreen'
import { Breadcrumb } from './components/Breadcrumb'

type AppState = 'welcome' | 'analyzing' | 'ready'

const LEVEL_ORDER: C4Level[] = ['system', 'container', 'component', 'code']

export default function App() {
  const [state, setState] = useState<AppState>('welcome')
  const [graph, setGraph] = useState<GraphResponse | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [nodeDetail, setNodeDetail] = useState<NodeDetailResponse | null>(null)
  const [progress, setProgress] = useState<AnalysisProgress | null>(null)
  const [projectPath, setProjectPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [navState, setNavState] = useState<NavigationState>({
    level: 'system',
    path: [],
    focusId: null,
  })

  useEffect(() => {
    const unsubProgress = window.projectOS.onProgress((p) => {
      setProgress(p)
    })

    const unsubComplete = window.projectOS.onComplete((data) => {
      setGraph(data.graph)
      setState('ready')
      setProgress(null)
      setNavState({
        level: 'system',
        path: [{
          level: 'system',
          label: data.graph.projectName,
          id: data.graph.projectId,
        }],
        focusId: null,
      })
    })

    const unsubError = window.projectOS.onError((data) => {
      setError(data.error)
      setState('welcome')
      setProgress(null)
    })

    return () => {
      unsubProgress()
      unsubComplete()
      unsubError()
    }
  }, [])

  const handleOpenProject = useCallback(async () => {
    const path = await window.projectOS.openProjectDialog()
    if (!path) return

    setProjectPath(path)
    setError(null)
    setState('analyzing')

    const result = await window.projectOS.analyze(path)
    if (!result.success) {
      setError(result.error?.message || '分析失败')
      setState('welcome')
    }
  }, [])

  const handleSelectNode = useCallback(async (nodeId: string | null) => {
    setSelectedNodeId(nodeId)
    if (nodeId && navState.level === 'container') {
      const detail = await window.projectOS.getNodeDetail(nodeId)
      if ('id' in detail) {
        setNodeDetail(detail)
      }
    } else {
      setNodeDetail(null)
    }
  }, [navState.level])

  const handleCloseInspector = useCallback(() => {
    setSelectedNodeId(null)
    setNodeDetail(null)
  }, [])

  const handleDrillDown = useCallback((nodeId: string, label: string) => {
    let nextLevel: C4Level
    if (navState.level === 'container' && navState.focusId?.startsWith('dep-')) {
      nextLevel = 'code'
    } else {
      const currentIndex = LEVEL_ORDER.indexOf(navState.level)
      if (currentIndex >= LEVEL_ORDER.length - 1) return
      nextLevel = LEVEL_ORDER[currentIndex + 1]
    }

    setSelectedNodeId(null)
    setNodeDetail(null)
    setNavState({
      level: nextLevel,
      path: [...navState.path, { level: nextLevel, label, id: nodeId }],
      focusId: nodeId,
    })
  }, [navState])

  const handleBreadcrumbNavigate = useCallback((targetIndex: number) => {
    const entry = navState.path[targetIndex]
    if (!entry) return

    setSelectedNodeId(null)
    setNodeDetail(null)
    setNavState({
      level: entry.level,
      path: navState.path.slice(0, targetIndex + 1),
      focusId: targetIndex > 0 ? entry.id ?? null : null,
    })
  }, [navState])

  if (state === 'welcome') {
    return <WelcomeScreen onOpenProject={handleOpenProject} error={error} />
  }

  if (state === 'analyzing') {
    return <ProgressOverlay progress={progress} projectPath={projectPath} />
  }

  return (
    <div className="app-layout">
      <div className="titlebar">
        <div className="titlebar-drag" />
        <div className="titlebar-content">
          <span className="titlebar-project">{graph?.projectName || 'Project OS'}</span>
          <div className="titlebar-tabs">
            <button className="tab active">Function Map</button>
            <button className="tab" disabled>Agent Flow</button>
            <button className="tab" disabled>Code</button>
          </div>
          <button className="titlebar-btn" onClick={handleOpenProject}>Open Project</button>
        </div>
      </div>

      {navState.path.length > 0 && (
        <Breadcrumb
          path={navState.path}
          currentLevel={navState.level}
          onNavigate={handleBreadcrumbNavigate}
        />
      )}

      <div className="main-area">
        <div className={`map-container ${selectedNodeId ? 'with-inspector' : ''}`}>
          {graph && (
            <FunctionMap
              graph={graph}
              navState={navState}
              selectedNodeId={selectedNodeId}
              onSelectNode={handleSelectNode}
              onDrillDown={handleDrillDown}
            />
          )}
        </div>

        {nodeDetail && (
          <NodeInspector
            detail={nodeDetail}
            onClose={handleCloseInspector}
            onNavigateNode={handleSelectNode}
          />
        )}
      </div>

      <div className="statusbar">
        <span>L{LEVEL_ORDER.indexOf(navState.level) + 1}</span>
        <span>{graph?.nodes.length || 0} nodes</span>
        <span>{graph?.edges.length || 0} edges</span>
        <span>{graph?.analysisStatus === 'complete' ? 'Analysis complete' : graph?.analysisStatus}</span>
      </div>
    </div>
  )
}
