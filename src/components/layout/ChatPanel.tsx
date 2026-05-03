import { useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Plug } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../../store/appStore'
import { MessageBubble } from '../chat/MessageBubble'
import { ChatInput } from '../chat/ChatInput'
import { ChatSessionTabs } from '../chat/ChatSessionTabs'

export function ChatPanel() {
  const { messages, agentRunning, activeProvider, setView, activeChatSessionId, compactChatSession } = useAppStore(
    useShallow(s => ({
      messages: s.messages,
      agentRunning: s.agentRunning,
      activeProvider: s.activeProvider,
      setView: s.setView,
      activeChatSessionId: s.activeChatSessionId,
      compactChatSession: s.compactChatSession,
    }))
  )
  const noProvider = !activeProvider.isLocal && !activeProvider.apiKey
  const parentRef = useRef<HTMLDivElement>(null)
  const sessionMountTimeRef = useRef(Date.now())
  const [bannerDismissedAt, setBannerDismissedAt] = useState<number | null>(null)
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: index => {
      const message = messages[index]
      const base = message.role === 'assistant' ? 120 : 88
      const contentWeight = Math.min(message.content.length, 2400) / 12
      const attachmentWeight = (message.attachments?.length ?? 0) * 28
      return base + contentWeight + attachmentWeight
    },
    overscan: 8,
  })

  useEffect(() => {
    sessionMountTimeRef.current = Date.now()
    setBannerDismissedAt(null)
  }, [activeChatSessionId])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const scrollElement = parentRef.current
    if (!scrollElement || messages.length === 0) return
    scrollElement.scrollTop = scrollElement.scrollHeight
  }, [activeChatSessionId])

  useEffect(() => {
    const scrollElement = parentRef.current
    const lastMessage = messages[messages.length - 1]
    if (!scrollElement || !lastMessage) return

    const isNearBottom = scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight < 160
    if (!isNearBottom && !lastMessage.streaming) {
      return
    }

    const behavior: ScrollBehavior = lastMessage.streaming ? 'auto' : 'smooth'
    window.requestAnimationFrame(() => {
      scrollElement.scrollTo({
        top: scrollElement.scrollHeight,
        behavior,
      })
    })
  }, [messages, virtualizer])

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0" style={{ background: 'var(--bg-primary)' }}>
      {/* Session tabs */}
      <ChatSessionTabs />

      {/* Messages scroll area */}
      <div ref={parentRef} className="flex-1 overflow-y-auto px-6 py-4" style={{ scrollbarGutter: 'stable' }}>
        <div
          className="relative w-full"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualizer.getVirtualItems().map(virtualRow => {
            const msg = messages[virtualRow.index]
            return (
              <div
                key={msg.id}
                ref={virtualizer.measureElement}
                data-index={virtualRow.index}
                className="absolute left-0 top-0 w-full"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <MessageBubble
                  message={msg}
                  isLast={virtualRow.index === messages.length - 1}
                  isNew={msg.timestamp.getTime() > sessionMountTimeRef.current}
                />
              </div>
            )
          })}
        </div>

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

      </div>

      {/* Compaction banner */}
      {(() => {
        const estimatedTokens = messages.reduce((sum, m) => sum + m.content.length, 0) / 4
        const showBanner = estimatedTokens > 100_000 && (bannerDismissedAt === null || estimatedTokens > bannerDismissedAt + 20_000)
        if (!showBanner) return null
        return (
          <div
            className="flex items-center gap-3 px-4 py-2 text-sm flex-shrink-0"
            style={{
              background: 'rgba(234, 179, 8, 0.12)',
              borderTop: '1px solid rgba(234, 179, 8, 0.4)',
              color: 'var(--text-primary)',
            }}
          >
            <span className="flex-1">
              This chat is getting long (~{Math.round(estimatedTokens / 1000)}k tokens). Compact it to keep responses fast.
            </span>
            <button
              onClick={() => compactChatSession(activeChatSessionId)}
              className="px-2.5 py-1 rounded text-xs font-semibold transition-colors"
              style={{ background: 'rgba(234, 179, 8, 0.3)', color: 'var(--text-primary)' }}
            >
              Compact
            </button>
            <button
              onClick={() => setBannerDismissedAt(estimatedTokens)}
              className="px-2 py-1 rounded text-xs transition-colors hover:bg-[var(--border-color)]/40"
              style={{ color: 'var(--text-secondary)' }}
            >
              Dismiss
            </button>
          </div>
        )
      })()}

      {/* Input */}
      <ChatInput />
    </div>
  )
}
