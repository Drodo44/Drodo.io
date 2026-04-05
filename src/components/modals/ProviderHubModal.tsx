import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Check, Loader, AlertCircle, Key, Link, Cpu, CheckCircle2 } from 'lucide-react'
import { clsx } from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../../store/appStore'
import {
  getProviderCatalog,
  loadProviderConfig,
  normalizeUrl,
  saveProviderConfig,
  testConnection,
} from '../../lib/providerApi'
import type { Provider } from '../../types'

type TestState = 'idle' | 'testing' | 'success' | 'error'

export function ProviderHubModal() {
  const { providerHubOpen, setProviderHubOpen, setActiveProvider } = useAppStore(
    useShallow(s => ({
      providerHubOpen: s.providerHubOpen,
      setProviderHubOpen: s.setProviderHubOpen,
      setActiveProvider: s.setActiveProvider,
    }))
  )
  const allProviders = getProviderCatalog()
  const [selectedId, setSelectedId] = useState('anthropic')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [testState, setTestState] = useState<TestState>('idle')
  const [testMessage, setTestMessage] = useState('')
  const [saveError, setSaveError] = useState('')

  const selected = allProviders.find(p => p.id === selectedId) ?? allProviders[0]

  // Load saved config when provider changes
  useEffect(() => {
    const saved = loadProviderConfig(selectedId)
    if (saved) {
      setApiKey(saved.apiKey)
      setBaseUrl(saved.baseUrl || selected.baseUrl)
      setModel(saved.model || selected.model || '')
    } else {
      setApiKey('')
      setBaseUrl(selected.baseUrl)
      setModel(selected.model ?? '')
    }
    setTestState('idle')
    setTestMessage('')
    setSaveError('')
  }, [selectedId])

  const handleSelect = (provider: Provider) => {
    setSelectedId(provider.id)
  }

  const effectiveBaseUrl = baseUrl || selected.baseUrl
  const effectiveModel = model || selected.model || ''

  const handleTest = async () => {
    setTestState('testing')
    setTestMessage('')
    const result = await testConnection(
      { ...selected, baseUrl: effectiveBaseUrl, apiKey, model: effectiveModel },
      apiKey,
      effectiveBaseUrl,
      effectiveModel
    )
    setTestState(result.ok ? 'success' : 'error')
    setTestMessage(result.message)
  }

  const handleSave = () => {
    if (!selected.isLocal && !apiKey.trim()) {
      setSaveError('API key is required before saving this provider.')
      return
    }

    const provider: Provider = {
      ...selected,
      baseUrl: effectiveBaseUrl,
      model: effectiveModel,
      apiKey,
      isConnected: testState === 'success',
    }
    setActiveProvider(provider)
    saveProviderConfig(selectedId, {
      apiKey,
      baseUrl: effectiveBaseUrl,
      model: effectiveModel,
    })
    setSaveError('')
    setProviderHubOpen(false)
  }

  return (
    <Dialog.Root open={providerHubOpen} onOpenChange={setProviderHubOpen}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        />
        <Dialog.Content
          className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
          style={{
            width: 780,
            height: 540,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: '1px solid var(--border-color)' }}
          >
            <div>
              <Dialog.Title className="text-base font-bold text-[var(--text-primary)]">Provider Hub</Dialog.Title>
              <Dialog.Description className="text-xs text-[var(--text-secondary)] mt-0.5">
                Connect AI providers · Keys stored locally in your browser
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-color)] transition-colors">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex h-[calc(100%-69px)]">
            {/* Provider List */}
            <div
              className="overflow-y-auto py-2"
              style={{ width: 210, borderRight: '1px solid var(--border-color)', flexShrink: 0 }}
            >
              {allProviders.map(provider => {
                const saved = loadProviderConfig(provider.id)
                const hasSaved = !!saved?.apiKey || provider.isLocal
                return (
                  <button
                    key={provider.id}
                    onClick={() => handleSelect(provider)}
                    className={clsx(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                      selectedId === provider.id
                        ? 'bg-[#7f77dd]/10 text-[var(--text-primary)]'
                        : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                    )}
                  >
                    <div className="relative flex-shrink-0">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                        style={{ background: provider.color + '33', color: provider.color }}
                      >
                        {provider.initials}
                      </div>
                      {hasSaved && (
                        <span
                          className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 flex items-center justify-center"
                          style={{ background: '#1d9e75', borderColor: 'var(--bg-secondary)' }}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium truncate">{provider.name}</div>
                      {provider.isLocal && (
                        <span className="text-xs" style={{ color: '#1d9e75' }}>Local</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Provider Config */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Provider title */}
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
                  style={{ background: selected.color + '33', color: selected.color }}
                >
                  {selected.initials}
                </div>
                <div>
                  <div className="font-semibold text-[var(--text-primary)]">{selected.name}</div>
                  {selected.isLocal ? (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#1d9e7520', color: '#1d9e75' }}>
                      No API key required
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--text-secondary)]">Endpoint: {normalizeUrl(effectiveBaseUrl)}</span>
                  )}
                </div>
              </div>

              {/* Base URL */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
                  <Link size={12} />
                  Base URL
                </label>
                <input
                  value={baseUrl || selected.baseUrl}
                  onChange={e => setBaseUrl(e.target.value)}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60 font-mono transition-colors"
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
                        <CheckCircle2 size={11} /> saved
                      </span>
                    )}
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={e => {
                      setApiKey(e.target.value)
                      setTestState('idle')
                      if (e.target.value.trim()) setSaveError('')
                    }}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60 font-mono transition-colors"
                    placeholder={selected.id === 'anthropic' ? 'sk-ant-...' : selected.id === 'openai' ? 'sk-...' : 'API key'}
                  />
                  {saveError && <p className="text-xs text-[#e05050]">{saveError}</p>}
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
                  onChange={e => setModel(e.target.value)}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60 font-mono transition-colors"
                  placeholder="model-name"
                />
              </div>

              {/* Test result message */}
              {testMessage && (
                <div
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-xs',
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
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all',
                    testState === 'testing'
                      ? 'border-[var(--border-color)] text-[var(--text-secondary)] cursor-not-allowed'
                      : testState === 'success'
                      ? 'border-[#1d9e75]/40 text-[#1d9e75]'
                      : testState === 'error'
                      ? 'border-[#e05050]/40 text-[#e05050]'
                      : 'border-[var(--border-color)] text-[var(--text-muted)] hover:border-[#7f77dd]/40 hover:text-[var(--text-primary)]'
                  )}
                >
                  {testState === 'testing' && <Loader size={14} className="animate-spin" />}
                  {testState === 'success' && <Check size={14} />}
                  {testState === 'error' && <AlertCircle size={14} />}
                  {testState === 'idle' && <Link size={14} />}
                  {testState === 'idle' && 'Test Connection'}
                  {testState === 'testing' && 'Testing...'}
                  {testState === 'success' && 'Connected! ✓'}
                  {testState === 'error' && 'Retry Test'}
                </button>

                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
                  style={{ background: '#7f77dd' }}
                >
                  <Check size={14} />
                  Save & Use
                </button>
              </div>

              <p className="text-xs text-[var(--text-secondary)] pt-1">
                Keys are stored locally in your browser and never sent to Drodo servers.
              </p>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
