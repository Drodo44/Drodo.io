import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  Puzzle, CheckCircle2, Circle, X, Key, Check,
  Search, Globe, Brain, Code2, FileText, Eye, Mic, Mail,
  Settings as GearIcon, Star,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../store/appStore'
import type { Connector, ConnectorCategory } from '../types'
import { getAppSettings, setAppSetting } from '../lib/appSettings'
import { loadConnectorKeys, removeConnectorKey, saveConnectorKey } from '../lib/connectorKeys'

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

// ─── Settings helpers ─────────────────────────────────────────────────────────

// ─── Tavily Key Modal ─────────────────────────────────────────────────────────

function TavilyModal({ onClose }: { onClose: () => void }) {
  const existingKey = String(getAppSettings().tavilyApiKey ?? '')
  const [key, setKey] = useState(existingKey)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    if (!key.trim()) return
    setAppSetting('tavilyApiKey', key.trim())
    setSaved(true)
    setTimeout(onClose, 700)
  }

  return (
    <Dialog.Root open onOpenChange={v => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        />
        <Dialog.Content
          className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl shadow-2xl overflow-hidden"
          style={{ width: 420, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
        >
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#7f77dd22' }}>
                <Search size={16} style={{ color: '#7f77dd' }} />
              </div>
              <div>
                <Dialog.Title className="font-bold text-[var(--text-primary)] text-sm">Tavily API Key</Dialog.Title>
                <Dialog.Description className="text-xs text-[var(--text-secondary)]">Required for Web Search &amp; Web Scraper</Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-color)] transition-colors">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>
          <div className="p-6 space-y-4">
            {existingKey && !saved && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#1d9e7512', border: '1px solid #1d9e7530' }}>
                <CheckCircle2 size={14} style={{ color: '#1d9e75' }} />
                <span className="text-xs text-[#1d9e75] font-medium">Key saved — skills are active</span>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
                <Key size={12} />
                API Key
              </label>
              <input
                type="password"
                value={key}
                onChange={e => setKey(e.target.value)}
                placeholder="tvly-xxxxxxxxxxxxxxxx"
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60 font-mono transition-colors"
              />
              <p className="text-xs text-[var(--text-secondary)]">Stored locally on your device. Never sent to Drodo servers.</p>
            </div>
            <p className="text-xs" style={{ color: '#7f77dd' }}>
              Get a free key at{' '}
              <button
                onClick={() => window.open('https://tavily.com', '_blank')}
                className="underline hover:opacity-80 transition-opacity"
                style={{ color: '#7f77dd', background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}
              >
                tavily.com
              </button>
            </p>
            {saved ? (
              <div className="flex items-center justify-center gap-2 py-2 text-[#1d9e75]">
                <CheckCircle2 size={16} />
                <span className="text-sm font-semibold">Saved!</span>
              </div>
            ) : (
              <button
                onClick={handleSave}
                disabled={!key.trim()}
                className={clsx(
                  'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all',
                  key.trim() ? 'hover:opacity-90' : 'opacity-40 cursor-not-allowed'
                )}
                style={{ background: '#7f77dd' }}
              >
                <Check size={14} />
                Save Key
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onChange() }}
      style={{
        position: 'relative',
        width: 42,
        height: 24,
        borderRadius: 12,
        background: on ? '#7f77dd' : 'var(--border-color)',
        border: 'none',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background 0.2s',
        outline: 'none',
      }}
      aria-checked={on}
      role="switch"
    >
      <span style={{
        position: 'absolute',
        top: 3,
        left: on ? 21 : 3,
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.18s',
        display: 'block',
      }} />
    </button>
  )
}

// ─── AI Skill Card ────────────────────────────────────────────────────────────

interface AiSkill {
  id: string
  name: string
  description: string
  color: string
  Icon: typeof Search
  hasTavilyGear?: boolean
  defaultOn?: boolean
}

const AI_SKILLS: AiSkill[] = [
  {
    id: 'web-search',
    name: 'Web Search',
    description: 'Search the web in real time. Powered by Tavily. Results injected as agent context automatically.',
    color: '#7f77dd',
    Icon: Search,
    hasTavilyGear: true,
  },
  {
    id: 'web-scraper',
    name: 'Web Scraper',
    description: 'Fetch and extract clean text from any URL and use it as agent context.',
    color: '#1d9e75',
    Icon: Globe,
    hasTavilyGear: true,
  },
  {
    id: 'memory',
    name: 'Persistent Memory',
    description: 'Agents remember key facts across sessions and recall them by relevance.',
    color: '#f97316',
    Icon: Brain,
    defaultOn: true,
  },
  {
    id: 'code-execution',
    name: 'Code Execution',
    description: 'Run JavaScript in a sandboxed environment and return results to the agent.',
    color: '#4285f4',
    Icon: Code2,
  },
  {
    id: 'file-reader',
    name: 'File Reader',
    description: 'Read local files and use their contents as context in any conversation.',
    color: '#e1306c',
    Icon: FileText,
  },
  {
    id: 'image-analysis',
    name: 'Image Analysis',
    description: 'Analyze images, charts, and screenshots passed to the agent.',
    color: '#a855f7',
    Icon: Eye,
  },
  {
    id: 'voice-input',
    name: 'Voice Input',
    description: 'Speak to your agent instead of typing. Transcribed automatically.',
    color: '#ec4899',
    Icon: Mic,
  },
  {
    id: 'email-integration',
    name: 'Email Integration',
    description: 'Read and send emails so agents can manage your inbox autonomously.',
    color: '#f59e0b',
    Icon: Mail,
  },
]

function loadEnabledSkills(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem('drodo_enabled_skills') ?? '{"memory":true}')
  } catch { return { memory: true } }
}

