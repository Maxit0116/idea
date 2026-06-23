import { Handle, Position, type NodeProps } from '@xyflow/react'

interface FeatureNodeData {
  label: string
  nameEn: string
  status: string
  type: string
  fileCount: number
  route: string | null
  confidence: number
  selected: boolean
  color: string
  childCount: number
}

export function FeatureNode({ data }: NodeProps) {
  const d = data as unknown as FeatureNodeData
  const isSuggested = d.type === 'suggested'

  return (
    <div
      className={`feature-node ${d.selected ? 'selected' : ''} ${isSuggested ? 'suggested' : ''}`}
      style={{
        borderColor: d.selected ? d.color : isSuggested ? '#444' : '#333',
        borderStyle: isSuggested ? 'dashed' : 'solid'
      }}
    >
      <Handle type="target" position={Position.Left} className="node-handle" />

      <div className="node-header">
        <div
          className="node-status-dot"
          style={{ backgroundColor: d.color }}
        />
        <span className="node-name">{d.label}</span>
      </div>

      <div className="node-meta">
        <span className="node-name-en">{d.nameEn}</span>
        {d.route && <span className="node-route">{d.route}</span>}
      </div>

      <div className="node-footer">
        <span className="node-files">{d.fileCount} files</span>
        <span className="node-confidence">{Math.round(d.confidence * 100)}%</span>
        {d.childCount > 0 && <span className="node-drill-indicator">▶</span>}
      </div>

      <Handle type="source" position={Position.Right} className="node-handle" />
    </div>
  )
}
