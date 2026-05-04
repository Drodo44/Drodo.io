import type { Provider } from '../types'
import { appDataDir, join } from '@tauri-apps/api/path'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { decryptStoredKey, encryptStoredKey } from './encryption'
import { autoTagModel, getBestModelForTask } from './modelRegistry'
import { PROVIDER_CATALOG } from './providerCatalog'

// ─── localStorage persistence ────────────────────────────────────────────────

const STORAGE_KEY = 'drodo_provider_configs'
const PROVIDER_CONFIG_FILE_NAME = 'drodo_provider_configs.json'

// Providers where users manage a list of saved models rather than one default model
export const MULTI_MODEL_PROVIDER_IDS = new Set(['nvidia', 'huggingface', 'openrouter'])

export interface SavedModel {
  id: string
  label: string
}

interface SavedConfig {
  apiKey: string
  baseUrl: string
  model: string
  modelDisplayName?: string
  savedModels?: SavedModel[]
  name?: string
}

const CUSTOM_PROVIDERS_KEY = 'drodo_custom_providers'
let savedConfigsCache: Record<string, SavedConfig> = await initializeSavedConfigsCache()

export function loadCustomProviders(): Provider[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PROVIDERS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveCustomProvider(provider: Provider): void {
  const all = loadCustomProviders().filter(p => p.id !== provider.id)
  localStorage.setItem(CUSTOM_PROVIDERS_KEY, JSON.stringify([...all, provider]))
}

export function deleteCustomProvider(id: string): void {
  const all = loadCustomProviders().filter(p => p.id !== id)
  localStorage.setItem(CUSTOM_PROVIDERS_KEY, JSON.stringify(all))
}

export function getAllProviders(): Provider[] {
  return [...PROVIDER_CATALOG, ...loadCustomProviders()]
}

function sanitizeSavedModel(model: SavedModel): SavedModel | null {
  const id = model.id.trim()
  if (!id) return null
  return {
    id,
    label: model.label.trim() || id,
  }
}

function sanitizeSavedModels(models?: SavedModel[]): SavedModel[] | undefined {
  if (!models?.length) return undefined

  const deduped = new Map<string, SavedModel>()
  for (const model of models) {
    const next = sanitizeSavedModel(model)
    if (!next) continue
    deduped.set(next.id, next)
  }

  return deduped.size > 0 ? [...deduped.values()] : undefined
}

export function loadAllSavedConfigs(): Record<string, SavedConfig> {
  try {
    return Object.fromEntries(
      Object.entries(savedConfigsCache).map(([id, config]) => [
        id,
        {
          ...config,
          apiKey: decryptStoredKey(config.apiKey ?? ''),
          savedModels: sanitizeSavedModels(config.savedModels),
        },
      ])
    )
  } catch {
    return {}
  }
}

export function saveProviderConfig(id: string, config: SavedConfig): void {
  const all = { ...loadRawSavedConfigs() }
  const existing = all[id]
  const previousModel = existing?.model?.trim()
  const savedModels = Object.prototype.hasOwnProperty.call(config, 'savedModels')
    ? sanitizeSavedModels(config.savedModels)
    : existing?.savedModels

  all[id] = {
    ...existing,
    ...config,
    apiKey: encryptStoredKey(config.apiKey),
    savedModels,
  }
  savedConfigsCache = all
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  void persistRawSavedConfigsToFs(all)

  const provider = buildProvider(id)
  const nextModel = config.model?.trim()
  if (provider && nextModel && nextModel !== previousModel) {
    void autoTagModel(nextModel, { ...provider, model: nextModel })
  }
}

export function loadProviderConfig(id: string): SavedConfig | null {
  const all = loadAllSavedConfigs()
  return all[id] ?? null
}

function getSavedModelDisplayNameFromConfig(config: SavedConfig | null | undefined, modelId: string | undefined): string | undefined {
  const normalizedModelId = modelId?.trim()
  if (!config || !normalizedModelId) return undefined

  const savedModelLabel = config.savedModels?.find(model => model.id === normalizedModelId)?.label?.trim()
  if (savedModelLabel) return savedModelLabel

  if (config.model?.trim() === normalizedModelId) {
    return config.modelDisplayName?.trim() || config.name?.trim() || undefined
  }

  return undefined
}

export function getSavedModelDisplayName(providerId: string | undefined, modelId: string | undefined): string | undefined {
  if (!providerId || !modelId) return undefined
  return getSavedModelDisplayNameFromConfig(loadProviderConfig(providerId), modelId)
}

export function getSavedModelDisplayNameMap(): Record<string, string> {
  const all = loadAllSavedConfigs()
  const map: Record<string, string> = {}

  for (const config of Object.values(all)) {
    for (const savedModel of config.savedModels ?? []) {
      const label = savedModel.label.trim()
      if (savedModel.id && label) {
        map[savedModel.id] = label
      }
    }

    const defaultLabel = config.modelDisplayName?.trim() || config.name?.trim()
    if (config.model?.trim() && defaultLabel) {
      map[config.model.trim()] = defaultLabel
    }
  }

  return map
}

function loadRawSavedConfigs(): Record<string, SavedConfig> {
  return savedConfigsCache
}

export function getProviderCatalog(): Provider[] {
  return PROVIDER_CATALOG
}

export function buildProvider(id: string): Provider | null {
  const base = getAllProviders().find(provider => provider.id === id)
  if (!base) return null

  const saved = loadProviderConfig(id)
  const resolvedModel = saved?.model || base.model || saved?.savedModels?.[0]?.id || ''

  return {
    ...base,
    baseUrl: saved?.baseUrl || base.baseUrl,
    apiKey: saved?.apiKey || '',
    model: resolvedModel,
    displayName: getSavedModelDisplayNameFromConfig(saved, resolvedModel) || undefined,
    isConnected: base.isLocal || !!saved?.apiKey,
  }
}

export function getConnectedProviders(): Provider[] {
  return getAllProviders()
    .map(provider => buildProvider(provider.id))
    .filter((provider): provider is Provider => !!provider)
    .filter(provider => provider.isLocal || !!provider.apiKey)
}

export function getSavedModels(providerId: string): SavedModel[] {
  return loadProviderConfig(providerId)?.savedModels ?? []
}

export function addSavedModel(providerId: string, model: SavedModel): void {
  const next = sanitizeSavedModel(model)
  if (!next) return

  const current = loadProviderConfig(providerId) ?? {
    apiKey: '',
    baseUrl: '',
    model: '',
  }

  saveProviderConfig(providerId, {
    ...current,
    savedModels: [...(current.savedModels ?? []).filter(item => item.id !== next.id), next],
  })

  const provider = buildProvider(providerId)
  if (provider) {
    void autoTagModel(next.id, { ...provider, model: next.id })
  }
}

export function removeSavedModel(providerId: string, modelId: string): void {
  const current = loadProviderConfig(providerId)
  if (!current) return

  saveProviderConfig(providerId, {
    ...current,
    savedModels: (current.savedModels ?? []).filter(model => model.id !== modelId),
  })
}

export function getAllSavedModels(): { providerId: string; providerName: string; model: SavedModel }[] {
  const allSaved = loadAllSavedConfigs()

  return getAllProviders().flatMap(provider =>
    (allSaved[provider.id]?.savedModels ?? []).map(model => ({
      providerId: provider.id,
      providerName: provider.name,
      model,
    }))
  )
}

function scoreModelForTask(modelId: string, task: string): number {
  const m = modelId.toLowerCase()
  const t = task.toLowerCase()
  let score = 0
  if (/(code|implement|debug|refactor|typescript|javascript|python|test|build)/.test(t)) {
    if (/(code|coder|sonnet|gpt-4\.1|gpt-5|o1|o3|gemini-2\.5)/.test(m)) score += 6
  }
  if (/(analy|research|review|plan|design|architecture|strategy)/.test(t)) {
    if (/(sonnet|opus|gpt-5|gpt-4|reason|gemini-2\.5)/.test(m)) score += 5
  }
  if (/(quick|fast|short|brief|summarize|summary)/.test(t)) {
    if (/(mini|haiku|flash|lite|small|groq|gemini-flash)/.test(m)) score += 4
  }
  return score
}

function pickBestSavedModelForTask(
  task: string,
  savedModels: { providerId: string; providerName: string; model: SavedModel }[],
  tieBreakerIndex = 0,
): { provider: Provider; score: number; allScoresZero: boolean } | null {
  let best: { entry: { providerId: string; providerName: string; model: SavedModel }; score: number } | null = null
  let allScoresZero = true
  for (const entry of savedModels) {
    const score = scoreModelForTask(entry.model.id, task)
    if (score > 0) allScoresZero = false
    if (!best || score > best.score) best = { entry, score }
  }
  if (!best) return null
  const normalizedIndex = ((tieBreakerIndex % savedModels.length) + savedModels.length) % savedModels.length
  const selectedEntry = allScoresZero ? savedModels[normalizedIndex] : best.entry
  const provider = buildProvider(selectedEntry.providerId)
  if (!provider) return null
  return {
    provider: {
      ...provider,
      model: selectedEntry.model.id,
      displayName: selectedEntry.model.label || undefined,
    },
    score: best.score,
    allScoresZero,
  }
}

export function routeModelForTask(task: string, fallback: Provider, tieBreakerIndex = 0): Provider {
  // Prefer user's explicitly saved models — only override fallback when scoring found a meaningful match
  const savedModels = getAllSavedModels()
  if (savedModels.length > 0) {
    const result = pickBestSavedModelForTask(task, savedModels, tieBreakerIndex)
    if (result && (result.score > 0 || result.allScoresZero)) return result.provider
  }

  // Fall back to connected-provider registry selection
  const connectedProviderIds = getConnectedProviders().map(provider => provider.id)
  const savedProviderIds = Object.keys(loadAllSavedConfigs())
  const providerIds = connectedProviderIds.length > 0
    ? connectedProviderIds
    : (savedProviderIds.length > 0 ? savedProviderIds : [fallback.id])

  return getBestModelForTask(task, providerIds, fallback)
}

async function initializeSavedConfigsCache(): Promise<Record<string, SavedConfig>> {
  const fromFs = await readSavedConfigsFromFs()
  if (fromFs) return fromFs

  const fromLocalStorage = readSavedConfigsFromLocalStorage()
  if (Object.keys(fromLocalStorage).length > 0) {
    void persistRawSavedConfigsToFs(fromLocalStorage)
  }
  return fromLocalStorage
}

function readSavedConfigsFromLocalStorage(): Record<string, SavedConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) as Record<string, SavedConfig> : {}
  } catch {
    return {}
  }
}

