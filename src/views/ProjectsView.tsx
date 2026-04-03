import { FolderOpen, Plus, Clock, MessageSquare, Zap } from 'lucide-react'
import type { Project } from '../types'

const MOCK_PROJECTS: Project[] = [
  { id: 'p1', name: 'E-Commerce Platform', description: 'Full-stack Next.js shop with Stripe integration and inventory management', sessionsCount: 24, lastActivity: new Date(Date.now() - 3600000), status: 'active' },
  { id: 'p2', name: 'Analytics Dashboard', description: 'Real-time data visualization using D3.js and WebSocket streams', sessionsCount: 11, lastActivity: new Date(Date.now() - 86400000), status: 'active' },
  { id: 'p3', name: 'Auth Microservice', description: 'JWT + OAuth2 authentication service with Redis session storage', sessionsCount: 8, lastActivity: new Date(Date.now() - 172800000), status: 'paused' },
  { id: 'p4', name: 'Mobile App Backend', description: 'REST API for React Native app — user profiles, notifications, push', sessionsCount: 31, lastActivity: new Date(Date.now() - 7200000), status: 'active' },
  { id: 'p5', name: 'Data Pipeline', description: 'ETL pipeline processing 10M records/day with Apache Kafka', sessionsCount: 6, lastActivity: new Date(Date.now() - 604800000), status: 'complete' },
  { id: 'p6', name: 'ML Model Serving', description: 'FastAPI inference server with model versioning and A/B testing', sessionsCount: 3, lastActivity: new Date(Date.now() - 259200000), status: 'paused' },
]

const STATUS_CFG = {
  active: { color: '#1d9e75', bg: '#1d9e7515', label: 'Active' },
  paused: { color: '#d4a227', bg: '#d4a22715', label: 'Paused' },
  complete: { color: '#6b6b78', bg: '#6b6b7815', label: 'Complete' },
}

function timeAgo(date: Date) {
  const s = Math.floor((Date.now() - date.getTime()) / 1000)
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function ProjectsView() {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: '#0d0d0f' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid #2a2a2e', background: '#141418' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#d4a22722' }}>
            <FolderOpen size={18} style={{ color: '#d4a227' }} />
          </div>
          <div>
            <h1 className="font-bold text-[#e8e8ef] text-lg">Projects</h1>
            <p className="text-xs text-[#6b6b78]">{MOCK_PROJECTS.length} projects</p>
          </div>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#7f77dd' }}
        >
          <Plus size={14} />
          New Project
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {MOCK_PROJECTS.map(project => {
            const sc = STATUS_CFG[project.status]
            return (
              <div
                key={project.id}
                className="rounded-xl border border-[#2a2a2e] p-5 bg-[#141418] hover:border-[#3a3a42] transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="font-semibold text-[#e8e8ef] text-sm group-hover:text-[#a09ae8] transition-colors">{project.name}</h3>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium"
                    style={{ color: sc.color, background: sc.bg }}
                  >
                    {sc.label}
                  </span>
                </div>
                <p className="text-xs text-[#9898a8] leading-relaxed mb-4 line-clamp-2">{project.description}</p>
                <div className="flex items-center gap-4 text-xs text-[#6b6b78]">
                  <span className="flex items-center gap-1">
                    <MessageSquare size={11} />
                    {project.sessionsCount} sessions
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {timeAgo(project.lastActivity)}
                  </span>
                  <button className="ml-auto flex items-center gap-1 text-[#7f77dd] opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                    <Zap size={11} />
                    Open
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
