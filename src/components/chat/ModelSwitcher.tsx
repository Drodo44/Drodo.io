import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check, Loader2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../../store/appStore'
import {
  getConnectedProviders,
  getSavedModelDisplayName,
} from '../../lib/providerApi'
import { useLiveModels } from '../../hooks/useLiveModels'

type ModelOption = {
  providerId: string
  providerName: string
  providerColor: string
  providerInitials: string
  modelId: string
  modelLabel: string
}

export function ModelSwitcher() {
  const { activeProvider, setSessionModel } = useAppStore(
    useShallow(s => ({
      activeProvider: s.activeProvider,
      setSessionModel: s.setSessionModel,
    }))
  )

  const [open, setOpen] = useState(false)
  const { options: liveOptions, loading: liveModelsLoading } = useLiveModels()
  const ref = useRef<HTMLDivElement>(null)
  const connectedProviders = getConnectedProviders()

  const options: ModelOption[] = []
  const seen = new Set<string>()

  for (const opt of liveOptions) {
    if (seen.has(opt.key)) continue
    seen.add(opt.key)
    const provider = connectedProviders.find(p => p.id === opt.providerId)
    options.push({
      providerId: opt.providerId,
      providerName: opt.providerName,
      providerColor: opt.providerColor ?? provider?.color ?? '#7f77dd',
      providerInitials: opt.providerInitials ?? provider?.initials ?? opt.providerName.slice(0, 2).toUpperCase(),
      modelId: opt.modelId,
      modelLabel: opt.modelLabel,
    })
  }

  // Add default models for connected providers that aren't already in the list
  for (const p of connectedProviders) {
    const key = `${p.id}::${p.model ?? ''}`
    if (p.model && !seen.has(key)) {
      seen.add(key)
      options.push({
        providerId: p.id,
        providerName: p.name,
        providerColor: p.color,
        providerInitials: p.initials,
        modelId: p.model,
        modelLabel: getSavedModelDisplayName(p.id, p.model) || p.displayName || p.model,
      })
    }
  }

  const optionsByProvider = new Map<string, ModelOption[]>()
  for (const option of options) {
    if (!optionsByProvider.has(option.providerId)) optionsByProvider.set(option.providerId, [])
    optionsByProvider.get(option.providerId)!.push(option)
  }
  const currentLabel = getSavedModelDisplayName(activeProvider.id, activeProvider.model) || activeProvider.displayName || activeProvider.model || activeProvider.name

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const select = (providerId: string, modelId: string) => {
    setSessionModel(providerId, modelId)
    setOpen(false)
  }

  if (options.length === 0 && !liveModelsLoading) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs border transition-colors"
        style={{
          borderColor: open ? '#7f77dd66' : 'var(--border-color)',
          background: open ? '#7f77dd10' : 'transparent',
          color: 'var(--text-secondary)',
          maxWidth: 150,
        }}
        title="Switch model"
      >
        {/* Provider color dot */}
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: activeProvider.color }}
        />
        <span className="truncate">{currentLabel}</span>
        <ChevronDown size={10} className="flex-shrink-0" style={{ opacity: 0.6 }} />
      </button>

      {open && (
        <div
          className="absolute bottom-full mb-1 left-0 z-50 rounded-xl border overflow-hidden"
          style={{
            background: 'var(--bg-secondary)',
            borderColor: 'var(--border-color)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            minWidth: 220,
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {liveModelsLoading && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-secondary)]">
              <Loader2 size={12} className="animate-spin" />
              Loading models…
            </div>
          )}
          {connectedProviders.map(provider => {
            const providerOptions = optionsByProvider.get(provider.id) ?? []
            if (providerOptions.length === 0 && !liveModelsLoading) return null

            return (
              <div key={provider.id}>
                {/* Provider header */}
                <div
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold"
                  style={{ color: 'var(--text-secondary)', background: 'var(--bg-tertiary)' }}
                >
                  <span
                    className="w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center flex-shrink-0"
                    style={{ background: provider.color + '30', color: provider.color }}
                  >
                    {provider.initials}
                  </span>
                  {provider.name}
                </div>
                {/* Models */}
                {providerOptions.map(opt => {
                  const isActive = activeProvider.id === opt.providerId && activeProvider.model === opt.modelId
                  return (
                    <button
                      key={opt.modelId}
                      onClick={() => select(opt.providerId, opt.modelId)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--border-color)]/40"
                      style={{ color: isActive ? '#a09ae8' : 'var(--text-primary)' }}
                    >
                      <span className="flex-1 truncate">{opt.modelLabel}</span>
                      {isActive && <Check size={11} className="flex-shrink-0 text-[#7f77dd]" />}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
