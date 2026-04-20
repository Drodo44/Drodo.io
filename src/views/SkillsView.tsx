import { useEffect, useMemo, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  Puzzle, CheckCircle2, Circle, X, Key, Check, Search, Plug, ExternalLink,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../store/appStore'
import type { Connector, ConnectorCategory, Skill } from '../types'
import { loadConnectorKeys, removeConnectorKey, saveConnectorKey } from '../lib/connectorKeys'
import {
  ensureSkillsCatalogLoaded,
  getAllSkills,
} from '../lib/skills'

const CATEGORY_ORDER: ConnectorCategory[] = [
  'Social Media',
  'Productivity',
  'Development',
  'Automation',
  'E-commerce',
  'Media & Creative',
  'Communication',
]

const CONNECTOR_CATEGORY_COLORS: Record<ConnectorCategory, string> = {
  'Social Media': '#e1306c',
  'Productivity': '#4285f4',
  'Development': '#1d9e75',
  'Automation': '#f97316',
  'E-commerce': '#635bff',
  'Media & Creative': '#7f77dd',
  'Communication': '#229ed9',
}

const SKILL_CATEGORY_COLORS: Record<string, string> = {
  Engineering: '#3b82f6',
  Business: '#10b981',
  Creative: '#ec4899',
  Research: '#06b6d4',
  DevOps: '#f97316',
  Security: '#ef4444',
  Data: '#8b5cf6',
  General: '#6b7280',
}

type SkillsTab = 'skills' | 'connectors'

const NON_ASCII_REGEX = /[^\x00-\x7F]/

function isEnglishSkill(skill: Skill): boolean {
  return !NON_ASCII_REGEX.test(skill.name) && !NON_ASCII_REGEX.test(skill.description)
}

function buildTopSkillCategories(skills: Skill[], limit: number): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>()

  for (const skill of skills) {
    counts.set(skill.category, (counts.get(skill.category) ?? 0) + 1)
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }))
}

function SkillCard({ skill }: { skill: Skill }) {
  const color = SKILL_CATEGORY_COLORS[skill.category] ?? '#6b7280'

  return (
    <article
      className="mb-3 break-inside-avoid rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 transition-colors hover:border-[var(--text-muted)]"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-snug text-[var(--text-primary)]">{skill.name}</h3>
          <span
            className="mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
          >
            {skill.category}
          </span>
        </div>
        <span className="flex-shrink-0 rounded-full bg-[var(--bg-tertiary)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
          {skill.priority}
        </span>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-[var(--text-muted)]">{skill.description}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {skill.tags.slice(0, 4).map(tag => (
          <span
            key={tag}
            className="rounded-full bg-[var(--bg-tertiary)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]"
          >
            {tag}
          </span>
        ))}
      </div>
    </article>
  )
}

