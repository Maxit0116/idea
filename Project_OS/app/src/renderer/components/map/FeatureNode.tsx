import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

interface FeatureNodeData {
  label: string
  nameEn: string
  status: string
  route: string | null
  fileCount: number
  confidence: number
  isSelected: boolean
}

const STATUS_COLORS: Record<string, string> = {
  active: '#3fb950',
  in_progress: '#d29922',
  error: '#f85149',
  suggested: '#8b949e',
}

function FeatureNode({ data }: NodeProps & { data: FeatureNodeData }) {
  const statusColor = STATUS_COLORS[data.status] ?? STATUS_COLORS.suggested
  const clampedConfidence = Math.max(0, Math.min(1, data.confidence))

  return (
    <div
      className={`feature-node${data.isSelected ? ' feature-node--selected' : ''}`}
      style={{
        background: '#161b22',
        border: `1px solid ${data.isSelected ? '#58a6ff' : '#30363d'}`,
        borderRadius: 8,
        padding: '12px 16px',
        minWidth: 200,
        color: '#e6edf3',
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: data.isSelected
          ? '0 0 0 2px rgba(88, 166, 255, 0.3)'
          : 'none',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#30363d', width: 8, height: 8 }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: statusColor,
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3 }}>
          {data.label}
        </span>
      </div>

      <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>
        {data.nameEn}
      </div>

      {data.route && (
        <div
          style={{
            fontSize: 11,
            color: '#58a6ff',
            marginBottom: 4,
            fontFamily: 'monospace',
          }}
        >
          {data.route}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <span
          style={{
            fontSize: 10,
            color: '#8b949e',
            background: '#21262d',
            padding: '2px 6px',
            borderRadius: 10,
          }}
        >
          {data.fileCount} file{data.fileCount !== 1 ? 's' : ''}
        </span>

        <div
          style={{
            width: 48,
            height: 4,
            background: '#21262d',
            borderRadius: 2,
            overflow: 'hidden',
          }}
          title={`Confidence: ${Math.round(clampedConfidence * 100)}%`}
        >
          <div
            style={{
              width: `${clampedConfidence * 100}%`,
              height: '100%',
              background: statusColor,
              borderRadius: 2,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#30363d', width: 8, height: 8 }}
      />
    </div>
  )
}

export default memo(FeatureNode)
