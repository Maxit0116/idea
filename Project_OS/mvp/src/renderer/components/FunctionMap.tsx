import { useMemo, useCallback } from 'react'
import {
  ReactFlow,
  type Node,
  type Edge,
  Background,
  Controls,
  MiniMap,
  type NodeMouseHandler,
  Position,
  MarkerType,
} from '@xyflow/react'
import dagre from '@dagrejs/dagre'
import '@xyflow/react/dist/style.css'
import type {
  GraphResponse,
  FunctionalNode as FNode,
  FunctionalEdge,
  FileEntry,
  NavigationState,
  C4Level,
} from '../../shared/types'
import { FeatureNode } from './FeatureNode'
import { SystemNode } from './SystemNode'
import { FileNode } from './FileNode'
import { CodeNode } from './CodeNode'

interface FunctionMapProps {
  graph: GraphResponse
  navState: NavigationState
  selectedNodeId: string | null
  onSelectNode: (nodeId: string | null) => void
  onDrillDown: (nodeId: string, label: string) => void
}

const nodeTypes = {
  system: SystemNode,
  feature: FeatureNode,
  file: FileNode,
  code: CodeNode,
}

const STATUS_COLORS: Record<string, string> = {
  active: '#3ecf8e',
  in_progress: '#f0b429',
  error: '#e5484d',
  suggested: '#505050',
}

const EDGE_STYLE: Edge['style'] = { stroke: '#2a2f3a', strokeWidth: 1.5 }
const EDGE_MARKER: Edge['markerEnd'] = {
  type: MarkerType.ArrowClosed, color: '#2a2f3a', width: 12, height: 12,
}

const NODE_DIMS: Record<string, { w: number; h: number }> = {
  system: { w: 180, h: 100 },
  hub: { w: 220, h: 130 },
  feature: { w: 220, h: 110 },
  file: { w: 220, h: 100 },
  code: { w: 160, h: 90 },
}

export function FunctionMap({
  graph, navState, selectedNodeId, onSelectNode, onDrillDown,
}: FunctionMapProps) {
  const { nodes, edges } = useMemo(() => {
    switch (navState.level) {
      case 'system':
        return computeSystemView(graph)
      case 'container':
        if (navState.focusId?.startsWith('dep-')) {
          return computeDependencyView(graph, navState.focusId)
        }
        return computeContainerView(graph, selectedNodeId)
      case 'component':
        return computeComponentView(graph, navState.focusId!)
      case 'code':
        return computeCodeView(graph, navState.focusId!)
    }
  }, [graph, navState.level, navState.focusId, selectedNodeId])

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if ((node.data as any).isHub) return

      const canDrill = canDrillInto(navState.level, node, graph)
      if (canDrill) {
        onDrillDown(node.id, (node.data as any).label || node.id)
      }
    },
    [navState.level, onDrillDown, graph],
  )

  const onPaneClick = useCallback(() => onSelectNode(null), [onSelectNode])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      fitView
      fitViewOptions={{ padding: 0.25, maxZoom: 1.2 }}
      proOptions={{ hideAttribution: true }}
      defaultEdgeOptions={{ type: 'smoothstep' }}
      minZoom={0.15}
      maxZoom={2}
    >
      <Background color="#1a1f2e" gap={24} size={1} />
      <Controls showInteractive={false} />
      <MiniMap
        nodeColor={(n) => {
          const d = n.data as any
          if (d?.isCenter || d?.isHub) return '#3ecf8e'
          return d?.color || '#505050'
        }}
        maskColor="rgba(10, 12, 20, 0.7)"
      />
    </ReactFlow>
  )
}

// ═══ Dagre Layout ═══════════════════════════════════════════════

function dagreLayout(
  nodes: Node[], edges: Edge[], dir: 'TB' | 'LR' = 'TB',
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: dir, nodesep: 50, ranksep: 70, marginx: 40, marginy: 40 })

  for (const n of nodes) {
    const key = (n.data as any)?.isHub || (n.data as any)?.isCenter ? 'hub' : (n.type || 'feature')
    const d = NODE_DIMS[key] || NODE_DIMS.feature
    g.setNode(n.id, { width: d.w, height: d.h })
  }
  for (const e of edges) g.setEdge(e.source, e.target)
  dagre.layout(g)

  return {
    nodes: nodes.map((n) => {
      const pos = g.node(n.id)
      const key = (n.data as any)?.isHub || (n.data as any)?.isCenter ? 'hub' : (n.type || 'feature')
      const d = NODE_DIMS[key] || NODE_DIMS.feature
      return {
        ...n,
        position: { x: pos.x - d.w / 2, y: pos.y - d.h / 2 },
        sourcePosition: dir === 'TB' ? Position.Bottom : Position.Right,
        targetPosition: dir === 'TB' ? Position.Top : Position.Left,
      }
    }),
    edges,
  }
}

