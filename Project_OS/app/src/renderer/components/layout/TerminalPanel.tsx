import React, { useState } from 'react'

export default function TerminalPanel() {
  const [minimized, setMinimized] = useState(false)

  if (minimized) {
    return (
      <div className="terminal-panel terminal-panel--minimized">
        <div className="terminal-panel__header">
          <span className="terminal-panel__title">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M4 7L6 9L4 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 11H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Terminal
          </span>
          <button
            className="terminal-panel__btn"
            onClick={() => setMinimized(false)}
            title="Restore Terminal"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="terminal-panel">
      <div className="terminal-panel__header">
        <span className="terminal-panel__title">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M4 7L6 9L4 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 11H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Terminal
        </span>
        <div className="terminal-panel__actions">
          <span className="terminal-panel__badge">bash</span>
          <button
            className="terminal-panel__btn"
            onClick={() => setMinimized(true)}
            title="Minimize Terminal"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M4 8H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
      <div className="terminal-panel__content">
        <div className="terminal-panel__line">
          <span className="terminal-panel__prompt">$&nbsp;</span>
          <span className="terminal-panel__cursor" />
        </div>
        <div className="terminal-panel__notice">
          Terminal integration available in M2
        </div>
      </div>
    </div>
  )
}