async function getProviderConfigFilePath(): Promise<string> {
  return join(await appDataDir(), PROVIDER_CONFIG_FILE_NAME)
}

async function readSavedConfigsFromFs(): Promise<Record<string, SavedConfig> | null> {
  try {
    const raw = await readTextFile(await getProviderConfigFilePath())
    return raw ? JSON.parse(raw) as Record<string, SavedConfig> : {}
  } catch {
    return null
  }
}

async function persistRawSavedConfigsToFs(configs: Record<string, SavedConfig>): Promise<void> {
  try {
    await writeTextFile(await getProviderConfigFilePath(), JSON.stringify(configs))
  } catch {
    // Keep localStorage as a fallback if the Tauri fs write is unavailable.
  }
}

// ─── CORS proxy ──────────────────────────────────────────────────────────────

const PROXY_URL = 'https://povfsxttqhconkvznmwq.supabase.co/functions/v1/proxy-llm'

function isLocalUrl(url: string): boolean {
  return url.includes('localhost') || url.includes('127.0.0.1')
}

export async function proxyFetch(
  targetUrl: string,
  init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }
): Promise<Response> {
  if (isLocalUrl(targetUrl)) {
    return fetch(targetUrl, init)
  }
  return fetch(PROXY_URL, {
    method: 'POST',
    signal: init.signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      targetUrl,
      headers: init.headers,
      body: init.body ? JSON.parse(init.body) : undefined,
    }),
  })
}

