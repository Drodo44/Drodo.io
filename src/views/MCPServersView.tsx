import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Server,
  Plus,
  Workflow,
  Database,
  GitBranch,
  FolderOpen,
  Search,
  MessageSquare,
  Mail,
  Globe,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Key,
  Trash2,
  X,
  Star,
  Settings2,
} from 'lucide-react'
import { clsx } from 'clsx'
import { invoke } from '@tauri-apps/api/core'
import type { MCPServer } from '../types'

const STORAGE_KEY = 'drodo_mcp_servers'
const CREDS_KEY_PREFIX = 'drodo_mcp_creds_'

type Status = MCPServer['status']

type FeaturedServer = {
  id: string
  name: string
  description: string
  category: string
  stars: string
  url: string
  color: string
  Icon: typeof Workflow
  credType: 'github' | 'supabase' | 'generic'
}

const FEATURED_SERVERS: FeaturedServer[] = [
  {
    id: 'google-workspace-cli',
    name: 'Google Workspace',
    Icon: Mail,
    color: '#4285f4',
    stars: 'New',
    description: 'Give your agents full access to Gmail, Drive, Docs, Sheets, Calendar, and Meet. Read emails, create documents, update spreadsheets, and schedule meetings — all autonomously.',
    category: 'Productivity',
    url: 'npx @google/workspace-mcp',
    credType: 'generic',
  },
  {
    id: 'n8n-mcp',
    name: 'n8n-MCP',
    Icon: Workflow,
    color: '#ea4b71',
    stars: '2.1k',
    description: 'Gives your agents expert knowledge of all 1,396 n8n nodes, 2,709 workflow templates, and real configuration schemas. Essential for the Agent→n8n workflow builder.',
    category: 'Automation',
    url: 'npx n8n-mcp',
    credType: 'generic',
  },
  {
    id: 'supabase-mcp',
    name: 'Supabase MCP',
    Icon: Database,
    color: '#3ecf8e',
    stars: '4.8k',
    description: 'Connect agents directly to your Supabase database. Query, insert, and manage data without leaving Drodo.',
    category: 'Database',
    url: 'npx @supabase/mcp-server-supabase',
    credType: 'supabase',
  },
  {
    id: 'github-mcp',
    name: 'GitHub MCP',
    Icon: GitBranch,
    color: '#ffffff',
    stars: '12.3k',
    description: 'Let agents read repos, create issues, open PRs, and manage code directly on GitHub.',
    category: 'Development',
    url: 'npx @modelcontextprotocol/server-github',
    credType: 'github',
  },
  {
    id: 'filesystem-mcp',
    name: 'Filesystem MCP',
    Icon: FolderOpen,
    color: '#f97316',
    stars: '8.9k',
    description: 'Give agents secure access to read and write files on your local machine.',
    category: 'Files',
    url: 'npx @modelcontextprotocol/server-filesystem',
    credType: 'generic',
  },
  {
    id: 'brave-search-mcp',
    name: 'Brave Search MCP',
    Icon: Search,
    color: '#fb923c',
    stars: '3.2k',
    description: 'Real-time web search powered by Brave Search API. Agents can search the web natively.',
    category: 'Search',
    url: 'npx @modelcontextprotocol/server-brave-search',
    credType: 'generic',
  },
  {
    id: 'postgres-mcp',
    name: 'PostgreSQL MCP',
    Icon: Database,
    color: '#336791',
    stars: '2.7k',
    description: 'Direct PostgreSQL database access for agents. Query any database with natural language.',
    category: 'Database',
    url: 'npx @modelcontextprotocol/server-postgres',
    credType: 'generic',
  },
  {
    id: 'slack-mcp',
    name: 'Slack MCP',
    Icon: MessageSquare,
    color: '#4a154b',
    stars: '1.9k',
    description: 'Read and send Slack messages, manage channels, and let agents communicate with your team.',
    category: 'Communication',
    url: 'npx @modelcontextprotocol/server-slack',
    credType: 'generic',
  },
  {
    id: 'puppeteer-mcp',
    name: 'Puppeteer MCP',
    Icon: Globe,
    color: '#7f77dd',
    stars: '5.1k',
    description: 'Full browser automation — agents can navigate websites, fill forms, take screenshots, and scrape data.',
    category: 'Browser',
    url: 'npx @modelcontextprotocol/server-puppeteer',
    credType: 'generic',
  },
]

