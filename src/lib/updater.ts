import { check } from '@tauri-apps/plugin-updater'

const UPDATE_STORAGE_KEY = 'drodo_update_available'

export interface StoredUpdateInfo {
  version?: string
  body?: string
  date?: string
}

export interface UpdateCheckResult {
  error?: string
  status: 'available' | 'up-to-date' | 'error'
  updateInfo?: StoredUpdateInfo
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim()
  }

  return 'Updater check failed.'
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  try {
    const update = await check()
    if (update?.available) {
      const updateInfo: StoredUpdateInfo = {
        version: update.version,
        body: update.body,
        date: update.date,
      }

      localStorage.setItem(UPDATE_STORAGE_KEY, JSON.stringify(updateInfo))
      return { status: 'available', updateInfo }
    }

    localStorage.removeItem(UPDATE_STORAGE_KEY)
    return { status: 'up-to-date' }
  } catch (error) {
    localStorage.removeItem(UPDATE_STORAGE_KEY)
    return { status: 'error', error: getErrorMessage(error) }
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
