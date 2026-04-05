const BOT_CONFIGS_STORAGE_KEY = 'drodo_bot_configs'

export interface BotConfig {
  platform: 'telegram' | 'slack' | 'discord'
  token: string
  channelId?: string
  webhookUrl?: string
  enabled: boolean
  lastUpdateId?: number
  lastTimestamp?: string
  lastMessageId?: string
  responsePrefix?: string
  maxResponseLength?: number
}

export interface IncomingMessage {
  platform: 'telegram' | 'slack' | 'discord'
  text: string
  from: string
  chatId: string
}

function readBotConfigs(): BotConfig[] {
  try {
    const raw = localStorage.getItem(BOT_CONFIGS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeBotConfigs(configs: BotConfig[]): void {
  localStorage.setItem(BOT_CONFIGS_STORAGE_KEY, JSON.stringify(configs))
}

export function loadBotConfigs(): BotConfig[] {
  return readBotConfigs()
}

export function saveBotConfig(config: BotConfig): void {
  const configs = readBotConfigs()
  const nextConfig: BotConfig = {
    ...config,
    responsePrefix: config.responsePrefix ?? '',
    maxResponseLength: config.maxResponseLength ?? 500,
  }
  const index = configs.findIndex(item => item.platform === config.platform)

  if (index >= 0) {
    configs[index] = {
      ...configs[index],
      ...nextConfig,
    }
  } else {
    configs.push(nextConfig)
  }

  writeBotConfigs(configs)
}

export function removeBotConfig(platform: string): void {
  writeBotConfigs(readBotConfigs().filter(config => config.platform !== platform))
}

export async function pollTelegram(config: BotConfig): Promise<IncomingMessage[]> {
  if (!config.token) return []

  const offset = config.lastUpdateId ?? 0
  const response = await fetch(
    `https://api.telegram.org/bot${encodeURIComponent(config.token)}/getUpdates?offset=${offset}&timeout=1`
  )
  const payload = await response.json()

  if (!response.ok || !payload?.ok || !Array.isArray(payload.result)) {
    throw new Error(payload?.description || 'Failed to poll Telegram.')
  }

  const messages = payload.result
    .map((update: any) => ({
      updateId: update.update_id,
      message: update.message,
    }))
    .filter((entry: any) => entry.message?.text && entry.message?.chat?.id != null)
    .map((entry: any) => ({
      platform: 'telegram' as const,
      text: entry.message.text as string,
      from:
        entry.message.from?.username ||
        [entry.message.from?.first_name, entry.message.from?.last_name].filter(Boolean).join(' ') ||
        'Telegram user',
      chatId: String(entry.message.chat.id),
      updateId: entry.updateId as number,
    }))

  const lastUpdateId = messages.length > 0 ? messages[messages.length - 1].updateId : undefined
  if (typeof lastUpdateId === 'number') {
    saveBotConfig({
      ...config,
      lastUpdateId: lastUpdateId + 1,
    })
  }

  return messages.map((entry: { updateId: number } & IncomingMessage) => {
    const { updateId: _updateId, ...message } = entry
    return message
  })
}

export async function sendTelegram(token: string, chatId: string, text: string): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  })
  const payload = await response.json()

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.description || 'Failed to send Telegram message.')
  }
}

export async function pollSlack(config: BotConfig): Promise<IncomingMessage[]> {
  if (!config.token || !config.channelId) return []

  const url = new URL('https://slack.com/api/conversations.history')
  url.searchParams.set('channel', config.channelId)
  url.searchParams.set('limit', '5')
  if (config.lastTimestamp) {
    url.searchParams.set('oldest', config.lastTimestamp)
    url.searchParams.set('inclusive', 'false')
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${config.token}`,
    },
  })
  const payload = await response.json()

  if (!response.ok || !payload?.ok || !Array.isArray(payload.messages)) {
    throw new Error(payload?.error || 'Failed to poll Slack.')
  }

  const messages = [...payload.messages]
    .reverse()
    .filter((message: any) => !message.bot_id && message.text)
    .map((message: any) => ({
      platform: 'slack' as const,
      text: message.text as string,
      from: message.user || 'Slack user',
      chatId: config.channelId as string,
      timestamp: message.ts as string | undefined,
    }))

  const lastTimestamp = messages.length > 0 ? messages[messages.length - 1].timestamp : undefined
  if (lastTimestamp) {
    saveBotConfig({
      ...config,
      lastTimestamp,
    })
  }

  return messages.map(({ timestamp: _timestamp, ...message }) => message)
}

export async function sendSlack(token: string, channelId: string, text: string): Promise<void> {
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: channelId,
      text,
    }),
  })
  const payload = await response.json()

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || 'Failed to send Slack message.')
  }
}

export async function pollDiscord(config: BotConfig): Promise<IncomingMessage[]> {
  if (!config.token || !config.channelId) return []

  const url = new URL(`https://discord.com/api/v10/channels/${config.channelId}/messages`)
  url.searchParams.set('limit', '5')
  if (config.lastMessageId) {
    url.searchParams.set('after', config.lastMessageId)
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bot ${config.token}`,
    },
  })
  const payload = await response.json()

  if (!response.ok || !Array.isArray(payload)) {
    throw new Error(payload?.message || 'Failed to poll Discord.')
  }

  const messages = [...payload]
    .reverse()
    .filter((message: any) => !message.author?.bot && message.content)
    .map((message: any) => ({
      platform: 'discord' as const,
      text: message.content as string,
      from: message.author?.username || 'Discord user',
      chatId: config.channelId as string,
      messageId: message.id as string,
    }))

  const lastMessageId = messages.length > 0 ? messages[messages.length - 1].messageId : undefined
  if (lastMessageId) {
    saveBotConfig({
      ...config,
      lastMessageId,
    })
  }

  return messages.map(({ messageId: _messageId, ...message }) => message)
}

export async function sendDiscord(webhookUrl: string, text: string): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: text,
    }),
  })

  if (!response.ok) {
    const payload = await response.text()
    throw new Error(payload || 'Failed to send Discord message.')
  }
}
