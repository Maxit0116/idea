import type { AnalysisProgress } from '../../shared/types'

interface ProgressOverlayProps {
  progress: AnalysisProgress | null
  projectPath: string | null
}

const STAGE_LABELS: Record<string, string> = {
  file_scan: 'Scanning files',
  route_detection: 'Detecting routes',
  import_analysis: 'Analyzing imports',
  clustering: 'Clustering features',
  edge_inference: 'Inferring relationships',
  finalize: 'Building graph'
}

export function ProgressOverlay({ progress, projectPath }: ProgressOverlayProps) {
  const percent = progress?.percent || 0
  const stage = progress?.stage ? STAGE_LABELS[progress.stage] || progress.message : 'Initializing...'
  const message = progress?.message || 'Preparing analysis...'

  return (
    <div className="progress-overlay">
      <div className="progress-card">
        <div className="progress-spinner">
          <svg width="48" height="48" viewBox="0 0 48 48">
            <circle
              cx="24" cy="24" r="20"
              fill="none" stroke="#222" strokeWidth="4"
            />
            <circle
              cx="24" cy="24" r="20"
              fill="none" stroke="#7c9aed" strokeWidth="4"
              strokeDasharray={`${percent * 1.26} 126`}
              strokeLinecap="round"
              transform="rotate(-90 24 24)"
              style={{ transition: 'stroke-dasharray 0.3s ease' }}
            />
          </svg>
          <span className="progress-percent">{Math.round(percent)}%</span>
        </div>

        <h2>Analyzing Project</h2>
        <p className="progress-path">{projectPath?.split('/').pop()}</p>
        <p className="progress-stage">{message}</p>

        <div className="progress-bar-track">
          <div
            className="progress-bar-fill"
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="progress-steps">
          {Object.entries(STAGE_LABELS).map(([key, label]) => {
            const stageOrder = ['file_scan', 'route_detection', 'import_analysis', 'clustering', 'edge_inference', 'finalize']
            const currentIdx = progress?.stage ? stageOrder.indexOf(progress.stage) : -1
            const thisIdx = stageOrder.indexOf(key)
            const isDone = thisIdx < currentIdx
            const isActive = thisIdx === currentIdx

            return (
              <div key={key} className={`step ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}>
                <div className="step-dot" />
                <span>{label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