function ConnectModal({
  connector,
  onClose,
  onSave,
}: {
  connector: Connector
  onClose: () => void
  onSave: (key: string) => void
}) {
  const [key, setKey] = useState('')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    if (!key.trim()) return
    saveConnectorKey(connector.id, key.trim())
    setSaved(true)
    setTimeout(() => {
      onSave(key.trim())
    }, 600)
  }

  const handleDisconnect = () => {
    removeConnectorKey(connector.id)
    onSave('')
  }

  const existingKey = (() => {
    try {
      return loadConnectorKeys()[connector.id] ?? ''
    } catch { return '' }
  })()

  return (
    <Dialog.Root open onOpenChange={v => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        />
        <Dialog.Content
          className="fixed z-50 top-1/2 left-1/2 w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl shadow-2xl animate-fade-in"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
        >
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold"
                style={{ background: `${connector.color}33`, color: connector.color }}
              >
                {connector.initials}
              </div>
              <div>
                <Dialog.Title className="text-sm font-bold text-[var(--text-primary)]">
                  Connect {connector.name}
                </Dialog.Title>
                <Dialog.Description className="text-xs text-[var(--text-secondary)]">
                  {connector.category}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="rounded-lg p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--border-color)] hover:text-[var(--text-primary)]">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4 p-6">
            {connector.isConnected && !saved && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#1d9e7512', border: '1px solid #1d9e7530' }}>
                <CheckCircle2 size={14} style={{ color: '#1d9e75' }} />
                <span className="text-xs font-medium text-[#1d9e75]">Connected - key saved locally</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
                <Key size={12} />
                API Key / Token
              </label>
              <input
                type="password"
                value={key || existingKey}
                onChange={e => setKey(e.target.value)}
                placeholder={connector.keyPlaceholder ?? 'API key'}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[#7f77dd]/60"
              />
              <p className="text-xs text-[var(--text-secondary)]">
                Stored locally on your device. Never sent to Drodo servers.
              </p>
              {connector.helpText && (
                <p className="text-xs text-[var(--text-muted)] leading-relaxed mt-1">
                  {connector.helpText}
                </p>
              )}
              {connector.helpUrl && (
                <a
                  href={connector.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium mt-1"
                  style={{ color: 'var(--accent)' }}
                >
                  Where do I get this key? <ExternalLink size={10} />
                </a>
              )}
            </div>

            {saved ? (
              <div className="flex items-center justify-center gap-2 py-2 text-[#1d9e75]">
                <CheckCircle2 size={16} />
                <span className="text-sm font-semibold">Connected!</span>
              </div>
            ) : (
              <div className="flex gap-3">
                {connector.isConnected && (
                  <button
                    onClick={handleDisconnect}
                    className="rounded-xl border border-[#e05050]/30 px-4 py-2 text-sm font-medium text-[#e05050] transition-colors hover:bg-[#e05050]/10"
                  >
                    Disconnect
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={!key.trim() && !existingKey}
                  className={clsx(
                    'flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all',
                    (key.trim() || existingKey) ? 'hover:opacity-90' : 'cursor-not-allowed opacity-40'
                  )}
                  style={{ background: '#7f77dd' }}
                >
                  <Check size={14} />
                  Save & Connect
                </button>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function ConnectorCard({ connector, onConnect }: { connector: Connector; onConnect: () => void }) {
  return (
    <div
      className={clsx(
        'group flex items-center gap-3 rounded-xl border p-4 transition-all duration-200',
        connector.isConnected
          ? 'border-[#1d9e75]/30 bg-[#1d9e75]/5 hover:border-[#1d9e75]/50'
          : 'border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-[var(--border-color)]'
      )}
    >
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold"
        style={{ background: `${connector.color}22`, color: connector.color }}
      >
        {connector.initials}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-[var(--text-primary)]">{connector.name}</div>
        {connector.description && (
          <div className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
            {connector.description}
          </div>
        )}
        <div className="mt-1 flex items-center gap-1.5">
          {connector.isConnected ? (
            <>
              <CheckCircle2 size={11} style={{ color: '#1d9e75' }} />
              <span className="text-xs text-[#1d9e75]">Connected</span>
            </>
          ) : (
            <>
              <Circle size={11} className="text-[var(--text-secondary)]" />
              <span className="text-xs text-[var(--text-secondary)]">Not connected</span>
            </>
          )}
        </div>
      </div>

      <button
        onClick={onConnect}
        className={clsx(
          'flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150',
          connector.isConnected
            ? 'border border-[#1d9e75]/30 text-[#1d9e75] hover:bg-[#1d9e75]/15'
            : 'text-white hover:opacity-90'
        )}
        style={!connector.isConnected ? { background: '#7f77dd' } : undefined}
      >
        {connector.isConnected ? 'Manage' : 'Connect'}
      </button>
    </div>
  )
}

function N8nStatusCard() {
  const { n8nReady, refreshN8nStatus } = useAppStore(
    useShallow(s => ({ n8nReady: s.n8nReady, refreshN8nStatus: s.refreshN8nStatus }))
  )

  return (
    <div
      className={clsx(
        'flex items-center gap-3 rounded-xl border p-4 mb-4',
        n8nReady
          ? 'border-[#1d9e75]/30 bg-[#1d9e75]/5'
          : 'border-[var(--border-color)] bg-[var(--bg-secondary)]'
      )}
    >
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold"
        style={{ background: '#ea4b7122', color: '#ea4b71' }}
      >
        N8
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-[var(--text-primary)]">n8n</div>
        <div className="mt-1 flex items-center gap-1.5">
          {n8nReady ? (
            <>
              <CheckCircle2 size={11} style={{ color: '#1d9e75' }} />
              <span className="text-xs text-[#1d9e75]">Connected — Managed by Drodo</span>
            </>
          ) : (
            <>
              <Circle size={11} className="text-[var(--text-secondary)]" />
              <span className="text-xs text-[var(--text-secondary)]">Not detected</span>
            </>
          )}
        </div>
      </div>
      {!n8nReady && (
        <button
          onClick={() => void refreshN8nStatus()}
          className="flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-colors"
          style={{ background: '#ea4b71' }}
        >
          Repair Installation
        </button>
      )}
    </div>
  )
}

export function SkillsView() {
  const { connectors, setConnectorConnected } = useAppStore(
    useShallow(s => ({ connectors: s.connectors, setConnectorConnected: s.setConnectorConnected }))
  )
  const [activeConnector, setActiveConnector] = useState<Connector | null>(null)
  const [activeTab, setActiveTab] = useState<SkillsTab>('skills')
  const [activeSkillCategory, setActiveSkillCategory] = useState('All')
  const [skillSearch, setSkillSearch] = useState('')
  const [skillsReady, setSkillsReady] = useState(false)
  const [allSkills, setAllSkills] = useState<Skill[]>([])
  const [topCategories, setTopCategories] = useState<Array<{ name: string; count: number }>>([])
  const [skillCategories, setSkillCategories] = useState<string[]>(['All'])

  useEffect(() => {
    let cancelled = false

    void ensureSkillsCatalogLoaded().then(() => {
      if (cancelled) return
      const englishSkills = getAllSkills().filter(isEnglishSkill)
      const categories = [...new Set(englishSkills.map(skill => skill.category))].sort((a, b) => a.localeCompare(b))

      setAllSkills(englishSkills)
      setTopCategories(buildTopSkillCategories(englishSkills, 5))
      setSkillCategories(['All', ...categories])
      setSkillsReady(true)
    })

    return () => {
      cancelled = true
    }
  }, [])

  const skillCount = allSkills.length
  const connectedCount = connectors.filter(c => c.isConnected).length

  const filteredSkills = useMemo(() => {
    const query = skillSearch.trim().toLowerCase()
    return allSkills.filter(skill => {
      const matchesCategory = activeSkillCategory === 'All' || skill.category === activeSkillCategory
      if (!matchesCategory) return false
      if (!query) return true

      return [
        skill.name,
        skill.description,
        skill.category,
        skill.tags.join(' '),
        skill.capability_domains.join(' '),
      ].some(value => value.toLowerCase().includes(query))
    })
  }, [activeSkillCategory, allSkills, skillSearch])

  const byConnectorCategory = CATEGORY_ORDER.map(cat => ({
    category: cat,
    items: connectors.filter(c => c.category === cat),
  }))

  return (
    <div className="flex w-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <div
        className="flex flex-shrink-0 flex-wrap items-center gap-3 px-6 py-4"
        style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: '#7f77dd22' }}>
          <Puzzle size={18} style={{ color: '#7f77dd' }} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Skills & Connectors</h1>
          <p className="text-xs text-[var(--text-secondary)]">
            {skillCount.toLocaleString()} skills · {connectedCount} connectors connected
          </p>
        </div>

        <div className="flex rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-1">
          {(['skills', 'connectors'] as SkillsTab[]).map(tab => {
            const isActive = activeTab === tab
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={clsx(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                  isActive ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
              >
                {tab === 'skills' ? 'Skills' : 'Connectors'}
              </button>
            )
          })}
        </div>
      </div>

      {activeTab === 'skills' ? (
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-6">
          {!skillsReady ? (
            <section className="flex flex-1 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-10 text-center">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Loading skills catalog…</h2>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  Preparing the bundled skills library for search and browsing.
                </p>
              </div>
            </section>
          ) : (
            <>
          <section className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Skill Library</div>
              <div className="mt-3 text-2xl font-bold text-[var(--text-primary)]">
                {skillCount.toLocaleString()} AI Skills Available
              </div>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Choose a skill to deploy manually, or Drodo will auto-assign the best match for your task.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Top Categories</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {topCategories.map(category => (
                  <span
                    key={category.name}
                    className="rounded-full px-2 py-1 text-xs font-medium"
                    style={{
                      background: `${SKILL_CATEGORY_COLORS[category.name] ?? '#6b7280'}18`,
                      color: SKILL_CATEGORY_COLORS[category.name] ?? '#6b7280',
                      border: `1px solid ${SKILL_CATEGORY_COLORS[category.name] ?? '#6b7280'}30`,
                    }}
                  >
                    {category.name} {category.count}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                <input
                  type="text"
                  value={skillSearch}
                  onChange={e => setSkillSearch(e.target.value)}
                  placeholder="Search skills..."
                  className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] py-2 pl-8 pr-3 text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[#7f77dd]/60"
                />
              </div>
              <span className="text-xs text-[var(--text-secondary)]">
                Showing {filteredSkills.length.toLocaleString()} skill{filteredSkills.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {skillCategories.map(category => {
                const isActive = activeSkillCategory === category
                const color = SKILL_CATEGORY_COLORS[category] ?? '#7f77dd'
                return (
                  <button
                    key={category}
                    onClick={() => setActiveSkillCategory(category)}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
                    style={{
                      background: isActive ? `${color}22` : 'var(--bg-tertiary)',
                      color: isActive ? color : 'var(--text-secondary)',
                      border: `1px solid ${isActive ? `${color}45` : 'var(--border-color)'}`,
                    }}
                  >
                    {category}
                  </button>
                )
              })}
            </div>

            <div className="columns-1 md:columns-2 xl:columns-3 2xl:columns-4" style={{ columnGap: '0.75rem' }}>
              {filteredSkills.map(skill => (
                <SkillCard key={skill.id} skill={skill} />
              ))}
            </div>
          </section>
            </>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
          <section className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: '#7f77dd22', color: '#7f77dd' }}>
                <Plug size={18} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Connectors</h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Connect the apps and services you want Drodo to use.
                </p>
              </div>
            </div>
          </section>

          <N8nStatusCard />

          {byConnectorCategory.map(({ category, items }) => (
            <section key={category}>
              <div className="mb-3 flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: CONNECTOR_CATEGORY_COLORS[category] }}
                />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{category}</h2>
                <span className="text-xs text-[var(--text-secondary)]">
                  ({items.filter(c => c.isConnected).length}/{items.length})
                </span>
              </div>

              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                {items.map(connector => (
                  <ConnectorCard
                    key={connector.id}
                    connector={connector}
                    onConnect={() => setActiveConnector(connector)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {activeConnector && (
        <ConnectModal
          connector={activeConnector}
          onClose={() => setActiveConnector(null)}
          onSave={(key) => {
            setConnectorConnected(activeConnector.id, key.length > 0)
            setActiveConnector(null)
          }}
        />
      )}
    </div>
  )
}
