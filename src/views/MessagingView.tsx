import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  MessageSquare,
  RefreshCcw,
  Save,
  Send,
  Wifi,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useAppStore } from '../store/appStore'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { loadBotConfigs, saveBotConfig, type BotConfig } from '../lib/messagingBots'

type Platform = BotConfig['platform']

type BotLogEntry = {
  id: string
  platform: Platform
  from: string
  text: string
  direction: 'in' | 'out'
  timestamp: string
}

type TestState = {
  status: 'idle' | 'testing' | 'success' | 'error'
  message: string
}

type FormState = Record<Platform, BotConfig>

const BOT_LOG_STORAGE_KEY = 'drodo_bot_message_log'
const PLATFORM_META: Record<
  Platform,
  {
    title: string
    color: string
    Icon: typeof Send
    fields: Array<'token' | 'channelId' | 'webhookUrl'>
    helper: string
  }
> = {
  telegram: {
    title: 'Telegram',
    color: '#229ed9',
    Icon: Send,
    fields: ['token'],
    helper: 'Create a bot via @BotFather on Telegram and paste the token here',
  },
  slack: {
    title: 'Slack',
    color: '#4a154b',
    Icon: MessageSquare,
    fields: ['token', 'channelId'],
    helper:
      'Create a Slack app at api.slack.com with scopes: channels:history, chat:write. Get Channel ID by right-clicking your channel.',
  },
  discord: {
    title: 'Discord',
    color: '#5865f2',
    Icon: MessageCircle,
    fields: ['token', 'channelId', 'webhookUrl'],
    helper:
      'Enable Developer Mode in Discord, right-click channel to copy ID. Create webhook in channel Settings > Integrations.',
  },
}

function createDefaultConfig(platform: Platform): BotConfig {
  return {
    platform,
    token: '',
    channelId: '',
    webhookUrl: '',
    enabled: false,
    responsePrefix: '',
    maxResponseLength: 500,
  }
}

function buildFormState(configs: BotConfig[]): FormState {
  return {
    telegram: configs.find(config => config.platform === 'telegram') ?? createDefaultConfig('telegram'),
    slack: configs.find(config => config.platform === 'slack') ?? createDefaultConfig('slack'),
    discord: configs.find(config => config.platform === 'discord') ?? createDefaultConfig('discord'),
  }
}

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

function relativeTime(timestamp?: string): string {
  if (!timestamp) return 'just now'
  const value = new Date(timestamp).getTime()
  if (Number.isNaN(value)) return 'just now'

  const diffSeconds = Math.max(0, Math.floor((Date.now() - value) / 1000))
  if (diffSeconds < 5) return 'just now'
  if (diffSeconds < 60) return `${diffSeconds}s ago`
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`
  return `${Math.floor(diffSeconds / 86400)}d ago`
}

async function testTelegram(token: string): Promise<string> {
  const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/getMe`)
  const payload = await response.json()
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.description || 'Telegram connection failed.')
  }
  return `@${payload.result.username} is ready`
}

async function testSlack(token: string): Promise<string> {
  const response = await fetch('https://slack.com/api/auth.test', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  const payload = await response.json()
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || 'Slack connection failed.')
  }
  return `${payload.team ?? 'Slack workspace'} is ready`
}

async function testDiscord(token: string, channelId: string): Promise<string> {
  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
    headers: {
      Authorization: `Bot ${token}`,
    },
  })
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload?.message || 'Discord connection failed.')
  }
  return `#${payload.name ?? 'channel'} is ready`
}

