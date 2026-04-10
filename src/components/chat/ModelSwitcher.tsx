import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../../store/appStore'
import { getAllSavedModels, getConnectedProviders } from '../../lib/providerApi'

export function ModelSwitcher() {
  const { activeProvider, setSessionModel } = useAppStore(
    useShallow(s => ({
      activeProvider: s.activeProvider,
      setSessionModel: s.setSessionModel,
    }))
  )

  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Build the model list: connected provider defaults + all saved models
  const buildOptions = () => {
    const seen = new Set<string>()
    const options: { providerId: string; providerName: string; providerColor: string; providerInitials: string; modelId: string; modelLabel: string }[] = []

    // Add default model for each connected provider
    for (const p of getConnectedProviders()) {
      const key = `${p.id}::${p.model ?? ''}`
      if (p.model && !seen.has(key)) {
        seen.add(key)
        options.push({
          providerId: p.id,
          providerName: p.name,
          providerColor: p.color,
          providerInitials: p.initials,
          modelId: p.model,
          modelLabel: p.displayName || p.model,
        })
      }
    }

    // Add saved models
    for (const entry of getAllSavedModels()) {
      const key = `${entry.providerId}::${entry.model.id}`
      if (!seen.has(key)) {
        seen.add(key)
        const provider = getConnectedProviders().find(p => p.id === entry.providerId)
        options.push({
          providerId: entry.providerId,
          providerName: entry.providerName,
          providerColor: provider?.color ?? '#7f77dd',
          providerInitials: provider?.initials ?? entry.providerName.slice(0, 2).toUpperCase(),
          modelId: entry.model.id,
          modelLabel: entry.model.label || entry.model.id,
        })
      }
    }

    return options
  }

  const options = buildOptions()
  const currentLabel = activeProvider.displayName || activeProvider.model || activeProvider.name

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

  if (options.length === 0) return null

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
          {/* Group by provider */}
          {(() => {
            const groups = new Map<string, typeof options>()
            for (const opt of options) {
              if (!groups.has(opt.providerId)) groups.set(opt.providerId, [])
              groups.get(opt.providerId)!.push(opt)
            }
            return [...groups.entries()].map(([providerId, opts]) => (
              <div key={providerId}>
                {/* Provider header */}
                <div
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold"
                  style={{ color: 'var(--text-secondary)', background: 'var(--bg-tertiary)' }}
                >
                  <span
                    className="w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center flex-shrink-0"
                    style={{ background: opts[0].providerColor + '30', color: opts[0].providerColor }}
                  >
                    {opts[0].providerInitials}
                  </span>
                  {opts[0].providerName}
                </div>
                {/* Models */}
                {opts.map(opt => {
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
            ))
          })()}
        </div>
      )}
    </div>
  )
}
