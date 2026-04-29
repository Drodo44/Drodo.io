import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type {
  AgentInstance,
  Attachment,
  ChatSession,
  Message,
  NavView,
  OrchestrationRun,
  PermissionTier,
  Provider,
  SwarmFeedEntry,
  TaskStep,
  TerminalEntry,
} from '../types'
import { runAgentSession, type AgentRunHandle } from '../lib/agentRunner'
import { completeText, streamCompletion } from '../lib/streamChat'
import {
  buildProvider,
  getConnectedProviders,
  getAllSavedModels,
  getSavedModelDisplayName,
  loadAllSavedConfigs,
  routeModelForTask,
  saveProviderConfig,
} from '../lib/providerApi'
import { INITIAL_CONNECTORS } from '../lib/connectors'
import { executeCommand, getN8nStatus, readFile } from '../lib/tauri'
import { trackUsage, estimateCost } from '../lib/usageTracker'
import { notify } from '../lib/notifications'
import {
  getConversationMessageCount,
  getLatestConversationPreview,
  upsertSession,
} from '../lib/dashboardData'
import { buildOrchestrationPlan, runOrchestration } from '../lib/orchestrator'
import { AGENT_TEMPLATE_NAMES } from '../lib/agentTemplates'
import { ensureSkillsCatalogLoaded, getSkillsForTask } from '../lib/skills'
import { ensureWorkflowCatalogLoaded, findWorkflowForTask } from '../lib/workflows'
import {
  compressMemory,
  injectMemoryContext,
  initializeAgentMemory,
  writeMemoryEntry,
  type MemoryEntry,
} from '../lib/agentMemory'

let activePrimaryRun: AgentRunHandle | null = null
let autonomousLoopTimer: ReturnType<typeof setTimeout> | null = null
let n8nStatusPollTimer: ReturnType<typeof setInterval> | null = null
const activeSwarmRuns = new Map<string, AgentRunHandle>()
let activeOrchestrationAbort: { abort: () => void; runId: string; cancelled: boolean } | null = null
let storeInitStarted = false
const ORCHESTRATION_PLANNING_TIMEOUT_MS = 1_800_000
const SWARM_FEED_LIMIT = 50
const SWARM_FEED_CHUNK_LIMIT = 300
const SWARM_FEED_MESSAGE_LIMIT = 1200
const SWARM_STREAM_FLUSH_INTERVAL_MS = 250
const SWARM_MEMORY_FLUSH_INTERVAL_MS = 3000

type PendingSwarmStream = {
  agentId: string
  agentName: string
  stepId?: string
  total: string
  pending: string
}

const pendingSwarmStreams = new Map<string, PendingSwarmStream>()
let pendingSwarmFlushTimer: ReturnType<typeof setTimeout> | null = null
let latestAgentIndexes: AgentIndexes | undefined

type AgentPaletteItem = {
  id: string
  name: string
  status: AgentInstance['status']
}

type AgentIndexes = {
  agentIds: string[]
  agentsById: Record<string, AgentInstance>
  visibleAgentIds: string[]
  runningAgentCount: number
  totalAgentTokens: number
  agentPaletteItems: AgentPaletteItem[]
}

type MemoryObservationInput = Omit<MemoryEntry, 'id' | 'timestamp'> & Partial<Pick<MemoryEntry, 'id' | 'timestamp'>>

type PendingMemoryObservation = Omit<MemoryObservationInput, 'content'> & {
  content: string
  timer: ReturnType<typeof setTimeout> | null
}

const pendingMemoryObservations = new Map<string, PendingMemoryObservation>()

function clearN8nStatusPollTimer() {
  if (n8nStatusPollTimer) {
    clearInterval(n8nStatusPollTimer)
    n8nStatusPollTimer = null
  }
}

function sameStringArray(left: string[] | undefined, right: string[]): boolean {
  if (!left || left.length !== right.length) return false
  return left.every((value, index) => value === right[index])
}

function sameAgentPaletteItems(left: AgentPaletteItem[] | undefined, right: AgentPaletteItem[]): boolean {
  if (!left || left.length !== right.length) return false
  return left.every((value, index) => {
    const next = right[index]
    return value.id === next.id && value.name === next.name && value.status === next.status
  })
}

function buildAgentIndexes(agents: AgentInstance[], previous: Partial<AgentIndexes> | undefined = latestAgentIndexes): AgentIndexes {
  const agentsById: Record<string, AgentInstance> = {}
  let runningAgentCount = 0
  let totalAgentTokens = 0
  const agentIds: string[] = []
  const visibleAgentIds: string[] = []
  const agentPaletteItems: AgentPaletteItem[] = []

  for (const agent of agents) {
    agentIds.push(agent.id)
    agentsById[agent.id] = agent
    totalAgentTokens += agent.tokens
    if (agent.status === 'running') runningAgentCount += 1
    if (!agent.orchestrator) visibleAgentIds.push(agent.id)
    agentPaletteItems.push({ id: agent.id, name: agent.name, status: agent.status })
  }

  const indexes = {
    agentIds: sameStringArray(previous?.agentIds, agentIds) ? previous!.agentIds! : agentIds,
    agentsById,
    visibleAgentIds: sameStringArray(previous?.visibleAgentIds, visibleAgentIds) ? previous!.visibleAgentIds! : visibleAgentIds,
    runningAgentCount,
    totalAgentTokens,
    agentPaletteItems: sameAgentPaletteItems(previous?.agentPaletteItems, agentPaletteItems)
      ? previous!.agentPaletteItems!
      : agentPaletteItems,
  }
  latestAgentIndexes = indexes
  return indexes
}

function flushMemoryObservation(agentId: string): void {
  const pending = pendingMemoryObservations.get(agentId)
  if (!pending) return
  if (pending.timer) clearTimeout(pending.timer)
  pendingMemoryObservations.delete(agentId)
  const { timer: _timer, ...entry } = pending
  void writeMemoryEntry(entry)
}

function queueMemoryObservation(entry: MemoryObservationInput): void {
  const existing = pendingMemoryObservations.get(entry.agent_id)
  if (existing) {
    existing.content += entry.content
    return
  }

  const pending: PendingMemoryObservation = {
    ...entry,
    content: entry.content,
    timer: null,
  }
  pending.timer = setTimeout(() => flushMemoryObservation(entry.agent_id), SWARM_MEMORY_FLUSH_INTERVAL_MS)
  pendingMemoryObservations.set(entry.agent_id, pending)
}

// ─── Chat session persistence ─────────────────────────────────────────────────

const CHAT_SESSIONS_KEY = 'drodo_chat_sessions'
const ACTIVE_CHAT_SESSION_KEY = 'drodo_active_chat_session'

function reviveMessages(raw: unknown[]): Message[] {
  return (raw ?? []).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
}

function persistChatSessions(sessions: ChatSession[], activeId: string): void {
  try {
    localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sessions))
    localStorage.setItem(ACTIVE_CHAT_SESSION_KEY, activeId)
  } catch { /* storage full */ }
}

function loadPersistedChatSessions(): { sessions: ChatSession[]; activeId: string } {
  try {
    const raw = localStorage.getItem(CHAT_SESSIONS_KEY)
    const activeId = localStorage.getItem(ACTIVE_CHAT_SESSION_KEY) ?? ''
    if (!raw) return { sessions: [], activeId }
    const parsed = JSON.parse(raw) as ChatSession[]
    const sessions = parsed.map(s => ({ ...s, messages: reviveMessages(s.messages) }))
    return { sessions, activeId }
  } catch {
    return { sessions: [], activeId: '' }
  }
}

const DONE_PHRASES = [
  'task complete',
  'task is complete',
  'all done',
  "that's everything",
  'work is complete',
  'finished',
  'completed successfully',
  'done.',
  'all steps complete',
  'implementation complete',
  "i've finished",
]

const DRODO_IDENTITY_PROMPT = 'You are Drodo, an AI agent platform built by Drodo. Do not identify yourself as any specific AI model or company. You are Drodo.'
const DEFAULT_PROVIDER: Provider = {
  id: 'anthropic',
  name: 'Anthropic',
  baseUrl: 'api.anthropic.com',
  model: 'claude-sonnet-4-6',
  apiKey: '',
  color: '#cc785c',
  initials: 'AN',
  isConnected: false,
}
const DEFAULT_MESSAGES = [createMessage('system', 'Session started. Drodo is ready.')]

const INITIAL_TASK_STEPS: TaskStep[] = [
  { id: 'plan', label: 'Analyze request', status: 'pending' },
  { id: 'tools', label: 'Use tools if needed', status: 'pending' },
  { id: 'respond', label: 'Write response', status: 'pending' },
]

