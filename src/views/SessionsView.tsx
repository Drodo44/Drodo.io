import { Clock, Plus, MessageSquare, Cpu, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { loadSessions, deleteSession, formatRelativeTime } from '../lib/dashboardData'
import { useAppStore } from '../store/appStore'
import type { Session } from '../types'

export function SessionsView() {
  const { setSessionName, setView, startNewSession } = useAppStore(
    useShallow(s => ({
      setSessionName: s.setSessionName,
      setView: s.setView,
      startNewSession: s.startNewSession,
    }))
  )
  const [query, setQuery] = useState('')
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  useEffect(() => {
    const syncSessions = () => {
      setSessions(loadSessions())
      setLoading(false)
    }

    syncSessions()
    window.addEventListener('storage', syncSessions)
    return () => window.removeEventListener('storage', syncSessions)
  }, [])

  const filteredSessions = useMemo(
    () => sessions.filter(session => session.name.toLowerCase().includes(query.toLowerCase())),
    [query, sessions]
  )

  const openSession = (session: Session) => {
    setSessionName(session.name)
    setView('agent')
  }

  const handleDelete = (sessionId: string) => {
    setSessions(deleteSession(sessionId))
    setPendingDeleteId(current => (current === sessionId ? null : current))
  }

  const hasSessions = sessions.length > 0
  const hasMatches = filteredSessions.length > 0

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <div
        className="flex items-center justify-between px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#7f77dd22' }}>
            <Clock size={18} style={{ color: '#7f77dd' }} />
          </div>
          <div>
            <h1 className="font-bold text-[var(--text-primary)] text-lg">Sessions</h1>
            <p className="text-xs text-[var(--text-secondary)]">{sessions.length} sessions</p>
          </div>
        </div>
        <button
          onClick={() => {
            startNewSession()
            setView('agent')
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#7f77dd' }}
        >
          <Plus size={14} />
          New Session
        </button>
      </div>

      <div className="px-6 py-3" style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)]">
          <Search size={14} className="text-[var(--text-secondary)]" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search sessions..."
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <LoadingSpinner label="Loading sessions…" />
        ) : !hasSessions ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--bg-tertiary)]">
              <Clock size={28} className="text-[var(--text-secondary)]" />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-[var(--text-primary)]">No sessions yet</h2>
            <p className="mt-2 max-w-md text-sm text-[var(--text-secondary)]">
              Start a conversation to see it saved here.
            </p>
            <button
              onClick={() => {
                startNewSession()
                setView('agent')
              }}
              className="mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{ background: '#7f77dd' }}
            >
              <Plus size={14} />
              Start Conversation
            </button>
          </div>
        ) : !hasMatches ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--bg-tertiary)]">
              <Search size={28} className="text-[var(--text-secondary)]" />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-[var(--text-primary)]">No matching sessions</h2>
            <p className="mt-2 max-w-md text-sm text-[var(--text-secondary)]">
              Try a different search term to find a saved conversation.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSessions.map(session => (
              <div
                key={session.id}
                className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 transition-colors hover:border-[var(--border-color)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => openSession(session)}
                    className="flex-1 min-w-0 text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <h3 className="truncate text-sm font-semibold text-[var(--text-primary)] transition-colors group-hover:text-[#a09ae8]">
                        {session.name}
                      </h3>
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{ background: '#7f77dd18', color: '#a09ae8' }}
                      >
                        <Cpu size={11} />
                        {session.model}
                      </span>
                    </div>
                    {session.preview && (
                      <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">{session.preview}</p>
                    )}
                  </button>

                  {pendingDeleteId === session.id ? (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-[var(--text-muted)]">Delete?</span>
                      <button
                        onClick={() => handleDelete(session.id)}
                        className="rounded-lg px-2.5 py-1 text-xs font-semibold text-white"
                        style={{ background: '#e05050' }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setPendingDeleteId(null)}
                        className="rounded-lg border border-[var(--border-color)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setPendingDeleteId(session.id)}
                      className="rounded-lg border border-[var(--border-color)] p-2 text-[var(--text-secondary)] transition-colors hover:text-[#e05050]"
                      aria-label={`Delete ${session.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-4 text-xs text-[var(--text-secondary)]">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare size={11} />
                    {session.messageCount} messages
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock size={11} />
                    {formatRelativeTime(session.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
