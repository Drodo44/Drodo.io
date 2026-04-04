import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Bot, FolderOpen, Clock, Files, Server, Puzzle, GitBranch,
  BarChart3, Zap, Plug, Settings2, Search,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../../store/appStore'
import type { NavView } from '../../types'

// ─── View definitions ─────────────────────────────────────────────────────────

interface ViewDef {
  view: NavView
  label: string
  Icon: typeof Bot
}

const ALL_VIEWS: ViewDef[] = [
  { view: 'agent', label: 'Agent', Icon: Bot },
  { view: 'projects', label: 'Projects', Icon: FolderOpen },
  { view: 'sessions', label: 'Sessions', Icon: Clock },
  { view: 'files', label: 'Files', Icon: Files },
  { view: 'mcp', label: 'MCP Servers', Icon: Server },
  { view: 'skills', label: 'Skills & Connectors', Icon: Puzzle },
  { view: 'workflows', label: 'Workflows', Icon: GitBranch },
  { view: 'analytics', label: 'Analytics', Icon: BarChart3 },
  { view: 'connections', label: 'Connections', Icon: Plug },
  { view: 'settings', label: 'Settings', Icon: Settings2 },
  { view: 'swarm', label: 'Agent Swarm', Icon: Zap },
]

// ─── Storage helpers ──────────────────────────────────────────────────────────

function loadWorkflowNames(): string[] {
  try {
    const raw = localStorage.getItem('drodo_workflow_defs')
    if (!raw) return []
    const arr = JSON.parse(raw) as Array<{ name?: string }>
    return arr.map(w => w.name ?? 'Untitled').filter(Boolean)
  } catch { return [] }
}

function loadSessionNames(): string[] {
  try {
    const raw = localStorage.getItem('drodo_sessions')
    if (!raw) return []
    const arr = JSON.parse(raw) as Array<{ name?: string }>
    return arr.map(s => s.name ?? 'Untitled').filter(Boolean)
  } catch { return [] }
}

// ─── Palette item ─────────────────────────────────────────────────────────────

interface PaletteItem {
  id: string
  label: string
  category: string
  Icon?: typeof Bot
  iconColor?: string
  onActivate: () => void
}

const STATUS_COLOR: Record<string, string> = {
  running: '#7f77dd',
  complete: '#1d9e75',
  idle: 'var(--text-secondary)',
  error: '#e05050',
}

// ─── Component ────────────────────────────────────────────────────────────────

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { setView, agents } = useAppStore(
    useShallow(s => ({ setView: s.setView, agents: s.agents }))
  )

  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  const workflowNames = useMemo(() => loadWorkflowNames(), [open])
  const sessionNames = useMemo(() => loadSessionNames(), [open])

  // Build all items
  const allItems = useMemo((): PaletteItem[] => {
    const items: PaletteItem[] = []

    // Navigate
    ALL_VIEWS.forEach(v => {
      items.push({
        id: `nav-${v.view}`,
        label: v.label,
        category: 'Navigate',
        Icon: v.Icon,
        iconColor: '#7f77dd',
        onActivate: () => { setView(v.view); onClose() },
      })
    })

    // Agents
    agents.forEach(a => {
      items.push({
        id: `agent-${a.id}`,
        label: a.name,
        category: 'Agents',
        iconColor: STATUS_COLOR[a.status] ?? 'var(--text-secondary)',
        onActivate: () => { setView('swarm'); onClose() },
      })
    })

    // Workflows
    workflowNames.forEach((name, i) => {
      items.push({
        id: `wf-${i}`,
        label: name,
        category: 'Workflows',
        Icon: GitBranch,
        iconColor: '#f97316',
        onActivate: () => { setView('workflows'); onClose() },
      })
    })

    // Sessions
    sessionNames.forEach((name, i) => {
      items.push({
        id: `sess-${i}`,
        label: name,
        category: 'Sessions',
        Icon: Clock,
        iconColor: '#4285f4',
        onActivate: () => { setView('sessions'); onClose() },
      })
    })

    return items
  }, [agents, workflowNames, sessionNames, setView, onClose])

  const filtered = useMemo(() => {
    if (!query.trim()) return allItems
    const q = query.toLowerCase()
    return allItems.filter(item =>
      item.label.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
    )
  }, [allItems, query])

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, PaletteItem[]>()
    filtered.forEach(item => {
      const list = map.get(item.category) ?? []
      list.push(item)
      map.set(item.category, list)
    })
    return map
  }, [filtered])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, filtered.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        filtered[selectedIndex]?.onActivate()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, filtered, selectedIndex, onClose])

  // Keep selectedIndex in bounds when filter changes
  useEffect(() => {
    setSelectedIndex(prev => Math.min(prev, Math.max(0, filtered.length - 1)))
  }, [filtered.length])

  if (!open) return null

  // Flat index for keyboard selection
  let flatIdx = 0

  const CATEGORY_COLORS: Record<string, string> = {
    Navigate: '#7f77dd',
    Agents: '#1d9e75',
    Workflows: '#f97316',
    Sessions: '#4285f4',
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-24"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{
          maxWidth: 560,
          maxHeight: '60vh',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
        }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <Search size={16} className="text-[var(--text-secondary)] flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0) }}
            placeholder="Search views, agents, workflows…"
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          />
          <kbd className="text-xs text-[var(--text-muted)] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1 py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">No results for "{query}"</div>
          ) : (
            Array.from(grouped.entries()).map(([category, items]) => (
              <div key={category}>
                {/* Category label */}
                <div className="px-4 py-1.5 flex items-center gap-2">
                  <span
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: CATEGORY_COLORS[category] ?? 'var(--text-muted)' }}
                  >
                    {category}
                  </span>
                </div>
                {/* Items */}
                {items.map(item => {
                  const currentFlat = flatIdx++
                  const isSelected = selectedIndex === currentFlat
                  const { Icon } = item
                  return (
                    <button
                      key={item.id}
                      onClick={item.onActivate}
                      onMouseEnter={() => setSelectedIndex(currentFlat)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                      style={{ background: isSelected ? '#7f77dd18' : 'transparent' }}
                    >
                      {/* Icon */}
                      {Icon ? (
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: (item.iconColor ?? '#7f77dd') + '20' }}
                        >
                          <Icon size={14} style={{ color: item.iconColor ?? '#7f77dd' }} />
                        </div>
                      ) : (
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: (item.iconColor ?? 'var(--text-secondary)') + '25' }}
                        >
                          <span className="text-xs font-bold" style={{ color: item.iconColor ?? 'var(--text-secondary)' }}>
                            {item.label.slice(0, 1)}
                          </span>
                        </div>
                      )}
                      {/* Label */}
                      <span
                        className="flex-1 text-sm truncate"
                        style={{ color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)' }}
                      >
                        {item.label}
                      </span>
                      {/* Category badge */}
                      <span
                        className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
                      >
                        {item.category}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div
          className="flex items-center gap-4 px-4 py-2 text-xs text-[var(--text-muted)]"
          style={{ borderTop: '1px solid var(--border-color)' }}
        >
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> select</span>
          <span><kbd className="font-mono">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
