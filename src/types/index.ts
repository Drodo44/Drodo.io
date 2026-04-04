export type PermissionTier = 'sandboxed' | 'standard' | 'wide-open'
export type AgentStatus = 'idle' | 'running' | 'complete' | 'error'
export type ToolName = 'read_file' | 'write_file' | 'list_directory' | 'execute_command' | 'get_home_dir'
export type TerminalEntryType = 'info' | 'tool' | 'command' | 'output' | 'error'
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
  | 'connections'
  | 'settings'

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
  providerId: string
  providerName: string
  model: string
  task: string
  status: AgentStatus
  tokens: number
  lastUpdate?: string
  summary?: string
  context: Message[]
  toolCalls: number
  orchestrator?: boolean
  startedAtLabel?: string
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

export interface FileSystemEntry {
  name: string
  path: string
  isDirectory: boolean
  size?: number | null
  modifiedAt?: number | null
}

export interface CommandExecutionResult {
  command: string
  shell: string
  workingDirectory: string
  stdout: string
  stderr: string
  combined: string
  exitCode: number
  success: boolean
}

export interface ToolCall {
  tool: ToolName
  arguments: Record<string, unknown>
}

export interface ToolExecutionResult {
  tool: ToolName
  arguments: Record<string, unknown>
  summary: string
  contentForModel: string
  raw: unknown
}

export interface TerminalEntry {
  id: string
  type: TerminalEntryType
  title: string
  content: string
  timestamp: Date
  agentId?: string
  exitCode?: number
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
