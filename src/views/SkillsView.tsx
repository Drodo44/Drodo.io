import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  Puzzle, CheckCircle2, Circle, X, Key, Check, Star,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../store/appStore'
import type { Connector, ConnectorCategory } from '../types'
import { loadConnectorKeys, removeConnectorKey, saveConnectorKey } from '../lib/connectorKeys'
import { getAllSkillCategories, getAllSkillDomains, getSkillCount, getTopSkillCategories } from '../lib/skills'

const CATEGORY_ORDER: ConnectorCategory[] = [
  'Social Media',
  'Productivity',
  'Development',
  'Automation',
  'E-commerce',
  'Media & Creative',
  'Communication',
]

const CATEGORY_COLORS: Record<ConnectorCategory, string> = {
  'Social Media': '#e1306c',
  'Productivity': '#4285f4',
  'Development': '#1d9e75',
  'Automation': '#f97316',
  'E-commerce': '#635bff',
  'Media & Creative': '#7f77dd',
  'Communication': '#229ed9',
}

// ─── Skill Packages ───────────────────────────────────────────────────────────

interface SkillPackage {
  id: string
  name: string
  author: string
  stars: string
  description: string
  category: string
  recommended?: boolean
  exploreUrl?: string
  buttonLabel?: string
}

const SKILL_PACKAGES: SkillPackage[] = [
  {
    id: 'wshobson-agents',
    name: 'Agent Orchestration Suite',
    author: 'wshobson',
    stars: '33.2k',
    description: '182 specialized agents, 147 skills, 75 plugins for software engineering, DevOps, security, and multi-agent orchestration. Best for: developers.',
    category: 'Engineering',
    recommended: true,
  },
  {
    id: 'alirezarezvani-claude-skills',
    name: 'Business Skills Library',
    author: 'alirezarezvani',
    stars: '10.1k',
    description: '248 skills across marketing, product, C-level advisory, compliance, and finance. Best for: business users and non-developers.',
    category: 'Business',
  },
  {
    id: 'obra-superpowers',
    name: 'Superpowers',
    author: 'obra',
    stars: '142k',
    description: 'TDD-focused development workflow with brainstorm, write-plan, and execute-plan commands. Lightweight and opinionated.',
    category: 'Developer',
  },
  {
    id: 'voltAgent-awesome-agent-skills',
    name: 'Awesome Agent Skills',
    author: 'VoltAgent',
    stars: '14.8k',
    description: '1,000+ community agent skills from official dev teams. Compatible with any AI model.',
    category: 'Community',
  },
  {
    id: 'travisvn-awesome-claude-skills',
    name: 'Awesome Claude Skills Directory',
    author: 'travisvn',
    stars: '10.8k',
    description: 'The most comprehensive curated index of Claude skills and resources.',
    category: 'Resource',
    exploreUrl: 'https://github.com/travisvn/awesome-claude-skills',
    buttonLabel: 'Explore →',
  },
  {
    id: 'shanraisshan-best-practice',
    name: 'Claude Code Best Practices',
    author: 'shanraisshan',
    stars: '33.1k',
    description: 'The definitive reference guide for agents, commands, skills, hooks, and workflows. Read before building.',
    category: 'Reference',
    exploreUrl: 'https://github.com/shanraisshan/claude-code-best-practice',
    buttonLabel: 'Explore →',
  },
]

const CATEGORY_BADGE_COLORS: Record<string, string> = {
  Engineering: '#7f77dd',
  Business: '#4285f4',
  Developer: '#1d9e75',
  Community: '#f97316',
  Resource: 'var(--text-muted)',
  Reference: 'var(--text-muted)',
}

function PackageCard({ pkg }: { pkg: SkillPackage }) {
  const badgeColor = CATEGORY_BADGE_COLORS[pkg.category] ?? 'var(--text-muted)'

  return (
    <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[var(--text-primary)]">{pkg.name}</span>
            {pkg.recommended && (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: '#7f77dd22', color: '#a09ae8' }}
              >
                RECOMMENDED
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}
            >
              by {pkg.author}
            </span>
            <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
              <Star size={11} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
              {pkg.stars}
            </div>
          </div>
        </div>
        {/* Always-active indicator — packages are built-in, not installed */}
        <span
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: '#1d9e7515', color: '#1d9e75', border: '1px solid #1d9e7530' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#1d9e75] flex-shrink-0" />
          Included
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-[var(--text-muted)] leading-relaxed">{pkg.description}</p>

      {/* Category badge */}
      <div>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ background: badgeColor + '18', color: badgeColor, border: `1px solid ${badgeColor}30` }}
        >
          {pkg.category}
        </span>
      </div>
    </div>
  )
}

