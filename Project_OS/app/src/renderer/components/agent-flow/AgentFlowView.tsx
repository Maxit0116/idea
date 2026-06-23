interface Props {
  projectId: string | null
}

interface MockStep {
  icon: string
  label: string
  sublabel: string
  status: 'complete' | 'active' | 'pending'
}

const MOCK_STEPS: MockStep[] = [
  { icon: '\u{1F4AC}', label: '理解需求', sublabel: 'Understand requirements', status: 'complete' },
  { icon: '\u{1F50D}', label: '检索上下文', sublabel: 'Retrieve context', status: 'active' },
  { icon: '\u{1F4DD}', label: '生成方案', sublabel: 'Generate solution', status: 'pending' },
]

const STATUS_STYLES: Record<string, { dot: string; border: string; bg: string }> = {
  complete: { dot: '#3fb950', border: '#238636', bg: 'rgba(63, 185, 80, 0.06)' },
  active: { dot: '#58a6ff', border: '#1f6feb', bg: 'rgba(88, 166, 255, 0.06)' },
  pending: { dot: '#484f58', border: '#30363d', bg: 'transparent' },
}

export default function AgentFlowView({ projectId: _projectId }: Props) {
  return (
    <div
      className="agent-flow-view"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0d1117',
        color: '#e6edf3',
        gap: 24,
      }}
    >
      {/* Title */}
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>
        Agent Flow Visualization
      </h2>

      {/* Subtitle */}
      <p style={{ margin: 0, fontSize: 14, color: '#8b949e' }}>
        实时查看 AI 代理执行流程
      </p>

      {/* Timeline */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          marginTop: 8,
          width: 300,
        }}
      >
        {MOCK_STEPS.map((step, i) => {
          const styles = STATUS_STYLES[step.status]
          const isLast = i === MOCK_STEPS.length - 1
          return (
            <div key={step.label}>
              {/* Step card */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  background: styles.bg,
                  border: `1px solid ${styles.border}`,
                  borderRadius: 8,
                }}
              >
                {/* Status indicator */}
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: styles.dot,
                    flexShrink: 0,
                    boxShadow: step.status === 'active'
                      ? `0 0 8px ${styles.dot}`
                      : 'none',
                  }}
                />

                {/* Icon */}
                <span style={{ fontSize: 20, lineHeight: 1 }}>{step.icon}</span>

                {/* Labels */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{step.label}</div>
                  <div style={{ fontSize: 11, color: '#8b949e' }}>{step.sublabel}</div>
                </div>
              </div>

              {/* Connector line between steps */}
              {!isLast && (
                <div
                  style={{
                    width: 2,
                    height: 20,
                    background: '#30363d',
                    marginLeft: 20,
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Footer note */}
      <p
        style={{
          margin: '16px 0 0',
          fontSize: 12,
          color: '#484f58',
          fontStyle: 'italic',
        }}
      >
        Full agent flow visualization available in M2
      </p>
    </div>
  )
}
