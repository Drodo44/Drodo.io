import { useState, useEffect, useMemo } from 'react'
import { Settings2, Sun, Moon, Monitor, Database, Trash2, Key, CheckCircle2, RotateCcw } from 'lucide-react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { getAllSavedModels, loadAllSavedConfigs } from '../lib/providerApi'
import { resetOnboarding } from '../components/Onboarding'
import { resetTutorial } from '../components/ui/Tutorial'
import { Logo } from '../components/ui/Logo'
import { applyThemeClass } from '../lib/theme'
import { useAppStore } from '../store/appStore'
import { signOut } from '../lib/auth'
import { syncUserData } from '../lib/syncToSupabase'
import { getAppSettings, setAppSetting } from '../lib/appSettings'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { getVersion } from '@tauri-apps/api/app'
import { checkForUpdates, getStoredUpdateInfo, type StoredUpdateInfo } from '../lib/updater'

// ─── Settings helpers ─────────────────────────────────────────────────────────

// ─── Storage breakdown ────────────────────────────────────────────────────────

function getStorageCounts() {
  const savedProviders = Object.keys(loadAllSavedConfigs()).length

  const installedPackages = (() => {
    try { return (JSON.parse(localStorage.getItem('drodo_installed_packages') ?? '[]') as unknown[]).length }
    catch { return 0 }
  })()

  const memoryEntries = (() => {
    try { return Number((JSON.parse(localStorage.getItem('drodo_agent_memory_meta') ?? '{}') as { count?: number }).count ?? 0) }
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
  const activeProvider = useAppStore(state => state.activeProvider)
  const setSessionModel = useAppStore(state => state.setSessionModel)
  const settings = getAppSettings()

  // Appearance
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>(
    (settings.theme as 'dark' | 'light' | 'system') ?? 'dark'
  )
  const [appVersion, setAppVersion] = useState('...')

  useEffect(() => {
    applyThemeClass(theme)
  }, [theme])

  useEffect(() => {
    getVersion().then(setAppVersion)
  }, [])

  const handleTheme = (t: 'dark' | 'light' | 'system') => {
    setTheme(t)
    setAppSetting('theme', t)
    applyThemeClass(t)
  }

  // Default Model
  const savedModelOptions = useMemo(() => {
    const activeModelId = activeProvider.model ?? activeProvider.name
    const activeKey = `${activeProvider.id}::${activeModelId}`
    const options = getAllSavedModels().map(entry => ({
      key: `${entry.providerId}::${entry.model.id}`,
      providerId: entry.providerId,
      modelId: entry.model.id,
      label: `${entry.providerName} — ${entry.model.label}`,
    }))

    if (!options.some(option => option.key === activeKey)) {
      options.unshift({
        key: activeKey,
        providerId: activeProvider.id,
        modelId: activeModelId,
        label: `${activeProvider.name} — ${activeModelId}`,
      })
    }

    return options
  }, [activeProvider])

  const [defaultModel, setDefaultModel] = useState<string>(() => {
    const savedDefault = settings.defaultModel as string | undefined
    return savedDefault && savedDefault.includes('::')
      ? savedDefault
      : `${activeProvider.id}::${activeProvider.model ?? activeProvider.name}`
  })

  useEffect(() => {
    const activeKey = `${activeProvider.id}::${activeProvider.model ?? activeProvider.name}`
    if (savedModelOptions.some(option => option.key === defaultModel)) return
    setDefaultModel(activeKey)
  }, [activeProvider, defaultModel, savedModelOptions])

  const handleDefaultModel = (value: string) => {
    const [providerId, modelId] = value.split('::')
    if (!providerId || !modelId) return

    setDefaultModel(value)
    setAppSetting('defaultModel', value)
    setSessionModel(providerId, modelId)
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
  const [updateInfo, setUpdateInfo] = useState<StoredUpdateInfo | null>(() => getStoredUpdateInfo())
  const [checkingUpdates, setCheckingUpdates] = useState(false)
  const [installingUpdate, setInstallingUpdate] = useState(false)
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

  const refreshUpdateInfo = () => {
    setUpdateInfo(getStoredUpdateInfo())
  }

  const handleCheckForUpdates = async () => {
    setCheckingUpdates(true)
    await checkForUpdates()
    refreshUpdateInfo()
    setCheckingUpdates(false)
  }

  const handleInstallUpdate = async () => {
    setInstallingUpdate(true)
    try {
      const update = await check()
      if (update?.available) {
        await update.downloadAndInstall()
        await relaunch()
      }
    } finally {
      setInstallingUpdate(false)
    }
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
              Choose the palette you want Drodo to use across every view.
            </p>
          </div>
        </section>

        {/* ── Default Model ────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-[0.12em] mb-3">Default Model</h2>
          <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
            {savedModelOptions.length > 0 ? (
              <>
                <select
                  value={defaultModel}
                  onChange={e => handleDefaultModel(e.target.value)}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60 transition-colors"
                >
                  {savedModelOptions.map(option => (
                    <option key={option.key} value={option.key} style={{ background: 'var(--bg-secondary)' }}>
                      {option.label}
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
          <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-[0.12em] mb-3">Updates</h2>
          <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
            {updateInfo?.version ? (
              <div
                className="rounded-xl border px-4 py-3 mb-4"
                style={{ background: '#1d9e7512', borderColor: '#1d9e7530' }}
              >
                <div className="text-sm font-semibold" style={{ color: '#1d9e75' }}>
                  Version {updateInfo.version} available
                </div>
                {updateInfo.body && (
                  <p className="text-xs mt-1 text-[var(--text-muted)]">{updateInfo.body}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)] mb-4">Drodo is up to date</p>
            )}

            <div className="flex gap-2">
              {updateInfo?.version && (
                <button
                  onClick={() => void handleInstallUpdate()}
                  disabled={installingUpdate}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: '#1d9e75' }}
                >
                  {installingUpdate ? 'Installing…' : 'Install Update'}
                </button>
              )}
              <button
                onClick={() => void handleCheckForUpdates()}
                disabled={checkingUpdates}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: '#7f77dd' }}
              >
                {checkingUpdates ? 'Checking…' : 'Check for Updates'}
              </button>
            </div>
          </div>
        </section>

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

        <section>
          <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-[0.12em] mb-3">About</h2>
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Logo size={28} />
                <div>
                  <div className="text-sm font-semibold text-[var(--text-primary)]">Drodo</div>
                  <div className="text-xs text-[var(--text-secondary)]">Version {appVersion}</div>
                </div>
              </div>
            </div>
            <p className="mt-4 text-sm text-[var(--text-secondary)]">
              Built for everyone. Powered by any AI.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={() => void openUrl('https://github.com/Drodo44/Drodo.io')}
                className="rounded-xl border border-[var(--border-color)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
              >
                GitHub
              </button>
              <button
                onClick={() => void openUrl('https://github.com/Drodo44/Drodo.io/issues')}
                className="rounded-xl border border-[var(--border-color)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
              >
                Report a Bug
              </button>
              <button
                onClick={() => { resetTutorial(); window.location.reload() }}
                className="rounded-xl border border-[var(--border-color)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
              >
                Restart Tutorial
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
