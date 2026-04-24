import { useEffect, useState, type ReactNode } from 'react'
import { onOpenUrl } from '@tauri-apps/plugin-deep-link'
import { useAppStore } from './store/appStore'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { ChatPanel } from './components/layout/ChatPanel'
import { RightPanel } from './components/layout/RightPanel'
import { AgentSwarmView } from './views/AgentSwarmView'
import { ProjectsView } from './views/ProjectsView'
import { SessionsView } from './views/SessionsView'
import { FilesView } from './views/FilesView'
import { MCPServersView } from './views/MCPServersView'
import { SkillsView } from './views/SkillsView'
import { WorkflowsView } from './views/WorkflowsView'
import { AnalyticsView } from './views/AnalyticsView'
import { ConnectionsView } from './views/ConnectionsView'
import { SettingsView } from './views/SettingsView'
import { AgentTemplatesView } from './views/AgentTemplatesView'
import { PromptLibraryView } from './views/PromptLibraryView'
import { AutomationsView } from './views/AutomationsView'
import { MessagingView } from './views/MessagingView'
import { AuthView } from './views/AuthView'
import { OnboardingScreen, isOnboardingComplete } from './components/Onboarding'
import { Tutorial, isTutorialComplete } from './components/ui/Tutorial'
import { ProviderHubModal } from './components/modals/ProviderHubModal'
import { PermissionWarningModal } from './components/modals/PermissionWarningModal'
import { CommandPalette } from './components/ui/CommandPalette'
import { withErrorBoundary } from './components/ui/ErrorBoundary'
import { Loader2 } from 'lucide-react'
import { applyThemeClass, getStoredTheme } from './lib/theme'
import { getSession, onAuthStateChange } from './lib/auth'
import { supabase } from './lib/supabase'
import { syncUserData } from './lib/syncToSupabase'
import { startBotPolling, stopBotPolling } from './lib/botRunner'
import { checkForUpdates } from './lib/updater'

function AgentWorkspace() {
  return (
    <div className="app-shell__content flex w-full min-w-0 min-h-0 flex-1 overflow-hidden flex-col lg:flex-row">
      <ChatPanel />
      <RightPanel />
    </div>
  )
}

const SafeAgentWorkspace = withErrorBoundary(AgentWorkspace)
const SafeAgentSwarmView = withErrorBoundary(AgentSwarmView)
const SafeProjectsView = withErrorBoundary(ProjectsView)
const SafeSessionsView = withErrorBoundary(SessionsView)
const SafeFilesView = withErrorBoundary(FilesView)
const SafeMCPServersView = withErrorBoundary(MCPServersView)
const SafeSkillsView = withErrorBoundary(SkillsView)
const SafeWorkflowsView = withErrorBoundary(WorkflowsView)
const SafeAnalyticsView = withErrorBoundary(AnalyticsView)
const SafeConnectionsView = withErrorBoundary(ConnectionsView)
const SafeSettingsView = withErrorBoundary(SettingsView)
const SafeAgentTemplatesView = withErrorBoundary(AgentTemplatesView)
const SafePromptLibraryView = withErrorBoundary(PromptLibraryView)
const SafeAutomationsView = withErrorBoundary(AutomationsView)
const SafeMessagingView = withErrorBoundary(MessagingView)
const SafeAuthView = withErrorBoundary(AuthView)
const SafeOnboardingScreen = withErrorBoundary(OnboardingScreen)

function MainContent() {
  const activeView = useAppStore(s => s.activeView)

  if (activeView === 'agent') {
    return <SafeAgentWorkspace />
  }
  if (activeView === 'swarm') return <SafeAgentSwarmView />
  if (activeView === 'projects') return <SafeProjectsView />
  if (activeView === 'sessions') return <SafeSessionsView />
  if (activeView === 'files') return <SafeFilesView />
  if (activeView === 'mcp') return <SafeMCPServersView />
  if (activeView === 'skills') return <SafeSkillsView />
  if (activeView === 'workflows') return <SafeWorkflowsView />
  if (activeView === 'analytics') return <SafeAnalyticsView />
  if (activeView === 'connections') return <SafeConnectionsView />
  if (activeView === 'settings') return <SafeSettingsView />
  if (activeView === 'templates') return <SafeAgentTemplatesView />
  if (activeView === 'prompts') return <SafePromptLibraryView />
  if (activeView === 'automations') return <SafeAutomationsView />
  if (activeView === 'messaging') return <SafeMessagingView />
  return null
}

