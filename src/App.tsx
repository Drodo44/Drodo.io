import { useState, useEffect } from 'react'
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
import { OnboardingScreen, isOnboardingComplete } from './components/Onboarding'
import { ProviderHubModal } from './components/modals/ProviderHubModal'
import { PermissionWarningModal } from './components/modals/PermissionWarningModal'
import { CommandPalette } from './components/ui/CommandPalette'

function MainContent() {
  const activeView = useAppStore(s => s.activeView)

  if (activeView === 'agent') {
    return (
      <>
        <ChatPanel />
        <RightPanel />
      </>
    )
  }
  if (activeView === 'swarm') return <AgentSwarmView />
  if (activeView === 'projects') return <ProjectsView />
  if (activeView === 'sessions') return <SessionsView />
  if (activeView === 'files') return <FilesView />
  if (activeView === 'mcp') return <MCPServersView />
  if (activeView === 'skills') return <SkillsView />
  if (activeView === 'workflows') return <WorkflowsView />
  if (activeView === 'analytics') return <AnalyticsView />
  if (activeView === 'connections') return <ConnectionsView />
  if (activeView === 'settings') return <SettingsView />
  if (activeView === 'templates') return <AgentTemplatesView />
  if (activeView === 'prompts') return <PromptLibraryView />
  return null
}

function App() {
  const [onboardingDone, setOnboardingDone] = useState(isOnboardingComplete)
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false)

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

  if (!onboardingDone) {
    return (
      <div
        className="flex h-screen w-screen overflow-hidden"
        style={{ background: '#0d0d0f', color: '#e8e8ef' }}
      >
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          <TopBar />
          <main className="flex flex-1 min-h-0 overflow-hidden">
            <OnboardingScreen onComplete={() => setOnboardingDone(true)} />
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
      style={{ background: '#0d0d0f', color: '#e8e8ef' }}
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