interface ModelsResponse {
  data?: Array<{ id?: string | null } | null>
}

export async function fetchLiveModels(providerId: string): Promise<string[]> {
  try {
    const saved = loadProviderConfig(providerId)
    const apiKey = saved?.apiKey?.trim()
    if (!apiKey) return []

    const provider = buildProvider(providerId)
    if (!provider) return []

    const baseUrl = normalizeUrl(saved?.baseUrl || provider.baseUrl)
    const endpoint = baseUrl.endsWith('/v1') ? `${baseUrl}/models` : `${baseUrl}/v1/models`
    const response = await proxyFetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      
    })

    if (!response.ok) return []

    const body = await response.json() as ModelsResponse
    if (!Array.isArray(body.data)) return []

    return body.data
      .map(entry => entry?.id?.trim())
      .filter((id): id is string => !!id)
  } catch {
    return []
  }
}

// ─── URL normalization ────────────────────────────────────────────────────────

export function normalizeUrl(raw: string): string {
  if (!raw) return ''
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw.replace(/\/$/, '')
  // localhost always http
  if (raw.startsWith('localhost') || raw.startsWith('127.0.0.1')) return `http://${raw}`.replace(/\/$/, '')
  return `https://${raw}`.replace(/\/$/, '')
}

// ─── Provider type detection ──────────────────────────────────────────────────

