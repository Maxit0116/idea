interface WelcomeScreenProps {
  onOpenProject: () => void
  error: string | null
}

export function WelcomeScreen({ onOpenProject, error }: WelcomeScreenProps) {
  return (
    <div className="welcome">
      <div className="welcome-content">
        <div className="welcome-logo">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <rect width="64" height="64" rx="16" fill="#1a1a2e" />
            <circle cx="22" cy="24" r="6" fill="#7c9aed" />
            <circle cx="42" cy="24" r="6" fill="#22c55e" />
            <circle cx="32" cy="42" r="6" fill="#f59e0b" />
            <line x1="26" y1="28" x2="38" y2="38" stroke="#444" strokeWidth="2" />
            <line x1="38" y1="28" x2="26" y2="38" stroke="#444" strokeWidth="2" />
            <line x1="22" y1="30" x2="22" y2="36" stroke="#444" strokeWidth="2" />
          </svg>
        </div>
        <h1>Project OS</h1>
        <p className="welcome-subtitle">
          See your software structure. Point and edit. Ship faster.
        </p>
        <button className="welcome-btn" onClick={onOpenProject}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
          Open Project
        </button>
        <p className="welcome-hint">Select a Next.js project folder to get started</p>
        {error && <div className="welcome-error">{error}</div>}
      </div>
    </div>
  )
}