export function MessagingView() {
  const setConnectorConnected = useAppStore(s => s.setConnectorConnected)
  const [loading, setLoading] = useState(true)
  const [formState, setFormState] = useState<FormState>(() => buildFormState(loadBotConfigs()))
  const [expanded, setExpanded] = useState<Record<Platform, boolean>>({
    telegram: true,
    slack: false,
    discord: false,
  })
  const [testState, setTestState] = useState<Record<Platform, TestState>>({
    telegram: { status: 'idle', message: '' },
    slack: { status: 'idle', message: '' },
    discord: { status: 'idle', message: '' },
  })
  const [savedState, setSavedState] = useState<Record<Platform, boolean>>({
    telegram: false,
    slack: false,
    discord: false,
  })
  const [logEntries, setLogEntries] = useState<BotLogEntry[]>([])

  useEffect(() => {
    setFormState(buildFormState(loadBotConfigs()))
    setLogEntries(loadBotLog())
    setLoading(false)
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setLogEntries(loadBotLog())
    }, 3000)

    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const syncConfigs = () => {
      setFormState(buildFormState(loadBotConfigs()))
    }

    window.addEventListener('storage', syncConfigs)
    return () => window.removeEventListener('storage', syncConfigs)
  }, [])

  const activeCount = useMemo(
    () => Object.values(formState).filter(config => config.enabled).length,
    [formState]
  )

  const updateForm = (platform: Platform, patch: Partial<BotConfig>) => {
    setFormState(current => ({
      ...current,
      [platform]: {
        ...current[platform],
        ...patch,
      },
    }))
    setSavedState(current => ({ ...current, [platform]: false }))
  }

  const persistConfig = (platform: Platform, overrides?: Partial<BotConfig>) => {
    const nextConfig = {
      ...formState[platform],
      ...overrides,
    }
    saveBotConfig(nextConfig)
    setConnectorConnected(platform, nextConfig.enabled)
    setFormState(current => ({
      ...current,
      [platform]: nextConfig,
    }))
    setSavedState(current => ({ ...current, [platform]: true }))
    window.setTimeout(() => {
      setSavedState(current => ({ ...current, [platform]: false }))
    }, 2000)
  }

  const handleToggle = (platform: Platform) => {
    persistConfig(platform, { enabled: !formState[platform].enabled })
  }

  const handleSave = (platform: Platform) => {
    persistConfig(platform)
  }

  const handleTest = async (platform: Platform) => {
    const config = formState[platform]
    setTestState(current => ({
      ...current,
      [platform]: { status: 'testing', message: '' },
    }))

    try {
      let message = ''

      if (platform === 'telegram') {
        if (!config.token.trim()) throw new Error('Telegram bot token is required.')
        message = await testTelegram(config.token.trim())
      } else if (platform === 'slack') {
        if (!config.token.trim()) throw new Error('Slack bot token is required.')
        message = await testSlack(config.token.trim())
      } else {
        if (!config.token.trim()) throw new Error('Discord bot token is required.')
        if (!config.channelId?.trim()) throw new Error('Discord channel ID is required.')
        message = await testDiscord(config.token.trim(), config.channelId.trim())
      }

      setTestState(current => ({
        ...current,
        [platform]: { status: 'success', message },
      }))
    } catch (error) {
      setTestState(current => ({
        ...current,
        [platform]: {
          status: 'error',
          message: error instanceof Error ? error.message : 'Connection failed.',
        },
      }))
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <LoadingSpinner label="Loading messaging bots…" />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: 'var(--bg-primary)' }}>
      <div
        className="flex-shrink-0 px-6 py-4"
        style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}
      >
        <h1 className="text-base font-bold text-[var(--text-primary)]">Messaging Bots</h1>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{activeCount} bots active</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
          {(['telegram', 'slack', 'discord'] as Platform[]).map(platform => {
            const config = formState[platform]
            const meta = PLATFORM_META[platform]
            const platformLogs = logEntries
              .filter(entry => entry.platform === platform)
              .slice(-20)
              .reverse()
            const hasAnyConfig = Boolean(config.token || config.channelId || config.webhookUrl)
            const currentTestState = testState[platform]
            const isExpanded = expanded[platform]
            const Icon = meta.Icon

            return (
              <section
                key={platform}
                className="overflow-hidden rounded-2xl border"
                style={{
                  borderColor: 'var(--border-color)',
                  background: 'var(--bg-secondary)',
                  boxShadow: '0 18px 48px rgba(0, 0, 0, 0.18)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setExpanded(current => ({ ...current, [platform]: !current[platform] }))}
                  className="flex w-full items-center justify-between px-5 py-4 text-left"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-xl"
                      style={{ background: `${meta.color}22`, color: meta.color }}
                    >
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">{meta.title}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{
                            background: config.enabled ? '#1d9e7520' : 'var(--bg-tertiary)',
                            color: config.enabled ? '#1d9e75' : 'var(--text-secondary)',
                          }}
                        >
                          {config.enabled ? 'Active' : 'Inactive'}
                        </span>
                        <span className="text-xs text-[var(--text-secondary)]">
                          {config.enabled ? 'Polling every 3 seconds' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-3"
                    onClick={event => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggle(platform)}
                      className={clsx(
                        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                        config.enabled ? 'bg-[#7f77dd]' : 'bg-[var(--bg-tertiary)]'
                      )}
                      aria-label={`Toggle ${meta.title}`}
                    >
                      <span
                        className={clsx(
                          'inline-block h-5 w-5 transform rounded-full bg-white transition-transform',
                          config.enabled ? 'translate-x-5' : 'translate-x-1'
                        )}
                      />
                    </button>
                    {isExpanded ? (
                      <ChevronDown size={18} className="text-[var(--text-secondary)]" />
                    ) : (
                      <ChevronRight size={18} className="text-[var(--text-secondary)]" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div
                    className="grid gap-6 border-t px-5 py-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    <div className="space-y-5">
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-[var(--text-muted)]">Bot Token</label>
                          <input
                            type="password"
                            value={config.token}
                            onChange={event => updateForm(platform, { token: event.target.value })}
                            placeholder={
                              platform === 'telegram'
                                ? '123456789:ABCdef...'
                                : platform === 'slack'
                                  ? 'xoxb-...'
                                  : 'Bot token from discord.com/developers'
                            }
                            className="w-full rounded-xl border bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[#7f77dd]/60"
                            style={{ borderColor: 'var(--border-color)' }}
                          />
                        </div>

                        {meta.fields.includes('channelId') && (
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-[var(--text-muted)]">Channel ID</label>
                            <input
                              type="text"
                              value={config.channelId ?? ''}
                              onChange={event => updateForm(platform, { channelId: event.target.value })}
                              placeholder={platform === 'slack' ? 'C0123456789' : '123456789012345678'}
                              className="w-full rounded-xl border bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[#7f77dd]/60"
                              style={{ borderColor: 'var(--border-color)' }}
                            />
                          </div>
                        )}

                        {meta.fields.includes('webhookUrl') && (
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-[var(--text-muted)]">Webhook URL</label>
                            <input
                              type="text"
                              value={config.webhookUrl ?? ''}
                              onChange={event => updateForm(platform, { webhookUrl: event.target.value })}
                              placeholder="https://discord.com/api/webhooks/..."
                              className="w-full rounded-xl border bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[#7f77dd]/60"
                              style={{ borderColor: 'var(--border-color)' }}
                            />
                          </div>
                        )}

                        <p className="text-xs leading-5 text-[var(--text-secondary)]">{meta.helper}</p>

                        {currentTestState.message && (
                          <div
                            className={clsx(
                              'rounded-xl border px-3 py-2 text-xs',
                              currentTestState.status === 'success'
                                ? 'border-[#1d9e75]/30 bg-[#1d9e75]/10 text-[#1d9e75]'
                                : 'border-[#e05050]/30 bg-[#e05050]/10 text-[#e05050]'
                            )}
                          >
                            {currentTestState.message}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => void handleTest(platform)}
                            disabled={currentTestState.status === 'testing'}
                            className={clsx(
                              'inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors',
                              currentTestState.status === 'testing'
                                ? 'cursor-not-allowed border-[var(--border-color)] text-[var(--text-secondary)]'
                                : 'border-[var(--border-color)] text-[var(--text-primary)] hover:border-[#7f77dd]/40 hover:bg-[var(--bg-tertiary)]'
                            )}
                          >
                            <RefreshCcw
                              size={14}
                              className={currentTestState.status === 'testing' ? 'animate-spin' : ''}
                            />
                            {currentTestState.status === 'testing' ? 'Testing…' : 'Test Connection'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSave(platform)}
                            className={clsx(
                              'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90',
                              savedState[platform] ? 'bg-[#1d9e75]' : 'bg-[#7f77dd]'
                            )}
                          >
                            <Save size={14} />
                            {savedState[platform] ? 'Saved!' : 'Save'}
                          </button>
                        </div>
                      </div>

                      <div
                        className="rounded-2xl border p-4"
                        style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}
                      >
                        <div className="mb-3">
                          <div className="text-sm font-semibold text-[var(--text-primary)]">Bot behavior</div>
                          <p className="mt-1 text-xs text-[var(--text-secondary)]">
                            Shape how Drodo answers on this platform.
                          </p>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-[var(--text-muted)]">Response prefix</label>
                            <input
                              type="text"
                              value={config.responsePrefix ?? ''}
                              onChange={event => updateForm(platform, { responsePrefix: event.target.value })}
                              placeholder="e.g. 🤖 Drodo:"
                              className="w-full rounded-xl border bg-[var(--bg-secondary)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[#7f77dd]/60"
                              style={{ borderColor: 'var(--border-color)' }}
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-[var(--text-muted)]">Max response length</label>
                            <input
                              type="number"
                              min={100}
                              max={2000}
                              value={config.maxResponseLength ?? 500}
                              onChange={event =>
                                updateForm(platform, {
                                  maxResponseLength: Math.min(2000, Math.max(100, Number(event.target.value) || 500)),
                                })
                              }
                              className="w-full rounded-xl border bg-[var(--bg-secondary)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[#7f77dd]/60"
                              style={{ borderColor: 'var(--border-color)' }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div
                      className="rounded-2xl border p-4"
                      style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}
                    >
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[var(--text-primary)]">Live Feed</div>
                          <p className="mt-1 text-xs text-[var(--text-secondary)]">
                            Latest inbound and outbound bot activity.
                          </p>
                        </div>
                        {config.enabled && (
                          <div className="flex items-center gap-2 text-xs text-[#1d9e75]">
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1d9e75] opacity-75" />
                              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#1d9e75]" />
                            </span>
                            Listening for messages...
                          </div>
                        )}
                      </div>

                      <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                        {platformLogs.length > 0 ? (
                          platformLogs.map(entry => (
                            <div
                              key={entry.id}
                              className="rounded-xl border px-3 py-2.5"
                              style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}
                            >
                              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                                <div className="flex min-w-0 items-center gap-2">
                                  {entry.direction === 'in' ? (
                                    <ArrowDownLeft size={13} className="shrink-0 text-[#7f77dd]" />
                                  ) : (
                                    <ArrowUpRight size={13} className="shrink-0 text-[#1d9e75]" />
                                  )}
                                  <span className="truncate font-medium text-[var(--text-primary)]">{entry.from}</span>
                                </div>
                                <span className="shrink-0 text-[var(--text-secondary)]">{relativeTime(entry.timestamp)}</span>
                              </div>
                              <p className="truncate text-sm text-[var(--text-secondary)]">{entry.text.slice(0, 60)}</p>
                            </div>
                          ))
                        ) : (
                          <div
                            className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed px-6 text-center"
                            style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}
                          >
                            <Wifi size={28} className="mb-3 text-[var(--text-muted)]" />
                            <div className="text-sm font-semibold text-[var(--text-primary)]">
                              No messages yet
                            </div>
                            <p className="mt-2 max-w-xs text-sm leading-6 text-[var(--text-secondary)]">
                              {hasAnyConfig
                                ? 'Enable a bot above and send a message to see the conversation here.'
                                : 'Enable a bot above and send a message to see the conversation here.'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