function looksComplete(text: string): boolean {
  const lower = text.toLowerCase()
  return DONE_PHRASES.some(phrase => lower.includes(phrase))
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function buildAttachmentSummary(attachments: Attachment[]): string {
  if (attachments.length === 0) return ''
  if (attachments.length === 1) return `Attached ${attachments[0].name}`
  return `Attached ${attachments.length} files: ${attachments.map(attachment => attachment.name).join(', ')}`
}

function summarizeUserTurn(content: string, attachments: Attachment[]): string {
  const trimmed = content.trim()
  const attachmentSummary = buildAttachmentSummary(attachments)
  if (!trimmed) return attachmentSummary
  if (attachments.length === 0 || trimmed === attachmentSummary) return trimmed
  return `${trimmed}\n\n${attachmentSummary}`
}

function attachmentToPromptBlock(attachment: Attachment): string {
  if (attachment.binary) {
    return `[File: ${attachment.name} (binary, not included)]`
  }

  return `[File: ${attachment.name}]\n${attachment.content}`
}

function isAbortError(error: unknown): boolean {
  return (error as { name?: string } | null)?.name === 'AbortError'
}

function summarizeOrchestrationResult(run: OrchestrationRun): string {
  const agentCount = run.plan.agents.length
  const agentNames = run.plan.agents.map(agent => agent.templateName).join(', ')
  const agentLabel = agentCount === 1 ? 'agent' : 'agents'
  const ranLine = agentNames
    ? `✅ Task complete — ${agentCount} ${agentLabel} ran (${agentNames}).`
    : `✅ Task complete — ${agentCount} ${agentLabel} ran.`

  return `${ranLine}\n\nSee the Agent Swarm tab for full output and details.`
}

function serializeMessageForModel(message: Message): Message {
  if (!message.attachments || message.attachments.length === 0) return message

  const attachmentSummary = buildAttachmentSummary(message.attachments)
  const promptSections = [
    message.content.trim() === attachmentSummary ? '' : message.content.trim(),
    ...message.attachments.map(attachmentToPromptBlock),
  ].filter(section => section.length > 0)

  return {
    ...message,
    content: promptSections.join('\n\n'),
  }
}

function createMessage(role: Message['role'], content: string, attachments?: Attachment[]): Message {
  return {
    id: createId(role),
    role,
    content,
    timestamp: new Date(),
    attachments,
  }
}

function createTaskSteps(): TaskStep[] {
  return INITIAL_TASK_STEPS.map(step => ({ ...step }))
}

function createSessionId(): string {
  return crypto.randomUUID()
}

function createDefaultChatState(provider: Provider = DEFAULT_PROVIDER): {
  chatSessions: ChatSession[]
  activeChatSessionId: string
  messages: Message[]
  activeProvider: Provider
} {
  const session: ChatSession = {
    id: createSessionId(),
    name: 'Chat 1',
    messages: DEFAULT_MESSAGES,
    providerId: provider.id,
    modelId: provider.model ?? '',
  }

  return {
    chatSessions: [session],
    activeChatSessionId: session.id,
    messages: session.messages,
    activeProvider: provider,
  }
}

function updateTaskStep(steps: TaskStep[], id: TaskStep['id'], status: TaskStep['status']): TaskStep[] {
  return steps.map(step => (step.id === id ? { ...step, status } : step))
}

function detectLanguage(pathOrLabel: string): string {
  const lower = pathOrLabel.toLowerCase()
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'typescript'
  if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) return 'javascript'
  if (lower.endsWith('.json')) return 'json'
  if (lower.endsWith('.rs')) return 'rust'
  if (lower.endsWith('.md')) return 'markdown'
  if (lower.endsWith('.css')) return 'css'
  if (lower.endsWith('.html')) return 'xml'
  if (lower.endsWith('.sh') || lower.endsWith('.bash')) return 'shell'
  if (lower.endsWith('.ps1') || lower.includes('powershell')) return 'powershell'
  return 'plaintext'
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4))
}

function createTerminalEntry(
  type: TerminalEntry['type'],
  title: string,
  content: string,
  agentId?: string,
  exitCode?: number
): TerminalEntry {
  return {
    id: createId('terminal'),
    type,
    title,
    content,
    timestamp: new Date(),
    agentId,
    exitCode,
  }
}

function pushRecentPath(paths: string[], next: string): string[] {
  if (!next) return paths
  return [next, ...paths.filter(path => path !== next)].slice(0, 12)
}

function persistSessionSnapshot(
  sessionId: string,
  sessionName: string,
  provider: Provider,
  messages: Message[],
  modelOverride?: string,
): void {
  upsertSession({
    id: sessionId,
    name: sessionName,
    createdAt: new Date().toISOString(),
    messageCount: getConversationMessageCount(messages),
    model: modelOverride ?? provider.model ?? provider.name,
    preview: getLatestConversationPreview(messages),
  })
}

function loadConnectors() {
  try {
    const saved = localStorage.getItem('drodo_connectors')
    if (!saved) return INITIAL_CONNECTORS
    const savedMap: Record<string, boolean> = JSON.parse(saved)
    return INITIAL_CONNECTORS.map(connector => ({
      ...connector,
      isConnected: savedMap[connector.id] ?? false,
    }))
  } catch {
    return INITIAL_CONNECTORS
  }
}

function buildDefaultProvider(): Provider {
  // Prefer the first provider the user has explicitly saved a config for
  const saved = loadAllSavedConfigs()
  for (const id of Object.keys(saved)) {
    const p = buildProvider(id)
    if (p) return p
  }
  return (
    buildProvider('anthropic') ?? {
      id: 'anthropic',
      name: 'Anthropic',
      baseUrl: 'api.anthropic.com',
      model: 'claude-sonnet-4-6',
      apiKey: '',
      color: '#cc785c',
      initials: 'AN',
      isConnected: false,
    }
  )
}

function initChatSessions(defaultProvider: Provider, defaultMessages: Message[]): {
  chatSessions: ChatSession[]
  activeChatSessionId: string
  messages: Message[]
  activeProvider: Provider
} {
  const { sessions, activeId } = loadPersistedChatSessions()

  if (sessions.length > 0) {
    const validActiveId = sessions.some(s => s.id === activeId) ? activeId : sessions[0].id
    const activeSession = sessions.find(s => s.id === validActiveId)!
    const sessionProvider = buildProvider(activeSession.providerId)
    const resolvedProvider = sessionProvider
      ? {
          ...sessionProvider,
          model: activeSession.modelId || sessionProvider.model,
          displayName: getSavedModelDisplayName(activeSession.providerId, activeSession.modelId || sessionProvider.model),
        }
      : defaultProvider
    return { chatSessions: sessions, activeChatSessionId: validActiveId, messages: activeSession.messages, activeProvider: resolvedProvider }
  }

  const session: ChatSession = {
    id: createSessionId(),
    name: 'Chat 1',
    messages: defaultMessages,
    providerId: defaultProvider.id,
    modelId: defaultProvider.model ?? '',
  }
  return { chatSessions: [session], activeChatSessionId: session.id, messages: defaultMessages, activeProvider: defaultProvider }
}

function selectProvider(preferredId: string | undefined, activeProvider: Provider, index: number): Provider {
  if (preferredId) {
    return buildProvider(preferredId) ?? activeProvider
  }

  const connected = getConnectedProviders()
  if (connected.length === 0) return activeProvider
  return connected[index % connected.length]
}

function resolveProviderForModel(model: string | undefined, fallback: Provider): Provider {
  if (!model) return fallback

  const explicit = model.includes('::') ? model.split('::') : []
  if (explicit.length === 2) {
    const [providerId, modelId] = explicit
    const provider = buildProvider(providerId)
    if (provider) {
      return { ...provider, model: modelId }
    }
  }

  const match = getAllSavedModels().find(entry => (
    entry.model.id === model ||
    entry.model.label === model ||
    `${entry.providerId}::${entry.model.id}` === model
  ))
  if (!match) return { ...fallback, model }

  const provider = buildProvider(match.providerId)
  if (!provider) return { ...fallback, model }

  return {
    ...provider,
    model: match.model.id,
  }
}

function fallbackSubtasks(goal: string) {
  return [
    { name: 'Planner', task: `Inspect the workspace and outline the implementation plan for: ${goal}` },
    { name: 'Builder', task: `Implement the highest-value changes needed to complete: ${goal}` },
    { name: 'Verifier', task: `Run checks and identify remaining issues for: ${goal}` },
  ]
}

let agentCounter = 1

function truncateSwarmContent(type: SwarmFeedEntry['type'], content: string): string {
  const limit = type === 'chunk' ? SWARM_FEED_CHUNK_LIMIT : SWARM_FEED_MESSAGE_LIMIT
  return content.length > limit ? `${content.slice(0, limit)}…` : content
}

function pushSwarmFeed(
  feed: SwarmFeedEntry[],
  next: SwarmFeedEntry,
): SwarmFeedEntry[] {
  return [
    ...feed,
    {
      ...next,
      content: truncateSwarmContent(next.type, next.content),
    },
  ].slice(-SWARM_FEED_LIMIT)
}

function upsertSwarmFeed(
  feed: SwarmFeedEntry[],
  next: SwarmFeedEntry,
): SwarmFeedEntry[] {
  if (next.agentId) {
    const existingIndex = feed.findIndex(entry => entry.agentId === next.agentId)
    if (existingIndex >= 0) {
      const updated = [...feed]
      updated[existingIndex] = {
        ...updated[existingIndex],
        ...next,
        id: updated[existingIndex].id,
        content: truncateSwarmContent(next.type, next.content),
      }
      return updated
    }
  }
  return pushSwarmFeed(feed, next)
}

function extractReadableChunk(buffer: string, force = false): { emit: string; rest: string } {
  if (!buffer) return { emit: '', rest: '' }
  if (force) return { emit: buffer, rest: '' }

  const paragraphBreak = buffer.lastIndexOf('\n\n')
  if (paragraphBreak >= 0) {
    const boundary = paragraphBreak + 2
    return { emit: buffer.slice(0, boundary), rest: buffer.slice(boundary) }
  }

  let sentenceBoundary = -1
  for (let i = buffer.length - 1; i >= 1; i -= 1) {
    const ch = buffer[i]
    const prev = buffer[i - 1]
    if ((ch === ' ' || ch === '\n') && (prev === '.' || prev === '!' || prev === '?')) {
      sentenceBoundary = i
      break
    }
  }
  if (sentenceBoundary > 0) {
    return { emit: buffer.slice(0, sentenceBoundary), rest: buffer.slice(sentenceBoundary) }
  }

  // Avoid indefinitely holding content if punctuation is sparse.
  if (buffer.length >= 240) {
    return { emit: buffer, rest: '' }
  }

  return { emit: '', rest: buffer }
}

