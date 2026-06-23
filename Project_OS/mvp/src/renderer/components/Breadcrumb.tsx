import type { BreadcrumbEntry, C4Level } from '../../shared/types'

interface BreadcrumbProps {
  path: BreadcrumbEntry[]
  currentLevel: C4Level
  onNavigate: (index: number) => void
}

const LEVEL_ICONS: Record<C4Level, string> = {
  system: '◎',
  container: '◧',
  component: '◇',
  code: '⟨⟩',
}

const LEVEL_LABELS: Record<C4Level, string> = {
  system: 'System Context',
  container: 'Containers',
  component: 'Components',
  code: 'Code',
}

export function Breadcrumb({ path, currentLevel, onNavigate }: BreadcrumbProps) {
  return (
    <div className="breadcrumb">
      <div className="breadcrumb-level-badge">
        {LEVEL_ICONS[currentLevel]} {LEVEL_LABELS[currentLevel]}
      </div>
      <div className="breadcrumb-separator">|</div>
      {path.map((entry, i) => (
        <span key={i} className="breadcrumb-segment">
          {i > 0 && <span className="breadcrumb-arrow">›</span>}
          <button
            className={`breadcrumb-btn ${i === path.length - 1 ? 'current' : ''}`}
            onClick={() => onNavigate(i)}
            disabled={i === path.length - 1}
          >
            {entry.label}
          </button>
        </span>
      ))}
    </div>
  )
}
