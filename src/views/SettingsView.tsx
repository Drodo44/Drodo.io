import { useState, useEffect } from 'react'
import { Settings2, Sun, Moon, Monitor, Database, Trash2, Key, CheckCircle2 } from 'lucide-react'
import { getAllProviders, loadAllSavedConfigs } from '../lib/providerApi'

// ─── Settings helpers ─────────────────────────────────────────────────────────

function getSettings(): Record<string, unknown> {
  try { return JSON.parse(localStorage.getItem('drodo_settings') ?? '{}') } catch { return {} }
}
function setSetting(key: string, value: unknown) {
  const s = getSettings()
  s[key] = value
  localStorage.setItem('drodo_settings', JSON.stringify(s))
}

function applyTheme(theme: string) {
  const root = document.getElementById('root')
  if (theme === 'light') {
    if (root) root.style.filter = 'invert(0.9) hue-rotate(180deg)'
    document.documentElement.classList.add('light')
  } else {
    if (root) root.style.filter = ''
    document.documentElement.classList.remove('light')
  }
}

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
  const settings = getSettings()

  // Appearance
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>(
    (settings.theme as 'dark' | 'light' | 'system') ?? 'dark'
  )

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const handleTheme = (t: 'dark' | 'light' | 'system') => {
    setTheme(t)
    setSetting('theme', t)
    applyTheme(t)
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
    setSetting('defaultModel', id)
  }

  // Tavily key
  const [tavilyKey, setTavilyKey] = useState('')
  const [tavilyKeySaved, setTavilyKeySaved] = useState(false)
  const existingTavilyKey = String(settings.tavilyApiKey ?? '')
  const tavilyConfigured = !!existingTavilyKey

  const handleSaveTavilyKey = () => {
    if (!tavilyKey.trim()) return
    setSetting('tavilyApiKey', tavilyKey.trim())
    setTavilyKeySaved(true)
    setTimeout(() => setTavilyKeySaved(false), 2000)
  }

  // Danger Zone
  const [showDanger, setShowDanger] = useState(false)
  const [resetInput, setResetInput] = useState('')

  const handleClearAll = () => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('drodo_'))
    keys.forEach(k => localStorage.removeItem(k))
    window.location.reload()
  }

  const counts = getStorageCounts()

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: '#0d0d0f' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid #2a2a2e', background: '#141418' }}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#9898a822' }}>
          <Settings2 size={18} style={{ color: '#9898a8' }} />
        </div>
        <div>
          <h1 className="font-bold text-[#e8e8ef] text-lg">Settings</h1>
          <p className="text-xs text-[#6b6b78]">Preferences, integrations, and data</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6" style={{ maxWidth: 680 }}>

        {/* ── Appearance ──────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-[#6b6b78] uppercase tracking-[0.12em] mb-3">Appearance</h2>
          <div className="p-4 rounded-xl border border-[#2a2a2e] bg-[#141418]">
            <div className="text-sm font-medium text-[#e8e8ef] mb-3">Theme</div>
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
                      : { background: '#1c1c22', color: '#9898a8', border: '1px solid #2a2a2e' }
                  }
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-[#6b6b78] mt-3">
              Dark and System both use the native dark theme. Light applies an inverted palette as a preview.
            </p>
          </div>
        </section>

        {/* ── Default Model ────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-[#6b6b78] uppercase tracking-[0.12em] mb-3">Default Model</h2>
          <div className="p-4 rounded-xl border border-[#2a2a2e] bg-[#141418]">
            {configuredProviders.length > 0 ? (
              <>
                <select
                  value={defaultModel}
                  onChange={e => handleDefaultModel(e.target.value)}
                  className="w-full bg-[#0d0d0f] border border-[#2a2a2e] rounded-lg px-3 py-2 text-sm text-[#e8e8ef] outline-none focus:border-[#7f77dd]/60 transition-colors"
                >
                  {configuredProviders.map(p => (
                    <option key={p.id} value={p.id} style={{ background: '#141418' }}>
                      {p.name} — {savedConfigs[p.id]?.model || p.model || p.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-[#6b6b78] mt-2">
                  Used as the active model when no other is selected.
                </p>
              </>
            ) : (
              <p className="text-sm text-[#6b6b78]">
                No models configured — add one in Model Connections.
              </p>
            )}
          </div>
        </section>

        {/* ── Skills Configuration ─────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-[#6b6b78] uppercase tracking-[0.12em] mb-3">Skills Configuration</h2>
          <div className="p-4 rounded-xl border border-[#2a2a2e] bg-[#141418] space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Key size={13} className="text-[#9898a8]" />
                <span className="text-sm font-medium text-[#e8e8ef]">Tavily API Key</span>
                {tavilyConfigured && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#1d9e7515', color: '#1d9e75', border: '1px solid #1d9e7530' }}>
                    Configured ✓
                  </span>
                )}
              </div>
              <p className="text-xs text-[#6b6b78] mb-3">Required for Web Search and Web Scraper skills.</p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={tavilyKey}
                  onChange={e => setTavilyKey(e.target.value)}
                  placeholder={tavilyConfigured ? 'Update key…' : 'tvly-xxxxxxxxxxxxxxxx'}
                  className="flex-1 bg-[#0d0d0f] border border-[#2a2a2e] rounded-lg px-3 py-2 text-sm text-[#e8e8ef] outline-none focus:border-[#7f77dd]/60 font-mono transition-colors"
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
          <h2 className="text-xs font-semibold text-[#6b6b78] uppercase tracking-[0.12em] mb-3">Privacy &amp; Data</h2>
          <div className="rounded-xl border border-[#2a2a2e] bg-[#141418] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2a2a2e]">
              <div className="flex items-center gap-2">
                <Database size={13} className="text-[#9898a8] flex-shrink-0" />
                <span className="text-sm font-semibold text-[#e8e8ef]">
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
                className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2e] last:border-0"
              >
                <span className="text-sm text-[#9898a8]">{label}</span>
                <span
                  className="text-xs font-mono font-medium"
                  style={{ color: count > 0 ? '#1d9e75' : '#6b6b78' }}
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
            className="p-4 rounded-xl border"
            style={{ borderColor: '#e0505040', background: '#e0505008' }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-[#e8e8ef]">Clear All Data</div>
                <div className="text-xs text-[#9898a8] mt-0.5">
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
                <p className="text-xs text-[#9898a8]">
                  Type <strong className="text-[#e05050]">RESET</strong> to confirm permanent deletion:
                </p>
                <input
                  type="text"
                  value={resetInput}
                  onChange={e => setResetInput(e.target.value)}
                  placeholder="Type RESET"
                  autoFocus
                  className="w-full bg-[#0d0d0f] border border-[#e05050]/30 rounded-lg px-3 py-2 text-sm text-[#e8e8ef] outline-none focus:border-[#e05050]/60 font-mono transition-colors"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowDanger(false); setResetInput('') }}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-[#9898a8] bg-[#1c1c22] hover:text-[#e8e8ef] transition-colors"
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