function edge(id: string, source: string, target: string, label?: string): Edge {
  return {
    id, source, target, type: 'smoothstep', label,
    labelStyle: { fontSize: 9, fill: '#505050' },
    style: { ...EDGE_STYLE },
    markerEnd: { ...EDGE_MARKER } as any,
  }
}

// ═══ L1 — System Context ════════════════════════════════════════

function computeSystemView(graph: GraphResponse): { nodes: Node[]; edges: Edge[] } {
  const deps = detectDependencies(graph)

  const nodes: Node[] = [
    {
      id: '__project__',
      type: 'system',
      position: { x: 0, y: 0 },
      data: {
        label: graph.projectName,
        sublabel: graph.projectType.replace('-', ' '),
        stats: `${graph.nodes.length} features · ${graph.fileIndex.length} files`,
        isCenter: true, color: '#3ecf8e', icon: '◉',
      },
    },
    ...deps.map((dep) => ({
      id: dep.id,
      type: 'system' as const,
      position: { x: 0, y: 0 },
      data: {
        label: dep.label,
        sublabel: `${dep.fileCount} files`,
        stats: null,
        isCenter: false, color: dep.color, icon: dep.icon,
      },
    })),
  ]

  const edges: Edge[] = deps.map((dep) =>
    edge(
      `sys-${dep.id}`,
      dep.direction === 'inbound' ? dep.id : '__project__',
      dep.direction === 'inbound' ? '__project__' : dep.id,
      dep.edgeLabel,
    ),
  )

  return dagreLayout(nodes, edges, 'LR')
}

// ═══ L2 — Containers (Features) ═════════════════════════════════

function computeContainerView(
  graph: GraphResponse, selectedId: string | null,
): { nodes: Node[]; edges: Edge[] } {
  const hubId = '__hub_project__'

  const hub: Node = {
    id: hubId, type: 'system', position: { x: 0, y: 0 },
    data: {
      label: graph.projectName, sublabel: `${graph.nodes.length} features`,
      stats: null, isCenter: true, isHub: true, color: '#3ecf8e', icon: '◉',
    },
  }

  const featureNodes: Node[] = graph.nodes.map((n: FNode) => ({
    id: n.id, type: 'feature', position: { x: 0, y: 0 },
    data: {
      label: n.name, nameEn: n.nameEn, status: n.status, type: n.type,
      fileCount: n.linkedFiles.length, route: n.preview?.route || null,
      confidence: n.confidence, selected: n.id === selectedId,
      color: STATUS_COLORS[n.status] || '#505050',
      childCount: n.linkedFiles.length,
    },
  }))

  const hubEdges = graph.nodes.map((n) => edge(`hub-${n.id}`, hubId, n.id))
  const featureEdges = graph.edges.map((e: FunctionalEdge) =>
    edge(e.id, e.source, e.target, edgeLabel(e.relation)),
  )

  return dagreLayout([hub, ...featureNodes], [...hubEdges, ...featureEdges], 'TB')
}

// ═══ Dependency Detail View ═════════════════════════════════════

function computeDependencyView(
  graph: GraphResponse, depId: string,
): { nodes: Node[]; edges: Edge[] } {
  const depInfo = DEP_FILTERS[depId]
  if (!depInfo) return computeContainerView(graph, null)

  const matchedFiles = graph.fileIndex.filter(depInfo.fileFilter)
  const matchedNodes = graph.nodes.filter((n) =>
    depInfo.nodeFilter(n) ||
    n.linkedFiles.some((lf) => matchedFiles.some((mf) => mf.path === lf.path))
  )

  if (matchedNodes.length === 0 && matchedFiles.length === 0) {
    return computeContainerView(graph, null)
  }

  const hubId = `__hub_${depId}__`
  const hub: Node = {
    id: hubId, type: 'system', position: { x: 0, y: 0 },
    data: {
      label: depInfo.label,
      sublabel: `${matchedFiles.length} files · ${matchedNodes.length} features`,
      stats: null, isCenter: true, isHub: true, color: depInfo.color, icon: depInfo.icon,
    },
  }

  const fileNodes: Node[] = matchedFiles.map((f) => ({
    id: f.path, type: 'file' as const, position: { x: 0, y: 0 },
    data: {
      label: f.path.split('/').pop() || f.path,
      fullPath: f.path, fileType: f.type,
      role: 'primary', exportCount: f.exports.length,
      selected: false, hasChildren: f.exports.length > 0,
    },
  }))

  const filePaths = new Set(matchedFiles.map((f) => f.path))
  const hubEdges = matchedFiles.map((f) => edge(`hub-${f.path}`, hubId, f.path))

  const importEdges: Edge[] = []
  for (const f of matchedFiles) {
    for (const imp of f.imports) {
      if (filePaths.has(imp)) {
        importEdges.push(edge(`imp-${f.path}-${imp}`, f.path, imp, 'imports'))
      }
    }
  }

  return dagreLayout([hub, ...fileNodes], [...hubEdges, ...importEdges], 'TB')
}

