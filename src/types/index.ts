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
  | 'templates'
  | 'prompts'
  | 'automations'
  | 'messaging'

export interface Provider {
  id: string
  name: string
  baseUrl: string
  apiKey?: string
  model?: string
  displayName?: string
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
  orchestrationStepIndex?: number
}

export interface OrchestrationStep {
  id: string
  templateName: string
  templateTask: string
  model: string
  specificTask: string
  dependsOnStep?: string
  outputVar: string
  systemPrompt?: string
  skills?: string[]
}

export interface OrchestrationPlan {
  taskSummary: string
  agents: OrchestrationStep[]
}

export interface OrchestrationRun {
  id: string
  originalTask: string
  plan: OrchestrationPlan
  status: 'planning' | 'running' | 'complete' | 'error'
  stepOutputs: Record<string, string>
  startedAt: Date
  finishedAt?: Date
}

export interface SwarmFeedEntry {
  id: string
  stepId?: string
  agentName: string
  type: 'start' | 'chunk' | 'complete' | 'summary' | 'error'
  content: string
  timestamp: Date
}

export interface Attachment {
  path: string
  name: string
  content: string
  binary?: boolean
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  streaming?: boolean
  attachments?: Attachment[]
}

export interface Session {
  id: string
  name: string
  createdAt: string
  messageCount: number
  model: string
  preview: string
}

export interface ChatSession {
  id: string
  name: string
  messages: Message[]
  providerId: string
  modelId: string
}

export type ProjectStatus = 'active' | 'paused' | 'complete'

export interface Project {
  id: string
  name: string
  description: string
  createdAt: string
  sessionsCount: number
  status: ProjectStatus
  agentCount: number
}

export interface MCPServer {
  id: string
  name: string
  url: string
  status: 'connected' | 'disconnected' | 'error'
  toolsCount: number
  description: string
  addedAt: string
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
  description?: string
  color: string
  initials: string
  isConnected: boolean
  requiresKey: boolean
  keyPlaceholder?: string
  helpUrl?: string
  helpText?: string
}

export interface Skill {
  id: string
  name: string
  description: string
  category: 'Engineering' | 'Business' | 'Creative' | 'Research' | 'DevOps' | 'Security' | 'Data' | 'General'
  tags: string[]
  source_repo: string
  capability_domains: string[]
  priority: number
  content: string
}
