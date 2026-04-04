import type { Message, Provider } from '../types'
import { normalizeUrl } from './providerApi'

type ChunkCallback = (text: string) => void
type DoneCallback = (fullText: string) => void
type ErrorCallback = (err: Error) => void

export interface StreamHandle {
  abort: () => void
}

type ProviderType = 'anthropic' | 'gemini' | 'openai-compatible'

const SESSION_READY_MESSAGE = 'Session started. Drodo is ready.'

function detectType(id: string, baseUrl: string): ProviderType {
  if (id === 'anthropic' || baseUrl.includes('anthropic.com')) return 'anthropic'
  if (id === 'gemini' || baseUrl.includes('generativelanguage.googleapis.com')) return 'gemini'
  return 'openai-compatible'
}

function splitSystemMessages(messages: Message[]) {
  const system = messages
    .filter(message => message.role === 'system' && message.content !== SESSION_READY_MESSAGE)
    .map(message => message.content)
    .join('\n\n')

  const conversation = messages.filter(
    message => message.role !== 'system' || message.content !== SESSION_READY_MESSAGE
  )

  return { system, conversation }
}

function toOpenAIMessages(messages: Message[]) {
  return messages
    .filter(message => message.role !== 'system' || message.content !== SESSION_READY_MESSAGE)
    .map(message => ({
      role: message.role,
      content: message.content,
    }))
}

function toAnthropicInput(messages: Message[]) {
  const { system, conversation } = splitSystemMessages(messages)
  return {
    system,
    messages: conversation
      .filter(message => message.role !== 'system')
      .map(message => ({
        role: message.role as 'user' | 'assistant',
        content: message.content,
      })),
  }
}

function toGeminiInput(messages: Message[]) {
  const { system, conversation } = splitSystemMessages(messages)
  return {
    systemInstruction: system
      ? {
          parts: [{ text: system }],
        }
      : undefined,
    contents: conversation
      .filter(message => message.role !== 'system')
      .map(message => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      })),
  }
}

function extractOpenAIText(payload: any): string {
  const content = payload?.choices?.[0]?.message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map(part => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
  }
  return ''
}

function extractAnthropicText(payload: any): string {
  const content = payload?.content
  if (!Array.isArray(content)) return ''
  return content
    .map(block => (block?.type === 'text' && typeof block?.text === 'string' ? block.text : ''))
    .join('')
}

function extractGeminiText(payload: any): string {
  const parts = payload?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return ''
  return parts
    .map((part: { text?: string }) => (typeof part.text === 'string' ? part.text : ''))
    .join('')
}

export async function completeText(
  provider: Provider,
  messages: Message[],
  signal?: AbortSignal
): Promise<string> {
  const url = normalizeUrl(provider.baseUrl)
  const type = detectType(provider.id, url)

  if (type === 'anthropic') {
    return completeAnthropic(url, provider, messages, signal)
  }
  if (type === 'gemini') {
    return completeGemini(url, provider, messages, signal)
  }
  return completeOpenAICompatible(url, provider, messages, signal)
}

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
      let accumulated = ''
      const emitChunk = (chunk: string) => {
        accumulated += chunk
        onChunk(chunk)
      }

      if (type === 'anthropic') {
        await streamAnthropic(url, provider, messages, emitChunk, signal)
      } else if (type === 'gemini') {
        await streamGemini(url, provider, messages, emitChunk, signal)
      } else {
        await streamOpenAICompatible(url, provider, messages, emitChunk, signal)
      }

      onDone(accumulated)
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError') return
      onError(err instanceof Error ? err : new Error(String(err)))
    }
  }

  void run()

  return { abort: () => controller.abort() }
}

async function* readSSE(response: Response) {
  const reader = response.body?.getReader()
  if (!reader) return

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

  if (buffer) {
    yield buffer
  }
}

async function completeOpenAICompatible(
  baseUrl: string,
  provider: Provider,
  messages: Message[],
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${provider.apiKey ?? ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: provider.model ?? 'gpt-4o-mini',
      messages: toOpenAIMessages(messages),
      stream: false,
      max_tokens: 4096,
    }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body?.error?.message ?? `API error ${response.status}`)
  }

  const body = await response.json()
  return extractOpenAIText(body)
}

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
      Authorization: `Bearer ${provider.apiKey ?? ''}`,
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
      // Ignore malformed chunks.
    }
  }
}

async function completeAnthropic(
  baseUrl: string,
  provider: Provider,
  messages: Message[],
  signal?: AbortSignal
): Promise<string> {
  const endpoint = baseUrl.includes('/v1') ? `${baseUrl}/messages` : `${baseUrl}/v1/messages`
  const anthropicInput = toAnthropicInput(messages)

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
      messages: anthropicInput.messages,
      system: anthropicInput.system || undefined,
    }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body?.error?.message ?? `API error ${response.status}`)
  }

  const body = await response.json()
  return extractAnthropicText(body)
}

async function streamAnthropic(
  baseUrl: string,
  provider: Provider,
  messages: Message[],
  onChunk: ChunkCallback,
  signal: AbortSignal
): Promise<void> {
  const endpoint = baseUrl.includes('/v1') ? `${baseUrl}/messages` : `${baseUrl}/v1/messages`
  const anthropicInput = toAnthropicInput(messages)

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
      messages: anthropicInput.messages,
      system: anthropicInput.system || undefined,
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
      // Ignore malformed chunks.
    }
  }
}

async function completeGemini(
  _baseUrl: string,
  provider: Provider,
  messages: Message[],
  signal?: AbortSignal
): Promise<string> {
  const model = provider.model ?? 'gemini-2.0-flash'
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${provider.apiKey ?? ''}`
  const geminiInput = toGeminiInput(messages)

  const response = await fetch(endpoint, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(geminiInput),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body?.error?.message ?? `API error ${response.status}`)
  }

  const body = await response.json()
  return extractGeminiText(body)
}

async function streamGemini(
  _baseUrl: string,
  provider: Provider,
  messages: Message[],
  onChunk: ChunkCallback,
  signal: AbortSignal
): Promise<void> {
  const model = provider.model ?? 'gemini-2.0-flash'
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${provider.apiKey ?? ''}`
  const geminiInput = toGeminiInput(messages)

  const response = await fetch(endpoint, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(geminiInput),
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
      const text = extractGeminiText(parsed)
      if (text) {
        onChunk(text)
      }
    } catch {
      // Ignore malformed chunks.
    }
  }
}
