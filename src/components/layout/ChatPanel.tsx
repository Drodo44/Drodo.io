import { useEffect, useRef } from 'react'
import { useAppStore } from '../../store/appStore'
import { MessageBubble } from '../chat/MessageBubble'
import { ChatInput } from '../chat/ChatInput'

export function ChatPanel() {
  const messages = useAppStore(s => s.messages)
  const agentRunning = useAppStore(s => s.agentRunning)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0" style={{ background: '#0d0d0f' }}>
      {/* Messages scroll area */}
      <div className="flex-1 overflow-y-auto px-6 py-4" style={{ scrollbarGutter: 'stable' }}>
        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isLast={i === messages.length - 1}
          />
        ))}

        {/* Typing indicator */}
        {agentRunning && !messages[messages.length - 1]?.streaming && (
          <div className="flex gap-3 mb-4 animate-fade-in">
            <div
              className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold"
              style={{ background: 'linear-gradient(135deg, #7f77dd, #5a52b0)', color: '#fff' }}
            >
              D
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-[#141418] border border-[#2a2a2e] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#6b6b78] animate-pulse-dot" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-[#6b6b78] animate-pulse-dot" style={{ animationDelay: '200ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-[#6b6b78] animate-pulse-dot" style={{ animationDelay: '400ms' }} />
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
