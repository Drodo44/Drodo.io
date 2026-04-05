import { decryptStoredKey, encryptStoredKey } from './encryption'

const CONNECTOR_KEYS_STORAGE_KEY = 'drodo_connector_keys'

export function loadConnectorKeys(): Record<string, string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONNECTOR_KEYS_STORAGE_KEY) ?? '{}') as Record<string, string>
    return Object.fromEntries(
      Object.entries(parsed).map(([connectorId, value]) => [connectorId, decryptStoredKey(value)])
    )
  } catch {
    return {}
  }
}

export function saveConnectorKey(connectorId: string, key: string): void {
  const stored = getRawConnectorKeys()
  stored[connectorId] = encryptStoredKey(key)
  localStorage.setItem(CONNECTOR_KEYS_STORAGE_KEY, JSON.stringify(stored))
}

export function removeConnectorKey(connectorId: string): void {
  const stored = getRawConnectorKeys()
  delete stored[connectorId]
  localStorage.setItem(CONNECTOR_KEYS_STORAGE_KEY, JSON.stringify(stored))
}

function getRawConnectorKeys(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CONNECTOR_KEYS_STORAGE_KEY) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}