// ─── Connect Modal ────────────────────────────────────────────────────────────

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

  // Load existing key
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
          className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
          style={{ width: 420, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
        >
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold"
                style={{ background: connector.color + '33', color: connector.color }}
              >
                {connector.initials}
              </div>
              <div>
                <Dialog.Title className="font-bold text-[var(--text-primary)] text-sm">
                  Connect {connector.name}
                </Dialog.Title>
                <Dialog.Description className="text-xs text-[var(--text-secondary)]">
                  {connector.category}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-color)] transition-colors">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div className="p-6 space-y-4">
            {connector.isConnected && !saved && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#1d9e7512', border: '1px solid #1d9e7530' }}>
                <CheckCircle2 size={14} style={{ color: '#1d9e75' }} />
                <span className="text-xs text-[#1d9e75] font-medium">Connected — key saved locally</span>
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
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60 font-mono transition-colors"
              />
              <p className="text-xs text-[var(--text-secondary)]">
                Stored locally on your device. Never sent to Drodo servers.
              </p>
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
                    className="px-4 py-2 rounded-xl text-sm font-medium border border-[#e05050]/30 text-[#e05050] hover:bg-[#e05050]/10 transition-colors"
                  >
                    Disconnect
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={!key.trim() && !existingKey}
                  className={clsx(
                    'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all',
                    (key.trim() || existingKey) ? 'hover:opacity-90' : 'opacity-40 cursor-not-allowed'
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

// ─── Connector Card ───────────────────────────────────────────────────────────

function ConnectorCard({ connector, onConnect }: { connector: Connector; onConnect: () => void }) {
  return (
    <div
      className={clsx(
        'flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 group',
        connector.isConnected
          ? 'border-[#1d9e75]/30 bg-[#1d9e75]/5 hover:border-[#1d9e75]/50'
          : 'border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-[var(--border-color)]'
      )}
    >
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
        style={{ background: connector.color + '22', color: connector.color }}
      >
        {connector.initials}
      </div>

      {/* Name + status */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[var(--text-primary)] truncate">{connector.name}</div>
        {connector.description && (
          <div className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
            {connector.description}
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-0.5">
          {connector.isConnected ? (
            <>
              <CheckCircle2 size={11} style={{ color: '#1d9e75' }} />
              <span className="text-xs" style={{ color: '#1d9e75' }}>Connected</span>
            </>
          ) : (
            <>
              <Circle size={11} className="text-[var(--text-secondary)]" />
              <span className="text-xs text-[var(--text-secondary)]">Not connected</span>
            </>
          )}
        </div>
      </div>

      {/* Connect button */}
      <button
        onClick={onConnect}
        className={clsx(
          'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150',
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

// ─── Main View ────────────────────────────────────────────────────────────────

export function SkillsView() {
  const { connectors, setConnectorConnected } = useAppStore(
    useShallow(s => ({ connectors: s.connectors, setConnectorConnected: s.setConnectorConnected }))
  )
  const [activeConnector, setActiveConnector] = useState<Connector | null>(null)

  const connectedCount = connectors.filter(c => c.isConnected).length
  const skillCount = getSkillCount()
  const skillDomains = getAllSkillDomains()
  const topCategories = getTopSkillCategories(5)
  const allCategories = getAllSkillCategories()

  const byCategory = CATEGORY_ORDER.map(cat => ({
    category: cat,
    items: connectors.filter(c => c.category === cat),
  }))

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#7f77dd22' }}>
          <Puzzle size={18} style={{ color: '#7f77dd' }} />
        </div>
        <div>
          <h1 className="font-bold text-[var(--text-primary)] text-lg">Skills & Connectors</h1>
          <p className="text-xs text-[var(--text-secondary)]">
            {connectedCount} connected · {connectors.length} available
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">

        {/* ── Active Skills Intelligence ───────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full" style={{ background: '#7f77dd' }} />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Active Skills Intelligence</h2>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#1d9e7515', color: '#1d9e75', border: '1px solid #1d9e7530' }}>
              Always on
            </span>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Total Skills</div>
              <div className="mt-3 text-3xl font-bold text-[var(--text-primary)]">{skillCount.toLocaleString()}</div>
              <div className="mt-2 text-xs text-[var(--text-secondary)]">
                Deduplicated bundle shipped locally with the app.
              </div>
            </div>
            <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Domains Covered</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {skillDomains.map(domain => (
                  <span
                    key={domain}
                    className="text-xs px-2 py-1 rounded-full font-medium"
                    style={{ background: '#7f77dd18', color: '#a09ae8', border: '1px solid #7f77dd30' }}
                  >
                    {domain}
                  </span>
                ))}
              </div>
            </div>
            <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Top Categories</div>
              <div className="mt-3 space-y-2">
                {topCategories.map(category => (
                  <div key={category.name} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-[var(--text-primary)]">{category.name}</span>
                    <span className="text-[var(--text-secondary)]">{category.count}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-[var(--text-secondary)]">
                {allCategories.length} categories available for orchestration-aware matching.
              </div>
            </div>
          </div>
        </div>

        {/* ── Skill Packages ────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full" style={{ background: '#f97316' }} />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Skill Packages</h2>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#1d9e7515', color: '#1d9e75', border: '1px solid #1d9e7530' }}>
              {SKILL_PACKAGES.length} included
            </span>
          </div>
          {/* Info banner */}
          <div
            className="flex items-start gap-2 px-4 py-3 rounded-xl mb-4 text-xs text-[var(--text-muted)] leading-relaxed"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}
          >
            <span className="flex-shrink-0 mt-0.5">ℹ️</span>
            <span>
              Skill packages are built-in and automatically injected into agent system prompts when relevant. No installation needed — they are always active.
            </span>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {SKILL_PACKAGES.map(pkg => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
              />
            ))}
          </div>
        </div>

        {/* ── Connectors (existing sections, preserved exactly) ──── */}
        {byCategory.map(({ category, items }) => (
          <div key={category}>
            {/* Category header */}
            <div className="flex items-center gap-2 mb-3">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: CATEGORY_COLORS[category] }}
              />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{category}</h2>
              <span className="text-xs text-[var(--text-secondary)]">
                ({items.filter(c => c.isConnected).length}/{items.length})
              </span>
            </div>

            {/* Cards grid */}
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
              {items.map(connector => (
                <ConnectorCard
                  key={connector.id}
                  connector={connector}
                  onConnect={() => setActiveConnector(connector)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Modals */}
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
