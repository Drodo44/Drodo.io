import type { Provider, Message } from '../types'
import { normalizeUrl } from './providerApi'

type ChunkCallback = (text: string) => void
type DoneCallback = (fullText: string) => void
type ErrorCallback = (err: Error) => void

export interface StreamHandle {
  abort: () => void
}

type ProviderType = 'anthropic' | 'gemini' | 'openai-compatible'

function detectType(id: string, baseUrl: string): ProviderType {
  if (id === 'anthropic' || baseUrl.includes('anthropic.com')) return 'anthropic'
  if (id === 'gemini' || baseUrl.includes('generativelanguage.googleapis.com')) return 'gemini'
  return 'openai-compatible'
}

// Convert our Message[] into the appropriate request format
function toOpenAIMessages(messages: Message[]) {
  return messages
    .filter(m => m.role !== 'system' || m.content !== 'Session started. Drodo is ready.')
    .map(m => ({
      role: m.role === 'system' ? 'user' : m.role,
      content: m.content,
    }))
}

// ─── Main stream entry point ──────────────────────────────────────────────────

export function streamCompletion(
  provider: Provider,
  messages: Message[],
  onChunk: ChunkCallback,
  onDone: DoneCallback,
  onError: ErrorCallback
): StreamHandle {
  const controller = new AbortController()
  const { signal } = controller

  const url = normalizeUrl(provider.baseUrl)
  const type = detectType(provider.id, url)

  const run = async () => {
    try {
      if (type === 'anthropic') {
        await streamAnthropic(url, provider, messages, onChunk, signal)
      } else if (type === 'gemini') {
        await streamGemini(url, provider, messages, onChunk, signal)
      } else {
        await streamOpenAICompatible(url, provider, messages, onChunk, signal)
      }
      // Get full text from chunks accumulated by caller
      onDone('')
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      onError(err instanceof Error ? err : new Error(String(err)))
    }
  }

  run()

  return { abort: () => controller.abort() }
}

// ─── SSE line parser ──────────────────────────────────────────────────────────

async function* readSSE(response: Response) {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      yield line
    }
  }

  // Flush remaining buffer
  if (buffer) yield buffer
}

// ─── OpenAI-compatible streaming ──────────────────────────────────────────────

async function streamOpenAICompatible(
  baseUrl: string,
  provider: Provider,
  messages: Message[],
  onChunk: ChunkCallback,
  signal: AbortSignal
): Promise<void> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'Authorization': `Bearer ${provider.apiKey ?? ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: provider.model ?? 'gpt-4o-mini',
      messages: toOpenAIMessages(messages),
      stream: true,
      max_tokens: 4096,
    }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body?.error?.message ?? `API error ${response.status}`)
  }

  for await (const line of readSSE(response)) {
    if (!line.startsWith('data:')) continue
    const data = line.slice(5).trim()
    if (data === '[DONE]') break
    try {
      const parsed = JSON.parse(data)
      const delta = parsed?.choices?.[0]?.delta?.content
      if (typeof delta === 'string' && delta) {
        onChunk(delta)
      }
    } catch {
      // skip malformed lines
    }
  }
}

// ─── Anthropic streaming ──────────────────────────────────────────────────────

async function streamAnthropic(
  baseUrl: string,
  provider: Provider,
  messages: Message[],
  onChunk: ChunkCallback,
  signal: AbortSignal
): Promise<void> {
  const endpoint = baseUrl.includes('/v1')
    ? `${baseUrl}/messages`
    : `${baseUrl}/v1/messages`

  const anthropicMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  const response = await fetch(endpoint, {
    method: 'POST',
    signal,
    headers: {
      'x-api-key': provider.apiKey ?? '',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-allow-browser': 'true',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: provider.model ?? 'claude-sonnet-4-6',
      max_tokens: 8192,
      messages: anthropicMessages,
      stream: true,
    }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body?.error?.message ?? `API error ${response.status}`)
  }

  for await (const line of readSSE(response)) {
    if (line.startsWith('event:')) continue
    if (!line.startsWith('data:')) continue
    const data = line.slice(5).trim()
    try {
      const parsed = JSON.parse(data)
      if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
        onChunk(parsed.delta.text)
      }
    } catch {
      // skip
    }
  }
}

// ─── Google Gemini streaming ──────────────────────────────────────────────────

async function streamGemini(
  _baseUrl: string,
  provider: Provider,
  messages: Message[],
  onChunk: ChunkCallback,
  signal: AbortSignal
): Promise<void> {
  const model = provider.model ?? 'gemini-2.0-flash'
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${provider.apiKey ?? ''}`

  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

  const response = await fetch(endpoint, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body?.error?.message ?? `API error ${response.status}`)
  }

  for await (const line of readSSE(response)) {
    if (!line.startsWith('data:')) continue
    const data = line.slice(5).trim()
    try {
      const parsed = JSON.parse(data)
      const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text
      if (typeof text === 'string' && text) {
        onChunk(text)
      }
    } catch {
      // skip
    }
  }
}
