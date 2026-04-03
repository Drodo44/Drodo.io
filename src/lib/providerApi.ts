import type { Provider } from '../types'

// ─── localStorage persistence ────────────────────────────────────────────────

const STORAGE_KEY = 'drodo_provider_configs'

interface SavedConfig {
  apiKey: string
  baseUrl: string
  model: string
}

export function loadAllSavedConfigs(): Record<string, SavedConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveProviderConfig(id: string, config: SavedConfig): void {
  const all = loadAllSavedConfigs()
  all[id] = config
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export function loadProviderConfig(id: string): SavedConfig | null {
  const all = loadAllSavedConfigs()
  return all[id] ?? null
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
