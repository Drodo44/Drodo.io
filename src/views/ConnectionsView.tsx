import { useState, useEffect } from 'react'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Key,
  Link,
  Loader,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useAppStore } from '../store/appStore'
import {
  deleteCustomProvider,
  getAllProviders,
  loadProviderConfig,
  normalizeUrl,
  saveCustomProvider,
  saveProviderConfig,
  testConnection,
} from '../lib/providerApi'
import type { Provider } from '../types'

type TestState = 'idle' | 'testing' | 'success' | 'error'

const CUSTOM_COLORS = [
  '#7f77dd', '#1d9e75', '#cc785c', '#10a37f', '#4285f4',
  '#f97316', '#6366f1', '#0ea5e9', '#d4a227', '#e05050',
]

function randomColor() {
  return CUSTOM_COLORS[Math.floor(Math.random() * CUSTOM_COLORS.length)]
}

function ProviderRow({
  provider,
  selected,
  onSelect,
}: {
  provider: Provider
  selected: boolean
  onSelect: () => void
}) {
  const saved = loadProviderConfig(provider.id)
  const hasKey = !!saved?.apiKey || !!provider.isLocal
  return (
    <button
      onClick={onSelect}
      className={clsx(
        'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-[var(--border-color)]',
        selected
          ? 'bg-[#7f77dd]/10 text-[var(--text-primary)]'
          : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
      )}
    >
      <div className="relative flex-shrink-0">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
          style={{ background: provider.color + '33', color: provider.color }}
        >
          {provider.initials}
        </div>
        {hasKey && (
          <span
            className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2"
            style={{ background: '#1d9e75', borderColor: 'var(--bg-secondary)' }}
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold truncate">{provider.name}</div>
        <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
          {provider.isLocal ? 'Local · no key needed' : normalizeUrl(saved?.baseUrl || provider.baseUrl) || 'No URL set'}
        </div>
      </div>
      {selected && <ChevronRight size={13} className="text-[#7f77dd] flex-shrink-0" />}
    </button>
  )
}

function AddCustomForm({ onAdd }: { onAdd: (provider: Provider) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !baseUrl.trim()) return
    const id = `custom-${Date.now()}`
    const initials = name.trim().slice(0, 2).toUpperCase()
    onAdd({
      id,
      name: name.trim(),
      baseUrl: baseUrl.trim(),
      model: model.trim() || undefined,
      color: randomColor(),
      initials,
    })
    setName('')
    setBaseUrl('')
    setModel('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-4 py-3 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors border-b border-[var(--border-color)]"
      >
        <Plus size={13} />
        Add custom provider
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-3 border-b border-[var(--border-color)] bg-[var(--bg-primary)]">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-[var(--text-primary)]">New Custom Provider</span>
        <button type="button" onClick={() => setOpen(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <X size={13} />
        </button>
      </div>
      <input
        autoFocus
        required
        placeholder="Provider name"
        value={name}
        onChange={e => setName(e.target.value)}
        className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60"
      />
      <input
        required
        placeholder="Base URL (e.g. https://api.example.com/v1)"
        value={baseUrl}
        onChange={e => setBaseUrl(e.target.value)}
        className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60 font-mono"
      />
      <input
        placeholder="Default model (optional)"
        value={model}
        onChange={e => setModel(e.target.value)}
        className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60 font-mono"
      />
      <button
        type="submit"
        className="w-full py-2 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: '#7f77dd' }}
      >
        Add Provider
      </button>
    </form>
  )
}

export function ConnectionsView() {
  const setActiveProvider = useAppStore(s => s.setActiveProvider)

  const [providers, setProviders] = useState<Provider[]>(() => getAllProviders())
  const [selectedId, setSelectedId] = useState(providers[0]?.id ?? 'anthropic')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [testState, setTestState] = useState<TestState>('idle')
  const [testMessage, setTestMessage] = useState('')
  const [saved, setSaved] = useState(false)

  const selected = providers.find(p => p.id === selectedId) ?? providers[0]
  const isCustom = !selected?.id.startsWith('custom-') === false

  useEffect(() => {
    if (!selected) return
    const config = loadProviderConfig(selected.id)
    setApiKey(config?.apiKey ?? '')
    setBaseUrl(config?.baseUrl || selected.baseUrl)
    setModel(config?.model || selected.model || '')
    setTestState('idle')
    setTestMessage('')
    setSaved(false)
  }, [selectedId])

  const effectiveUrl = baseUrl || selected?.baseUrl || ''
  const effectiveModel = model || selected?.model || ''

  const handleTest = async () => {
    if (!selected) return
    setTestState('testing')
    setTestMessage('')
    const result = await testConnection(
      { ...selected, baseUrl: effectiveUrl, apiKey, model: effectiveModel },
      apiKey,
      effectiveUrl,
      effectiveModel
    )
    setTestState(result.ok ? 'success' : 'error')
    setTestMessage(result.message)
  }

  const handleSave = () => {
    if (!selected) return
    const provider: Provider = {
      ...selected,
      baseUrl: effectiveUrl,
      model: effectiveModel,
      apiKey,
      isConnected: testState === 'success',
    }
    setActiveProvider(provider)
    saveProviderConfig(selected.id, {
      apiKey,
      baseUrl: effectiveUrl,
      model: effectiveModel,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleAddCustom = (provider: Provider) => {
    saveCustomProvider(provider)
    setProviders(getAllProviders())
    setSelectedId(provider.id)
  }

  const handleDeleteCustom = (id: string) => {
    deleteCustomProvider(id)
    const updated = getAllProviders()
    setProviders(updated)
    if (selectedId === id) setSelectedId(updated[0]?.id ?? 'anthropic')
  }

  if (!selected) return null

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div
        className="flex-shrink-0 px-6 py-4"
        style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}
      >
        <h1 className="text-base font-bold text-[var(--text-primary)]">Model Connections</h1>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
          Connect AI providers using your own API keys · stored locally, never sent to Drodo servers
        </p>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Provider List */}
        <div
          className="flex-shrink-0 flex flex-col overflow-hidden"
          style={{ width: 260, borderRight: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}
        >
          <div className="flex-1 overflow-y-auto">
            {providers.map(provider => (
              <ProviderRow
                key={provider.id}
                provider={provider}
                selected={selectedId === provider.id}
                onSelect={() => setSelectedId(provider.id)}
              />
            ))}
          </div>
          <AddCustomForm onAdd={handleAddCustom} />
        </div>

        {/* Config Panel */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-xl p-6 space-y-5">
            {/* Provider header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold"
                  style={{ background: selected.color + '33', color: selected.color }}
                >
                  {selected.initials}
                </div>
                <div>
                  <div className="font-semibold text-[var(--text-primary)]">{selected.name}</div>
                  {selected.isLocal ? (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: '#1d9e7520', color: '#1d9e75' }}
                    >
                      Local · no API key required
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--text-secondary)]">
                      {normalizeUrl(effectiveUrl) || 'No URL configured'}
                    </span>
                  )}
                </div>
              </div>
              {isCustom && (
                <button
                  onClick={() => handleDeleteCustom(selected.id)}
                  className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[#e05050] hover:bg-[#e05050]/10 transition-colors"
                  title="Delete custom provider"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            {/* Base URL */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
                <Link size={12} />
                Base URL
              </label>
              <input
                value={baseUrl || selected.baseUrl}
                onChange={e => { setBaseUrl(e.target.value); setTestState('idle'); setSaved(false) }}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60 font-mono transition-colors"
                placeholder="https://api.provider.com/v1"
              />
            </div>

            {/* API Key */}
            {!selected.isLocal && (
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
                  <Key size={12} />
                  API Key
                  {apiKey && (
                    <span className="text-[#1d9e75] ml-1 flex items-center gap-0.5">
                      <CheckCircle2 size={11} /> configured
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => { setApiKey(e.target.value); setTestState('idle'); setSaved(false) }}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60 font-mono transition-colors"
                  placeholder={
                    selected.id === 'anthropic' ? 'sk-ant-...' :
                    selected.id === 'openai' ? 'sk-...' :
                    'API key'
                  }
                />
              </div>
            )}

            {/* Model */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
                <Cpu size={12} />
                Model
              </label>
              <input
                value={model || selected.model || ''}
                onChange={e => { setModel(e.target.value); setSaved(false) }}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60 font-mono transition-colors"
                placeholder="model-name"
              />
            </div>

            {/* Test result */}
            {testMessage && (
              <div
                className={clsx(
                  'flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs',
                  testState === 'success'
                    ? 'bg-[#1d9e75]/10 text-[#1d9e75] border border-[#1d9e75]/20'
                    : 'bg-[#e05050]/10 text-[#e05050] border border-[#e05050]/20'
                )}
              >
                {testState === 'success' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                {testMessage}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleTest}
                disabled={testState === 'testing'}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-all',
                  testState === 'testing'
                    ? 'border-[var(--border-color)] text-[var(--text-secondary)] cursor-not-allowed'
                    : testState === 'success'
                    ? 'border-[#1d9e75]/40 text-[#1d9e75] hover:bg-[#1d9e75]/5'
                    : testState === 'error'
                    ? 'border-[#e05050]/40 text-[#e05050] hover:bg-[#e05050]/5'
                    : 'border-[var(--border-color)] text-[var(--text-muted)] hover:border-[#7f77dd]/40 hover:text-[var(--text-primary)]'
                )}
              >
                {testState === 'testing' && <Loader size={14} className="animate-spin" />}
                {testState === 'success' && <Check size={14} />}
                {testState === 'error' && <AlertCircle size={14} />}
                {testState === 'idle' && <Link size={14} />}
                {testState === 'idle' && 'Test Connection'}
                {testState === 'testing' && 'Testing...'}
                {testState === 'success' && 'Connected'}
                {testState === 'error' && 'Retry Test'}
              </button>

              <button
                onClick={handleSave}
                className={clsx(
                  'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90',
                  saved ? 'bg-[#1d9e75]' : 'bg-[#7f77dd]'
                )}
              >
                <Check size={14} />
                {saved ? 'Saved!' : 'Save & Use'}
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)]">
              Keys are stored locally on your device and never sent to Drodo servers.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
