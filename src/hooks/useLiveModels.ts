import { useEffect, useState } from 'react'
import {
  buildProvider,
  fetchLiveModels,
  getAllSavedModels,
  getSavedModelDisplayName,
  isFreeModel,
  loadOpenRouterFreeOnly,
} from '../lib/providerApi'
import { getConnectedProviders } from '../lib/providerApi'

const LIVE_MODELS_CACHE_KEY = 'drodo_live_models_cache'

export interface LiveModelOption {
  key: string
  providerId: string
  providerName: string
  modelId: string
  modelLabel: string
  providerColor?: string
  providerInitials?: string
}

export function useLiveModels(): {
  options: LiveModelOption[]
  loading: boolean
} {
  const [options, setOptions] = useState<LiveModelOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const connected = getConnectedProviders()
    const liveFetchableIds = new Set(['nvidia', 'openrouter'])
    const liveProviders = connected.filter(
      p => liveFetchableIds.has(p.id) && !!p.apiKey?.trim()
    )

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

    try {
      const cachedItem = localStorage.getItem(LIVE_MODELS_CACHE_KEY)
      if (cachedItem) {
        const cached = JSON.parse(cachedItem) as { options: LiveModelOption[], timestamp: number }
        if (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
          setOptions(cached.options)
        }
      }
    } catch { /* ignore */ }

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

        for (const opt of savedOptions) {
          if (!seen.has(opt.key)) {
            liveOptions.push(opt)
            seen.add(opt.key)
          }
        }

        try {
          localStorage.setItem(LIVE_MODELS_CACHE_KEY, JSON.stringify({ options: liveOptions, timestamp: Date.now() }))
        } catch { /* storage full */ }

        setOptions(liveOptions)
      })
      .catch((err) => {
        console.error('[useLiveModels] failed to fetch live models:', err)
        if (!cancelled) setOptions(savedOptions)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { options, loading }
}
