import { create } from 'zustand'
import type {
  AgentInstance,
  Message,
  NavView,
  PermissionTier,
  Provider,
  TaskStep,
  TerminalEntry,
} from '../types'
import { runAgentSession, type AgentRunHandle } from '../lib/agentRunner'
import { streamCompletion } from '../lib/streamChat'
import {
  buildProvider,
  getConnectedProviders,
  loadAllSavedConfigs,
  saveProviderConfig,
} from '../lib/providerApi'
import { INITIAL_CONNECTORS } from '../lib/connectors'
import { executeCommand, readFile } from '../lib/tauri'

let activePrimaryRun: AgentRunHandle | null = null
let autonomousLoopTimer: ReturnType<typeof setTimeout> | null = null
const activeSwarmRuns = new Map<string, AgentRunHandle>()

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

function createMessage(role: Message['role'], content: string): Message {
  return {
    id: createId(role),
    role,
    content,
    timestamp: new Date(),
  }
}

function createTaskSteps(): TaskStep[] {
  return INITIAL_TASK_STEPS.map(step => ({ ...step }))
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

function selectProvider(preferredId: string | undefined, activeProvider: Provider, index: number): Provider {
  if (preferredId) {
    return buildProvider(preferredId) ?? activeProvider
  }

  const connected = getConnectedProviders()
  if (connected.length === 0) return activeProvider
  return connected[index % connected.length]
}

function fallbackSubtasks(goal: string) {
  return [
    { name: 'Planner', task: `Inspect the workspace and outline the implementation plan for: ${goal}` },
    { name: 'Builder', task: `Implement the highest-value changes needed to complete: ${goal}` },
    { name: 'Verifier', task: `Run checks and identify remaining issues for: ${goal}` },
  ]
}

let agentCounter = 1

interface AppState {
  activeView: NavView
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

  setView: (view: NavView) => void
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
  sendMessage: (content: string) => void
  stopAll: () => void
  spawnAgent: (task?: string, providerId?: string, name?: string) => Promise<void>
  launchSwarm: (goal?: string) => Promise<void>
  stopAgent: (id: string) => void
  setConnectorConnected: (id: string, connected: boolean) => void
  openDocument: (path: string) => Promise<void>
  setLiveOutput: (title: string, content: string, language?: string) => void
  runManualCommand: (command: string) => Promise<void>
  clearTerminal: () => void
  setSwarmGoal: (goal: string) => void
  setChatDraft: (draft: string) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  activeView: 'agent',
  sessionName: 'Drodo Session',
  agentRunning: false,
  permissionTier: 'standard',
  pendingTier: null,
  permissionWarningOpen: false,
  autonomousMode: false,
  autonomousLoopActive: false,
  autonomousLoopCount: 0,
  autonomousMaxLoops: 6,
  activeProvider: buildDefaultProvider(),
  providerHubOpen: false,
  messages: [createMessage('system', 'Session started. Drodo is ready.')],
  agents: [],
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

  setView: view => set({ activeView: view }),
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
    })
  },

  setProviderHubOpen: open => set({ providerHubOpen: open }),
  addMessage: message => set(state => ({ messages: [...state.messages, message] })),
  setSwarmGoal: goal => set({ swarmGoal: goal }),
  setChatDraft: draft => set({ chatDraft: draft }),

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

    if (autonomousLoopTimer) {
      clearTimeout(autonomousLoopTimer)
      autonomousLoopTimer = null
    }

    set(state => ({
      agentRunning: false,
      autonomousLoopActive: false,
      autonomousLoopCount: 0,
      swarmRunning: false,
      messages: state.messages.map(message =>
        message.streaming
          ? { ...message, streaming: false, content: `${message.content} [stopped]`.trim() }
          : message
      ),
      agents: state.agents.map(agent =>
        agent.status === 'running'
          ? { ...agent, status: 'complete' as const, lastUpdate: 'Stopped by user.' }
          : agent
      ),
      terminalEntries: [
        ...state.terminalEntries,
        createTerminalEntry('info', 'Stopped', 'Active agent runs were stopped.'),
      ],
    }))
  },

  sendMessage: content => {
    const state = get()

    activePrimaryRun?.abort()
    activePrimaryRun = null

    if (autonomousLoopTimer) {
      clearTimeout(autonomousLoopTimer)
      autonomousLoopTimer = null
    }

    const provider = state.activeProvider
    const userMessage = createMessage('user', content)
    const assistantId = createId('assistant')
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      streaming: true,
    }

    // Build clean API conversation: system prompt + user/assistant turns only
    const history = state.messages.filter(m => !m.streaming)
    const apiMessages: Message[] = [
      createMessage('system', 'You are Drodo, a capable desktop AI agent. Be direct, concise, and helpful.'),
      ...history.filter(m => m.role === 'user' || m.role === 'assistant'),
      userMessage,
    ]

    set(current => ({
      messages: [...current.messages.map(m => ({ ...m, streaming: false })), userMessage, assistantMessage],
      agentRunning: true,
      taskSteps: updateTaskStep(createTaskSteps(), 'respond', 'running'),
      terminalEntries: [
        ...current.terminalEntries,
        createTerminalEntry('info', 'User', content),
      ],
    }))

    // No key configured — the ChatPanel inline card already tells the user.
    // Remove the placeholder assistant bubble and bail.
    if (!provider.isLocal && !provider.apiKey) {
      set(current => ({
        messages: current.messages.filter(m => m.id !== assistantId),
        agentRunning: false,
        taskSteps: createTaskSteps(),
      }))
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

        set(current => ({
          messages: current.messages.map(m =>
            m.id === assistantId
              ? { ...m, streaming: false, content: finalContent || m.content }
              : m
          ),
          agentRunning: false,
          autonomousLoopActive: false,
          taskSteps: current.taskSteps.map(s => ({ ...s, status: 'complete' })),
          terminalEntries: [
            ...current.terminalEntries,
            createTerminalEntry('info', 'Response', finalContent || '(no content)'),
          ],
        }))

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
        set(current => ({
          messages: current.messages.map(m =>
            m.id === assistantId
              ? { ...m, streaming: false, content: `Error: ${error.message}` }
              : m
          ),
          agentRunning: false,
          autonomousLoopActive: false,
          taskSteps: updateTaskStep(current.taskSteps, 'respond', 'error'),
          terminalEntries: [
            ...current.terminalEntries,
            createTerminalEntry('error', 'API error', error.message),
          ],
        }))
      }
    )

    activePrimaryRun = handle
  },

  spawnAgent: async (task, providerId, name) => {
    const state = get()
    const agentTask =
      task?.trim() ||
      state.swarmGoal.trim() ||
      state.messages.filter(message => message.role === 'user').slice(-1)[0]?.content ||
      state.sessionName

    const agentId = `agent-${agentCounter++}`
    const provider = selectProvider(providerId, state.activeProvider, agentCounter)
    const conversation = [
      createMessage('system', 'You are a Drodo swarm worker. Focus only on the assigned subtask.'),
      createMessage('user', agentTask),
    ]

    const agent: AgentInstance = {
      id: agentId,
      name: name?.trim() || `Agent ${agentCounter - 1}`,
      providerId: provider.id,
      providerName: provider.name,
      model: provider.model ?? provider.name,
      task: agentTask,
      status: 'running',
      tokens: 0,
      lastUpdate: 'Starting…',
      summary: '',
      context: conversation,
      toolCalls: 0,
      startedAt: new Date(),
    }

    set(current => ({
      agents: [...current.agents, agent],
      swarmRunning: true,
      terminalEntries: [
        ...current.terminalEntries,
        createTerminalEntry('info', `${agent.name} started`, `${provider.name} · ${agent.model}\n${agentTask}`, agentId),
      ],
    }))

    if (!provider.isLocal && !provider.apiKey) {
      set(current => ({
        agents: current.agents.map(item =>
          item.id === agentId
            ? { ...item, status: 'error' as const, lastUpdate: `Missing API key for ${provider.name}.` }
            : item
        ),
      }))
      return
    }

    let accumulated = ''
    let usedTools = false

    const handle = runAgentSession({
      provider,
      conversation,
      onPlanning: round => {
        set(current => ({
          agents: current.agents.map(item =>
            item.id === agentId ? { ...item, lastUpdate: `Planning round ${round}…` } : item
          ),
        }))
      },
      onToolStart: call => {
        usedTools = true
        set(current => ({
          agents: current.agents.map(item =>
            item.id === agentId
              ? { ...item, toolCalls: item.toolCalls + 1, lastUpdate: `Running ${call.tool}…` }
              : item
          ),
          terminalEntries: [
            ...current.terminalEntries,
            createTerminalEntry('tool', `${agent.name}: ${call.tool}`, JSON.stringify(call.arguments, null, 2), agentId),
          ],
        }))
      },
      onToolResult: result => {
        set(current => ({
          agents: current.agents.map(item =>
            item.id === agentId
              ? {
                  ...item,
                  tokens: item.tokens + estimateTokens(result.contentForModel),
                  lastUpdate: result.summary,
                  summary: result.summary,
                }
              : item
          ),
          terminalEntries: [
            ...current.terminalEntries,
            createTerminalEntry('output', `${agent.name}: ${result.summary}`, result.contentForModel, agentId),
          ],
        }))
      },
      onFinalStart: () => {
        set(current => ({
          agents: current.agents.map(item =>
            item.id === agentId ? { ...item, lastUpdate: usedTools ? 'Summarizing work…' : 'Responding…' } : item
          ),
        }))
      },
      onFinalChunk: chunk => {
        accumulated += chunk
        set(current => ({
          agents: current.agents.map(item =>
            item.id === agentId
              ? { ...item, tokens: estimateTokens(accumulated), lastUpdate: accumulated.slice(-120) || item.lastUpdate }
              : item
          ),
        }))
      },
      onFinal: message => {
        activeSwarmRuns.delete(agentId)
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
            swarmRunning: agents.some(item => item.status === 'running'),
            terminalEntries: [
              ...current.terminalEntries,
              createTerminalEntry('info', `${agent.name} complete`, message, agentId),
            ],
          }
        })
      },
      onError: error => {
        activeSwarmRuns.delete(agentId)
        set(current => {
          const agents = current.agents.map(item =>
            item.id === agentId
              ? { ...item, status: 'error' as const, lastUpdate: error.message, summary: error.message }
              : item
          )

          return {
            agents,
            swarmRunning: agents.some(item => item.status === 'running'),
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

    set(current => ({
      swarmGoal: targetGoal,
      swarmRunning: true,
      agents: [...current.agents, orchestrator],
      terminalEntries: [
        ...current.terminalEntries,
        createTerminalEntry('info', 'Swarm orchestrator', targetGoal, orchestratorId),
      ],
    }))

    const plannerProvider = (!provider.isLocal && !provider.apiKey)
      ? getConnectedProviders()[0] ?? provider
      : provider
    const controller = new AbortController()
    activeSwarmRuns.set(orchestratorId, { abort: () => controller.abort() })

    try {
      const { completeText } = await import('../lib/streamChat')
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

      set(current => ({
        agents: current.agents.map(agent =>
          agent.id === orchestratorId
            ? {
                ...agent,
                status: 'complete' as const,
                summary: subtasks.map(item => `${item.name}: ${item.task}`).join('\n'),
                lastUpdate: `Assigned ${subtasks.length} worker agents.`,
                tokens: estimateTokens(JSON.stringify(subtasks)),
              }
            : agent
        ),
        terminalEntries: [
          ...current.terminalEntries,
          createTerminalEntry(
            'info',
            'Swarm plan ready',
            subtasks.map(item => `${item.name}: ${item.task}`).join('\n'),
            orchestratorId
          ),
        ],
      }))

      const connectedProviders = getConnectedProviders()
      for (let index = 0; index < subtasks.length; index += 1) {
        const taskEntry = subtasks[index]
        const assignedProvider = connectedProviders.length > 0
          ? connectedProviders[index % connectedProviders.length]
          : state.activeProvider
        await get().spawnAgent(taskEntry.task, assignedProvider.id, taskEntry.name)
      }
    } catch (error: unknown) {
      activeSwarmRuns.delete(orchestratorId)
      const message = error instanceof Error ? error.message : String(error)
      set(current => ({
        agents: current.agents.map(agent =>
          agent.id === orchestratorId
            ? { ...agent, status: 'error' as const, summary: message, lastUpdate: message }
            : agent
        ),
        terminalEntries: [
          ...current.terminalEntries,
          createTerminalEntry('error', 'Swarm orchestration failed', message, orchestratorId),
        ],
      }))
    }
  },

  stopAgent: id => {
    activeSwarmRuns.get(id)?.abort()
    activeSwarmRuns.delete(id)

    set(current => {
      const agents = current.agents.map(agent =>
        agent.id === id
          ? { ...agent, status: 'complete' as const, lastUpdate: 'Stopped by user.' }
          : agent
      )

      return {
        agents,
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
}))
