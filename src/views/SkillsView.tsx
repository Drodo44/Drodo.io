import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Puzzle, CheckCircle2, Circle, X, Key, Check } from 'lucide-react'
import { clsx } from 'clsx'
import { useAppStore } from '../store/appStore'
import type { Connector, ConnectorCategory } from '../types'

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
    // Store key in localStorage
    const stored = JSON.parse(localStorage.getItem('drodo_connector_keys') ?? '{}')
    stored[connector.id] = key.trim()
    localStorage.setItem('drodo_connector_keys', JSON.stringify(stored))
    setSaved(true)
    setTimeout(() => {
      onSave(key.trim())
    }, 600)
  }

  const handleDisconnect = () => {
    const stored = JSON.parse(localStorage.getItem('drodo_connector_keys') ?? '{}')
    delete stored[connector.id]
    localStorage.setItem('drodo_connector_keys', JSON.stringify(stored))
    onSave('')
  }

  // Load existing key
  const existingKey = (() => {
    try {
      const stored = JSON.parse(localStorage.getItem('drodo_connector_keys') ?? '{}')
      return stored[connector.id] ?? ''
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
          style={{ width: 420, background: '#141418', border: '1px solid #2a2a2e' }}
        >
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2a2a2e' }}>
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold"
                style={{ background: connector.color + '33', color: connector.color }}
              >
                {connector.initials}
              </div>
              <div>
                <Dialog.Title className="font-bold text-[#e8e8ef] text-sm">
                  Connect {connector.name}
                </Dialog.Title>
                <Dialog.Description className="text-xs text-[#6b6b78]">
                  {connector.category}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="p-1.5 rounded-lg text-[#6b6b78] hover:text-[#e8e8ef] hover:bg-[#2a2a2e] transition-colors">
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
              <label className="flex items-center gap-1.5 text-xs font-medium text-[#9898a8]">
                <Key size={12} />
                API Key / Token
              </label>
              <input
                type="password"
                value={key || existingKey}
                onChange={e => setKey(e.target.value)}
                placeholder={connector.keyPlaceholder ?? 'API key'}
                className="w-full bg-[#0d0d0f] border border-[#2a2a2e] rounded-lg px-3 py-2 text-sm text-[#e8e8ef] outline-none focus:border-[#7f77dd]/60 font-mono transition-colors"
              />
              <p className="text-xs text-[#6b6b78]">
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
          : 'border-[#2a2a2e] bg-[#141418] hover:border-[#3a3a42]'
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
        <div className="text-sm font-medium text-[#e8e8ef] truncate">{connector.name}</div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {connector.isConnected ? (
            <>
              <CheckCircle2 size={11} style={{ color: '#1d9e75' }} />
              <span className="text-xs" style={{ color: '#1d9e75' }}>Connected</span>
            </>
          ) : (
            <>
              <Circle size={11} className="text-[#6b6b78]" />
              <span className="text-xs text-[#6b6b78]">Not connected</span>
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
  const { connectors, setConnectorConnected } = useAppStore()
  const [activeConnector, setActiveConnector] = useState<Connector | null>(null)

  const connectedCount = connectors.filter(c => c.isConnected).length

  const byCategory = CATEGORY_ORDER.map(cat => ({
    category: cat,
    items: connectors.filter(c => c.category === cat),
  }))

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: '#0d0d0f' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid #2a2a2e', background: '#141418' }}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#7f77dd22' }}>
          <Puzzle size={18} style={{ color: '#7f77dd' }} />
        </div>
        <div>
          <h1 className="font-bold text-[#e8e8ef] text-lg">Skills & Connectors</h1>
          <p className="text-xs text-[#6b6b78]">
            {connectedCount} connected · {connectors.length} available
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {byCategory.map(({ category, items }) => (
          <div key={category}>
            {/* Category header */}
            <div className="flex items-center gap-2 mb-3">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: CATEGORY_COLORS[category] }}
              />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#9898a8]">{category}</h2>
              <span className="text-xs text-[#6b6b78]">
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

      {/* Connect modal */}
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