function SkillToggleCard({
  skill,
  enabled,
  onToggle,
  onGearClick,
}: {
  skill: AiSkill
  enabled: boolean
  onToggle: () => void
  onGearClick?: () => void
}) {
  const { Icon } = skill
  return (
    <div
      className={clsx(
        'flex items-start gap-3 p-4 rounded-xl border transition-all duration-200',
        enabled
          ? 'border-[#7f77dd]/30 bg-[#7f77dd]/5'
          : 'border-[var(--border-color)] bg-[var(--bg-secondary)]'
      )}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: skill.color + '22', color: skill.color }}
      >
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[var(--text-primary)]">{skill.name}</div>
        <div className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{skill.description}</div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
        {skill.hasTavilyGear && (
          <button
            onClick={onGearClick}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-muted)] hover:bg-[var(--border-color)] transition-colors"
            title="Configure Tavily API key"
          >
            <GearIcon size={14} />
          </button>
        )}
        <Toggle on={enabled} onChange={onToggle} />
      </div>
    </div>
  )
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
    stars: '32.9k',
    description: '182 specialized agents, 147 skills, 75 plugins for software engineering, DevOps, security, and multi-agent orchestration. Best for: developers.',
    category: 'Engineering',
    recommended: true,
  },
  {
    id: 'alirezarezvani-claude-skills',
    name: 'Business Skills Library',
    author: 'alirezarezvani',
    stars: '5.2k',
    description: '248 skills across marketing, product, C-level advisory, compliance, and finance. Best for: business users and non-developers.',
    category: 'Business',
  },
  {
    id: 'obra-superpowers',
    name: 'Superpowers',
    author: 'obra',
    stars: '1.1k',
    description: 'TDD-focused development workflow with brainstorm, write-plan, and execute-plan commands. Lightweight and opinionated.',
    category: 'Developer',
  },
  {
    id: 'voltAgent-awesome-agent-skills',
    name: 'Awesome Agent Skills',
    author: 'VoltAgent',
    stars: '14.1k',
    description: '1,000+ community agent skills from official dev teams. Compatible with any AI model.',
    category: 'Community',
  },
  {
    id: 'travisvn-awesome-claude-skills',
    name: 'Awesome Claude Skills Directory',
    author: 'travisvn',
    stars: '10.5k',
    description: 'The most comprehensive curated index of Claude skills and resources.',
    category: 'Resource',
    exploreUrl: 'https://github.com/travisvn/awesome-claude-skills',
    buttonLabel: 'Explore →',
  },
  {
    id: 'shanraisshan-best-practice',
    name: 'Claude Code Best Practices',
    author: 'shanraisshan',
    stars: '31.6k',
    description: 'The definitive reference guide for agents, commands, skills, hooks, and workflows. Read before building.',
    category: 'Reference',
    exploreUrl: 'https://github.com/shanraisshan/claude-code-best-practice',
    buttonLabel: 'Explore →',
  },
]

// Conflict pairs (by id)
const CONFLICT_PAIRS: [string, string][] = [
  ['wshobson-agents', 'alirezarezvani-claude-skills'],
]

interface InstalledPackage {
  id: string
  name: string
  installedAt: string
}

function loadInstalledPackages(): InstalledPackage[] {
  try { return JSON.parse(localStorage.getItem('drodo_installed_packages') ?? '[]') } catch { return [] }
}

const CATEGORY_BADGE_COLORS: Record<string, string> = {
  Engineering: '#7f77dd',
  Business: '#4285f4',
  Developer: '#1d9e75',
  Community: '#f97316',
  Resource: 'var(--text-muted)',
  Reference: 'var(--text-muted)',
}

