import { useState, useEffect } from 'react'
import { Settings2, Sun, Moon, Monitor, Database, Trash2, Key, CheckCircle2, RotateCcw } from 'lucide-react'
import { getAllProviders, loadAllSavedConfigs } from '../lib/providerApi'
import { resetOnboarding } from '../components/Onboarding'
import { applyThemeClass } from '../lib/theme'
import { useAppStore } from '../store/appStore'
import { signOut } from '../lib/auth'
import { syncUserData } from '../lib/syncToSupabase'
import { getAppSettings, setAppSetting } from '../lib/appSettings'

// ─── Settings helpers ─────────────────────────────────────────────────────────

// ─── Storage breakdown ────────────────────────────────────────────────────────

function getStorageCounts() {
  const savedProviders = Object.keys(loadAllSavedConfigs()).length

  const installedPackages = (() => {
    try { return (JSON.parse(localStorage.getItem('drodo_installed_packages') ?? '[]') as unknown[]).length }
    catch { return 0 }
  })()

  const memoryEntries = (() => {
    try { return (JSON.parse(localStorage.getItem('drodo_agent_memory') ?? '[]') as unknown[]).length }
    catch { return 0 }
  })()

  const workflowDefs = (() => {
    try { return (JSON.parse(localStorage.getItem('drodo_workflow_defs') ?? '[]') as unknown[]).length }
    catch { return 0 }
  })()

  const connectorKeys = (() => {
    try { return Object.keys(JSON.parse(localStorage.getItem('drodo_connector_keys') ?? '{}')).length }
    catch { return 0 }
  })()

  return { savedProviders, installedPackages, memoryEntries, workflowDefs, connectorKeys }
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function SettingsView() {
  const user = useAppStore(state => state.user)
  const settings = getAppSettings()

  // Appearance
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>(
    (settings.theme as 'dark' | 'light' | 'system') ?? 'dark'
  )

  useEffect(() => {
    applyThemeClass(theme)
  }, [theme])

  const handleTheme = (t: 'dark' | 'light' | 'system') => {
    setTheme(t)
    setAppSetting('theme', t)
    applyThemeClass(t)
  }

  // Default Model
  const savedConfigs = loadAllSavedConfigs()
  const allProviders = getAllProviders()
  const configuredProviders = allProviders.filter(p => savedConfigs[p.id])
  const [defaultModel, setDefaultModel] = useState<string>(
    (settings.defaultModel as string) ?? (configuredProviders[0]?.id ?? '')
  )
  const handleDefaultModel = (id: string) => {
    setDefaultModel(id)
    setAppSetting('defaultModel', id)
  }

  // Tavily key
  const [tavilyKey, setTavilyKey] = useState('')
  const [tavilyKeySaved, setTavilyKeySaved] = useState(false)
  const existingTavilyKey = String(settings.tavilyApiKey ?? '')
  const tavilyConfigured = !!existingTavilyKey

  const handleSaveTavilyKey = () => {
    if (!tavilyKey.trim()) return
    setAppSetting('tavilyApiKey', tavilyKey.trim())
    setTavilyKeySaved(true)
    setTimeout(() => setTavilyKeySaved(false), 2000)
  }

  // Danger Zone
  const [syncSuccess, setSyncSuccess] = useState(false)
  const [showDanger, setShowDanger] = useState(false)
  const [resetInput, setResetInput] = useState('')

  const handleClearAll = () => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('drodo_'))
    keys.forEach(k => localStorage.removeItem(k))
    window.location.reload()
  }

  const handleSignOut = async () => {
    await signOut()
    localStorage.removeItem('drodo_skip_auth')
    window.location.reload()
  }

  const handleSyncData = async () => {
    if (!user?.id) return
    await syncUserData(user.id)
    setSyncSuccess(true)
    window.setTimeout(() => setSyncSuccess(false), 2000)
  }

  const counts = getStorageCounts()

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--text-muted)22' }}>
          <Settings2 size={18} style={{ color: 'var(--text-muted)' }} />
        </div>
        <div>
          <h1 className="font-bold text-[var(--text-primary)] text-lg">Settings</h1>
          <p className="text-xs text-[var(--text-secondary)]">Preferences, integrations, and data</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6" style={{ maxWidth: 680 }}>

        {/* ── Appearance ──────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-[0.12em] mb-3">Appearance</h2>
          <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
            <div className="text-sm font-medium text-[var(--text-primary)] mb-3">Theme</div>
            <div className="flex gap-2 flex-wrap">
              {([
                { key: 'dark' as const, label: 'Dark', Icon: Moon },
                { key: 'light' as const, label: 'Light', Icon: Sun },
                { key: 'system' as const, label: 'System', Icon: Monitor },
              ]).map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => handleTheme(key)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style={
                    theme === key
                      ? { background: '#7f77dd', color: '#fff' }
                      : { background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }
                  }
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-3">
              Dark and System both use the native dark theme. Light applies an inverted palette as a preview.
            </p>
          </div>
        </section>

        {/* ── Default Model ────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-[0.12em] mb-3">Default Model</h2>
          <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
            {configuredProviders.length > 0 ? (
              <>
                <select
                  value={defaultModel}
                  onChange={e => handleDefaultModel(e.target.value)}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60 transition-colors"
                >
                  {configuredProviders.map(p => (
                    <option key={p.id} value={p.id} style={{ background: 'var(--bg-secondary)' }}>
                      {p.name} — {savedConfigs[p.id]?.model || p.model || p.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-[var(--text-secondary)] mt-2">
                  Used as the active model when no other is selected.
                </p>
              </>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">
                No models configured — add one in Model Connections.
              </p>
            )}
          </div>
        </section>

        {/* ── Skills Configuration ─────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-[0.12em] mb-3">Skills Configuration</h2>
          <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Key size={13} className="text-[var(--text-muted)]" />
                <span className="text-sm font-medium text-[var(--text-primary)]">Tavily API Key</span>
                {tavilyConfigured && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#1d9e7515', color: '#1d9e75', border: '1px solid #1d9e7530' }}>
                    Configured ✓
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)] mb-3">Required for Web Search and Web Scraper skills.</p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={tavilyKey}
                  onChange={e => setTavilyKey(e.target.value)}
                  placeholder={tavilyConfigured ? 'Update key…' : 'tvly-xxxxxxxxxxxxxxxx'}
                  className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60 font-mono transition-colors"
                />
                {tavilyKeySaved ? (
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg" style={{ color: '#1d9e75' }}>
                    <CheckCircle2 size={14} />
                    <span className="text-sm font-medium">Saved</span>
                  </div>
                ) : (
                  <button
                    onClick={handleSaveTavilyKey}
                    disabled={!tavilyKey.trim()}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: '#7f77dd' }}
                  >
                    Save
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Privacy & Data ──────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-[0.12em] mb-3">Privacy &amp; Data</h2>
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2">
                <Database size={13} className="text-[var(--text-muted)] flex-shrink-0" />
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  All your data is stored locally on this device. Nothing is sent to Drodo servers.
                </span>
              </div>
            </div>
            {[
              { label: 'Saved providers', count: counts.savedProviders },
              { label: 'Installed packages', count: counts.installedPackages },
              { label: 'Memory entries', count: counts.memoryEntries },
              { label: 'Workflow definitions', count: counts.workflowDefs },
              { label: 'Connector keys', count: counts.connectorKeys },
            ].map(({ label, count }) => (
              <div
                key={label}
                className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] last:border-0"
              >
                <span className="text-sm text-[var(--text-muted)]">{label}</span>
                <span
                  className="text-xs font-mono font-medium"
                  style={{ color: count > 0 ? '#1d9e75' : 'var(--text-secondary)' }}
                >
                  {count}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Danger Zone ─────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] mb-3" style={{ color: '#e05050' }}>
            Danger Zone
          </h2>
          <div
            className="p-4 rounded-xl border mb-3"
            style={{ borderColor: '#e0505040', background: '#e0505008' }}
          >
            <div className="text-xs font-semibold uppercase tracking-[0.12em] mb-3" style={{ color: '#e05050' }}>
              Account
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">
                  {user?.email ?? 'Guest mode'}
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                  {user ? 'Signed in to sync workflows, prompts, and sessions.' : 'Local-only mode. Sign out to return to the auth screen.'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void handleSyncData()}
                  disabled={!user?.id}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: '#7f77dd' }}
                >
                  {syncSuccess ? 'Synced!' : 'Sync Data to Cloud'}
                </button>
                <button
                  onClick={() => void handleSignOut()}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-[#e05050]/30 text-[#e05050] hover:bg-[#e05050]/10 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
          {/* Reset Onboarding */}
          <div
            className="p-4 rounded-xl border mb-3 flex items-center justify-between gap-4"
            style={{ borderColor: '#e0505040', background: '#e0505008' }}
          >
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">Reset Onboarding</div>
              <div className="text-xs text-[var(--text-muted)] mt-0.5">Show the welcome wizard again on next reload.</div>
            </div>
            <button
              onClick={() => { resetOnboarding(); window.location.reload() }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold flex-shrink-0 border border-[#e05050]/30 text-[#e05050] hover:bg-[#e05050]/10 transition-colors"
            >
              <RotateCcw size={13} />
              Reset
            </button>
          </div>
          <div
            className="p-4 rounded-xl border"
            style={{ borderColor: '#e0505040', background: '#e0505008' }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">Clear All Data</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                  Removes all providers, skills, packages, workflows, and memory. Cannot be undone.
                </div>
              </div>
              {!showDanger && (
                <button
                  onClick={() => setShowDanger(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold flex-shrink-0 transition-all hover:opacity-90"
                  style={{ background: '#e05050', color: '#fff' }}
                >
                  <Trash2 size={14} />
                  Clear
                </button>
              )}
            </div>
            {showDanger && (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-[var(--text-muted)]">
                  Type <strong className="text-[#e05050]">RESET</strong> to confirm permanent deletion:
                </p>
                <input
                  type="text"
                  value={resetInput}
                  onChange={e => setResetInput(e.target.value)}
                  placeholder="Type RESET"
                  autoFocus
                  className="w-full bg-[var(--bg-primary)] border border-[#e05050]/30 rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[#e05050]/60 font-mono transition-colors"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowDanger(false); setResetInput('') }}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-muted)] bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClearAll}
                    disabled={resetInput !== 'RESET'}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                    style={{ background: '#e05050' }}
                  >
                    Confirm — Delete Everything
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
