import { Handle, Position, type NodeProps } from '@xyflow/react'

interface FileNodeData {
  label: string
  fullPath: string
  fileType: string
  role: string
  exportCount: number
  selected: boolean
  hasChildren: boolean
}

const TYPE_COLORS: Record<string, string> = {
  page: '#7c9aed',
  api: '#f59e0b',
  component: '#22c55e',
  lib: '#a78bfa',
  config: '#f97316',
  style: '#ec4899',
  test: '#06b6d4',
  asset: '#6b7280',
  other: '#6b7280',
}

const TYPE_ICONS: Record<string, string> = {
  page: '📄',
  api: '⚡',
  component: '🧩',
  lib: '📦',
  config: '⚙️',
  style: '🎨',
  test: '🧪',
  asset: '📁',
  other: '📋',
}

export function FileNode({ data }: NodeProps) {
  const d = data as unknown as FileNodeData
  const color = TYPE_COLORS[d.fileType] || '#6b7280'

  return (
    <div
      className={`file-node ${d.selected ? 'selected' : ''}`}
      style={{ borderColor: d.selected ? color : undefined }}
    >
      <Handle type="target" position={Position.Left} className="node-handle" />

      <div className="file-node-header">
        <span className="file-node-icon">{TYPE_ICONS[d.fileType] || '📋'}</span>
        <span className="file-node-name">{d.label}</span>
      </div>

      <div className="file-node-path">{d.fullPath}</div>

      <div className="file-node-footer">
        <span className="file-node-type" style={{ color }}>{d.fileType}</span>
        {d.exportCount > 0 && (
          <span className="file-node-exports">{d.exportCount} exports</span>
        )}
        {d.hasChildren && <span className="file-node-drill">▶</span>}
      </div>

      <Handle type="source" position={Position.Right} className="node-handle" />
    </div>
  )
}
