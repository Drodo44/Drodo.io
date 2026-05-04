import { useRef, useState } from 'react'
import { Plus, X, Check, Minimize2 } from 'lucide-react'
import { clsx } from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../../store/appStore'

export function ChatSessionTabs() {
  const { chatSessions, activeChatSessionId, createChatSession, switchChatSession, closeChatSession, renameChatSession, compactChatSession } =
    useAppStore(
      useShallow(s => ({
        chatSessions: s.chatSessions,
        activeChatSessionId: s.activeChatSessionId,
        createChatSession: s.createChatSession,
        switchChatSession: s.switchChatSession,
        closeChatSession: s.closeChatSession,
        renameChatSession: s.renameChatSession,
        compactChatSession: s.compactChatSession,
      }))
    )

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const startEdit = (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(id)
    setEditValue(currentName)
  }

  const commitEdit = () => {
    if (editingId && editValue.trim()) {
      renameChatSession(editingId, editValue.trim())
    }
    setEditingId(null)
    setEditValue('')
  }

  return (
    <div
      className="flex items-stretch flex-shrink-0 overflow-hidden"
      style={{
        height: 36,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      {/* Scrollable tab list */}
      <div
        ref={scrollRef}
        className="flex items-stretch flex-1 overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {chatSessions.map(session => {
          const isActive = session.id === activeChatSessionId

          return (
            <div
              key={session.id}
              onClick={() => switchChatSession(session.id)}
              className={clsx(
                'relative flex items-center gap-1.5 px-3 flex-shrink-0 cursor-pointer select-none group transition-colors',
                isActive
                  ? 'text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-muted)] hover:bg-[var(--border-color)]/30'
              )}
              style={{
                maxWidth: 160,
                minWidth: 80,
                borderRight: '1px solid var(--border-color)',
                background: isActive ? 'var(--bg-primary)' : undefined,
                boxShadow: isActive ? 'inset 0 -2px 0 #7f77dd' : undefined,
              }}
            >
              {editingId === session.id ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitEdit()
                    if (e.key === 'Escape') { setEditingId(null); setEditValue('') }
                    e.stopPropagation()
                  }}
                  onClick={e => e.stopPropagation()}
                  className="flex-1 min-w-0 bg-transparent text-xs text-[var(--text-primary)] outline-none border-b border-[#7f77dd]/60"
                  style={{ width: '100%' }}
                />
              ) : (
                <span
                  className="flex-1 min-w-0 truncate text-xs font-medium"
                  onDoubleClick={e => startEdit(session.id, session.name, e)}
                  title={`${session.name} (double-click to rename)`}
                >
                  {session.name}
                </span>
              )}

              {editingId === session.id ? (
                <button
                  onClick={e => { e.stopPropagation(); commitEdit() }}
                  className="flex-shrink-0 text-[#1d9e75] p-0.5"
                >
                  <Check size={10} />
                </button>
              ) : chatSessions.length > 1 ? (
                <button
                  onClick={e => { e.stopPropagation(); closeChatSession(session.id) }}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-[var(--border-color)] hover:text-[var(--text-primary)]"
                  title="Close session"
                >
                  <X size={10} />
                </button>
              ) : null}
            </div>
          )
        })}
      </div>

      {/* Compact button */}
      {(chatSessions.find(s => s.id === activeChatSessionId)?.messages?.length ?? 0) > 10 && (
        <button
          onClick={() => compactChatSession(activeChatSessionId)}
          className="flex items-center justify-center px-2.5 flex-shrink-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-color)]/40 transition-colors"
          style={{ borderLeft: '1px solid var(--border-color)' }}
        >
          <Minimize2 size={12} /><span className="text-xs ml-1">Compact</span>
        </button>
      )}

      {/* New session button */}
      <button
        onClick={createChatSession}
        title="New chat session"
        className="flex items-center justify-center px-2.5 flex-shrink-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-color)]/40 transition-colors"
        style={{ borderLeft: '1px solid var(--border-color)' }}
      >
        <Plus size={14} />
      </button>
    </div>
  )
}
