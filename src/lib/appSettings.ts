import { decryptStoredKey, encryptStoredKey } from './encryption'

const SETTINGS_KEY = 'drodo_settings'

export type AppSettings = Record<string, unknown> & {
  tavilyApiKey?: string
  n8nApiKey?: string
}

export function getAppSettings(): AppSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as AppSettings
    if (typeof parsed.tavilyApiKey === 'string') {
      parsed.tavilyApiKey = decryptStoredKey(parsed.tavilyApiKey)
    }
    if (typeof parsed.n8nApiKey === 'string') {
      parsed.n8nApiKey = decryptStoredKey(parsed.n8nApiKey)
    }
    return parsed
  } catch {
    return {}
  }
}

export function setAppSetting(key: string, value: unknown): void {
  const settings = getRawAppSettings()
  settings[key] = (key === 'tavilyApiKey' || key === 'n8nApiKey') && typeof value === 'string'
    ? encryptStoredKey(value)
    : value
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

function getRawAppSettings(): AppSettings {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as AppSettings
  } catch {
    return {}
  }
}
