// Tauri native notifications — fail-silent wrapper

let pluginAvailable = false

async function ensurePermission(): Promise<boolean> {
  try {
    const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification')
    let granted = await isPermissionGranted()
    if (!granted) {
      const result = await requestPermission()
      granted = result === 'granted'
    }
    return granted
  } catch {
    return false
  }
}

// Called once at app start — warms up the permission state
export async function initNotifications(): Promise<void> {
  try {
    pluginAvailable = await ensurePermission()
  } catch {
    pluginAvailable = false
  }
}

export async function notify(title: string, body: string): Promise<void> {
  try {
    if (!pluginAvailable) {
      pluginAvailable = await ensurePermission()
    }
    if (!pluginAvailable) return

    const { sendNotification } = await import('@tauri-apps/plugin-notification')
    sendNotification({ title, body })
  } catch {
    // Never break UI over a notification failure
  }
}
