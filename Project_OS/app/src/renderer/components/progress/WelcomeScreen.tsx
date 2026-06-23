interface Props {
  onOpen: () => void
  error: string | null
}

export default function WelcomeScreen({ onOpen, error }: Props) {
  return (
    <div
      className="welcome-screen"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0d1117',
        color: '#e6edf3',
        gap: 16,
      }}
    >
      {/* Logo text */}
      <h1
        style={{
          margin: 0,
          fontSize: 42,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          background: 'linear-gradient(135deg, #58a6ff 0%, #bc8cff 50%, #f778ba 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        Project OS
      </h1>

      {/* Subtitle */}
      <p
        style={{
          margin: 0,
          fontSize: 16,
          color: '#8b949e',
          letterSpacing: '0.05em',
        }}
      >
        智能代码结构引擎
      </p>

      {/* Open Project button */}
      <button
        onClick={onOpen}
        style={{
          marginTop: 24,
          padding: '10px 32px',
          fontSize: 14,
          fontWeight: 600,
          color: '#ffffff',
          background: '#238636',
          border: '1px solid rgba(240, 246, 252, 0.1)',
          borderRadius: 6,
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#2ea043'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#238636'
        }}
      >
        Open Project
      </button>

      {/* Error message */}
      {error && (
        <div
          style={{
            marginTop: 16,
            padding: '10px 16px',
            background: 'rgba(248, 81, 73, 0.1)',
            border: '1px solid rgba(248, 81, 73, 0.4)',
            borderRadius: 6,
            color: '#f85149',
            fontSize: 13,
            maxWidth: 400,
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}
