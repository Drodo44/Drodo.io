import { useEffect, useRef } from 'react'
import { Plug } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../../store/appStore'
import { MessageBubble } from '../chat/MessageBubble'
import { ChatInput } from '../chat/ChatInput'
import { ChatSessionTabs } from '../chat/ChatSessionTabs'

export function ChatPanel() {
  const { messages, agentRunning, activeProvider, setView } = useAppStore(
    useShallow(s => ({
      messages: s.messages,
      agentRunning: s.agentRunning,
      activeProvider: s.activeProvider,
      setView: s.setView,
    }))
  )
  const noProvider = !activeProvider.isLocal && !activeProvider.apiKey
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0" style={{ background: 'var(--bg-primary)' }}>
      {/* Session tabs */}
      <ChatSessionTabs />

      {/* Messages scroll area */}
      <div className="flex-1 overflow-y-auto px-6 py-4" style={{ scrollbarGutter: 'stable' }}>
        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isLast={i === messages.length - 1}
          />
        ))}

        {/* No provider inline card */}
        {noProvider && (
          <div className="flex gap-3 mb-4 animate-fade-in">
            <div
              className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold mt-1"
              style={{ background: 'linear-gradient(135deg, #7f77dd, #5a52b0)', color: '#fff' }}
            >
              D
            </div>
            <div
              className="px-4 py-3 rounded-2xl rounded-tl-sm border text-sm leading-relaxed"
              style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-muted)', maxWidth: '75%' }}
            >
              No model connected yet.{' '}
              <button
                onClick={() => setView('connections')}
                className="font-semibold transition-colors hover:opacity-80"
                style={{ color: '#7f77dd' }}
              >
                <Plug size={12} className="inline -mt-0.5 mr-0.5" />
                Connect your first model →
              </button>
            </div>
          </div>
        )}

        {/* Typing indicator */}
        {agentRunning && !messages[messages.length - 1]?.streaming && (
          <div className="flex gap-3 mb-4 animate-fade-in">
            <div
              className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold"
              style={{ background: 'linear-gradient(135deg, #7f77dd, #5a52b0)', color: '#fff' }}
            >
              D
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] animate-pulse-dot" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] animate-pulse-dot" style={{ animationDelay: '200ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] animate-pulse-dot" style={{ animationDelay: '400ms' }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput />
    </div>
  )
}
