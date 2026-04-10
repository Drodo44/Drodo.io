import { clsx } from 'clsx'
import type { Message } from '../../types'

interface MessageBubbleProps {
  message: Message
  isLast?: boolean
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function sanitizeChatContent(content: string): string {
  // Strip XML tool call blocks the LLM may emit
  let out = content
    .replace(/<function_calls>[\s\S]*?<\/antml:function_calls>/g, '')
    .replace(/<function_calls>[\s\S]*?<\/function_calls>/g, '')
    .replace(/<tool_use>[\s\S]*?<\/tool_use>/g, '')
    .replace(/<tool_result>[\s\S]*?<\/tool_result>/g, '')
    .trim()

  // Strip bare tool-call JSON lines: lines like {"tool":"...","arguments":{...}}
  out = out
    .split('\n')
    .filter(line => {
      const t = line.trim()
      if (!t.startsWith('{')) return true
      try {
        const parsed = JSON.parse(t) as Record<string, unknown>
        // Drop lines that look like tool call objects
        if ('tool' in parsed && 'arguments' in parsed) return false
        if ('tool_name' in parsed) return false
      } catch {
        // Not valid JSON — keep the line
      }
      return true
    })
    .join('\n')
    .trim()

  return out
}

export function MessageBubble({ message, isLast }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  if (isSystem) {
    return (
      <div className="flex justify-center my-3">
        <span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-tertiary)] border border-[var(--border-color)] px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    )
  }

  const displayContent = isUser ? message.content : sanitizeChatContent(message.content)

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
              ? 'bg-[#7f77dd]/15 border border-[#7f77dd]/25 text-[var(--text-primary)] rounded-tr-sm'
              : 'bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-tl-sm'
          )}
        >
          <span className="whitespace-pre-wrap break-words">{displayContent}</span>
          {message.streaming && isLast && (
            <span className="inline-block w-0.5 h-4 bg-[#7f77dd] ml-0.5 -mb-0.5 animate-blink" />
          )}
        </div>

        {/* Timestamp */}
        <span className="text-xs text-[var(--text-secondary)] px-1">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  )
}