type ProviderType = 'anthropic' | 'gemini' | 'openai-compatible'

function detectProviderType(id: string, baseUrl: string): ProviderType {
  if (id === 'anthropic' || baseUrl.includes('anthropic.com')) return 'anthropic'
  if (id === 'gemini' || baseUrl.includes('generativelanguage.googleapis.com')) return 'gemini'
  return 'openai-compatible'
}

// ─── Test connection ──────────────────────────────────────────────────────────

export interface TestResult {
  ok: boolean
  message: string
}

export async function testConnection(
  provider: Provider,
  apiKey: string,
  baseUrl: string,
  model: string,
  signal?: AbortSignal
): Promise<TestResult> {
  const url = normalizeUrl(baseUrl || provider.baseUrl)
  const key = apiKey || provider.apiKey || ''
  const mdl = model || provider.model || 'gpt-3.5-turbo'
  const type = detectProviderType(provider.id, url)

  try {
    if (type === 'anthropic') {
      return await testAnthropic(url, key, mdl, signal)
    } else if (type === 'gemini') {
      return await testGemini(url, key, mdl, signal)
    } else if (provider.isLocal) {
      return await testLocal(url, mdl, signal)
    } else {
      return await testOpenAICompatible(url, key, mdl, signal)
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') return { ok: false, message: 'Cancelled' }
    return { ok: false, message: err?.message ?? 'Network error' }
  }
}

async function testOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  signal?: AbortSignal
): Promise<TestResult> {
  const res = await proxyFetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Say "ok" in one word.' }],
      max_tokens: 5,
      stream: false,
    }),
  })
  if (res.ok) return { ok: true, message: 'Connected successfully' }
  const body = await res.json().catch(() => ({}))
  return { ok: false, message: body?.error?.message ?? `HTTP ${res.status}` }
}

async function testAnthropic(
  baseUrl: string,
  apiKey: string,
  model: string,
  signal?: AbortSignal
): Promise<TestResult> {
  const endpoint = baseUrl.includes('/v1') ? `${baseUrl}/messages` : `${baseUrl}/v1/messages`
  const res = await proxyFetch(endpoint, {
    method: 'POST',
    signal,
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-allow-browser': 'true',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 5,
      messages: [{ role: 'user', content: 'Say "ok".' }],
    }),
  })
  if (res.ok) return { ok: true, message: 'Connected successfully' }
  const body = await res.json().catch(() => ({}))
  return { ok: false, message: body?.error?.message ?? `HTTP ${res.status}` }
}

async function testGemini(
  _baseUrl: string,
  apiKey: string,
  model: string,
  signal?: AbortSignal
): Promise<TestResult> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const res = await proxyFetch(endpoint, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Say "ok".' }] }],
    }),
  })
  if (res.ok) return { ok: true, message: 'Connected successfully' }
  const body = await res.json().catch(() => ({}))
  return { ok: false, message: body?.error?.message ?? `HTTP ${res.status}` }
}

async function testLocal(
  baseUrl: string,
  model: string,
  signal?: AbortSignal
): Promise<TestResult> {
  // Try the models list endpoint first (Ollama/LM Studio expose this)
  try {
    const res = await fetch(`${baseUrl}/models`, { signal })
    if (res.ok) return { ok: true, message: 'Local server reachable' }
  } catch {
    // fall through to chat test
  }
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 5,
      }),
    })
    if (res.ok) return { ok: true, message: 'Local server connected' }
    return { ok: false, message: `HTTP ${res.status}` }
  } catch (err: any) {
    return { ok: false, message: 'Cannot reach local server — is it running?' }
  }
}