function PackageCard({
  pkg,
  installed,
  onInstall,
}: {
  pkg: SkillPackage
  installed: boolean
  onInstall: () => void
}) {
  const [conflict, setConflict] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const handleInstallClick = () => {
    if (pkg.exploreUrl) {
      window.open(pkg.exploreUrl, '_blank')
      return
    }
    // Check conflicts
    const currentInstalled = loadInstalledPackages()
    for (const [a, b] of CONFLICT_PAIRS) {
      const conflictId = pkg.id === a ? b : pkg.id === b ? a : null
      if (conflictId && currentInstalled.some(p => p.id === conflictId)) {
        const conflictPkg = SKILL_PACKAGES.find(p => p.id === conflictId)
        setConflict(conflictPkg?.name ?? conflictId)
        setConfirming(true)
        return
      }
    }
    onInstall()
  }

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
        {/* Install / Explore button */}
        {installed ? (
          <span
            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: '#1d9e7515', color: '#1d9e75', border: '1px solid #1d9e7530' }}
          >
            Installed ✓
          </span>
        ) : (
          <button
            onClick={handleInstallClick}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
            style={{ background: '#7f77dd' }}
          >
            {pkg.buttonLabel ?? 'Install'}
          </button>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-[var(--text-muted)] leading-relaxed">{pkg.description}</p>

      {/* Conflict warning */}
      {confirming && conflict && (
        <div
          className="rounded-lg px-3 py-3 space-y-2"
          style={{ background: '#f9731608', border: '1px solid #f9731630' }}
        >
          <p className="text-xs text-[#f97316] leading-relaxed">
            ⚠️ Conflicts with <strong>{conflict}</strong> already installed. These cover the same domain and may create duplicate agents. Install anyway?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { onInstall(); setConfirming(false); setConflict(null) }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
              style={{ background: '#f97316' }}
            >
              Confirm
            </button>
            <button
              onClick={() => { setConfirming(false); setConflict(null) }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
  const [tavilyOpen, setTavilyOpen] = useState(false)

  // AI Skills state
  const [enabledSkills, setEnabledSkills] = useState<Record<string, boolean>>(loadEnabledSkills)
  const toggleSkill = (id: string) => {
    setEnabledSkills(prev => {
      const next = { ...prev, [id]: !prev[id] }
      localStorage.setItem('drodo_enabled_skills', JSON.stringify(next))
      return next
    })
  }

  // Packages state
  const [installedPkgs, setInstalledPkgs] = useState<InstalledPackage[]>(loadInstalledPackages)
  const installPackage = (pkg: SkillPackage) => {
    const entry: InstalledPackage = { id: pkg.id, name: pkg.name, installedAt: new Date().toISOString() }
    setInstalledPkgs(prev => {
      const next = [...prev.filter(p => p.id !== pkg.id), entry]
      localStorage.setItem('drodo_installed_packages', JSON.stringify(next))
      return next
    })
  }

  const connectedCount = connectors.filter(c => c.isConnected).length

  const byCategory = CATEGORY_ORDER.map(cat => ({
    category: cat,
    items: connectors.filter(c => c.category === cat),
  }))

  const tavilyConfigured = !!getAppSettings().tavilyApiKey

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

        {/* ── AI Skills ────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full" style={{ background: '#7f77dd' }} />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">AI Skills</h2>
            <span className="text-xs text-[var(--text-secondary)]">
              ({Object.values(enabledSkills).filter(Boolean).length}/{AI_SKILLS.length})
            </span>
            {tavilyConfigured && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#1d9e7515', color: '#1d9e75', border: '1px solid #1d9e7530' }}>
                Tavily ✓
              </span>
            )}
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {AI_SKILLS.map(skill => (
              <SkillToggleCard
                key={skill.id}
                skill={skill}
                enabled={!!enabledSkills[skill.id]}
                onToggle={() => toggleSkill(skill.id)}
                onGearClick={() => setTavilyOpen(true)}
              />
            ))}
          </div>
        </div>

        {/* ── Skill Packages ────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full" style={{ background: '#f97316' }} />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Skill Packages</h2>
            <span className="text-xs text-[var(--text-secondary)]">
              ({installedPkgs.length} installed)
            </span>
          </div>
          {/* Info banner */}
          <div
            className="flex items-start gap-2 px-4 py-3 rounded-xl mb-4 text-xs text-[var(--text-muted)] leading-relaxed"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}
          >
            <span className="flex-shrink-0 mt-0.5">ℹ️</span>
            <span>
              Skill packages extend your agents with domain expertise. Most users only need one Engineering package.{' '}
              Packages marked <strong style={{ color: 'var(--text-muted)' }}>Reference</strong> and <strong style={{ color: 'var(--text-muted)' }}>Resource</strong>{' '}
              are reading material, not installs.
            </span>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {SKILL_PACKAGES.map(pkg => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                installed={installedPkgs.some(p => p.id === pkg.id)}
                onInstall={() => installPackage(pkg)}
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
      {tavilyOpen && <TavilyModal onClose={() => setTavilyOpen(false)} />}
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
