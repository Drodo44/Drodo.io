import { useState } from 'react'
import { Settings, Moon, Database, Trash2 } from 'lucide-react'
import { getAllProviders, loadAllSavedConfigs } from '../lib/providerApi'

const STORAGE_KEYS = [
  { key: 'drodo_provider_configs', label: 'Provider API Keys & Configs' },
  { key: 'drodo_custom_providers', label: 'Custom Provider Definitions' },
  { key: 'drodo_workflow_defs', label: 'Saved Workflows' },
]

export function SettingsView() {
  const [confirmClear, setConfirmClear] = useState(false)
  const [cleared, setCleared] = useState(false)

  const savedConfigs = loadAllSavedConfigs()
  const allProviders = getAllProviders()
  const defaultProviderId = Object.keys(savedConfigs)[0] ?? null
  const defaultProvider = defaultProviderId
    ? allProviders.find(p => p.id === defaultProviderId) ?? null
    : null

  const storageUsed = STORAGE_KEYS.map(({ key, label }) => {
    const raw = localStorage.getItem(key)
    const bytes = raw ? new TextEncoder().encode(raw).length : 0
    return { key, label, bytes, exists: !!raw }
  })

  const handleClearAll = () => {
    STORAGE_KEYS.forEach(({ key }) => localStorage.removeItem(key))
    setConfirmClear(false)
    setCleared(true)
    setTimeout(() => window.location.reload(), 800)
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: '#0d0d0f' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid #2a2a2e', background: '#141418' }}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#9898a822' }}>
          <Settings size={18} style={{ color: '#9898a8' }} />
        </div>
        <div>
          <h1 className="font-bold text-[#e8e8ef] text-lg">Settings</h1>
          <p className="text-xs text-[#6b6b78]">App preferences and data</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6" style={{ maxWidth: 680 }}>
        {/* Appearance */}
        <section>
          <h2 className="text-xs font-semibold text-[#6b6b78] uppercase tracking-[0.12em] mb-3">
            Appearance
          </h2>
          <div className="p-4 rounded-xl border border-[#2a2a2e] bg-[#141418] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#1c1c22' }}>
                <Moon size={15} className="text-[#9898a8]" />
              </div>
              <div>
                <div className="text-sm font-medium text-[#e8e8ef]">Dark Mode</div>
                <div className="text-xs text-[#6b6b78] mt-0.5">Drodo uses dark mode exclusively</div>
              </div>
            </div>
            <div
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: '#7f77dd22', color: '#a09ae8' }}
            >
              Always on
            </div>
          </div>
        </section>

        {/* Default Model */}
        <section>
          <h2 className="text-xs font-semibold text-[#6b6b78] uppercase tracking-[0.12em] mb-3">
            Default Model
          </h2>
          <div className="p-4 rounded-xl border border-[#2a2a2e] bg-[#141418]">
            {defaultProvider ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                    style={{
                      background: defaultProvider.color + '33',
                      color: defaultProvider.color,
                    }}
                  >
                    {defaultProvider.initials}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-[#e8e8ef]">{defaultProvider.name}</div>
                    <div className="text-xs text-[#6b6b78] font-mono mt-0.5">
                      {savedConfigs[defaultProvider.id]?.model || defaultProvider.model}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-[#6b6b78]">Auto-selected</span>
              </div>
            ) : (
              <p className="text-sm text-[#6b6b78]">
                No providers configured. Go to Connections to add one.
              </p>
            )}
            <p className="text-xs text-[#6b6b78] mt-3 pt-3 border-t border-[#2a2a2e]">
              The default model is the first provider you connected. To change it, save a different
              provider in Connections — it will become the active model.
            </p>
          </div>
        </section>

        {/* Data & Privacy */}
        <section>
          <h2 className="text-xs font-semibold text-[#6b6b78] uppercase tracking-[0.12em] mb-3">
            Data &amp; Privacy
          </h2>
          <div className="rounded-xl border border-[#2a2a2e] bg-[#141418] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2a2a2e]">
              <div className="flex items-center gap-2 mb-1">
                <Database size={13} className="text-[#9898a8]" />
                <span className="text-sm font-medium text-[#e8e8ef]">Local Storage Only</span>
              </div>
              <p className="text-xs text-[#6b6b78]">
                All data is stored on your device. Nothing is sent to Drodo servers. API keys never
                leave your machine.
              </p>
            </div>
            {storageUsed.map(({ key, label, bytes, exists }) => (
              <div
                key={key}
                className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2e] last:border-0"
              >
                <span className="text-sm text-[#9898a8]">{label}</span>
                <span
                  className="text-xs font-mono"
                  style={{ color: exists ? '#1d9e75' : '#6b6b78' }}
                >
                  {exists ? `${bytes} B` : 'empty'}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Danger Zone */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] mb-3" style={{ color: '#e05050' }}>
            Danger Zone
          </h2>
          <div
            className="p-4 rounded-xl border"
            style={{ borderColor: '#e05050' + '40', background: '#e05050' + '08' }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-[#e8e8ef]">Clear All Data</div>
                <div className="text-xs text-[#9898a8] mt-0.5">
                  Removes all API keys, providers, and workflows. This cannot be undone.
                </div>
              </div>
              {!confirmClear ? (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold flex-shrink-0 transition-all hover:opacity-90"
                  style={{ background: '#e05050', color: '#fff' }}
                >
                  <Trash2 size={14} />
                  Clear
                </button>
              ) : (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="px-3 py-2 rounded-lg text-sm font-medium text-[#9898a8] bg-[#1c1c22] hover:text-[#e8e8ef] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                    style={{ background: '#e05050' }}
                  >
                    {cleared ? 'Cleared!' : 'Confirm Clear'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
