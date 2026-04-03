import { clsx } from 'clsx'
import type { Message } from '../../types'

interface MessageBubbleProps {
  message: Message
  isLast?: boolean
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function MessageBubble({ message, isLast }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  if (isSystem) {
    return (
      <div className="flex justify-center my-3">
        <span className="text-xs text-[#6b6b78] bg-[#1c1c22] border border-[#2a2a2e] px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    )
  }

  return (
    <div
      className={clsx(
        'flex gap-3 mb-4 animate-fade-in',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      {!isUser && (
        <div
          className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold mt-1"
          style={{ background: 'linear-gradient(135deg, #7f77dd, #5a52b0)', color: '#fff' }}
        >
          D
        </div>
      )}

      <div className={clsx('flex flex-col gap-1 max-w-[75%]', isUser && 'items-end')}>
        {/* Bubble */}
        <div
          className={clsx(
            'px-4 py-3 rounded-2xl text-sm leading-relaxed',
            isUser
              ? 'bg-[#7f77dd]/15 border border-[#7f77dd]/25 text-[#e8e8ef] rounded-tr-sm'
              : 'bg-[#141418] border border-[#2a2a2e] text-[#e8e8ef] rounded-tl-sm'
          )}
        >
          <span className="whitespace-pre-wrap break-words">{message.content}</span>
          {message.streaming && isLast && (
            <span className="inline-block w-0.5 h-4 bg-[#7f77dd] ml-0.5 -mb-0.5 animate-blink" />
          )}
        </div>

        {/* Timestamp */}
        <span className="text-xs text-[#6b6b78] px-1">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  )
}
