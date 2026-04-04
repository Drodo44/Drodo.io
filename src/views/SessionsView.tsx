import { Clock, Plus, MessageSquare, Cpu, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
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
  const [sessions, setSessions] = useState<Session[]>(() => loadSessions())
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  useEffect(() => {
    const syncSessions = () => setSessions(loadSessions())
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
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: '#0d0d0f' }}>
      <div
        className="flex items-center justify-between px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid #2a2a2e', background: '#141418' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#7f77dd22' }}>
            <Clock size={18} style={{ color: '#7f77dd' }} />
          </div>
          <div>
            <h1 className="font-bold text-[#e8e8ef] text-lg">Sessions</h1>
            <p className="text-xs text-[#6b6b78]">{sessions.length} sessions</p>
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

      <div className="px-6 py-3" style={{ borderBottom: '1px solid #2a2a2e', background: '#141418' }}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0d0d0f] border border-[#2a2a2e]">
          <Search size={14} className="text-[#6b6b78]" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search sessions..."
            className="flex-1 bg-transparent text-sm text-[#e8e8ef] placeholder-[#6b6b78] outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {!hasSessions ? (
          <div className="rounded-2xl border border-[#2a2a2e] bg-[#141418] p-8 text-center">
            <p className="text-sm text-[#9898a8]">No sessions yet. Start a conversation to see it saved here.</p>
          </div>
        ) : !hasMatches ? (
          <div className="rounded-2xl border border-[#2a2a2e] bg-[#141418] p-8 text-center">
            <p className="text-sm text-[#9898a8]">No sessions match your search.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSessions.map(session => (
              <div
                key={session.id}
                className="rounded-2xl border border-[#2a2a2e] bg-[#141418] p-4 transition-colors hover:border-[#3a3a42]"
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => openSession(session)}
                    className="flex-1 min-w-0 text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <h3 className="truncate text-sm font-semibold text-[#e8e8ef] transition-colors group-hover:text-[#a09ae8]">
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
                      <p className="mt-2 text-xs leading-relaxed text-[#9898a8]">{session.preview}</p>
                    )}
                  </button>

                  {pendingDeleteId === session.id ? (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-[#9898a8]">Delete?</span>
                      <button
                        onClick={() => handleDelete(session.id)}
                        className="rounded-lg px-2.5 py-1 text-xs font-semibold text-white"
                        style={{ background: '#e05050' }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setPendingDeleteId(null)}
                        className="rounded-lg border border-[#2a2a2e] px-2.5 py-1 text-xs font-medium text-[#9898a8]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setPendingDeleteId(session.id)}
                      className="rounded-lg border border-[#2a2a2e] p-2 text-[#6b6b78] transition-colors hover:text-[#e05050]"
                      aria-label={`Delete ${session.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-4 text-xs text-[#6b6b78]">
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
