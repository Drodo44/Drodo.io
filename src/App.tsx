import { useEffect, useState } from 'react'
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
import { AuthView } from './views/AuthView'
import { OnboardingScreen, isOnboardingComplete } from './components/Onboarding'
import { ProviderHubModal } from './components/modals/ProviderHubModal'
import { PermissionWarningModal } from './components/modals/PermissionWarningModal'
import { CommandPalette } from './components/ui/CommandPalette'
import { withErrorBoundary } from './components/ui/ErrorBoundary'
import { LoadingSpinner } from './components/ui/LoadingSpinner'
import { applyThemeClass, getStoredTheme } from './lib/theme'
import { getSession, onAuthStateChange } from './lib/auth'
import { syncUserData } from './lib/syncToSupabase'
import { checkForUpdates } from './lib/updater'

function AgentWorkspace() {
  return (
    <>
      <ChatPanel />
      <RightPanel />
    </>
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
  return null
}

function App() {
  const user = useAppStore(s => s.user)
  const setUser = useAppStore(s => s.setUser)
  const [onboardingDone, setOnboardingDone] = useState(isOnboardingComplete)
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    applyThemeClass(getStoredTheme())
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
    void checkForUpdates()
  }, [authReady])

  const skipAuth = localStorage.getItem('drodo_skip_auth') === 'true'

  if (!authReady) {
    return (
      <div
        className="flex h-screen w-screen items-center justify-center"
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
        className="flex h-screen w-screen overflow-hidden"
        style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
      >
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          <TopBar />
          <main className="flex flex-1 min-h-0 overflow-hidden">
            <SafeOnboardingScreen onComplete={() => setOnboardingDone(true)} />
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
      className="flex h-screen w-screen overflow-hidden"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 min-h-0">
        <TopBar />
        <main className="flex flex-1 min-h-0 overflow-hidden">
          <MainContent />
        </main>
      </div>

      <ProviderHubModal />
      <PermissionWarningModal />
      <CommandPalette open={cmdPaletteOpen} onClose={() => setCmdPaletteOpen(false)} />
    </div>
  )
}

export default App
