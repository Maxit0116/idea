import { Handle, Position, type NodeProps } from '@xyflow/react'

interface SystemNodeData {
  label: string
  sublabel: string
  stats: string | null
  isCenter: boolean
  color: string
  icon: string
}

export function SystemNode({ data }: NodeProps) {
  const d = data as unknown as SystemNodeData

  if (d.isCenter) {
    return (
      <div className="system-node center">
        <Handle type="target" position={Position.Left} className="node-handle" />
        <div className="system-node-icon">{d.icon}</div>
        <div className="system-node-label">{d.label}</div>
        <div className="system-node-sublabel">{d.sublabel}</div>
        {d.stats && <div className="system-node-stats">{d.stats}</div>}
        <div className="system-node-hint">Click to explore</div>
        <Handle type="source" position={Position.Right} className="node-handle" />
      </div>
    )
  }

  return (
    <div className="system-node dependency clickable" style={{ borderColor: d.color }}>
      <Handle type="target" position={Position.Left} className="node-handle" />
      <div className="system-node-icon" style={{ color: d.color }}>{d.icon}</div>
      <div className="system-node-label">{d.label}</div>
      <div className="system-node-sublabel">{d.sublabel}</div>
      <div className="system-node-hint" style={{ color: d.color }}>Click to inspect</div>
      <Handle type="source" position={Position.Right} className="node-handle" />
    </div>
  )
}
