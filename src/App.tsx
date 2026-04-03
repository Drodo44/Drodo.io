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
import { ProviderHubModal } from './components/modals/ProviderHubModal'
import { PermissionWarningModal } from './components/modals/PermissionWarningModal'

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
  return null
}

function App() {
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
    </div>
  )
}

export default App