async function buildWorkflowHint(task: string): Promise<string> {
  await ensureWorkflowCatalogLoaded()
  const workflowMatch = findWorkflowForTask(task)
  if (!workflowMatch || workflowMatch.confidence <= 0.7) return ''

  return [
    '## Workflow Hint',
    `Matched workflow: ${workflowMatch.workflow.name}`,
    `Category: ${workflowMatch.workflow.category}`,
    `Required services: ${workflowMatch.workflow.required_services.join(', ') || 'None listed'}`,
    `Template file: ${workflowMatch.filePath}`,
  ].join('\n')
}

async function buildAgentSystemPrompt(task: string, basePrompt: string): Promise<string> {
  await ensureSkillsCatalogLoaded()
  const memoryPrompt = injectMemoryContext(task)
  const skillPrompt = await getSkillsForTask(task)
  const workflowPrompt = await buildWorkflowHint(task)

  return [memoryPrompt, skillPrompt, basePrompt, workflowPrompt]
    .filter(section => section.trim().length > 0)
    .join('\n\n')
}

interface AppState {
  isInitializing: boolean
  isInitialized: boolean
  activeView: NavView
  user: any | null
  sessionId: string
  sessionName: string
  agentRunning: boolean
  permissionTier: PermissionTier
  pendingTier: PermissionTier | null
  permissionWarningOpen: boolean
  autonomousMode: boolean
  autonomousLoopActive: boolean
  autonomousLoopCount: number
  autonomousMaxLoops: number
  activeProvider: Provider
  providerHubOpen: boolean
  messages: Message[]
  agents: AgentInstance[]
  agentIds: string[]
  agentsById: Record<string, AgentInstance>
  visibleAgentIds: string[]
  runningAgentCount: number
  totalAgentTokens: number
  agentPaletteItems: AgentPaletteItem[]
  taskSteps: TaskStep[]
  connectors: ReturnType<typeof loadConnectors>
  terminalEntries: TerminalEntry[]
  liveOutputTitle: string
  liveOutputContent: string
  liveOutputLanguage: string
  activeDocumentPath: string | null
  activeDocumentLoading: boolean
  recentPaths: string[]
  swarmGoal: string
  swarmRunning: boolean
  chatDraft: string
  chatDraftBySession: Record<string, string>
  multiAgentMode: boolean
  orchestrationRun: OrchestrationRun | null
  swarmFeed: SwarmFeedEntry[]
  chatSessions: ChatSession[]
  activeChatSessionId: string
  n8nReady: boolean
  n8nUrl: string

  init: () => void
  setView: (view: NavView) => void
  setUser: (user: any | null) => void
  startNewSession: () => void
  setSessionName: (name: string) => void
  toggleAgentRunning: () => void
  setPermission: (tier: PermissionTier) => void
  setPendingTier: (tier: PermissionTier | null) => void
  setPermissionWarningOpen: (open: boolean) => void
  confirmPermission: () => void
  toggleAutonomous: () => void
  setActiveProvider: (provider: Provider) => void
  setProviderHubOpen: (open: boolean) => void
  addMessage: (message: Message) => void
  sendMessage: (content: string, attachments?: Attachment[]) => void
  stopAll: () => void
  spawnAgent: (task?: string, providerId?: string, name?: string, model?: string, systemPrompt?: string) => Promise<void>
  launchSwarm: (goal?: string) => Promise<void>
  stopAgent: (id: string) => void
  setConnectorConnected: (id: string, connected: boolean) => void
  openDocument: (path: string) => Promise<void>
  setLiveOutput: (title: string, content: string, language?: string) => void
  runManualCommand: (command: string) => Promise<void>
  clearTerminal: () => void
  setSwarmGoal: (goal: string) => void
  setChatDraft: (draft: string) => void
  clearSwarmFeed: () => void
  toggleMultiAgentMode: () => void
  setOrchestrationRun: (run: OrchestrationRun | null) => void
  startOrchestration: (task: string) => Promise<void>
  createChatSession: () => void
  switchChatSession: (id: string) => void
  closeChatSession: (id: string) => void
  renameChatSession: (id: string, name: string) => void
  setSessionModel: (providerId: string, modelId: string) => void
  refreshN8nStatus: () => Promise<void>
  startN8nStatusPolling: () => void
  stopN8nStatusPolling: () => void
}

const _chatInit = createDefaultChatState()

