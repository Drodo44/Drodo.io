import { streamCompletion } from './streamChat'
import {
  loadBotConfigs,
  pollDiscord,
  pollSlack,
  pollTelegram,
  sendDiscord,
  sendSlack,
  sendTelegram,
  type BotConfig,
  type IncomingMessage,
} from './messagingBots'
import type { Message, Provider } from '../types'

type BotLogEntry = {
  id: string
  platform: BotConfig['platform']
  from: string
  text: string
  direction: 'in' | 'out'
  timestamp: string
}

const BOT_LOG_STORAGE_KEY = 'drodo_bot_message_log'
const POLL_INTERVAL_MS = 3000

let pollingHandle: number | null = null
let pollingInFlight = false

function loadBotLog(): BotLogEntry[] {
  try {
    const raw = localStorage.getItem(BOT_LOG_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveBotLog(entries: BotLogEntry[]): void {
  localStorage.setItem(BOT_LOG_STORAGE_KEY, JSON.stringify(entries.slice(-100)))
}

function appendBotLog(entry: Omit<BotLogEntry, 'id' | 'timestamp'> & Partial<Pick<BotLogEntry, 'id' | 'timestamp'>>): void {
  const nextEntry: BotLogEntry = {
    id: entry.id ?? crypto.randomUUID(),
    timestamp: entry.timestamp ?? new Date().toISOString(),
    ...entry,
  }
  const entries = loadBotLog()
  entries.push(nextEntry)
  saveBotLog(entries)
}

function buildMessages(config: BotConfig, incoming: IncomingMessage): Message[] {
  const maxResponseLength = config.maxResponseLength ?? 500

  return [
    {
      id: crypto.randomUUID(),
      role: 'system',
      content: `You are Drodo, a helpful AI assistant. Keep responses concise and under ${maxResponseLength} characters.`,
      timestamp: new Date(),
    },
    {
      id: crypto.randomUUID(),
      role: 'user',
      content: incoming.text,
      timestamp: new Date(),
    },
  ]
}

function runStreamCompletion(provider: Provider, messages: Message[]): Promise<string> {
  return new Promise((resolve, reject) => {
    let response = ''

    streamCompletion(
      provider,
      messages,
      chunk => {
        response += chunk
      },
      () => resolve(response.trim()),
      error => reject(error)
    )
  })
}

async function sendPlatformResponse(config: BotConfig, incoming: IncomingMessage, text: string): Promise<void> {
  if (config.platform === 'telegram') {
    await sendTelegram(config.token, incoming.chatId, text)
    return
  }

  if (config.platform === 'slack') {
    if (!config.channelId) throw new Error('Slack channel ID is missing.')
    await sendSlack(config.token, config.channelId, text)
    return
  }

  if (!config.webhookUrl) throw new Error('Discord webhook URL is missing.')
  await sendDiscord(config.webhookUrl, text)
}

async function pollPlatform(config: BotConfig): Promise<IncomingMessage[]> {
  if (config.platform === 'telegram') return pollTelegram(config)
  if (config.platform === 'slack') return pollSlack(config)
  return pollDiscord(config)
}

async function handleIncomingMessage(config: BotConfig, incoming: IncomingMessage, provider: Provider): Promise<void> {
  appendBotLog({
    platform: config.platform,
    from: incoming.from,
    text: incoming.text,
    direction: 'in',
  })

  let responseText = ''

  try {
    responseText = await runStreamCompletion(provider, buildMessages(config, incoming))
    responseText = `${config.responsePrefix ?? ''}${responseText}`.trim()

    if (!responseText) {
      responseText = 'I do not have a response for that yet.'
    }

    await sendPlatformResponse(config, incoming, responseText)

    appendBotLog({
      platform: config.platform,
      from: 'Drodo',
      text: responseText,
      direction: 'out',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bot response failed.'
    appendBotLog({
      platform: config.platform,
      from: 'Drodo',
      text: `Error: ${message}`,
      direction: 'out',
    })
  }
}

async function pollEnabledBots(getProvider: () => Provider): Promise<void> {
  if (pollingInFlight) return
  pollingInFlight = true

  try {
    const provider = getProvider()
    const configs = loadBotConfigs().filter(config => config.enabled)

    for (const config of configs) {
      const incomingMessages = await pollPlatform(config).catch(error => {
        appendBotLog({
          platform: config.platform,
          from: 'System',
          text: error instanceof Error ? `Error: ${error.message}` : 'Error: Failed to poll bot.',
          direction: 'out',
        })
        return []
      })

      for (const incoming of incomingMessages) {
        await handleIncomingMessage(config, incoming, provider)
      }
    }
  } finally {
    pollingInFlight = false
  }
}

export function startBotPolling(getProvider: () => Provider): void {
  if (pollingHandle !== null) return

  void pollEnabledBots(getProvider)
  pollingHandle = window.setInterval(() => {
    void pollEnabledBots(getProvider)
  }, POLL_INTERVAL_MS)
}

export function stopBotPolling(): void {
  if (pollingHandle !== null) {
    window.clearInterval(pollingHandle)
    pollingHandle = null
  }
}
