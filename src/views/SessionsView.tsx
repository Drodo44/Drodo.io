import { Clock, Plus, MessageSquare, Cpu, Search } from 'lucide-react'
import { useState } from 'react'
import type { Session } from '../types'

const MOCK_SESSIONS: Session[] = [
  { id: 's1', name: 'Auth Module Test Suite', createdAt: new Date(Date.now() - 5000), messageCount: 12, model: 'claude-sonnet-4-6' },
  { id: 's2', name: 'Database Schema Design', createdAt: new Date(Date.now() - 7200000), messageCount: 34, model: 'gpt-4o' },
  { id: 's3', name: 'API Endpoint Refactor', createdAt: new Date(Date.now() - 86400000), messageCount: 8, model: 'claude-sonnet-4-6' },
  { id: 's4', name: 'Performance Audit', createdAt: new Date(Date.now() - 172800000), messageCount: 21, model: 'llama3.2' },
  { id: 's5', name: 'Mobile Push Notifications', createdAt: new Date(Date.now() - 259200000), messageCount: 16, model: 'gpt-4o' },
  { id: 's6', name: 'CI/CD Pipeline Setup', createdAt: new Date(Date.now() - 345600000), messageCount: 9, model: 'claude-sonnet-4-6' },
  { id: 's7', name: 'Payment Integration', createdAt: new Date(Date.now() - 432000000), messageCount: 45, model: 'gpt-4o' },
  { id: 's8', name: 'Docker Compose Config', createdAt: new Date(Date.now() - 604800000), messageCount: 7, model: 'llama3.2' },
]

function formatDate(d: Date) {
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function SessionsView() {
  const [query, setQuery] = useState('')
  const filtered = MOCK_SESSIONS.filter(s => s.name.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: '#0d0d0f' }}>
      {/* Header */}
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
            <p className="text-xs text-[#6b6b78]">{MOCK_SESSIONS.length} sessions</p>
          </div>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#7f77dd' }}
        >
          <Plus size={14} />
          New Session
        </button>
      </div>

      {/* Search */}
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

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead
            className="sticky top-0"
            style={{ background: '#141418', borderBottom: '1px solid #2a2a2e' }}
          >
            <tr>
              <th className="text-left px-6 py-3 text-xs font-semibold text-[#6b6b78] uppercase tracking-wider">Session</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#6b6b78] uppercase tracking-wider">Model</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#6b6b78] uppercase tracking-wider">Messages</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#6b6b78] uppercase tracking-wider">Created</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((session, i) => (
              <tr
                key={session.id}
                className="border-b border-[#2a2a2e] hover:bg-[#141418] cursor-pointer transition-colors group"
              >
                <td className="px-6 py-3.5">
                  <span className="font-medium text-[#e8e8ef] group-hover:text-[#a09ae8] transition-colors">
                    {session.name}
                  </span>
                  {i === 0 && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full" style={{ background: '#1d9e7520', color: '#1d9e75' }}>
                      Active
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <span className="flex items-center gap-1.5 text-xs text-[#9898a8]">
                    <Cpu size={11} />
                    {session.model}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="flex items-center gap-1.5 text-xs text-[#9898a8]">
                    <MessageSquare size={11} />
                    {session.messageCount}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-xs text-[#6b6b78]">{formatDate(session.createdAt)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
