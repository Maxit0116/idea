import { Handle, Position, type NodeProps } from '@xyflow/react'

interface CodeNodeData {
  label: string
  exportType: 'function' | 'component' | 'constant' | 'type' | 'class' | 'unknown'
  selected: boolean
}

const EXPORT_COLORS: Record<string, string> = {
  function: '#a78bfa',
  component: '#22c55e',
  constant: '#f59e0b',
  type: '#7c9aed',
  class: '#ec4899',
  unknown: '#6b7280',
}

const EXPORT_ICONS: Record<string, string> = {
  function: 'ƒ',
  component: '◇',
  constant: 'K',
  type: 'T',
  class: 'C',
  unknown: '·',
}

export function CodeNode({ data }: NodeProps) {
  const d = data as unknown as CodeNodeData
  const color = EXPORT_COLORS[d.exportType] || '#6b7280'

  return (
    <div
      className={`code-node ${d.selected ? 'selected' : ''}`}
      style={{ borderColor: d.selected ? color : undefined }}
    >
      <Handle type="target" position={Position.Left} className="node-handle" />

      <div className="code-node-badge" style={{ background: color }}>
        {EXPORT_ICONS[d.exportType]}
      </div>
      <div className="code-node-label">{d.label}</div>
      <div className="code-node-type" style={{ color }}>{d.exportType}</div>

      <Handle type="source" position={Position.Right} className="node-handle" />
    </div>
  )
}
