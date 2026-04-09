import { useEffect, useState } from 'react'
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
import { LoadingSpinner } from './components/ui/LoadingSpinner'
import { applyThemeClass, getStoredTheme } from './lib/theme'
import { getSession, onAuthStateChange } from './lib/auth'
import { supabase } from './lib/supabase'
import { syncUserData } from './lib/syncToSupabase'
import { startBotPolling, stopBotPolling } from './lib/botRunner'

function AgentWorkspace() {
  return (
    <div className="app-shell__content flex min-w-0 min-h-0 flex-1 overflow-hidden flex-col lg:flex-row">
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
    // Deduplicate lines
    const raw = parts.join('\n')
    const deduped = [...new Set(raw.split('\n'))].join('\n')
    try {
      localStorage.setItem(SKILL_LIBRARY_KEY, JSON.stringify({ content: deduped, fetchedAt: Date.now() }))
    } catch { /* storage full */ }
  })
}

function App() {
  const user = useAppStore(s => s.user)
  const setUser = useAppStore(s => s.setUser)
  const startN8nStatusPolling = useAppStore(s => s.startN8nStatusPolling)
  const stopN8nStatusPolling = useAppStore(s => s.stopN8nStatusPolling)
  const [onboardingDone, setOnboardingDone] = useState(isOnboardingComplete)
  const [showTutorial, setShowTutorial] = useState(false)
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    applyThemeClass(getStoredTheme())
  }, [])

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

    void getSession()
      .then(({ data }) => {
        if (!mounted) return
        setUser(data.session?.user ?? null)
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
    // void checkForUpdates() — disabled until updater pubkey is configured
  }, [authReady])

  useEffect(() => {
    if (!authReady) return

    startBotPolling(() => useAppStore.getState().activeProvider)
    return () => {
      stopBotPolling()
    }
  }, [authReady])

  const skipAuth = localStorage.getItem('drodo_skip_auth') === 'true'

  if (!authReady) {
    return (
      <div
        className="app-shell flex items-center justify-center"
        style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
      >
        <LoadingSpinner label="Loading session…" />
      </div>
    )
  }

  if (!user && !skipAuth) {
    return <SafeAuthView />
  }

  if (!onboardingDone) {
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
          <main className="app-shell__content">
            <SafeOnboardingScreen
              onComplete={() => {
                setOnboardingDone(true)
                if (!isTutorialComplete()) {
                  setTimeout(() => setShowTutorial(true), 500)
                }
              }}
            />
          </main>
        </div>
        <ProviderHubModal />
        <PermissionWarningModal />
        <CommandPalette open={cmdPaletteOpen} onClose={() => setCmdPaletteOpen(false)} />
      </div>
    )
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
        <main className="app-shell__content">
          <MainContent />
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
