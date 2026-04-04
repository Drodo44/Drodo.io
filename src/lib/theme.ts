export type ThemeMode = 'dark' | 'light' | 'system'

const SETTINGS_KEY = 'drodo_settings'

export function getStoredTheme(): ThemeMode {
  try {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as { theme?: ThemeMode }
    return settings.theme ?? 'dark'
  } catch {
    return 'dark'
  }
}

export function applyThemeClass(theme: ThemeMode): void {
  if (theme === 'light') {
    document.documentElement.classList.add('light')
    return
  }

  document.documentElement.classList.remove('light')
}
