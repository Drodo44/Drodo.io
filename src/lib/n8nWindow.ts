import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { getStoredTheme } from './theme'

export const N8N_WINDOW_LABEL = 'n8n-automations'

export async function getN8nWindow() {
  return WebviewWindow.getByLabel(N8N_WINDOW_LABEL)
}

export async function openN8nWindow(url: string) {
  const existing = await getN8nWindow()
  if (existing) {
    await existing.setFocus()
    await existing.show()
    return existing
  }

  // Detect the current theme
  const theme = getStoredTheme()
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  
  // Append theme to URL
  const themedUrl = url + (url.includes('?') ? '&' : '?') + (isDark ? 'theme=dark' : 'theme=light')

  const created = new WebviewWindow(N8N_WINDOW_LABEL, {
    url: themedUrl,
    title: 'Drodo Automations',
    width: 1360,
    height: 860,
    minWidth: 1000,
    minHeight: 700,
    center: true,
    resizable: true,
    maximizable: true,
    minimizable: true,
    closable: true,
    decorations: true,
    visible: true,
    focus: true,
  })

  created.once('tauri://error', event => {
    console.error('Failed to create n8n window.', event)
  })

  return created
}

export async function closeN8nWindow() {
  const existing = await getN8nWindow()
  if (!existing) return
  await existing.close()
}
