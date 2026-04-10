import { useState } from 'react'
import {
  Bot, FolderOpen, Clock, Files, Server, GitBranch, BarChart3, Zap,
  Puzzle, ChevronRight, Plug, Settings2, LayoutTemplate, BookMarked, Workflow, MessageCircle,
} from 'lucide-react'
import { clsx } from 'clsx'
import { Logo } from '../ui/Logo'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../../store/appStore'
import type { NavView } from '../../types'
import drodoLogo from '../../assets/drodo-logo.png?url'

const NAV_ITEMS: { view: NavView; label: string; Icon: typeof Bot; tutorialId?: string }[] = [
  { view: 'agent', label: 'Agent', Icon: Bot, tutorialId: 'nav-agent' },
  { view: 'projects', label: 'Projects', Icon: FolderOpen },
  { view: 'sessions', label: 'Sessions', Icon: Clock },
  { view: 'files', label: 'Files', Icon: Files },
  { view: 'mcp', label: 'MCP Servers', Icon: Server, tutorialId: 'nav-mcp' },
  { view: 'skills', label: 'Skills & Connectors', Icon: Puzzle, tutorialId: 'nav-skills' },
  { view: 'workflows', label: 'Workflows', Icon: GitBranch, tutorialId: 'nav-workflows' },
  { view: 'automations', label: 'Automations', Icon: Workflow, tutorialId: 'nav-automations' },
  { view: 'messaging', label: 'Messaging', Icon: MessageCircle, tutorialId: 'nav-messaging' },
  { view: 'analytics', label: 'Analytics', Icon: BarChart3 },
  { view: 'connections', label: 'Connections', Icon: Plug },
]

const LIBRARY_ITEMS: { view: NavView; label: string; Icon: typeof Bot; tutorialId?: string }[] = [
  { view: 'templates', label: 'Agent Templates', Icon: LayoutTemplate, tutorialId: 'nav-templates' },
  { view: 'prompts', label: 'Prompt Library', Icon: BookMarked },
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
  const { activeView, setView, activeProvider, agentRunning, setProviderHubOpen, agents } = useAppStore(
    useShallow(s => ({
      activeView: s.activeView,
      setView: s.setView,
      activeProvider: s.activeProvider,
      agentRunning: s.agentRunning,
      setProviderHubOpen: s.setProviderHubOpen,
      agents: s.agents,
    }))
  )
  const runningAgents = agents.filter(a => a.status === 'running').length

  const navButton = (view: NavView, label: string, Icon: typeof Bot, badge?: number, tutorialId?: string) => {
    const isActive = activeView === view
    return (
      <button
        key={view}
        data-tutorial={tutorialId}
        onClick={() => setView(view)}
        className={clsx(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 relative',
          isActive
            ? 'text-[var(--text-primary)] bg-[#7f77dd]/12'
            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
        )}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full" style={{ background: '#7f77dd' }} />
        )}
        <Icon size={16} style={{ color: isActive ? '#7f77dd' : undefined, flexShrink: 0 }} />
        <span className="truncate">{label}</span>
        {badge != null && badge > 0 && (
          <span className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#7f77dd', color: '#fff', fontSize: 10 }}>
            {badge}
          </span>
        )}
      </button>
    )
  }

  return (
    <aside
      data-tutorial="sidebar"
      className="flex h-full w-full min-w-0 flex-shrink-0 flex-col overflow-hidden"
      style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <BrandLogo />
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#7f77dd', letterSpacing: '-0.03em', lineHeight: 1 }}>Drodo</div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2, letterSpacing: '0.05em', textTransform: 'uppercase' }}>AI Agent Platform</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {/* Main nav items */}
        <div className="px-2 space-y-0.5">
          {NAV_ITEMS.map(({ view, label, Icon, tutorialId }) => navButton(view, label, Icon, undefined, tutorialId))}
        </div>

        {/* Library section */}
        <div className="mx-4 mt-4 mb-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Library</p>
        </div>
        <div className="px-2 space-y-0.5">
          {LIBRARY_ITEMS.map(({ view, label, Icon, tutorialId }) => navButton(view, label, Icon, undefined, tutorialId))}
        </div>

        {/* Divider */}
        <div className="mx-4 my-3" style={{ borderTop: '1px solid var(--border-color)' }} />

        {/* Swarm + Settings */}
        <div className="px-2 space-y-0.5">
          {navButton('swarm', 'Agent Swarm', Zap, runningAgents > 0 ? runningAgents : undefined, 'nav-swarm')}
          {navButton('settings', 'Settings', Settings2)}
        </div>
      </nav>

      {/* Bottom: Provider + Agent Status */}
      <div style={{ borderTop: '1px solid var(--border-color)' }} className="p-3 space-y-2">
        <button
          onClick={() => setProviderHubOpen(true)}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors group"
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: activeProvider.color + '33', color: activeProvider.color }}
          >
            {activeProvider.initials}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-xs font-medium text-[var(--text-primary)] truncate">{activeProvider.model ?? activeProvider.name}</div>
            <div className="text-xs text-[var(--text-secondary)] truncate">{activeProvider.name}</div>
          </div>
          <ChevronRight size={12} className="text-[var(--text-secondary)] group-hover:text-[var(--text-muted)] flex-shrink-0" />
        </button>

        <div className="flex items-center gap-2 px-3 py-2">
          <span
            className={clsx('w-2 h-2 rounded-full flex-shrink-0', agentRunning ? 'bg-[#1d9e75] animate-pulse-dot' : 'bg-[var(--text-secondary)]')}
          />
          <span className="text-xs text-[var(--text-muted)]">{agentRunning ? 'Agent running...' : 'Agent idle'}</span>
        </div>
      </div>
    </aside>
  )
}
