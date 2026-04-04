import { useState } from 'react'
import {
  Bot,
  FolderOpen,
  Clock,
  Files,
  Server,
  GitBranch,
  BarChart3,
  Zap,
  Puzzle,
  ChevronRight,
  Plug,
} from 'lucide-react'
import { clsx } from 'clsx'
import { Logo } from '../ui/Logo'
import { useAppStore } from '../../store/appStore'
import type { NavView } from '../../types'

import drodoLogo from '../../assets/drodo-logo.png'

const NAV_ITEMS: { view: NavView; label: string; Icon: typeof Bot }[] = [
  { view: 'agent', label: 'Agent', Icon: Bot },
  { view: 'projects', label: 'Projects', Icon: FolderOpen },
  { view: 'sessions', label: 'Sessions', Icon: Clock },
  { view: 'files', label: 'Files', Icon: Files },
  { view: 'mcp', label: 'MCP Servers', Icon: Server },
  { view: 'skills', label: 'Skills & Connectors', Icon: Puzzle },
  { view: 'workflows', label: 'Workflows', Icon: GitBranch },
  { view: 'analytics', label: 'Analytics', Icon: BarChart3 },
  { view: 'connections', label: 'Connections', Icon: Plug },
]

function BrandLogo() {
  const [imgFailed, setImgFailed] = useState(false)

  if (!imgFailed) {
    return (
      <img
        src={drodoLogo}
        alt="Drodo"
        width={34}
        height={34}
        className="rounded-lg object-contain flex-shrink-0"
        onError={() => setImgFailed(true)}
        style={{ imageRendering: 'crisp-edges' }}
      />
    )
  }
  return <Logo size={34} />
}

export function Sidebar() {
  const { activeView, setView, activeProvider, agentRunning, setProviderHubOpen, agents } = useAppStore()
  const runningAgents = agents.filter(a => a.status === 'running').length

  return (
    <aside
      className="flex flex-col h-full flex-shrink-0"
      style={{
        width: 220,
        background: '#141418',
        borderRight: '1px solid #2a2a2e',
      }}
    >
      {/* Logo + Brand */}
      <div className="flex items-center gap-3 px-4 py-5" style={{ borderBottom: '1px solid #2a2a2e' }}>
        <BrandLogo />
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#7f77dd', letterSpacing: '-0.03em', lineHeight: 1 }}>
            Drodo
          </div>
          <div style={{ fontSize: 10, color: '#6b6b78', marginTop: 2, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            AI Agent Platform
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        <div className="px-2 space-y-0.5">
          {NAV_ITEMS.map(({ view, label, Icon }) => {
            const isActive = activeView === view
            return (
              <button
                key={view}
                onClick={() => setView(view)}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 relative group',
                  isActive
                    ? 'text-[#e8e8ef] bg-[#7f77dd]/12'
                    : 'text-[#9898a8] hover:text-[#e8e8ef] hover:bg-[#1c1c22]'
                )}
              >
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                    style={{ background: '#7f77dd' }}
                  />
                )}
                <Icon
                  size={16}
                  style={{ color: isActive ? '#7f77dd' : undefined, flexShrink: 0 }}
                />
                <span className="truncate">{label}</span>
              </button>
            )
          })}
        </div>

        {/* Divider */}
        <div className="mx-4 my-3" style={{ borderTop: '1px solid #2a2a2e' }} />

        {/* Agent Swarm */}
        <div className="px-2">
          <button
            onClick={() => setView('swarm')}
            className={clsx(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 relative',
              activeView === 'swarm'
                ? 'text-[#e8e8ef] bg-[#7f77dd]/12'
                : 'text-[#9898a8] hover:text-[#e8e8ef] hover:bg-[#1c1c22]'
            )}
          >
            {activeView === 'swarm' && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full" style={{ background: '#7f77dd' }} />
            )}
            <Zap size={16} style={{ color: activeView === 'swarm' ? '#7f77dd' : undefined, flexShrink: 0 }} />
            Agent Swarm
            {runningAgents > 0 && (
              <span
                className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: '#7f77dd', color: '#fff', fontSize: 10 }}
              >
                {runningAgents}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Bottom: Provider + Agent Status */}
      <div style={{ borderTop: '1px solid #2a2a2e' }} className="p-3 space-y-2">
        {/* Active Provider */}
        <button
          onClick={() => setProviderHubOpen(true)}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-[#1c1c22] transition-colors group"
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: activeProvider.color + '33', color: activeProvider.color }}
          >
            {activeProvider.initials}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-xs font-medium text-[#e8e8ef] truncate">{activeProvider.model ?? activeProvider.name}</div>
            <div className="text-xs text-[#6b6b78] truncate">{activeProvider.name}</div>
          </div>
          <ChevronRight size={12} className="text-[#6b6b78] group-hover:text-[#9898a8] flex-shrink-0" />
        </button>

        {/* Agent Status */}
        <div className="flex items-center gap-2 px-3 py-2">
          <span
            className={clsx(
              'w-2 h-2 rounded-full flex-shrink-0',
              agentRunning ? 'bg-[#1d9e75] animate-pulse-dot' : 'bg-[#6b6b78]'
            )}
          />
          <span className="text-xs text-[#9898a8]">
            {agentRunning ? 'Agent running...' : 'Agent idle'}
          </span>
        </div>
      </div>
    </aside>
  )
}
