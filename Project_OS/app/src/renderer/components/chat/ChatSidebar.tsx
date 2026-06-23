import React, { useState, useRef, useEffect } from 'react'

interface Props {
  projectId: string | null
  selectedNodeId: string | null
}

interface Message {
  id: string
  role: 'assistant' | 'user'
  content: string
  timestamp: Date
}

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: '你好！我是 Project OS 助手。选择一个功能节点，我可以帮你理解代码结构。',
  timestamp: new Date(),
}

export default function ChatSidebar({ projectId, selectedNodeId }: Props) {
  const [messages] = useState<Message[]>([WELCOME_MESSAGE])
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`
    }
  }, [inputValue])

  return (
    <div className="chat-sidebar">
      <div className="chat-sidebar__header">
        <div className="chat-sidebar__header-left">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
            <path
              d="M2.5 3C2.5 2.44772 2.94772 2 3.5 2H12.5C13.0523 2 13.5 2.44772 13.5 3V10C13.5 10.5523 13.0523 11 12.5 11H5L2.5 13.5V3Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
          <span className="chat-sidebar__title">AI Assistant</span>
        </div>
        <span className="chat-sidebar__model-badge">Claude Sonnet</span>
      </div>

      <div className="chat-sidebar__messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-sidebar__message chat-sidebar__message--${msg.role}`}>
            {msg.role === 'assistant' && (
              <div className="chat-sidebar__avatar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="6" cy="6.5" r="1" fill="currentColor" />
                  <circle cx="10" cy="6.5" r="1" fill="currentColor" />
                  <path d="M5.5 10C6 11 7 11.5 8 11.5C9 11.5 10 11 10.5 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </div>
            )}
            <div className="chat-sidebar__bubble">
              <p>{msg.content}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-sidebar__input-area">
        {selectedNodeId && (
          <div className="chat-sidebar__context-badge">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 5V8.5L10.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Context: {selectedNodeId}</span>
            <button className="chat-sidebar__context-dismiss" title="Remove context">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
        <div className="chat-sidebar__input-row">
          <textarea
            ref={textareaRef}
            className="chat-sidebar__textarea"
            placeholder="Ask about this codebase..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            rows={1}
          />
          <button
            className="chat-sidebar__send-btn"
            disabled
            title="Chat available in M2"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 8L14 2L10 14L8 9L2 8Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <span className="chat-sidebar__hint">Chat available in M2</span>
      </div>
    </div>
  )
}