const STATUS_CFG = {
  connected: { Icon: CheckCircle2, color: '#1d9e75', bg: '#1d9e7515', label: 'Connected' },
  disconnected: { Icon: XCircle, color: 'var(--text-secondary)', bg: 'var(--bg-tertiary)', label: 'Not configured' },
  error: { Icon: AlertCircle, color: '#e05050', bg: '#e0505015', label: 'Error' },
} satisfies Record<Status, { Icon: typeof CheckCircle2; color: string; bg: string; label: string }>

// ─── Credential helpers ───────────────────────────────────────────────────────

type CredType = FeaturedServer['credType']

interface GitHubCreds { token: string }
interface SupabaseCreds { url: string; key: string }
interface GenericCreds { apiKey: string }
type Creds = GitHubCreds | SupabaseCreds | GenericCreds

function loadCreds(serverId: string): Creds | null {
  try {
    const raw = localStorage.getItem(CREDS_KEY_PREFIX + serverId)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveCreds(serverId: string, creds: Creds) {
  localStorage.setItem(CREDS_KEY_PREFIX + serverId, JSON.stringify(creds))
}

function credsToEnvMap(creds: Creds, credType: CredType): Record<string, string> {
  if (credType === 'github') {
    const c = creds as GitHubCreds
    return { GITHUB_PERSONAL_ACCESS_TOKEN: c.token }
  }
  if (credType === 'supabase') {
    const c = creds as SupabaseCreds
    return { SUPABASE_URL: c.url, SUPABASE_SERVICE_ROLE_KEY: c.key }
  }
  const c = creds as GenericCreds
  return { MCP_API_KEY: c.apiKey }
}

async function startMcpServerProcess(
  serverId: string,
  command: string,
  creds: Creds,
  credType: CredType,
): Promise<void> {
  const isTauri = '__TAURI_INTERNALS__' in window
  if (!isTauri) return // dev mode — skip process spawn
  const envVars = credsToEnvMap(creds, credType)
  await invoke('start_mcp_server', { serverId, command, envVars })
}

// ─── Credential Modal ─────────────────────────────────────────────────────────

function CredentialModal({
  serverId,
  serverName,
  credType,
  onClose,
  onSaved,
}: {
  serverId: string
  serverName: string
  credType: CredType
  onClose: () => void
  onSaved: () => void
}) {
  const existing = loadCreds(serverId)
  const [token, setToken] = useState((existing as GitHubCreds)?.token ?? '')
  const [url, setUrl] = useState((existing as SupabaseCreds)?.url ?? '')
  const [key, setKey] = useState((existing as SupabaseCreds)?.key ?? '')
  const [apiKey, setApiKey] = useState((existing as GenericCreds)?.apiKey ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setError(null)
    let creds: Creds

    if (credType === 'github') {
      if (!token.trim()) { setError('Personal Access Token is required.'); return }
      creds = { token: token.trim() }
    } else if (credType === 'supabase') {
      if (!url.trim() || !key.trim()) { setError('Project URL and Service Role Key are both required.'); return }
      creds = { url: url.trim(), key: key.trim() }
    } else {
      if (!apiKey.trim()) { setError('API Key is required.'); return }
      creds = { apiKey: apiKey.trim() }
    }

    setSaving(true)
    try {
      saveCreds(serverId, creds)
      // Determine the server command from FEATURED_SERVERS or use serverId as fallback
      const featured = FEATURED_SERVERS.find(s => s.id === serverId)
      const command = featured?.url ?? serverId
      await startMcpServerProcess(serverId, command, creds, credType)
      onSaved()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`Failed to start server: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6 py-8"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border overflow-hidden"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#7f77dd22' }}>
              <Key size={16} style={{ color: '#7f77dd' }} />
            </div>
            <div>
              <h2 className="font-bold text-[var(--text-primary)] text-sm">Configure {serverName}</h2>
              <p className="text-xs text-[var(--text-secondary)]">Credentials are stored locally and never sent to Drodo servers</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {credType === 'github' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-muted)] flex items-center gap-1.5">
                <Key size={11} /> GitHub Personal Access Token
              </label>
              <input
                type="password"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60 font-mono transition-colors"
              />
              <p className="text-xs text-[var(--text-secondary)]">Generate at github.com → Settings → Developer Settings → Personal Access Tokens</p>
            </div>
          )}

          {credType === 'supabase' && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-muted)]">Project URL</label>
                <input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://xxxxxxxxxxxx.supabase.co"
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60 font-mono transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-muted)]">Service Role Key</label>
                <input
                  type="password"
                  value={key}
                  onChange={e => setKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60 font-mono transition-colors"
                />
                <p className="text-xs text-[var(--text-secondary)]">Found in Supabase Dashboard → Settings → API → service_role key</p>
              </div>
            </>
          )}

          {credType === 'generic' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-muted)] flex items-center gap-1.5">
                <Key size={11} /> API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="Your API key"
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60 font-mono transition-colors"
              />
            </div>
          )}

          {error && (
            <p className="text-xs text-[#e05050] px-3 py-2 rounded-lg" style={{ background: '#e0505010', border: '1px solid #e0505020' }}>
              {error}
            </p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="flex-1 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ background: '#7f77dd' }}
            >
              {saving ? 'Connecting…' : 'Save & Connect'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

function loadServers(): MCPServer[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as MCPServer[]) : []
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(server => ({
        id: server.id,
        name: server.name,
        url: server.url,
        status: server.status,
        toolsCount: typeof server.toolsCount === 'number' ? server.toolsCount : 0,
        description: server.description ?? '',
        addedAt: server.addedAt ?? new Date().toISOString(),
      }))
      .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
  } catch {
    return []
  }
}

function saveServers(servers: MCPServer[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(servers))
}

function upsertServer(server: MCPServer): MCPServer[] {
  const current = loadServers()
  const next = current.some(existing => existing.id === server.id)
    ? current.map(existing => (existing.id === server.id ? { ...existing, ...server } : existing))
    : [server, ...current]
  saveServers(next)
  return loadServers()
}

function removeServer(serverId: string): MCPServer[] {
  const next = loadServers().filter(server => server.id !== serverId)
  saveServers(next)
  return next
}

function EmptyServersState({ onAddCustom }: { onAddCustom: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--bg-tertiary)]">
        <Server size={28} className="text-[var(--text-secondary)]" />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-[var(--text-primary)]">No MCP servers added yet</h3>
      <p className="mt-2 max-w-xl text-sm text-[var(--text-secondary)]">
        Add a featured server above or connect a custom one.
      </p>
      <button
        onClick={onAddCustom}
        className="mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
        style={{ background: '#7f77dd' }}
      >
        <Plus size={14} />
        Add Custom Server
      </button>
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function MCPServersView() {
  const [servers, setServers] = useState<MCPServer[]>([])
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [descriptionInput, setDescriptionInput] = useState('')
  const [formError, setFormError] = useState('')
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null)
  const [featuredInfo, setFeaturedInfo] = useState<{ title: string; body: string } | null>(null)
  const [credModal, setCredModal] = useState<{ serverId: string; serverName: string; credType: CredType } | null>(null)
  // Track which servers have saved credentials (for status display)
  const [credsVersion, setCredsVersion] = useState(0)
  const testingTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    const syncServers = () => setServers(loadServers())
    syncServers()
    window.addEventListener('storage', syncServers)
    return () => {
      window.removeEventListener('storage', syncServers)
      if (testingTimeoutRef.current) window.clearTimeout(testingTimeoutRef.current)
    }
  }, [])

  const connectedCount = servers.filter(server => server.status === 'connected').length
  const addedIds = useMemo(() => new Set(servers.map(server => server.id)), [servers])

  const hasCreds = (serverId: string) => {
    void credsVersion // reactive dependency
    return loadCreds(serverId) !== null
  }

  const addFeaturedServer = (featured: FeaturedServer) => {
    const nextServers = upsertServer({
      id: featured.id,
      name: featured.name,
      url: featured.url,
      status: 'disconnected',
      toolsCount: 0,
      description: featured.description,
      addedAt: new Date().toISOString(),
    })
    setServers(nextServers)
    // Open credential modal immediately
    setCredModal({ serverId: featured.id, serverName: featured.name, credType: featured.credType })
  }

  const openConfigureModal = (server: MCPServer) => {
    const featured = FEATURED_SERVERS.find(s => s.id === server.id)
    const credType: CredType = featured?.credType ?? 'generic'
    setCredModal({ serverId: server.id, serverName: server.name, credType })
  }

  const handleCredSaved = (serverId: string) => {
    // Mark server as connected
    const nextServers = upsertServer({
      ...loadServers().find(s => s.id === serverId)!,
      status: 'connected',
    })
    setServers(nextServers)
    setCredsVersion(v => v + 1)
  }

  const handleSaveCustom = () => {
    const name = nameInput.trim()
    const url = urlInput.trim()
    const description = descriptionInput.trim()
    if (!name || !url) {
      setFormError('Name and URL are required.')
      return
    }
    const newServer: MCPServer = {
      id: crypto.randomUUID(),
      name,
      url,
      status: 'disconnected',
      toolsCount: 0,
      description,
      addedAt: new Date().toISOString(),
    }
    const nextServers = upsertServer(newServer)
    setServers(nextServers)
    setNameInput('')
    setUrlInput('')
    setDescriptionInput('')
    setFormError('')
    setShowCustomForm(false)
    // Open credential modal for the new custom server
    setCredModal({ serverId: newServer.id, serverName: name, credType: 'generic' })
  }

  const handleRemove = (serverId: string) => {
    setServers(removeServer(serverId))
    localStorage.removeItem(CREDS_KEY_PREFIX + serverId)
    setPendingRemoveId(current => (current === serverId ? null : current))
    setCredsVersion(v => v + 1)
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <div
        className="flex items-center justify-between px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#0ea5e922' }}>
            <Server size={18} style={{ color: '#0ea5e9' }} />
          </div>
          <div>
            <h1 className="font-bold text-[var(--text-primary)] text-lg">MCP Servers</h1>
            <p className="text-xs text-[var(--text-secondary)]">
              {connectedCount} connected · {servers.length} total
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCustomForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#7f77dd' }}
        >
          <Plus size={14} />
          Add Custom Server
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Featured Servers */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full" style={{ background: '#7f77dd' }} />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Featured MCP Servers</h2>
            <span className="text-xs text-[var(--text-secondary)]">One-click integrations</span>
          </div>

          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {FEATURED_SERVERS.map(server => {
              const alreadyAdded = addedIds.has(server.id)
              const connected = hasCreds(server.id)

              return (
                <div key={server.id} className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${server.color}22`, color: server.color }}
                      >
                        <server.Icon size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[var(--text-primary)]">{server.name}</div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: `${server.color}18`, color: server.color, border: `1px solid ${server.color}30` }}
                          >
                            {server.category}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                            <Star size={11} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
                            {server.stars}
                          </span>
                        </div>
                      </div>
                    </div>

                    {connected ? (
                      <button
                        onClick={() => setCredModal({ serverId: server.id, serverName: server.name, credType: server.credType })}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ background: '#1d9e7515', color: '#1d9e75', border: '1px solid #1d9e7530' }}
                        title="Reconfigure credentials"
                      >
                        <CheckCircle2 size={11} />
                        Connected
                      </button>
                    ) : alreadyAdded ? (
                      <button
                        onClick={() => setCredModal({ serverId: server.id, serverName: server.name, credType: server.credType })}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                        style={{ background: '#7f77dd' }}
                      >
                        <Settings2 size={11} />
                        Configure
                      </button>
                    ) : (
                      <button
                        onClick={() => addFeaturedServer(server)}
                        className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                        style={{ background: '#7f77dd' }}
                      >
                        Add
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">{server.description}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* Your MCP Servers */}
        <section>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: '#0ea5e9' }} />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Your MCP Servers</h2>
              <span className="text-xs text-[var(--text-secondary)]">{servers.length} saved</span>
            </div>

            {!showCustomForm && (
              <button
                onClick={() => setShowCustomForm(true)}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
                style={{ background: '#7f77dd' }}
              >
                <Plus size={14} />
                Add Custom Server
              </button>
            )}
          </div>

          {showCustomForm && (
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 mb-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Name</label>
                  <input
                    value={nameInput}
                    onChange={event => {
                      setNameInput(event.target.value)
                      if (event.target.value.trim() && urlInput.trim()) setFormError('')
                    }}
                    placeholder="My MCP Server"
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">URL / Command</label>
                  <input
                    value={urlInput}
                    onChange={event => {
                      setUrlInput(event.target.value)
                      if (nameInput.trim() && event.target.value.trim()) setFormError('')
                    }}
                    placeholder="npx my-mcp-server"
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60 transition-colors font-mono"
                  />
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Description (optional)</label>
                <input
                  value={descriptionInput}
                  onChange={event => setDescriptionInput(event.target.value)}
                  placeholder="What this server is for"
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60 transition-colors"
                />
              </div>
              {formError && <p className="mt-3 text-xs text-[#e05050]">{formError}</p>}
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={handleSaveCustom}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: '#7f77dd' }}
                >
                  Save Server
                </button>
                <button
                  onClick={() => {
                    setShowCustomForm(false)
                    setNameInput('')
                    setUrlInput('')
                    setDescriptionInput('')
                    setFormError('')
                  }}
                  className="rounded-xl border border-[var(--border-color)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {servers.length === 0 ? (
            <EmptyServersState onAddCustom={() => setShowCustomForm(true)} />
          ) : (
            <div className="space-y-3">
              {servers.map(server => {
                const serverHasCreds = hasCreds(server.id)
                const status = serverHasCreds ? STATUS_CFG.connected : STATUS_CFG.disconnected
                return (
                  <div
                    key={server.id}
                    className={clsx(
                      'flex items-center gap-4 rounded-xl border bg-[var(--bg-secondary)] p-4',
                      serverHasCreds ? 'border-[#1d9e75]/25' : 'border-[var(--border-color)]'
                    )}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--bg-tertiary)] text-sm font-bold text-[var(--text-secondary)]">
                      {server.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[var(--text-primary)]">{server.name}</div>
                      <div className="mt-0.5 truncate text-xs font-mono text-[var(--text-secondary)]">{server.url}</div>
                      {server.description && (
                        <p className="mt-2 text-xs text-[var(--text-muted)] line-clamp-2">{server.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 flex-wrap justify-end">
                      <span
                        className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                        style={{ color: status.color, background: status.bg }}
                      >
                        <status.Icon size={11} />
                        {status.label}
                      </span>

                      {pendingRemoveId === server.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[var(--text-muted)]">Remove?</span>
                          <button
                            onClick={() => handleRemove(server.id)}
                            className="rounded-lg bg-[#e05050] px-2.5 py-1 text-xs font-semibold text-white"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setPendingRemoveId(null)}
                            className="rounded-lg border border-[var(--border-color)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => openConfigureModal(server)}
                            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                          >
                            <Settings2 size={12} />
                            {serverHasCreds ? 'Reconfigure' : 'Configure'}
                          </button>
                          <button
                            onClick={() => setPendingRemoveId(server.id)}
                            className="rounded-lg border border-[var(--border-color)] p-2 text-[var(--text-secondary)] transition-colors hover:text-[#e05050]"
                            aria-label={`Remove ${server.name}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4">
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            MCP (Model Context Protocol) servers extend Drodo with external tools, APIs, filesystems, and data sources. Credentials are stored locally on your device and passed as environment variables when the server starts — they are never sent to Drodo servers.
          </p>
        </div>
      </div>

      {/* Credential Modal */}
      {credModal && (
        <CredentialModal
          serverId={credModal.serverId}
          serverName={credModal.serverName}
          credType={credModal.credType}
          onClose={() => setCredModal(null)}
          onSaved={() => handleCredSaved(credModal.serverId)}
        />
      )}

      {featuredInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6 py-8"
          style={{ background: 'rgba(0, 0, 0, 0.55)', backdropFilter: 'blur(8px)' }}
          onClick={() => setFeaturedInfo(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border overflow-hidden"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-color)] px-5 py-4">
              <h2 className="text-base font-bold text-[var(--text-primary)]">{featuredInfo.title}</h2>
              <button
                onClick={() => setFeaturedInfo(null)}
                className="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{featuredInfo.body}</p>
              <button
                onClick={() => setFeaturedInfo(null)}
                className="mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
                style={{ background: '#7f77dd' }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
