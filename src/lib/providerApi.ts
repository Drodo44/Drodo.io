import type { Provider } from '../types'
import { decryptStoredKey, encryptStoredKey } from './encryption'

// ─── localStorage persistence ────────────────────────────────────────────────

const STORAGE_KEY = 'drodo_provider_configs'

interface SavedConfig {
  apiKey: string
  baseUrl: string
  model: string
}

export const PROVIDER_CATALOG: Provider[] = [
  { id: 'nvidia', name: 'NVIDIA NIM', baseUrl: 'integrate.api.nvidia.com/v1', color: '#76b900', initials: 'NV' },
  { id: 'openrouter', name: 'OpenRouter', baseUrl: 'openrouter.ai/api/v1', color: '#6366f1', initials: 'OR', model: 'openai/gpt-4o' },
  { id: 'anthropic', name: 'Anthropic', baseUrl: 'api.anthropic.com', color: '#cc785c', initials: 'AN', model: 'claude-sonnet-4-6' },
  { id: 'openai', name: 'OpenAI', baseUrl: 'api.openai.com/v1', color: '#10a37f', initials: 'OA', model: 'gpt-4o' },
  { id: 'gemini', name: 'Google Gemini', baseUrl: 'generativelanguage.googleapis.com', color: '#4285f4', initials: 'GG', model: 'gemini-2.0-flash' },
  { id: 'mistral', name: 'Mistral', baseUrl: 'api.mistral.ai/v1', color: '#ff7000', initials: 'MI', model: 'mistral-large-latest' },
  { id: 'groq', name: 'Groq', baseUrl: 'api.groq.com/openai/v1', color: '#f55036', initials: 'GR', model: 'llama-3.3-70b-versatile' },
  { id: 'together', name: 'Together AI', baseUrl: 'api.together.xyz/v1', color: '#0ea5e9', initials: 'TA', model: 'meta-llama/Llama-3-8b-chat-hf' },
  { id: 'fireworks', name: 'Fireworks AI', baseUrl: 'api.fireworks.ai/inference/v1', color: '#f97316', initials: 'FW', model: 'accounts/fireworks/models/llama-v3-8b-instruct' },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'api.deepseek.com/v1', color: '#2563eb', initials: 'DS', model: 'deepseek-chat' },
  { id: 'huggingface', name: 'Hugging Face', baseUrl: 'api-inference.huggingface.co', color: '#ffd21e', initials: 'HF', model: 'HuggingFaceH4/zephyr-7b-beta' },
  { id: 'ollama', name: 'Ollama', baseUrl: 'localhost:11434/v1', color: '#7f77dd', initials: 'OL', isLocal: true, model: 'llama3.2' },
  { id: 'lmstudio', name: 'LM Studio', baseUrl: 'localhost:1234/v1', color: '#8b5cf6', initials: 'LM', isLocal: true, model: 'local-model' },
  { id: 'custom', name: 'Custom Endpoint', baseUrl: '', color: 'var(--text-secondary)', initials: 'CU' },
]

const CUSTOM_PROVIDERS_KEY = 'drodo_custom_providers'

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

export function loadAllSavedConfigs(): Record<string, SavedConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}

    const parsed = JSON.parse(raw) as Record<string, SavedConfig>
    return Object.fromEntries(
      Object.entries(parsed).map(([id, config]) => [
        id,
        {
          ...config,
          apiKey: decryptStoredKey(config.apiKey ?? ''),
        },
      ])
    )
  } catch {
    return {}
  }
}

export function saveProviderConfig(id: string, config: SavedConfig): void {
  const all = loadRawSavedConfigs()
  all[id] = {
    ...config,
    apiKey: encryptStoredKey(config.apiKey),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export function loadProviderConfig(id: string): SavedConfig | null {
  const all = loadAllSavedConfigs()
  return all[id] ?? null
}

function loadRawSavedConfigs(): Record<string, SavedConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) as Record<string, SavedConfig> : {}
  } catch {
    return {}
  }
}

export function getProviderCatalog(): Provider[] {
  return PROVIDER_CATALOG
}

export function buildProvider(id: string): Provider | null {
  const base = PROVIDER_CATALOG.find(provider => provider.id === id)
  if (!base) return null

  const saved = loadProviderConfig(id)
  return {
    ...base,
    baseUrl: saved?.baseUrl || base.baseUrl,
    apiKey: saved?.apiKey || '',
    model: saved?.model || base.model || '',
    isConnected: base.isLocal || !!saved?.apiKey,
  }
}

export function getConnectedProviders(): Provider[] {
  return PROVIDER_CATALOG
    .map(provider => buildProvider(provider.id))
    .filter((provider): provider is Provider => !!provider)
    .filter(provider => provider.isLocal || !!provider.apiKey)
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
  const res = await fetch(`${baseUrl}/chat/completions`, {
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
  const res = await fetch(endpoint, {
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
  const res = await fetch(endpoint, {
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
