import { check } from '@tauri-apps/plugin-updater'

const UPDATE_STORAGE_KEY = 'drodo_update_available'

export interface StoredUpdateInfo {
  version?: string
  body?: string
  date?: string
}

export async function checkForUpdates(): Promise<void> {
  try {
    const update = await check()
    if (update?.available) {
      localStorage.setItem(UPDATE_STORAGE_KEY, JSON.stringify({
        version: update.version,
        body: update.body,
        date: update.date,
      }))
      return
    }

    localStorage.removeItem(UPDATE_STORAGE_KEY)
  } catch {
    // Fail silently — updater not critical
  }
}

export function getStoredUpdateInfo(): StoredUpdateInfo | null {
  try {
    const raw = localStorage.getItem(UPDATE_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredUpdateInfo
  } catch {
    return null
  }
}
