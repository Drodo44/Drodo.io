export type PermissionTier = 'sandboxed' | 'standard' | 'wide-open'
export type AgentStatus = 'idle' | 'running' | 'complete' | 'error'
export type NavView =
  | 'agent'
  | 'projects'
  | 'sessions'
  | 'files'
  | 'mcp'
  | 'skills'
  | 'workflows'
  | 'analytics'
  | 'swarm'

export interface Provider {
  id: string
  name: string
  baseUrl: string
  apiKey?: string
  model?: string
  isLocal?: boolean
  isConnected?: boolean
  color: string
  initials: string
}

export interface AgentInstance {
  id: string
  name: string
  model: string
  task: string
  status: AgentStatus
  tokens: number
  startedAt?: Date
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  streaming?: boolean
}

export interface Session {
  id: string
  name: string
  createdAt: Date
  messageCount: number
  model: string
}

export interface Project {
  id: string
  name: string
  description: string
  sessionsCount: number
  lastActivity: Date
  status: 'active' | 'paused' | 'complete'
}

export interface MCPServer {
  id: string
  name: string
  url: string
  status: 'connected' | 'disconnected' | 'error'
  toolsCount: number
}

export interface Workflow {
  id: string
  name: string
  trigger: string
  lastRun?: Date
  status: 'active' | 'inactive' | 'running'
  runsCount: number
}

export interface TaskStep {
  id: string
  label: string
  status: 'pending' | 'running' | 'complete' | 'error'
}

export type ConnectorCategory =
  | 'Social Media'
  | 'Productivity'
  | 'Development'
  | 'Automation'
  | 'E-commerce'
  | 'Media & Creative'
  | 'Communication'

export interface Connector {
  id: string
  name: string
  category: ConnectorCategory
  color: string
  initials: string
  isConnected: boolean
  requiresKey: boolean
  keyPlaceholder?: string
}
