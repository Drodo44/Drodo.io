import { useEffect, useRef, useState } from 'react'
import {
  buildProvider,
  fetchLiveModels,
  getAllSavedModels,
  getSavedModelDisplayName,
  isFreeModel,
  loadOpenRouterFreeOnly,
} from '../lib/providerApi'
import { getConnectedProviders } from '../lib/providerApi'

export interface LiveModelOption {
  key: string
  providerId: string
  providerName: string
  modelId: string
  modelLabel: string
  providerColor?: string
  providerInitials?: string
}

function areProvidersEqual(a: string, b: string): boolean {
  return a === b
}

function buildProviderKey(): string {
  const connected = getConnectedProviders()
  return connected
    .map(p => `${p.id}:${p.apiKey || ''}:${p.baseUrl}`)
    .sort()
    .join('|')
}

export function useLiveModels(): {
  options: LiveModelOption[]
  loading: boolean
} {
  const [options, setOptions] = useState<LiveModelOption[]>([])
  const [loading, setLoading] = useState(false)
  const lastKeyRef = useRef<string>('')

  useEffect(() => {
    const connected = getConnectedProviders()
    const liveFetchableIds = new Set(['nvidia', 'openrouter'])
    const liveProviders = connected.filter(
      p => liveFetchableIds.has(p.id) && !!p.apiKey?.trim()
    )

    // Build saved options as baseline
    const savedOptions: LiveModelOption[] = getAllSavedModels().map(entry => {
      const provider = buildProvider(entry.providerId)
      return {
        key: `${entry.providerId}::${entry.model.id}`,
        providerId: entry.providerId,
        providerName: entry.providerName,
        modelId: entry.model.id,
        modelLabel: entry.model.label || entry.model.id,
        providerColor: provider?.color,
        providerInitials: provider?.initials,
      }
    })

    const key = buildProviderKey()
    if (areProvidersEqual(key, lastKeyRef.current)) {
      // Already loaded for this exact provider set
      setOptions(prev => {
        // Ensure we still have saved options if we haven't loaded yet
        if (prev.length === 0 && savedOptions.length > 0) return savedOptions
        return prev
      })
      return
    }
    lastKeyRef.current = key

    setLoading(true)

    if (liveProviders.length === 0) {
      setOptions(savedOptions)
      setLoading(false)
      return
    }

    let cancelled = false

    Promise.all(
      liveProviders.map(async provider => {
        const models = await fetchLiveModels(provider.id)
        return { provider, models }
      })
    )
      .then(results => {
        if (cancelled) return

        const freeOnly = loadOpenRouterFreeOnly()
        const seen = new Set<string>()
        const liveOptions: LiveModelOption[] = []

        for (const { provider, models } of results) {
          for (const model of models) {
            // Filter OpenRouter free models if preference is set
            if (provider.id === 'openrouter' && freeOnly) {
              if (!isFreeModel(model)) continue
            }

            const key = `${provider.id}::${model.id}`
            if (seen.has(key)) continue
            seen.add(key)

            liveOptions.push({
              key,
              providerId: provider.id,
              providerName: provider.name,
              modelId: model.id,
              modelLabel: getSavedModelDisplayName(provider.id, model.id) || model.name || model.id,
              providerColor: provider.color,
              providerInitials: provider.initials,
            })
          }
        }

        // Merge saved models as fallback for non-live providers and any gaps
        for (const opt of savedOptions) {
          if (!seen.has(opt.key)) {
            liveOptions.push(opt)
            seen.add(opt.key)
          }
        }

        setOptions(liveOptions)
      })
      .catch(() => {
        if (!cancelled) setOptions(savedOptions)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [lastKeyRef.current]) // eslint-disable-line react-hooks/exhaustive-deps
  // We intentionally run once on mount; the key ref prevents re-fetching on re-renders.

  return { options, loading }
}