// ═══ L3 — Components (Files) ════════════════════════════════════

function computeComponentView(
  graph: GraphResponse, parentNodeId: string,
): { nodes: Node[]; edges: Edge[] } {
  const parentNode = graph.nodes.find((n) => n.id === parentNodeId)
  if (!parentNode) return { nodes: [], edges: [] }

  const hubId = `__hub_${parentNodeId}__`
  const filePaths = new Set(parentNode.linkedFiles.map((f) => f.path))
  const fileMap = new Map(graph.fileIndex.map((f) => [f.path, f]))

  const hub: Node = {
    id: hubId, type: 'system', position: { x: 0, y: 0 },
    data: {
      label: parentNode.name, sublabel: `${parentNode.linkedFiles.length} files`,
      stats: null, isCenter: true, isHub: true,
      color: STATUS_COLORS[parentNode.status] || '#3ecf8e', icon: '◧',
    },
  }

  const fileNodes: Node[] = parentNode.linkedFiles.map((lf) => {
    const entry = fileMap.get(lf.path)
    return {
      id: lf.path, type: 'file' as const, position: { x: 0, y: 0 },
      data: {
        label: lf.path.split('/').pop() || lf.path, fullPath: lf.path,
        fileType: entry?.type || 'other', role: lf.role,
        exportCount: entry?.exports.length || 0, selected: false,
        hasChildren: (entry?.exports.length || 0) > 0,
      },
    }
  })

  const hubEdges = parentNode.linkedFiles.map((lf) =>
    edge(`hub-${lf.path}`, hubId, lf.path),
  )

  const importEdges: Edge[] = []
  for (const fp of filePaths) {
    const entry = fileMap.get(fp)
    if (!entry) continue
    for (const imp of entry.imports) {
      if (filePaths.has(imp)) {
        importEdges.push(edge(`imp-${fp}-${imp}`, fp, imp, 'imports'))
      }
    }
  }

  return dagreLayout([hub, ...fileNodes], [...hubEdges, ...importEdges], 'TB')
}

// ═══ L4 — Code (Exports) ════════════════════════════════════════

function computeCodeView(
  graph: GraphResponse, filePath: string,
): { nodes: Node[]; edges: Edge[] } {
  const fileEntry = graph.fileIndex.find((f) => f.path === filePath)
  if (!fileEntry) return { nodes: [], edges: [] }

  const exports = fileEntry.exports.length > 0 ? fileEntry.exports : ['default']
  const hubId = '__hub_file__'

  const hub: Node = {
    id: hubId, type: 'system', position: { x: 0, y: 0 },
    data: {
      label: filePath.split('/').pop() || filePath,
      sublabel: `${exports.length} exports`,
      stats: null, isCenter: true, isHub: true, color: '#7c9aed', icon: '◇',
    },
  }

  const codeNodes: Node[] = exports.map((exp) => ({
    id: `export-${exp}`, type: 'code' as const, position: { x: 0, y: 0 },
    data: { label: exp, exportType: classifyExport(exp), selected: false },
  }))

  const edges = exports.map((exp) => edge(`hub-${exp}`, hubId, `export-${exp}`))
  return dagreLayout([hub, ...codeNodes], edges, 'LR')
}

// ═══ Dependency Filters ═════════════════════════════════════════

const DEP_FILTERS: Record<string, {
  label: string; color: string; icon: string
  fileFilter: (f: FileEntry) => boolean
  nodeFilter: (n: FNode) => boolean
}> = {
  'dep-api': {
    label: 'API Layer', color: '#3b82f6', icon: '⚡',
    fileFilter: (f) => f.path.includes('/api/') || f.type === 'api',
    nodeFilter: (n) => n.linkedFiles.some((lf) => lf.path.includes('/api/')),
  },
  'dep-auth': {
    label: 'Auth Provider', color: '#8b5cf6', icon: '🔐',
    fileFilter: (f) =>
      f.path.includes('auth') || f.path.includes('login') ||
      f.path.includes('session') || f.path.includes('middleware'),
    nodeFilter: (n) => n.tags.some((t) => ['auth', 'login', 'session'].includes(t)),
  },
  'dep-database': {
    label: 'Database', color: '#f0b429', icon: '⛁',
    fileFilter: (f) =>
      f.path.includes('prisma') || f.path.includes('db') ||
      f.path.includes('database') || f.path.includes('models') ||
      f.path.includes('schema'),
    nodeFilter: (n) => n.tags.some((t) => ['database', 'data', 'models', 'prisma'].includes(t)),
  },
  'dep-nextjs': {
    label: 'Next.js', color: '#e5e5e5', icon: '▲',
    fileFilter: (f) =>
      f.path.includes('layout') || f.path.includes('middleware') ||
      f.path.includes('next.config') || f.path.includes('loading') ||
      f.path.includes('error') || f.type === 'config',
    nodeFilter: () => false,
  },
  'dep-browser': {
    label: 'Users', color: '#3ecf8e', icon: '👤',
    fileFilter: (f) => f.type === 'page' || f.type === 'component',
    nodeFilter: (n) => n.linkedFiles.some((lf) => lf.role === 'primary'),
  },
}