function LoadingShell({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-0 flex-1 items-center justify-center px-6">
      <div
        className="w-full max-w-md rounded-2xl border p-6"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      >
        <div className="flex items-center gap-3">
          <Loader2 size={18} className="animate-spin" style={{ color: '#7f77dd' }} />
          <div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">{label}</div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]">
              The shell is ready. Background initialization is still running.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Skill library URLs fetched once at startup ───────────────────────────────
const SKILL_LIBRARY_URLS = [
  'https://raw.githubusercontent.com/wshobson/agents/main/README.md',
  'https://raw.githubusercontent.com/alirezarezvani/claude-skills/main/README.md',
  'https://raw.githubusercontent.com/obra/superpowers/main/README.md',
  'https://raw.githubusercontent.com/VoltAgent/awesome-agent-skills/main/README.md',
  'https://raw.githubusercontent.com/affaan-m/everything-claude-code/main/README.md',
  'https://raw.githubusercontent.com/gsd-build/get-shit-done/main/README.md',
]
const SKILL_LIBRARY_KEY = 'drodo_skill_library'
const SKILL_LIBRARY_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const SESSION_INIT_TIMEOUT_MS = 5000

function refreshSkillLibrary() {
  try {
    const cached = localStorage.getItem(SKILL_LIBRARY_KEY)
    if (cached) {
      const parsed = JSON.parse(cached) as { content: string; fetchedAt: number }
      if (Date.now() - parsed.fetchedAt < SKILL_LIBRARY_TTL_MS) return
    }
  } catch { /* stale or corrupt — re-fetch */ }

  void Promise.allSettled(
    SKILL_LIBRARY_URLS.map(url => fetch(url, { cache: 'no-store' }).then(r => r.ok ? r.text() : ''))
  ).then(results => {
    const parts = results
      .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled' && !!r.value)
      .map(r => r.value)
    if (parts.length === 0) return

    window.setTimeout(() => {
      const raw = parts.join('\n')
      const deduped = [...new Set(raw.split('\n'))].join('\n')
      try {
        localStorage.setItem(SKILL_LIBRARY_KEY, JSON.stringify({ content: deduped, fetchedAt: Date.now() }))
      } catch { /* storage full */ }
    }, 0)
  })
}

function App() {
  const user = useAppStore(s => s.user)
  const setUser = useAppStore(s => s.setUser)
  const initStore = useAppStore(s => s.init)
  const isInitializing = useAppStore(s => s.isInitializing)
  const isInitialized = useAppStore(s => s.isInitialized)
  const startN8nStatusPolling = useAppStore(s => s.startN8nStatusPolling)
  const stopN8nStatusPolling = useAppStore(s => s.stopN8nStatusPolling)
  const [onboardingDone, setOnboardingDone] = useState(isOnboardingComplete)
  const [showTutorial, setShowTutorial] = useState(false)
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    applyThemeClass(getStoredTheme())
  }, [])

  useEffect(() => {
    initStore()
  }, [initStore])

  // Fetch skill library once on startup (cached for 24h)
  useEffect(() => {
    refreshSkillLibrary()
  }, [])

  useEffect(() => {
    startN8nStatusPolling()
    return () => {
      stopN8nStatusPolling()
    }
  }, [startN8nStatusPolling, stopN8nStatusPolling])

  useEffect(() => {
    let isActive = true
    let cleanup: (() => void) | undefined

    const isTauri = '__TAURI_INTERNALS__' in window
    if (!isTauri) return

    void onOpenUrl((urls) => {
      for (const url of urls) {
        if (url.startsWith('drodo://auth/callback')) {
          const hash = url.split('#')[1]
          if (hash) {
            const params = new URLSearchParams(hash)
            const access_token = params.get('access_token')
            const refresh_token = params.get('refresh_token')
            if (access_token && refresh_token) {
              void supabase.auth.setSession({ access_token, refresh_token })
            }
          }
        }
      }
    }).then(unlisten => {
      if (!isActive) {
        unlisten()
        return
      }
      cleanup = unlisten
    })

    return () => {
      isActive = false
      cleanup?.()
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const sessionTimeout = new Promise<null>(resolve => {
      window.setTimeout(() => resolve(null), SESSION_INIT_TIMEOUT_MS)
    })

    void Promise.race([getSession(), sessionTimeout])
      .then(result => {
        if (!mounted) return
        if (result === null) {
          console.warn('Session initialization timed out. Continuing without a restored session.')
          setUser(null)
          return
        }
        setUser(result.data.session?.user ?? null)
      })
      .catch(error => {
        console.error('Session initialization failed. Continuing without a restored session.', error)
        if (mounted) setUser(null)
      })
      .finally(() => {
        if (mounted) setAuthReady(true)
      })

    const { data } = onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)

      if (event === 'SIGNED_IN' && session?.user?.id) {
        await syncUserData(session.user.id).catch(error => {
          console.error('Failed to sync user data to Supabase.', error)
        })
      }
    })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [setUser])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdPaletteOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (!authReady) return

    void checkForUpdates()
  }, [authReady])

  useEffect(() => {
    if (!authReady) return

    startBotPolling(() => useAppStore.getState().activeProvider)
    return () => {
      stopBotPolling()
    }
  }, [authReady])

  const skipAuth = localStorage.getItem('drodo_skip_auth') === 'true'

  const authPending = !authReady && !skipAuth
  let content: ReactNode

  if (!isInitialized || isInitializing) {
    content = <LoadingShell label="Loading chats…" />
  } else if (!user && !skipAuth && authReady) {
    content = <SafeAuthView />
  } else if (!onboardingDone) {
    content = (
      <SafeOnboardingScreen
        onComplete={() => {
          setOnboardingDone(true)
          if (!isTutorialComplete()) {
            setTimeout(() => setShowTutorial(true), 500)
          }
        }}
      />
    )
  } else {
    content = <MainContent />
  }

  return (
    <div
      className="app-shell"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      <div className="app-shell__sidebar">
        <Sidebar />
      </div>

      <div className="app-shell__main">
        <TopBar />
        {authPending && (
          <div
            className="flex items-center gap-2 px-5 py-2 text-xs"
            style={{ background: '#7f77dd12', color: '#a09ae8', borderBottom: '1px solid #7f77dd22' }}
          >
            <Loader2 size={12} className="animate-spin" style={{ color: '#7f77dd' }} />
            Restoring your session in the background…
          </div>
        )}
        <main className="app-shell__content flex-1 min-w-0 overflow-auto">
          {content}
        </main>
      </div>

      <ProviderHubModal />
      <PermissionWarningModal />
      <CommandPalette open={cmdPaletteOpen} onClose={() => setCmdPaletteOpen(false)} />
      {showTutorial && <Tutorial onComplete={() => setShowTutorial(false)} />}
    </div>
  )
}

export default App
