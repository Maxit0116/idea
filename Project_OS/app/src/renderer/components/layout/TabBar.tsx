import React from 'react'

interface Props {
  activeTab: 'function-map' | 'agent-flow' | 'code'
  onTabChange: (tab: 'function-map' | 'agent-flow' | 'code') => void
  showTerminal: boolean
  onToggleTerminal: () => void
  showChat: boolean
  onToggleChat: () => void
}

const tabs = [
  {
    id: 'function-map' as const,
    label: 'Function Map',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="10" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="5.5" y="10" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3.5 6V8.5H8M12.5 6V8.5H8M8 8.5V10" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: 'agent-flow' as const,
    label: 'Agent Flow',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="2.5" r="2" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="8" cy="13.5" r="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 4.5V7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 9L8 7L12 9" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 7V11.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="4" cy="9.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="12" cy="9.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: 'code' as const,
    label: 'Code',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M9.5 1.5H4C3.44772 1.5 3 1.94772 3 2.5V13.5C3 14.0523 3.44772 14.5 4 14.5H12C12.5523 14.5 13 14.0523 13 13.5V5L9.5 1.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M9.5 1.5V5H13" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M6 8.5L5 10L6 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 8.5L11 10L10 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

export default function TabBar({
  activeTab,
  onTabChange,
  showTerminal,
  onToggleTerminal,
  showChat,
  onToggleChat,
}: Props) {
  return (
    <div className="tab-bar">
      <div className="tab-bar__tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-bar__tab ${activeTab === tab.id ? 'tab-bar__tab--active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="tab-bar__tab-icon">{tab.icon}</span>
            <span className="tab-bar__tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Draggable spacer for macOS window dragging */}
      <div className="tab-bar__spacer" />

      <div className="tab-bar__actions">
        <button
          className={`tab-bar__toggle ${showTerminal ? 'tab-bar__toggle--active' : ''}`}
          onClick={onToggleTerminal}
          title={showTerminal ? 'Hide Terminal' : 'Show Terminal'}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M4 7L6 9L4 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 11H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <button
          className={`tab-bar__toggle ${showChat ? 'tab-bar__toggle--active' : ''}`}
          onClick={onToggleChat}
          title={showChat ? 'Hide Chat' : 'Show Chat'}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M2.5 3C2.5 2.44772 2.94772 2 3.5 2H12.5C13.0523 2 13.5 2.44772 13.5 3V10C13.5 10.5523 13.0523 11 12.5 11H5L2.5 13.5V3Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path d="M5 5.5H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M5 8H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
