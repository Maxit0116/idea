import { useState, useEffect, useCallback } from 'react'
import type {
  AnalysisProgress,
  GraphResponse,
  NodeDetailResponse,
} from '../shared/types'
import WelcomeScreen from './components/progress/WelcomeScreen'
import ProgressOverlay from './components/progress/ProgressOverlay'
import FunctionMap from './components/map/FunctionMap'
import AgentFlowView from './components/agent-flow/AgentFlowView'
import NodeInspector from './components/inspector/NodeInspector'
import ChatSidebar from './components/chat/ChatSidebar'
import TabBar from './components/layout/TabBar'
import TerminalPanel from './components/layout/TerminalPanel'

type AppState = 'welcome' | 'analyzing' | 'ready'
type CenterTab = 'function-map' | 'agent-flow' | 'code'

export default function App() {
  const [state, setState] = useState<AppState>('welcome')
  const [progress, setProgress] = useState<AnalysisProgress | null>(null)
  const [graph, setGraph] = useState<GraphResponse | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [nodeDetail, setNodeDetail] = useState<NodeDetailResponse | null>(null)
  const [activeTab, setActiveTab] = useState<CenterTab>('function-map')
  const [error, setError] = useState<string | null>(null)
  const [showTerminal, setShowTerminal] = useState(false)
  const [showChat, setShowChat] = useState(true)

  useEffect(() => {
    const api = window.projectOS.engine

    const offProgress = api.onProgress((p) => {
      setProgress(p)
    })

    const offComplete = api.onComplete(async (data) => {
      setProjectId(data.projectId)
      const g = await api.getGraph(data.projectId)
      if (g) {
        setGraph(g)
        setState('ready')
      }
    })

    const offError = api.onError((data) => {
      setError(data.message)
      setState('welcome')
    })

    return () => { offProgress(); offComplete(); offError() }
  }, [])

  const handleOpenProject = useCallback(async () => {
    setError(null)
    const path = await window.projectOS.engine.openProjectDialog()
    if (!path) return
    setState('analyzing')
    setProgress(null)
    const result = await window.projectOS.engine.analyze(path)
    if (!result.success) {
      setError(result.error?.message ?? 'Analysis failed')
      setState('welcome')
    }
  }, [])

  const handleSelectNode = useCallback(async (nodeId: string) => {
    setSelectedNodeId(nodeId)
    if (projectId) {
      const detail = await window.projectOS.engine.getNodeDetail(projectId, nodeId)
      setNodeDetail(detail)
    }
  }, [projectId])

  const handleDeselectNode = useCallback(() => {
    setSelectedNodeId(null)
    setNodeDetail(null)
  }, [])

  if (state === 'welcome') {
    return <WelcomeScreen onOpen={handleOpenProject} error={error} />
  }

  if (state === 'analyzing') {
    return <ProgressOverlay progress={progress} />
  }

  return (
    <div className="app-layout">
      <div className="app-main">
        <TabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          showTerminal={showTerminal}
          onToggleTerminal={() => setShowTerminal(t => !t)}
          showChat={showChat}
          onToggleChat={() => setShowChat(c => !c)}
        />
        <div className="center-content">
          {activeTab === 'function-map' && graph && (
            <FunctionMap
              nodes={graph.nodes}
              edges={graph.edges}
              selectedNodeId={selectedNodeId}
              onSelectNode={handleSelectNode}
            />
          )}
          {activeTab === 'agent-flow' && (
            <AgentFlowView projectId={projectId} />
          )}
          {activeTab === 'code' && (
            <div className="placeholder-tab">
              <p className="placeholder-text">Code Editor — M2</p>
            </div>
          )}
        </div>
        {showTerminal && <TerminalPanel />}
      </div>

      {selectedNodeId && nodeDetail && (
        <NodeInspector
          detail={nodeDetail}
          projectId={projectId}
          onClose={handleDeselectNode}
          onNavigate={handleSelectNode}
        />
      )}

      {showChat && (
        <ChatSidebar
          projectId={projectId}
          selectedNodeId={selectedNodeId}
        />
      )}
    </div>
  )
}
