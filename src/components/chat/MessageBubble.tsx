import { useState } from 'react'
import { clsx } from 'clsx'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check, Paperclip } from 'lucide-react'
import type { Message } from '../../types'

interface MessageBubbleProps {
  message: Message
  isLast?: boolean
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function sanitizeChatContent(content: string): string {
  let out = content
    .replace(/<function_calls>[\s\S]*?<\/antml:function_calls>/g, '')
    .replace(/<function_calls>[\s\S]*?<\/function_calls>/g, '')
    .replace(/<tool_use>[\s\S]*?<\/tool_use>/g, '')
    .replace(/<tool_result>[\s\S]*?<\/tool_result>/g, '')
    .trim()

  out = out
    .split('\n')
    .filter(line => {
      const t = line.trim()
      if (!t.startsWith('{')) return true
      try {
        const parsed = JSON.parse(t) as Record<string, unknown>
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    void navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
      style={{ background: 'var(--bg-tertiary)', color: copied ? '#1d9e75' : 'var(--text-secondary)' }}
      title="Copy message"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  )
}

export function MessageBubble({ message, isLast }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const attachments = message.attachments ?? []
  const hasAttachments = attachments.length > 0

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
  const hasTextContent = displayContent.trim().length > 0

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
            'relative group px-4 py-3 rounded-2xl text-sm leading-relaxed',
            isUser
              ? 'bg-[#7f77dd]/15 border border-[#7f77dd]/25 text-[var(--text-primary)] rounded-tr-sm'
              : 'bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-tl-sm'
          )}
        >
          {!isUser && <CopyButton text={displayContent} />}
          {isUser ? (
            <div className="space-y-2">
              {hasTextContent && (
                <span className="whitespace-pre-wrap break-words block">{displayContent}</span>
              )}
              {hasAttachments && (
                <div className="flex flex-wrap gap-2">
                  {attachments.map(attachment => (
                    <span
                      key={attachment.path}
                      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
                      style={{ borderColor: '#7f77dd33', background: '#7f77dd14', color: 'var(--text-primary)' }}
                    >
                      <Paperclip size={11} />
                      {attachment.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="drodo-prose">
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '')
                    const codeString = String(children).replace(/\n$/, '')
                    // Block code: has a language class or contains newlines
                    if (match || (codeString.includes('\n') && !className)) {
                      return (
                        <SyntaxHighlighter
                          style={oneDark}
                          language={match?.[1] ?? 'text'}
                          PreTag="div"
                          customStyle={{ margin: '0.5em 0', borderRadius: 8, fontSize: '0.8125rem' }}
                        >
                          {codeString}
                        </SyntaxHighlighter>
                      )
                    }
                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    )
                  },
                }}
              >
                {displayContent}
              </Markdown>
            </div>
          )}
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
