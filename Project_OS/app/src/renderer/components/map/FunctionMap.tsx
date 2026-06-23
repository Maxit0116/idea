import { useMemo, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
} from '@xyflow/react'
import type { FunctionalNode, FunctionalEdge } from '@shared/types'
import FeatureNode from './FeatureNode'

interface Props {
  nodes: FunctionalNode[]
  edges: FunctionalEdge[]
  selectedNodeId: string | null
  onSelectNode: (nodeId: string) => void
}

const COLUMNS = 3
const H_SPACING = 300
const V_SPACING = 200

const EDGE_COLORS: Record<string, string> = {
  depends_on: '#58a6ff',
  redirects_to: '#d29922',
  data_flows_to: '#3fb950',
  imports: '#8b949e',
  shares_data: '#bc8cff',
}

const nodeTypes = { feature: FeatureNode }

export default function FunctionMap({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
}: Props) {
  const flowNodes: Node[] = useMemo(
    () =>
      nodes.map((n, i) => ({
        id: n.id,
        type: 'feature',
        position: {
          x: (i % COLUMNS) * H_SPACING,
          y: Math.floor(i / COLUMNS) * V_SPACING,
        },
        data: {
          label: n.name,
          nameEn: n.nameEn,
          status: n.status,
          route: n.preview?.route ?? null,
          fileCount: n.linkedFiles.length,
          confidence: n.confidence,
          isSelected: n.id === selectedNodeId,
        },
      })),
    [nodes, selectedNodeId],
  )

  const flowEdges: Edge[] = useMemo(
    () =>
      edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        animated: true,
        style: {
          stroke: EDGE_COLORS[e.relation] ?? '#8b949e',
          strokeWidth: 2,
        },
        label: e.relation.replace(/_/g, ' '),
        labelStyle: { fill: '#8b949e', fontSize: 10 },
        labelBgStyle: { fill: '#0d1117', fillOpacity: 0.8 },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 4,
      })),
    [edges],
  )

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onSelectNode(node.id)
    },
    [onSelectNode],
  )

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        style={{ background: '#0d1117' }}
      >
        <Background color="#21262d" gap={20} size={1} />
        <Controls
          showInteractive={false}
          style={{ background: '#161b22', border: '1px solid #30363d' }}
        />
        <MiniMap
          nodeColor={(node) => {
            const status = (node.data as { status?: string }).status
            const colors: Record<string, string> = {
              active: '#3fb950',
              in_progress: '#d29922',
              error: '#f85149',
              suggested: '#8b949e',
            }
            return colors[status ?? ''] ?? '#8b949e'
          }}
          maskColor="rgba(0, 0, 0, 0.7)"
          style={{ background: '#0d1117', border: '1px solid #30363d' }}
        />
      </ReactFlow>
    </div>
  )
}