export const useAppStore = create<AppState>((set, get) => {
  const flushPendingSwarmStreams = (force = false) => {
    if (pendingSwarmStreams.size === 0) return
    const updates: Array<{
      agentId: string
      agentName: string
      stepId?: string
      content: string
      tokens: number
      lastUpdate: string
    }> = []

    for (const [agentId, state] of pendingSwarmStreams.entries()) {
      const { emit, rest } = extractReadableChunk(state.pending, force)
      if (!emit && !force) continue

      const nextTotal = state.total + emit
      const nextPending = force ? '' : rest
      const nextLastLine = (nextTotal.slice(-120) || state.agentName).trim()
      updates.push({
        agentId,
        agentName: state.agentName,
        stepId: state.stepId,
        content: nextTotal,
        tokens: estimateTokens(nextTotal),
        lastUpdate: nextLastLine,
      })

      if (nextPending.length > 0) {
        pendingSwarmStreams.set(agentId, { ...state, total: nextTotal, pending: nextPending })
      } else {
        pendingSwarmStreams.delete(agentId)
      }
    }

    if (updates.length === 0) return

    set(current => {
      const updatesById = new Map(updates.map(update => [update.agentId, update]))
      const agents = current.agents.map(agent => {
        const update = updatesById.get(agent.id)
        if (!update) return agent
        return { ...agent, tokens: update.tokens, lastUpdate: update.lastUpdate }
      })

      return {
        agents,
        ...buildAgentIndexes(agents),
        swarmFeed: updates.reduce((feed, update) => upsertSwarmFeed(feed, {
          id: createId('swarm-feed'),
          agentId: update.agentId,
          stepId: update.stepId,
          agentName: update.agentName,
          type: 'chunk',
          content: update.content,
          timestamp: new Date(),
        }), current.swarmFeed),
      }
    })
  }

  const scheduleSwarmStreamFlush = () => {
    if (pendingSwarmFlushTimer) return
    pendingSwarmFlushTimer = setTimeout(() => {
      pendingSwarmFlushTimer = null
      flushPendingSwarmStreams(false)
      if (pendingSwarmStreams.size > 0) {
        scheduleSwarmStreamFlush()
      }
    }, SWARM_STREAM_FLUSH_INTERVAL_MS)
  }

  return ({
  isInitializing: true,
  isInitialized: false,
  activeView: 'agent',
  user: null,
  sessionId: _chatInit.activeChatSessionId,
  sessionName: _chatInit.chatSessions.find(s => s.id === _chatInit.activeChatSessionId)?.name ?? 'Chat 1',
  agentRunning: false,
  permissionTier: 'standard',
  pendingTier: null,
  permissionWarningOpen: false,
  autonomousMode: false,
  autonomousLoopActive: false,
  autonomousLoopCount: 0,
  autonomousMaxLoops: 6,
  activeProvider: _chatInit.activeProvider,
  providerHubOpen: false,
  messages: _chatInit.messages,
  agents: [],
  ...buildAgentIndexes([]),
  taskSteps: createTaskSteps(),
  connectors: loadConnectors(),
  terminalEntries: [
    createTerminalEntry('info', 'Drodo ready', 'Terminal activity, agent tool calls, and command output will appear here.'),
  ],
  liveOutputTitle: 'Live Output',
  liveOutputContent: '// Live output will appear here when files are opened or tools run.',
  liveOutputLanguage: 'typescript',
  activeDocumentPath: null,
  activeDocumentLoading: false,
  recentPaths: [],
  swarmGoal: '',
  swarmRunning: false,
  chatDraft: '',
  chatDraftBySession: { [_chatInit.activeChatSessionId]: '' },
  multiAgentMode: false,
  orchestrationRun: null,
  swarmFeed: [],
  chatSessions: _chatInit.chatSessions,
  activeChatSessionId: _chatInit.activeChatSessionId,
  n8nReady: false,
  n8nUrl: 'http://localhost:5678',

  init: () => {
    if (storeInitStarted) return
    storeInitStarted = true

    void Promise.resolve().then(() => {
      const defaultProvider = buildDefaultProvider()
      const hydrated = initChatSessions(defaultProvider, DEFAULT_MESSAGES)
      const sessionName =
        hydrated.chatSessions.find(session => session.id === hydrated.activeChatSessionId)?.name
        ?? 'Chat 1'
      const nextDraft = get().chatDraftBySession[hydrated.activeChatSessionId] ?? ''

      set({
        isInitializing: false,
        isInitialized: true,
        activeProvider: hydrated.activeProvider,
        messages: hydrated.messages,
        chatSessions: hydrated.chatSessions,
        activeChatSessionId: hydrated.activeChatSessionId,
        sessionId: hydrated.activeChatSessionId,
        sessionName,
        chatDraft: nextDraft,
        chatDraftBySession: {
          ...get().chatDraftBySession,
          [hydrated.activeChatSessionId]: nextDraft,
        },
      })
    }).catch(() => {
      set({ isInitializing: false, isInitialized: true })
    })
  },

  setView: view => set({ activeView: view }),
  setUser: user => set({ user }),
  startNewSession: () => {
    // Delegate to createChatSession for consistency
    get().createChatSession()
  },
  refreshN8nStatus: async () => {
    try {
      const status = await getN8nStatus()
      set({
        n8nReady: status.running,
        n8nUrl: status.url || 'http://localhost:5678',
      })

      if (status.running) {
        clearN8nStatusPollTimer()
      }
    } catch {
      set(state => ({
        n8nReady: false,
        n8nUrl: state.n8nUrl || 'http://localhost:5678',
      }))
    }
  },
  startN8nStatusPolling: () => {
    clearN8nStatusPollTimer()
    void get().refreshN8nStatus()

    n8nStatusPollTimer = setInterval(() => {
      if (get().n8nReady) {
        clearN8nStatusPollTimer()
        return
      }

      void get().refreshN8nStatus()
    }, 30_000)
  },
  stopN8nStatusPolling: () => {
    clearN8nStatusPollTimer()
  },
  setSessionName: name => set({ sessionName: name }),
  toggleAgentRunning: () => set(state => ({ agentRunning: !state.agentRunning })),

  setPermission: tier => {
    if (tier === 'wide-open') set({ pendingTier: tier, permissionWarningOpen: true })
    else set({ permissionTier: tier })
  },

  setPendingTier: tier => set({ pendingTier: tier }),
  setPermissionWarningOpen: open => set({ permissionWarningOpen: open }),
  confirmPermission: () => {
    const { pendingTier } = get()
    if (pendingTier) {
      set({
        permissionTier: pendingTier,
        pendingTier: null,
        permissionWarningOpen: false,
      })
    }
  },

  toggleAutonomous: () => set(state => ({ autonomousMode: !state.autonomousMode })),

  setActiveProvider: provider => {
    set({ activeProvider: provider })
    saveProviderConfig(provider.id, {
      apiKey: provider.apiKey ?? '',
      baseUrl: provider.baseUrl,
      model: provider.model ?? '',
      modelDisplayName: provider.displayName,
    })
  },

  setProviderHubOpen: open => set({ providerHubOpen: open }),
  addMessage: message => set(state => ({ messages: [...state.messages, message] })),
  setSwarmGoal: goal => set({ swarmGoal: goal }),
  setChatDraft: draft => set(state => ({
    chatDraft: draft,
    chatDraftBySession: {
      ...state.chatDraftBySession,
      [state.activeChatSessionId]: draft,
    },
  })),
  clearSwarmFeed: () => {
    pendingSwarmStreams.clear()
    if (pendingSwarmFlushTimer) {
      clearTimeout(pendingSwarmFlushTimer)
      pendingSwarmFlushTimer = null
    }
    set({ swarmFeed: [] })
  },
  toggleMultiAgentMode: () => set(state => ({ multiAgentMode: !state.multiAgentMode })),
  setOrchestrationRun: run => set({ orchestrationRun: run }),

  startOrchestration: async task => {
    // Chat stays active — never switch to 'swarm' view here.

    // ── Complexity guard ───────────────────────────────────────────────────────
    // Simple messages (< 20 words, no task keywords) route to regular chat.
    const TASK_KEYWORDS = /\b(build|create|write|research|analyze|generate|make|design|develop|find|compare|summarize|plan|implement|draft|produce|explain|code|debug|review|evaluate|investigate|gather|run|fix|improve|organize|update|help|set up|launch|deploy|test|optimize|refactor|document|migrate|integrate|automate)\b/i
    const wordCount = task.trim().split(/\s+/).length
    if (wordCount < 20 && !TASK_KEYWORDS.test(task)) {
      get().sendMessage(task)
      return
    }

    const state = get()
    const provider = state.activeProvider
    const originSessionId = state.activeChatSessionId

    if (!provider.isLocal && !provider.apiKey) return

    await initializeAgentMemory()

    const runId = createId('orch')
    const run: OrchestrationRun = {
      id: runId,
      originalTask: task,
      plan: { taskSummary: task, agents: [] },
      status: 'planning',
      stepOutputs: {},
      startedAt: new Date(),
    }

    set({ orchestrationRun: run, swarmFeed: [] })

    // ── Mutable checklist message helpers ─────────────────────────────────────
    // We create ONE assistant message and edit it in-place as steps progress.
    const checklistMsgId = createId('checklist')

    const upsertSessionMessage = (msgId: string, content: string, role: Message['role'] = 'assistant') => {
      set(current => {
        const sourceMessages = current.chatSessions.find(s => s.id === originSessionId)?.messages ?? current.messages
        const exists = sourceMessages.some(m => m.id === msgId)
        const nextMessages = exists
          ? sourceMessages.map(m => m.id === msgId ? { ...m, content } : m)
          : [...sourceMessages, { id: msgId, role, content, timestamp: new Date() }]
        const nextChatSessions = current.chatSessions.map(session =>
          session.id === originSessionId ? { ...session, messages: nextMessages } : session
        )
        return {
          messages: current.activeChatSessionId === originSessionId ? nextMessages : current.messages,
          chatSessions: nextChatSessions,
        }
      })
      const latest = get()
      persistChatSessions(latest.chatSessions, latest.activeChatSessionId)
    }

    const appendSessionMessage = (content: string, role: Message['role'] = 'assistant') => {
      const message = createMessage(role, content)
      set(current => {
        const sourceMessages = current.chatSessions.find(s => s.id === originSessionId)?.messages ?? current.messages
        const nextMessages = [...sourceMessages, message]
        const nextChatSessions = current.chatSessions.map(session =>
          session.id === originSessionId ? { ...session, messages: nextMessages } : session
        )
        return {
          messages: current.activeChatSessionId === originSessionId ? nextMessages : current.messages,
          chatSessions: nextChatSessions,
        }
      })
      const latest = get()
      persistChatSessions(latest.chatSessions, latest.activeChatSessionId)
      const targetSession = latest.chatSessions.find(s => s.id === originSessionId)
      if (targetSession) {
        const targetProvider = buildProvider(targetSession.providerId)
        persistSessionSnapshot(
          targetSession.id,
          targetSession.name,
          targetProvider ? { ...targetProvider, model: targetSession.modelId || targetProvider.model } : latest.activeProvider,
          targetSession.messages,
          'Multi-Agent',
        )
      }
    }

    const buildChecklist = (
      agents: Array<{ id: string; templateName: string; specificTask: string }>,
      completedIds: Set<string>,
      runningId: string | null,
      taskSummary: string,
    ) => {
      const lines = agents.map(a => {
        if (completedIds.has(a.id)) return `✅ **${a.templateName}** — done`
        if (a.id === runningId) return `🔄 **${a.templateName}** — running…`
        return `⏳ **${a.templateName}** — waiting`
      })
      return `🤖 **Multi-Agent Task:** ${taskSummary}\n\n${lines.join('\n')}`
    }

    appendSessionMessage(task, 'user')

    let planningTimeout: ReturnType<typeof setTimeout> | null = null

    try {
      const savedModels = getAllSavedModels().map(m => `${m.providerId}::${m.model.id}`)
      const planningController = new AbortController()
      const planningAbortState = {
        runId,
        cancelled: false,
        abort: () => planningController.abort(),
      }
      planningTimeout = setTimeout(() => {
        if (planningAbortState.cancelled) return
        planningAbortState.cancelled = true
        planningController.abort()
        if (activeOrchestrationAbort === planningAbortState) {
          activeOrchestrationAbort = null
        }
        set(current => ({
          orchestrationRun: current.orchestrationRun?.id === runId
            ? { ...current.orchestrationRun, status: 'cancelled', finishedAt: new Date() }
            : current.orchestrationRun,
          terminalEntries: [
            ...current.terminalEntries,
            createTerminalEntry('error', 'Planning timed out', 'Planning timed out and was cancelled.'),
          ],
          swarmFeed: pushSwarmFeed(current.swarmFeed, {
            id: createId('swarm-feed'),
            agentName: 'Swarm',
            type: 'error',
            content: 'Planning timed out and was cancelled.',
            timestamp: new Date(),
          }),
        }))
        appendSessionMessage('❌ Planning timed out and was cancelled.', 'system')
      }, ORCHESTRATION_PLANNING_TIMEOUT_MS)

      activeOrchestrationAbort = planningAbortState

      const basePlan = await buildOrchestrationPlan(
        task,
        provider,
        AGENT_TEMPLATE_NAMES,
        savedModels,
        planningController.signal,
      )
      if (planningTimeout) {
        clearTimeout(planningTimeout)
        planningTimeout = null
      }
      if (activeOrchestrationAbort === planningAbortState) {
        activeOrchestrationAbort = null
      }
      if (planningAbortState.cancelled) {
        return
      }
      const plan = {
        ...basePlan,
        agents: await Promise.all(basePlan.agents.map(async step => {
          const baseSystemPrompt = step.systemPrompt?.trim()
            || `You are a ${step.templateName}. ${step.templateTask}. Focus only on your specific assigned task and produce high quality output.`
          const injectedPrompt = await buildAgentSystemPrompt(step.specificTask, baseSystemPrompt)
          return {
            ...step,
            systemPrompt: injectedPrompt,
          }
        })),
      }

      appendSessionMessage(`Starting multi-agent task: ${plan.taskSummary || task}. Agents are running — check the Agent Swarm tab for live progress.`)

      const runningRun: OrchestrationRun = { ...run, plan, status: 'running' }
      set(current => ({
        orchestrationRun: current.orchestrationRun?.id === runId
          ? { ...runningRun, finishedAt: undefined }
          : current.orchestrationRun,
      }))

      // Post the initial checklist message (all waiting)
      const completedStepIds = new Set<string>()
      upsertSessionMessage(
        checklistMsgId,
        buildChecklist(plan.agents, completedStepIds, null, plan.taskSummary || task),
      )

      // Create an AgentInstance for each orchestration step
      const stepAgentIds: Record<string, string> = {}
      const stepProviders = new Map<string, Provider>()
      for (let i = 0; i < plan.agents.length; i++) {
        const step = plan.agents[i]
        const agentId = `orch-${runId}-step-${i}`
        const fallbackProvider = resolveProviderForModel(step.model, selectProvider(undefined, provider, i))
        const agentProvider = routeModelForTask(step.specificTask, fallbackProvider, i)
        stepProviders.set(step.id, agentProvider)
        const agent: AgentInstance = {
          id: agentId,
          name: step.templateName,
          providerId: agentProvider.id,
          providerName: agentProvider.name,
          model: agentProvider.model ?? step.model ?? agentProvider.name,
          task: step.specificTask,
          status: 'idle',
          tokens: 0,
          lastUpdate: 'Waiting to start…',
          summary: '',
          context: [],
          toolCalls: 0,
          startedAt: new Date(),
          orchestrationStepIndex: i + 1,
        }
        stepAgentIds[step.id] = agentId
        set(current => {
          const agents = [...current.agents, agent]
          return {
            agents,
            ...buildAgentIndexes(agents),
            swarmRunning: true,
          }
        })
      }

      // Register the abort handle BEFORE runOrchestration fires execute(), so any
      // cancelOrchestration call that arrives during the microtask gap still works.
      const orchestrationAbortState = {
        runId,
        cancelled: false,
        abort: () => { /* replaced below once runOrchestration returns */ },
      }
      activeOrchestrationAbort = orchestrationAbortState

      const abort = await runOrchestration(
        runningRun,
        provider,
        (stepId, agentName) => {
          const agentId = stepAgentIds[stepId]
          const step = plan.agents.find(item => item.id === stepId)
          if (!agentId) return
          set(current => {
            const agents = current.agents.map(a =>
              a.id === agentId
                ? { ...a, status: 'running' as const, startedAt: new Date(), lastUpdate: `${agentName} started...` }
                : a
            )
            return {
              agents,
              ...buildAgentIndexes(agents),
              swarmFeed: upsertSwarmFeed(current.swarmFeed, {
                id: createId('swarm-feed'),
                agentId,
                stepId,
                agentName,
                type: 'start',
                content: plan.agents.find(s => s.id === stepId)?.specificTask ?? '',
                timestamp: new Date(),
              }),
            }
          })
          if (step) {
            queueMemoryObservation({
              session_id: originSessionId,
              agent_id: agentId,
              agent_name: agentName,
              task: step.specificTask,
              type: 'observation',
              content: `${agentName} started ${step.specificTask}`,
              project_id: runId,
            })
          }
          // Update checklist: mark this step as running
          upsertSessionMessage(
            checklistMsgId,
            buildChecklist(plan.agents, completedStepIds, stepId, plan.taskSummary || task),
          )
        },
        (stepId, chunk) => {
          const agentId = stepAgentIds[stepId]
          if (!agentId) return
          const step = plan.agents.find(item => item.id === stepId)
          const agentName = step?.templateName ?? 'Agent'
          const pending = pendingSwarmStreams.get(agentId)
          if (pending) {
            pending.total += chunk
            pending.pending += chunk
          } else {
            pendingSwarmStreams.set(agentId, { agentId, agentName, stepId, total: '', pending: chunk })
          }
          scheduleSwarmStreamFlush()
          if (step) {
            queueMemoryObservation({
              session_id: originSessionId,
              agent_id: agentId,
              agent_name: agentName,
              task: step.specificTask,
              type: 'observation',
              content: chunk,
              project_id: runId,
            })
          }
        },
        stepId => {
          const agentId = stepAgentIds[stepId]
          if (!agentId) return
          set(current => {
            const agents = current.agents.map(a =>
              a.id === agentId
                ? { ...a, lastUpdate: 'Reviewing...', status: 'running' as const }
                : a
            )
            return { agents, ...buildAgentIndexes(agents) }
          })
        },
        (stepId, output) => {
          const agentId = stepAgentIds[stepId]
          if (!agentId) return
          const step = plan.agents.find(item => item.id === stepId)
          const agentName = step?.templateName ?? 'Agent'
          completedStepIds.add(stepId)
          flushPendingSwarmStreams(true)
          flushMemoryObservation(agentId)
          set(current => {
            const agents = current.agents.map(a =>
              a.id === agentId
                ? { ...a, status: 'complete' as const, summary: output, lastUpdate: output.slice(0, 120) }
                : a
            )
            return {
              agents,
              ...buildAgentIndexes(agents),
              swarmFeed: upsertSwarmFeed(current.swarmFeed, {
                id: createId('swarm-feed'),
                agentId,
                stepId,
                agentName,
                type: 'complete',
                content: output,
                timestamp: new Date(),
              }),
            }
          })
          // Update checklist: mark this step as done
          upsertSessionMessage(
            checklistMsgId,
            buildChecklist(plan.agents, completedStepIds, null, plan.taskSummary || task),
          )
          // Persist output to orchestrationRun in store
          set(current => {
            if (!current.orchestrationRun) return {}
            const s = current.orchestrationRun.plan.agents.find(a => a.id === stepId)
            if (!s) return {}
            return {
              orchestrationRun: {
                ...current.orchestrationRun,
                stepOutputs: { ...current.orchestrationRun.stepOutputs, [s.outputVar]: output },
              },
            }
          })
          if (step) {
            const routedProvider = stepProviders.get(step.id)
            void writeMemoryEntry({
              session_id: originSessionId,
              agent_id: agentId,
              agent_name: agentName,
              task: step.specificTask,
              type: 'output',
              content: output,
              project_id: runId,
            }).then(() => compressMemory(agentId, routedProvider))
          }
        },
        completedRun => {
          if (activeOrchestrationAbort?.runId === runId) {
            activeOrchestrationAbort = null
          }

          // Finalize checklist to all-done
          const finalChecklist = buildChecklist(plan.agents, new Set(plan.agents.map(a => a.id)), null, plan.taskSummary || task)
          upsertSessionMessage(checklistMsgId, finalChecklist)

          appendSessionMessage(summarizeOrchestrationResult(completedRun))

          set(current => ({
            orchestrationRun: current.orchestrationRun?.id === runId && current.orchestrationRun.status !== 'cancelled'
              ? {
                  ...completedRun,
                  status: 'complete',
                  finishedAt: new Date(),
                }
              : current.orchestrationRun,
            swarmRunning: current.agents.some(a => a.status === 'running'),
            swarmFeed: pushSwarmFeed(current.swarmFeed, {
              id: createId('swarm-feed'),
              agentName: 'Swarm',
              type: 'summary',
              content: `Completed: ${completedRun.originalTask}`,
              timestamp: new Date(),
            }),
          }))
          void notify('Drodo', 'Multi-agent task complete')
        },
        errorMessage => {
          if (activeOrchestrationAbort?.runId === runId) {
            activeOrchestrationAbort = null
          }
          set(current => {
            const agents = current.agents.map(a =>
              a.id.startsWith(`orch-${runId}`) && a.status === 'running'
                ? { ...a, status: 'error' as const, lastUpdate: 'Task failed.' }
                : a
            )
            return {
              orchestrationRun: current.orchestrationRun?.id === runId && current.orchestrationRun.status !== 'cancelled'
                ? { ...current.orchestrationRun, status: 'error', finishedAt: new Date() }
                : current.orchestrationRun,
              agents,
              ...buildAgentIndexes(agents),
              swarmRunning: false,
              terminalEntries: [
                ...current.terminalEntries,
                createTerminalEntry('error', 'Orchestration failed', errorMessage),
              ],
              swarmFeed: pushSwarmFeed(current.swarmFeed, {
                id: createId('swarm-feed'),
                agentName: 'Swarm',
                type: 'error',
                content: errorMessage,
                timestamp: new Date(),
              }),
            }
          })
          appendSessionMessage(`❌ Multi-agent task failed: ${errorMessage}`, 'system')
        },
        (step, stepIndex) => stepProviders.get(step.id) ?? selectProvider(undefined, provider, stepIndex),
      )

      // Wire the real abort function into the already-registered state object
      orchestrationAbortState.abort = abort
    } catch (error: unknown) {
      if (planningTimeout) {
        clearTimeout(planningTimeout)
        planningTimeout = null
      }

      if (isAbortError(error)) {
        if (activeOrchestrationAbort?.runId === runId) {
          activeOrchestrationAbort = null
        }
        set(current => {
          const agents = current.agents.filter(a => !a.id.startsWith(`orch-${runId}`))
          return {
            orchestrationRun: current.orchestrationRun?.id === runId && current.orchestrationRun.status === 'planning'
              ? {
                  ...current.orchestrationRun,
                  status: 'cancelled',
                  finishedAt: current.orchestrationRun.finishedAt ?? new Date(),
                }
              : current.orchestrationRun,
            agents,
            ...buildAgentIndexes(agents),
            swarmRunning: false,
          }
        })
        return
      }

      const message = error instanceof Error ? error.message : String(error)
      if (activeOrchestrationAbort?.runId === runId) {
        activeOrchestrationAbort = null
      }
      set(current => {
        const agents = current.agents.map(a =>
          a.id.startsWith(`orch-${runId}`) && (a.status === 'running' || a.status === 'idle')
            ? { ...a, status: 'error' as const, lastUpdate: 'Task failed.' }
            : a
        )
        return {
          orchestrationRun: current.orchestrationRun?.id === runId
            ? { ...current.orchestrationRun, status: 'error', finishedAt: new Date() }
            : current.orchestrationRun,
          agents,
          ...buildAgentIndexes(agents),
          swarmRunning: false,
          terminalEntries: [
            ...current.terminalEntries,
            createTerminalEntry('error', 'Orchestration failed', message),
          ],
          swarmFeed: pushSwarmFeed(current.swarmFeed, {
            id: createId('swarm-feed'),
            agentName: 'Swarm',
            type: 'error',
            content: message,
            timestamp: new Date(),
          }),
        }
      })
    } finally {
      if (planningTimeout) {
        clearTimeout(planningTimeout)
      }
    }
  },

  setLiveOutput: (title, content, language) =>
    set({
      liveOutputTitle: title,
      liveOutputContent: content,
      liveOutputLanguage: language ?? detectLanguage(title),
    }),

  clearTerminal: () => {
    set({
      terminalEntries: [
        createTerminalEntry('info', 'Terminal cleared', 'New tool activity and command output will appear here.'),
      ],
    })
  },

  openDocument: async path => {
    set({ activeDocumentLoading: true })

    try {
      const content = await readFile(path)
      set(state => ({
        activeDocumentPath: path,
        activeDocumentLoading: false,
        liveOutputTitle: path,
        liveOutputContent: content,
        liveOutputLanguage: detectLanguage(path),
        recentPaths: pushRecentPath(state.recentPaths, path),
      }))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      set(state => ({
        activeDocumentLoading: false,
        terminalEntries: [
          ...state.terminalEntries,
          createTerminalEntry('error', 'File read failed', `${path}\n\n${message}`),
        ],
      }))
    }
  },

  runManualCommand: async command => {
    const trimmed = command.trim()
    if (!trimmed) return

    set(state => ({
      terminalEntries: [
        ...state.terminalEntries,
        createTerminalEntry('command', '$ command', trimmed),
      ],
    }))

    try {
      const result = await executeCommand(trimmed)
      const output = result.combined.trim() || '(no output)'

      set(state => ({
        terminalEntries: [
          ...state.terminalEntries,
          createTerminalEntry(
            result.success ? 'output' : 'error',
            `${result.shell} exit ${result.exitCode}`,
            output,
            undefined,
            result.exitCode
          ),
        ],
        liveOutputTitle: trimmed,
        liveOutputContent: output,
        liveOutputLanguage: detectLanguage(result.shell),
      }))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      set(state => ({
        terminalEntries: [
          ...state.terminalEntries,
          createTerminalEntry('error', 'Command failed', message),
        ],
      }))
    }
  },

  stopAll: () => {
    activePrimaryRun?.abort()
    activePrimaryRun = null

    for (const handle of activeSwarmRuns.values()) {
      handle.abort()
    }
    activeSwarmRuns.clear()
    for (const agentId of Array.from(pendingMemoryObservations.keys())) {
      flushMemoryObservation(agentId)
    }

    const orchestrationAbort = activeOrchestrationAbort
    if (orchestrationAbort) {
      orchestrationAbort.cancelled = true
    }

    if (autonomousLoopTimer) {
      clearTimeout(autonomousLoopTimer)
      autonomousLoopTimer = null
    }

    set(state => {
      const stoppedMessages = state.messages.map(message =>
        message.streaming
          ? { ...message, streaming: false, content: `${message.content} [stopped]`.trim() }
          : message
      )
      const agents = state.agents.map(agent =>
        agent.status === 'running'
          ? { ...agent, status: 'complete' as const, lastUpdate: 'Stopped by user.' }
          : agent
      )
      return {
        agentRunning: false,
        autonomousLoopActive: false,
        autonomousLoopCount: 0,
        swarmRunning: false,
        messages: stoppedMessages,
        orchestrationRun: state.orchestrationRun &&
          (state.orchestrationRun.status === 'planning' || state.orchestrationRun.status === 'running')
          ? { ...state.orchestrationRun, status: 'cancelled', finishedAt: new Date() }
          : state.orchestrationRun,
        chatSessions: state.chatSessions.map(s =>
          s.id === state.activeChatSessionId ? { ...s, messages: stoppedMessages } : s
        ),
        agents,
        ...buildAgentIndexes(agents),
        terminalEntries: [
          ...state.terminalEntries,
          createTerminalEntry('info', 'Stopped', 'Active agent runs were stopped.'),
        ],
      }
    })
    orchestrationAbort?.abort()
    if (activeOrchestrationAbort === orchestrationAbort) {
      activeOrchestrationAbort = null
    }
    const s = get()
    persistChatSessions(s.chatSessions, s.activeChatSessionId)
  },

  sendMessage: (content, attachments = []) => {
    const state = get()
    const normalizedAttachments = attachments.filter(attachment => (
      attachment.path.trim().length > 0 &&
      attachment.name.trim().length > 0
    ))
    const userMessageContent = content || buildAttachmentSummary(normalizedAttachments)

    activePrimaryRun?.abort()
    activePrimaryRun = null

    if (autonomousLoopTimer) {
      clearTimeout(autonomousLoopTimer)
      autonomousLoopTimer = null
    }

    const provider = state.activeProvider
    const userMessage = createMessage(
      'user',
      userMessageContent,
      normalizedAttachments.length > 0 ? normalizedAttachments : undefined,
    )
    const assistantId = createId('assistant')
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      streaming: true,
    }
    const nextMessages = [...state.messages.map(m => ({ ...m, streaming: false })), userMessage, assistantMessage]

    // Build clean API conversation: system prompt + user/assistant turns only
    const history = state.messages.filter(m => !m.streaming)
    const apiMessages: Message[] = [
      createMessage('system', `${DRODO_IDENTITY_PROMPT} Be direct, concise, and helpful.`),
      ...history
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(serializeMessageForModel),
      serializeMessageForModel(userMessage),
    ]

    set(current => ({
      messages: nextMessages,
      agentRunning: true,
      taskSteps: updateTaskStep(createTaskSteps(), 'respond', 'running'),
      terminalEntries: [
        ...current.terminalEntries,
        createTerminalEntry('info', 'User', summarizeUserTurn(userMessageContent, normalizedAttachments)),
      ],
    }))
    persistSessionSnapshot(state.sessionId, state.sessionName, provider, nextMessages)

    // No key configured — the ChatPanel inline card already tells the user.
    // Remove the placeholder assistant bubble and bail.
    if (!provider.isLocal && !provider.apiKey) {
      const failedMessages = nextMessages.filter(message => message.id !== assistantId)
      set(current => ({
        messages: current.messages.filter(m => m.id !== assistantId),
        agentRunning: false,
        taskSteps: createTaskSteps(),
      }))
      persistSessionSnapshot(state.sessionId, state.sessionName, provider, failedMessages)
      return
    }

    let accumulated = ''

    const handle = streamCompletion(
      provider,
      apiMessages,
      chunk => {
        accumulated += chunk
        set(current => ({
          messages: current.messages.map(m =>
            m.id === assistantId ? { ...m, content: accumulated } : m
          ),
        }))
      },
      message => {
        activePrimaryRun = null
        const finalContent = message || accumulated

        set(current => {
          const finalMessages = current.messages.map(m =>
            m.id === assistantId
              ? { ...m, streaming: false, content: finalContent || m.content }
              : m
          )
          return {
            messages: finalMessages,
            chatSessions: current.chatSessions.map(s =>
              s.id === current.activeChatSessionId ? { ...s, messages: finalMessages } : s
            ),
            agentRunning: false,
            autonomousLoopActive: false,
            taskSteps: current.taskSteps.map(s => ({ ...s, status: 'complete' })),
            terminalEntries: [
              ...current.terminalEntries,
              createTerminalEntry('info', 'Response', finalContent || '(no content)'),
            ],
          }
        })
        const persistedState = get()
        persistChatSessions(persistedState.chatSessions, persistedState.activeChatSessionId)
        persistSessionSnapshot(
          persistedState.sessionId,
          persistedState.sessionName,
          provider,
          persistedState.messages
        )

        // Track usage
        try {
          const totalTokens = Math.max(1, Math.ceil(finalContent.length / 4))
          const inputTokens = Math.floor(totalTokens * 0.3)
          const outputTokens = totalTokens - inputTokens
          trackUsage({
            providerId: provider.id,
            providerName: provider.name,
            model: provider.model ?? provider.name,
            inputTokens,
            outputTokens,
            totalTokens,
            estimatedCostUsd: estimateCost(provider.model ?? provider.name, inputTokens, outputTokens),
          })
        } catch { /* never break the UI over analytics */ }

        void notify('Drodo', 'Agent finished responding.')

        const latest = get()
        if (
          latest.autonomousMode &&
          latest.autonomousLoopCount < latest.autonomousMaxLoops &&
          !looksComplete(finalContent)
        ) {
          set({
            autonomousLoopCount: latest.autonomousLoopCount + 1,
            autonomousLoopActive: true,
            agentRunning: true,
          })
          autonomousLoopTimer = setTimeout(() => {
            get().sendMessage('Continue with the next step.')
          }, 1200)
        } else if (latest.autonomousMode) {
          set({ autonomousLoopCount: 0, autonomousLoopActive: false })
        }
      },
      error => {
        activePrimaryRun = null
        if (autonomousLoopTimer) {
          clearTimeout(autonomousLoopTimer)
          autonomousLoopTimer = null
        }
        set(current => ({
          messages: current.messages.map(m =>
            m.id === assistantId
              ? { ...m, streaming: false, content: `Error: ${error.message}` }
              : m
          ),
          agentRunning: false,
          autonomousLoopActive: false,
          autonomousLoopCount: 0,
          taskSteps: updateTaskStep(current.taskSteps, 'respond', 'error'),
          terminalEntries: [
            ...current.terminalEntries,
            createTerminalEntry('error', 'API error', error.message),
          ],
        }))
        const latest = get()
        persistSessionSnapshot(latest.sessionId, latest.sessionName, provider, latest.messages)
      }
    )

    activePrimaryRun = handle
  },

  spawnAgent: async (task, providerId, name, model, systemPrompt) => {
    const state = get()
    const agentTask =
      task?.trim() ||
      state.swarmGoal.trim() ||
      state.messages.filter(message => message.role === 'user').slice(-1)[0]?.content ||
      state.sessionName

    await initializeAgentMemory()

    const agentId = `agent-${agentCounter++}`
    const selectedProvider = selectProvider(providerId, state.activeProvider, agentCounter)
    const fallbackProvider = model ? { ...selectedProvider, model } : selectedProvider
    const provider = routeModelForTask(agentTask, fallbackProvider, agentCounter - 1)
    const resolvedSystemPrompt = await buildAgentSystemPrompt(
      agentTask,
      systemPrompt ?? 'You are a Drodo swarm worker. Focus only on the assigned subtask.',
    )
    const baseConversation = [
      createMessage('system', resolvedSystemPrompt),
      createMessage('user', agentTask),
    ]
    const conversation = baseConversation

    const agent: AgentInstance = {
      id: agentId,
      name: name?.trim() || `Agent ${agentCounter - 1}`,
      providerId: provider.id,
      providerName: provider.name,
      model: model ?? provider.model ?? provider.name,
      task: agentTask,
      status: 'running',
      tokens: 0,
      lastUpdate: 'Starting…',
      summary: '',
      context: conversation,
      toolCalls: 0,
      startedAt: new Date(),
    }

    set(current => {
      const agents = [...current.agents, agent]
      return {
        agents,
        ...buildAgentIndexes(agents),
        swarmRunning: true,
        swarmFeed: upsertSwarmFeed(current.swarmFeed, {
          id: createId('swarm-feed'),
          agentId,
          agentName: agent.name,
          type: 'start',
          content: agentTask,
          timestamp: new Date(),
        }),
        terminalEntries: [
          ...current.terminalEntries,
          createTerminalEntry('info', `${agent.name} started`, `${provider.name} · ${agent.model}\n${agentTask}`, agentId),
        ],
      }
    })

    if (!provider.isLocal && !provider.apiKey) {
      set(current => {
        const agents = current.agents.map(item =>
          item.id === agentId
            ? { ...item, status: 'error' as const, lastUpdate: `Missing API key for ${provider.name}.` }
            : item
        )
        return { agents, ...buildAgentIndexes(agents) }
      })
      return
    }

    let accumulated = ''
    let usedTools = false

    void writeMemoryEntry({
      session_id: state.activeChatSessionId,
      agent_id: agentId,
      agent_name: name?.trim() || `Agent ${agentCounter - 1}`,
      task: agentTask,
      type: 'observation',
      content: `Assigned task: ${agentTask}`,
      project_id: state.sessionId,
    })

    const handle = runAgentSession({
      provider,
      conversation,
      onPlanning: round => {
        set(current => {
          const agents = current.agents.map(item =>
            item.id === agentId ? { ...item, lastUpdate: `Planning round ${round}...` } : item
          )
          return { agents, ...buildAgentIndexes(agents) }
        })
      },
      onToolStart: call => {
        usedTools = true
        set(current => {
          const agents = current.agents.map(item =>
            item.id === agentId
              ? { ...item, toolCalls: item.toolCalls + 1, lastUpdate: `Running ${call.tool}...` }
              : item
          )
          return {
            agents,
            ...buildAgentIndexes(agents),
            terminalEntries: [
              ...current.terminalEntries,
              createTerminalEntry('tool', `${agent.name}: ${call.tool}`, JSON.stringify(call.arguments, null, 2), agentId),
            ],
          }
        })
        void writeMemoryEntry({
          session_id: state.activeChatSessionId,
          agent_id: agentId,
          agent_name: agent.name,
          task: agentTask,
          type: 'tool_call',
          content: `${call.tool}\n${JSON.stringify(call.arguments, null, 2)}`,
          project_id: state.sessionId,
        })
      },
      onToolResult: result => {
        set(current => {
          const agents = current.agents.map(item =>
            item.id === agentId
              ? {
                  ...item,
                  tokens: item.tokens + estimateTokens(result.contentForModel),
                  lastUpdate: result.summary,
                  summary: result.summary,
                }
              : item
          )
          return {
            agents,
            ...buildAgentIndexes(agents),
            terminalEntries: [
              ...current.terminalEntries,
              createTerminalEntry('output', `${agent.name}: ${result.summary}`, result.contentForModel, agentId),
            ],
          }
        })
        void writeMemoryEntry({
          session_id: state.activeChatSessionId,
          agent_id: agentId,
          agent_name: agent.name,
          task: agentTask,
          type: 'output',
          content: result.contentForModel,
          project_id: state.sessionId,
        })
      },
      onFinalStart: () => {
        set(current => {
          const agents = current.agents.map(item =>
            item.id === agentId ? { ...item, lastUpdate: usedTools ? 'Summarizing work...' : 'Responding...' } : item
          )
          return { agents, ...buildAgentIndexes(agents) }
        })
      },
      onFinalChunk: chunk => {
        accumulated += chunk
        const pending = pendingSwarmStreams.get(agentId)
        if (pending) {
          pending.total += chunk
          pending.pending += chunk
        } else {
          pendingSwarmStreams.set(agentId, { agentId, agentName: agent.name, total: '', pending: chunk })
        }
        scheduleSwarmStreamFlush()
        queueMemoryObservation({
          session_id: state.activeChatSessionId,
          agent_id: agentId,
          agent_name: agent.name,
          task: agentTask,
          type: 'observation',
          content: chunk,
          project_id: state.sessionId,
        })
      },
      onFinal: message => {
        activeSwarmRuns.delete(agentId)
        flushPendingSwarmStreams(true)
        flushMemoryObservation(agentId)
        set(current => {
          const agents = current.agents.map(item =>
            item.id === agentId
              ? {
                  ...item,
                  status: 'complete' as const,
                  summary: message,
                  lastUpdate: message,
                  tokens: estimateTokens(message),
                  context: [...item.context, createMessage('assistant', message)],
                }
              : item
          )

          return {
            agents,
            ...buildAgentIndexes(agents),
            swarmRunning: agents.some(item => item.status === 'running'),
            swarmFeed: upsertSwarmFeed(current.swarmFeed, {
              id: createId('swarm-feed'),
              agentId,
              agentName: agent.name,
              type: 'complete',
              content: message,
              timestamp: new Date(),
            }),
            terminalEntries: [
              ...current.terminalEntries,
              createTerminalEntry('info', `${agent.name} complete`, message, agentId),
            ],
          }
        })
        void writeMemoryEntry({
          session_id: state.activeChatSessionId,
          agent_id: agentId,
          agent_name: agent.name,
          task: agentTask,
          type: 'output',
          content: message,
          project_id: state.sessionId,
        }).then(() => compressMemory(agentId, provider))
      },
      onError: error => {
        activeSwarmRuns.delete(agentId)
        flushPendingSwarmStreams(true)
        flushMemoryObservation(agentId)
        set(current => {
          const agents = current.agents.map(item =>
            item.id === agentId
              ? { ...item, status: 'error' as const, lastUpdate: error.message, summary: error.message }
              : item
          )

          return {
            agents,
            ...buildAgentIndexes(agents),
            swarmRunning: agents.some(item => item.status === 'running'),
            swarmFeed: upsertSwarmFeed(current.swarmFeed, {
              id: createId('swarm-feed'),
              agentId,
              agentName: agent.name,
              type: 'error',
              content: error.message,
              timestamp: new Date(),
            }),
            terminalEntries: [
              ...current.terminalEntries,
              createTerminalEntry('error', `${agent.name} error`, error.message, agentId),
            ],
          }
        })
      },
    })

    activeSwarmRuns.set(agentId, handle)
  },

  launchSwarm: async goal => {
    const state = get()
    const targetGoal =
      goal?.trim() ||
      state.swarmGoal.trim() ||
      state.messages.filter(message => message.role === 'user').slice(-1)[0]?.content ||
      state.sessionName

    if (!targetGoal) return

    const provider = state.activeProvider
    const orchestratorId = `agent-${agentCounter++}`

    const orchestrator: AgentInstance = {
      id: orchestratorId,
      name: 'Orchestrator',
      providerId: provider.id,
      providerName: provider.name,
      model: provider.model ?? provider.name,
      task: `Break down and coordinate: ${targetGoal}`,
      status: 'running',
      tokens: 0,
      lastUpdate: 'Designing the swarm plan…',
      summary: '',
      context: [createMessage('user', targetGoal)],
      toolCalls: 0,
      orchestrator: true,
      startedAt: new Date(),
    }

    set(current => {
      const agents = [...current.agents, orchestrator]
      return {
        swarmGoal: targetGoal,
        swarmRunning: true,
        agents,
        ...buildAgentIndexes(agents),
        terminalEntries: [
          ...current.terminalEntries,
          createTerminalEntry('info', 'Swarm orchestrator', targetGoal, orchestratorId),
        ],
      }
    })

    const plannerProvider = (!provider.isLocal && !provider.apiKey)
      ? getConnectedProviders()[0] ?? provider
      : provider
    const controller = new AbortController()
    activeSwarmRuns.set(orchestratorId, { abort: () => controller.abort() })

    try {
      const prompt = [
        'Break this goal into 2 to 4 parallel subtasks.',
        'Return JSON only with this exact shape:',
        '{"agents":[{"name":"Planner","task":"Specific subtask"}]}',
        'Make the tasks concrete, non-overlapping, and practical for independent agents.',
        `Goal: ${targetGoal}`,
      ].join('\n')

      const plannerText = await completeText(
        plannerProvider,
        [
          createMessage('system', 'You are the Drodo swarm orchestrator.'),
          createMessage('user', prompt),
        ],
        controller.signal
      )

      let subtasks = fallbackSubtasks(targetGoal)
      try {
        const normalized = plannerText
          .trim()
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '')
        const parsed = JSON.parse(normalized) as {
          agents?: Array<{ name?: string; task?: string }>
        }
        if (Array.isArray(parsed.agents) && parsed.agents.length > 0) {
          subtasks = parsed.agents
            .filter(item => item.task)
            .slice(0, 4)
            .map((item, index) => ({
              name: item.name?.trim() || `Agent ${index + 1}`,
              task: item.task!.trim(),
            }))
        }
      } catch {
        subtasks = fallbackSubtasks(targetGoal)
      }

      activeSwarmRuns.delete(orchestratorId)

      set(current => {
        const agents = current.agents.map(agent =>
          agent.id === orchestratorId
            ? {
                ...agent,
                status: 'complete' as const,
                summary: subtasks.map(item => `${item.name}: ${item.task}`).join('\n'),
                lastUpdate: `Assigned ${subtasks.length} worker agents.`,
                tokens: estimateTokens(JSON.stringify(subtasks)),
              }
            : agent
        )
        return {
          agents,
          ...buildAgentIndexes(agents),
          terminalEntries: [
            ...current.terminalEntries,
            createTerminalEntry(
              'info',
              'Swarm plan ready',
              subtasks.map(item => `${item.name}: ${item.task}`).join('\n'),
              orchestratorId
            ),
          ],
        }
      })

      for (let index = 0; index < subtasks.length; index += 1) {
        const taskEntry = subtasks[index]
        const assignedProvider = routeModelForTask(taskEntry.task, state.activeProvider, index)
        await get().spawnAgent(taskEntry.task, assignedProvider.id, taskEntry.name, assignedProvider.model)
      }
    } catch (error: unknown) {
      activeSwarmRuns.delete(orchestratorId)
      const message = error instanceof Error ? error.message : String(error)
      set(current => {
        const agents = current.agents.map(agent =>
          agent.id === orchestratorId
            ? { ...agent, status: 'error' as const, summary: message, lastUpdate: message }
            : agent
        )
        return {
          agents,
          ...buildAgentIndexes(agents),
          swarmRunning: agents.some(a => a.status === 'running'),
          terminalEntries: [
            ...current.terminalEntries,
            createTerminalEntry('error', 'Swarm orchestration failed', message, orchestratorId),
          ],
        }
      })
    }
  },

  stopAgent: id => {
    activeSwarmRuns.get(id)?.abort()
    activeSwarmRuns.delete(id)
    flushMemoryObservation(id)

    set(current => {
      const agents = current.agents.map(agent =>
        agent.id === id
          ? { ...agent, status: 'complete' as const, lastUpdate: 'Stopped by user.' }
          : agent
      )

      return {
        agents,
        ...buildAgentIndexes(agents),
        swarmRunning: agents.some(agent => agent.status === 'running'),
        terminalEntries: [
          ...current.terminalEntries,
          createTerminalEntry('info', 'Agent stopped', id, id),
        ],
      }
    })
  },

  setConnectorConnected: (id, connected) => {
    set(current => {
      const connectors = current.connectors.map(connector =>
        connector.id === id ? { ...connector, isConnected: connected } : connector
      )

      const saved: Record<string, boolean> = {}
      connectors.forEach(connector => {
        if (connector.isConnected) saved[connector.id] = true
      })
      localStorage.setItem('drodo_connectors', JSON.stringify(saved))

      return { connectors }
    })
  },

  createChatSession: () => {
    activePrimaryRun?.abort()
    activePrimaryRun = null
    if (autonomousLoopTimer) {
      clearTimeout(autonomousLoopTimer)
      autonomousLoopTimer = null
    }

    const state = get()
    const updatedSessions = state.chatSessions.map(s =>
      s.id === state.activeChatSessionId ? { ...s, messages: state.messages } : s
    )
    const newSession: ChatSession = {
      id: createSessionId(),
      name: `Chat ${updatedSessions.length + 1}`,
      messages: [createMessage('system', 'Session started. Drodo is ready.')],
      providerId: state.activeProvider.id,
      modelId: state.activeProvider.model ?? '',
    }
    const allSessions = [...updatedSessions, newSession]
    set({
      chatSessions: allSessions,
      activeChatSessionId: newSession.id,
      messages: newSession.messages,
      sessionId: newSession.id,
      sessionName: newSession.name,
      agentRunning: false,
      autonomousLoopActive: false,
      autonomousLoopCount: 0,
      taskSteps: createTaskSteps(),
      chatDraft: '',
      chatDraftBySession: {
        ...state.chatDraftBySession,
        [newSession.id]: '',
      },
    })
    persistChatSessions(allSessions, newSession.id)
  },

  switchChatSession: id => {
    const state = get()
    if (id === state.activeChatSessionId) return

    activePrimaryRun?.abort()
    activePrimaryRun = null
    if (autonomousLoopTimer) {
      clearTimeout(autonomousLoopTimer)
      autonomousLoopTimer = null
    }

    const updatedSessions = state.chatSessions.map(s =>
      s.id === state.activeChatSessionId ? { ...s, messages: state.messages } : s
    )
    const target = updatedSessions.find(s => s.id === id)
    if (!target) return

    const sessionProvider = buildProvider(target.providerId)
    const resolvedProvider = sessionProvider
      ? {
          ...sessionProvider,
          model: target.modelId || sessionProvider.model,
          displayName: getSavedModelDisplayName(target.providerId, target.modelId || sessionProvider.model),
        }
      : state.activeProvider

    set({
      chatSessions: updatedSessions,
      activeChatSessionId: id,
      messages: target.messages,
      activeProvider: resolvedProvider,
      sessionId: target.id,
      sessionName: target.name,
      agentRunning: false,
      autonomousLoopActive: false,
      autonomousLoopCount: 0,
      taskSteps: createTaskSteps(),
      chatDraftBySession: {
        ...state.chatDraftBySession,
        [state.activeChatSessionId]: state.chatDraft,
      },
      chatDraft: state.chatDraftBySession[id] ?? '',
    })
    persistChatSessions(updatedSessions, id)
  },

  closeChatSession: id => {
    const state = get()
    if (state.chatSessions.length <= 1) return

    const idx = state.chatSessions.findIndex(s => s.id === id)
    if (idx === -1) return

    const remaining = state.chatSessions.filter(s => s.id !== id)
    const { [id]: _removedDraft, ...remainingDrafts } = state.chatDraftBySession

    if (id === state.activeChatSessionId) {
      activePrimaryRun?.abort()
      activePrimaryRun = null

      const nextSession = remaining[Math.min(idx, remaining.length - 1)]
      const sessionProvider = buildProvider(nextSession.providerId)
      const resolvedProvider = sessionProvider
        ? { ...sessionProvider, model: nextSession.modelId || sessionProvider.model }
        : state.activeProvider

      set({
        chatSessions: remaining,
        activeChatSessionId: nextSession.id,
        messages: nextSession.messages,
        activeProvider: resolvedProvider,
        sessionId: nextSession.id,
        sessionName: nextSession.name,
        agentRunning: false,
        autonomousLoopActive: false,
        taskSteps: createTaskSteps(),
        chatDraftBySession: remainingDrafts,
        chatDraft: remainingDrafts[nextSession.id] ?? '',
      })
      persistChatSessions(remaining, nextSession.id)
    } else {
      set({
        chatSessions: remaining,
        chatDraftBySession: remainingDrafts,
      })
      persistChatSessions(remaining, state.activeChatSessionId)
    }
  },

  renameChatSession: (id, name) => {
    const state = get()
    const updated = state.chatSessions.map(s => s.id === id ? { ...s, name } : s)
    const patch: Partial<AppState> = { chatSessions: updated }
    if (id === state.activeChatSessionId) patch.sessionName = name
    set(patch)
    persistChatSessions(updated, state.activeChatSessionId)
  },

  setSessionModel: (providerId, modelId) => {
    const state = get()
    const base = buildProvider(providerId)
    if (!base) return
    const displayName = getSavedModelDisplayName(providerId, modelId)
    const provider = { ...base, model: modelId, displayName }
    const updated = state.chatSessions.map(s =>
      s.id === state.activeChatSessionId ? { ...s, providerId, modelId } : s
    )
    set({ activeProvider: provider, chatSessions: updated })
    saveProviderConfig(providerId, {
      apiKey: base.apiKey ?? '',
      baseUrl: base.baseUrl,
      model: modelId,
      modelDisplayName: displayName,
    })
    persistChatSessions(updated, state.activeChatSessionId)
  },
  })
})

export function useAgentIds() {
  return useAppStore(state => state.agentIds)
}

export function useAgentCardData(agentId: string) {
  return useAppStore(state => state.agentsById[agentId])
}

export function useSwarmSummary() {
  return useAppStore(
    useShallow(state => ({
      runningAgentCount: state.runningAgentCount,
      totalAgentCount: state.visibleAgentIds.length,
      totalAgentTokens: state.totalAgentTokens,
    }))
  )
}

export function useSwarmFeedMeta() {
  return useAppStore(
    useShallow(state => ({
      feedCount: state.swarmFeed.length,
      runningAgentCount: state.runningAgentCount,
      clearSwarmFeed: state.clearSwarmFeed,
    }))
  )
}

export function useSwarmFeedEntries() {
  return useAppStore(state => state.swarmFeed)
}
