import type { AnalysisProgress } from '@shared/types'

interface Props {
  progress: AnalysisProgress | null
}

const STAGE_LABELS: Record<string, string> = {
  file_scan: '扫描文件',
  route_detection: '检测路由',
  import_analysis: '分析依赖',
  clustering: '聚类模块',
  edge_inference: '推断关系',
  finalize: '完成分析',
}

const CIRCLE_RADIUS = 54
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS

export default function ProgressOverlay({ progress }: Props) {
  if (!progress) return null

  const percent = Math.max(0, Math.min(100, progress.percent))
  const dashOffset = CIRCLE_CIRCUMFERENCE * (1 - percent / 100)
  const stageLabel = STAGE_LABELS[progress.stage] ?? progress.stage

  return (
    <div
      className="progress-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(1, 4, 9, 0.85)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        color: '#e6edf3',
        gap: 20,
      }}
    >
      {/* Circular progress */}
      <div style={{ position: 'relative', width: 128, height: 128 }}>
        <svg
          width={128}
          height={128}
          viewBox="0 0 128 128"
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* Background circle */}
          <circle
            cx={64}
            cy={64}
            r={CIRCLE_RADIUS}
            fill="none"
            stroke="#21262d"
            strokeWidth={6}
          />
          {/* Progress arc */}
          <circle
            cx={64}
            cy={64}
            r={CIRCLE_RADIUS}
            fill="none"
            stroke="#58a6ff"
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={CIRCLE_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 0.4s ease' }}
          />
        </svg>

        {/* Percentage in center */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {Math.round(percent)}%
        </div>
      </div>

      {/* Stage name */}
      <div style={{ fontSize: 16, fontWeight: 600 }}>
        {stageLabel}
      </div>

      {/* Progress message */}
      {progress.message && (
        <div style={{ fontSize: 13, color: '#8b949e', maxWidth: 400, textAlign: 'center' }}>
          {progress.message}
        </div>
      )}

      {/* Progress bar */}
      <div
        style={{
          width: 280,
          height: 4,
          background: '#21262d',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #58a6ff, #bc8cff)',
            borderRadius: 2,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
    </div>
  )
}