// ═══ Helpers ════════════════════════════════════════════════════

function canDrillInto(level: C4Level, node: Node, graph: GraphResponse): boolean {
  if (level === 'system') {
    if (node.id === '__project__') return true
    if (node.id.startsWith('dep-')) {
      const filter = DEP_FILTERS[node.id]
      if (!filter) return false
      return graph.fileIndex.some(filter.fileFilter)
    }
    return false
  }
  if (level === 'container') {
    if ((node.data as any).isHub) return false
    const featureNode = graph.nodes.find((n) => n.id === node.id)
    if (featureNode) return featureNode.linkedFiles.length > 0
    const fileEntry = graph.fileIndex.find((f) => f.path === node.id)
    if (fileEntry) return fileEntry.exports.length > 0
    return false
  }
  if (level === 'component') {
    return (graph.fileIndex.find((f) => f.path === node.id)?.exports.length || 0) > 0
  }
  return false
}

function getNextLevel(level: C4Level): C4Level | null {
  const order: C4Level[] = ['system', 'container', 'component', 'code']
  const i = order.indexOf(level)
  return i < order.length - 1 ? order[i + 1] : null
}

function classifyExport(name: string): string {
  if (name === 'default') return 'component'
  if (name === 'metadata' || name === 'revalidate') return 'constant'
  if (name.startsWith('generate')) return 'function'
  if (/^[A-Z]/.test(name)) return 'component'
  if (/^use[A-Z]/.test(name)) return 'function'
  if (name === name.toUpperCase()) return 'constant'
  return 'function'
}

function edgeLabel(relation: string): string {
  switch (relation) {
    case 'depends_on': return 'depends'
    case 'redirects_to': return 'navigates'
    case 'data_flows_to': return 'data'
    case 'shares_data': return 'shared'
    default: return ''
  }
}

interface DepInfo {
  id: string; label: string; sublabel: string; color: string
  icon: string; edgeLabel: string; direction: 'outbound' | 'inbound'
  fileCount: number
}

function detectDependencies(graph: GraphResponse): DepInfo[] {
  const deps: DepInfo[] = []

  const countFiles = (id: string) => {
    const filter = DEP_FILTERS[id]
    return filter ? graph.fileIndex.filter(filter.fileFilter).length : 0
  }

  deps.push({
    id: 'dep-browser', label: 'Users', sublabel: 'Browser Clients',
    color: '#3ecf8e', icon: '👤', edgeLabel: 'accesses', direction: 'inbound',
    fileCount: countFiles('dep-browser'),
  })

  if (graph.projectType.startsWith('nextjs')) {
    deps.push({
      id: 'dep-nextjs', label: 'Next.js', sublabel: 'Framework',
      color: '#e5e5e5', icon: '▲', edgeLabel: 'built with', direction: 'outbound',
      fileCount: countFiles('dep-nextjs'),
    })
  }

  if (graph.nodes.some((n) => n.tags.some((t) => ['database', 'data', 'models', 'prisma'].includes(t)))) {
    deps.push({
      id: 'dep-database', label: 'Database', sublabel: 'Storage',
      color: '#f0b429', icon: '⛁', edgeLabel: 'reads/writes', direction: 'outbound',
      fileCount: countFiles('dep-database'),
    })
  }

  if (graph.nodes.some((n) => n.tags.some((t) => ['auth', 'login', 'session'].includes(t)))) {
    deps.push({
      id: 'dep-auth', label: 'Auth', sublabel: 'Identity',
      color: '#8b5cf6', icon: '🔐', edgeLabel: 'authenticates', direction: 'outbound',
      fileCount: countFiles('dep-auth'),
    })
  }

  if (graph.nodes.some((n) => n.linkedFiles.some((f) => f.path.includes('/api/')))) {
    deps.push({
      id: 'dep-api', label: 'API Layer', sublabel: 'Endpoints',
      color: '#3b82f6', icon: '⚡', edgeLabel: 'serves', direction: 'outbound',
      fileCount: countFiles('dep-api'),
    })
  }

  return deps
}
