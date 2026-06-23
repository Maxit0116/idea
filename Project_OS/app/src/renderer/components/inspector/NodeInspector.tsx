import type { NodeDetailResponse } from '@shared/types'

interface Props {
  detail: NodeDetailResponse
  projectId: string | null
  onClose: () => void
  onNavigate: (nodeId: string) => void
}

const STATUS_COLORS: Record<string, string> = {
  active: '#3fb950',
  in_progress: '#d29922',
  error: '#f85149',
  suggested: '#8b949e',
}

const ROLE_STYLES: Record<string, { bg: string; color: string }> = {
  primary: { bg: 'rgba(88, 166, 255, 0.15)', color: '#58a6ff' },
  supporting: { bg: 'rgba(139, 148, 158, 0.15)', color: '#8b949e' },
  config: { bg: 'rgba(210, 153, 34, 0.15)', color: '#d29922' },
  test: { bg: 'rgba(63, 185, 80, 0.15)', color: '#3fb950' },
}

export default function NodeInspector({
  detail,
  onClose,
  onNavigate,
}: Props) {
  const statusColor = STATUS_COLORS[detail.status] ?? STATUS_COLORS.suggested

  return (
    <div
      className="node-inspector"
      style={{
        width: 320,
        height: '100%',
        background: '#161b22',
        borderLeft: '1px solid #30363d',
        overflowY: 'auto',
        padding: 20,
        color: '#e6edf3',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, lineHeight: 1.3 }}>
            {detail.name}
          </h2>
          <div style={{ fontSize: 12, color: '#8b949e', marginTop: 2 }}>
            {detail.nameEn}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span
            style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 10,
              background: `${statusColor}22`,
              color: statusColor,
              fontWeight: 500,
            }}
          >
            {detail.status.replace(/_/g, ' ')}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#8b949e',
              cursor: 'pointer',
              fontSize: 18,
              padding: '0 4px',
              lineHeight: 1,
            }}
            aria-label="Close inspector"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Summary */}
      {detail.summary && (
        <section>
          <h3 style={sectionTitle}>Summary</h3>
          <p style={{ margin: 0, fontSize: 13, color: '#c9d1d9', lineHeight: 1.5 }}>
            {detail.summary}
          </p>
        </section>
      )}

      {/* Tags */}
      {detail.tags.length > 0 && (
        <section>
          <h3 style={sectionTitle}>Tags</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {detail.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: 'rgba(88, 166, 255, 0.1)',
                  color: '#58a6ff',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Files */}
      {detail.files.length > 0 && (
        <section>
          <h3 style={sectionTitle}>Files</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {detail.files.map((f) => {
              const roleStyle = ROLE_STYLES[f.role] ?? ROLE_STYLES.supporting
              return (
                <div
                  key={f.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: '#0d1117',
                    fontSize: 12,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      padding: '1px 6px',
                      borderRadius: 8,
                      background: roleStyle.bg,
                      color: roleStyle.color,
                      flexShrink: 0,
                    }}
                  >
                    {f.role}
                  </span>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      color: '#c9d1d9',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {f.path}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Upstream */}
      {detail.upstream.length > 0 && (
        <section>
          <h3 style={sectionTitle}>Upstream</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {detail.upstream.map((n) => (
              <button
                key={n.id}
                onClick={() => onNavigate(n.id)}
                style={linkButton}
              >
                {n.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Downstream */}
      {detail.downstream.length > 0 && (
        <section>
          <h3 style={sectionTitle}>Downstream</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {detail.downstream.map((n) => (
              <button
                key={n.id}
                onClick={() => onNavigate(n.id)}
                style={linkButton}
              >
                {n.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Route Preview */}
      {detail.preview?.route && (
        <section>
          <h3 style={sectionTitle}>Route Preview</h3>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: 12,
              color: '#58a6ff',
              background: '#0d1117',
              padding: '8px 12px',
              borderRadius: 6,
            }}
          >
            {detail.preview.route}
          </div>
        </section>
      )}
    </div>
  )
}

const sectionTitle: React.CSSProperties = {
  margin: '0 0 8px 0',
  fontSize: 11,
  fontWeight: 600,
  color: '#8b949e',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
}

const linkButton: React.CSSProperties = {
  background: '#0d1117',
  border: '1px solid #30363d',
  borderRadius: 6,
  padding: '6px 10px',
  color: '#58a6ff',
  fontSize: 13,
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'border-color 0.15s',
}
