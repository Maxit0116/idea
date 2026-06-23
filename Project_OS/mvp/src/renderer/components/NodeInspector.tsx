import type { NodeDetailResponse } from '../../shared/types'

interface NodeInspectorProps {
  detail: NodeDetailResponse
  onClose: () => void
  onNavigateNode: (nodeId: string) => void
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: '#22c55e' },
  in_progress: { label: 'In Progress', color: '#f59e0b' },
  error: { label: 'Error', color: '#ef4444' },
  suggested: { label: 'Suggested', color: '#6b7280' }
}

const ROLE_LABELS: Record<string, string> = {
  primary: 'Core',
  supporting: 'Supporting',
  config: 'Config',
  test: 'Test'
}

export function NodeInspector({ detail, onClose, onNavigateNode }: NodeInspectorProps) {
  const status = STATUS_LABELS[detail.status] || STATUS_LABELS.active

  return (
    <div className="inspector">
      <div className="inspector-header">
        <div className="inspector-title-row">
          <div className="inspector-status-dot" style={{ backgroundColor: status.color }} />
          <h2>{detail.name}</h2>
          <button className="inspector-close" onClick={onClose}>x</button>
        </div>
        <div className="inspector-subtitle">
          <span className="inspector-name-en">{detail.nameEn}</span>
          <span className="inspector-status-badge" style={{ color: status.color }}>
            {status.label}
          </span>
        </div>
        {detail.tags.length > 0 && (
          <div className="inspector-tags">
            {detail.tags.map((tag) => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        )}
      </div>

      <div className="inspector-body">
        <section>
          <h3>Summary</h3>
          <p className="inspector-summary">{detail.summary}</p>
        </section>

        {detail.preview?.route && (
          <section>
            <h3>Route</h3>
            <code className="inspector-route">{detail.preview.route}</code>
          </section>
        )}

        <section>
          <h3>Files ({detail.files.length})</h3>
          <ul className="file-list">
            {detail.files.map((file) => (
              <li key={file.path} className="file-item">
                <span className={`file-role role-${file.role}`}>
                  {ROLE_LABELS[file.role] || file.role}
                </span>
                <span className="file-path">{file.path}</span>
                {file.summary && <span className="file-summary">{file.summary}</span>}
              </li>
            ))}
          </ul>
        </section>

        {detail.upstream.length > 0 && (
          <section>
            <h3>Upstream ({detail.upstream.length})</h3>
            <div className="related-nodes">
              {detail.upstream.map((node) => (
                <button
                  key={node.id}
                  className="related-node-btn"
                  onClick={() => onNavigateNode(node.id)}
                >
                  <span className="arrow">&#8592;</span> {node.name}
                </button>
              ))}
            </div>
          </section>
        )}

        {detail.downstream.length > 0 && (
          <section>
            <h3>Downstream ({detail.downstream.length})</h3>
            <div className="related-nodes">
              {detail.downstream.map((node) => (
                <button
                  key={node.id}
                  className="related-node-btn"
                  onClick={() => onNavigateNode(node.id)}
                >
                  {node.name} <span className="arrow">&#8594;</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
