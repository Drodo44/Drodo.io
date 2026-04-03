import { create } from 'zustand'
import type {
  NavView,
  PermissionTier,
  AgentInstance,
  Message,
  Provider,
  TaskStep,
  Connector,
} from '../types'
import { streamCompletion } from '../lib/streamChat'
import { loadProviderConfig, saveProviderConfig } from '../lib/providerApi'

// ─── Module-level streaming handle (not in Zustand state — not serializable) ─

let activeStreamHandle: { abort: () => void } | null = null
let autonomousLoopTimer: ReturnType<typeof setTimeout> | null = null

// ─── "Done" heuristic for autonomous mode ────────────────────────────────────

const DONE_PHRASES = [
  'task complete', 'task is complete', 'all done', 'that\'s everything',
  'work is complete', 'finished', 'completed successfully', 'done.',
  'all steps complete', 'implementation complete', 'i\'ve finished',
]

function looksComplete(text: string): boolean {
  const lower = text.toLowerCase()
  return DONE_PHRASES.some(p => lower.includes(p))
}

// ─── State interface ──────────────────────────────────────────────────────────

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
  connectors: Connector[]

  // Actions
  setView: (v: NavView) => void
  setSessionName: (name: string) => void
  toggleAgentRunning: () => void
  setPermission: (t: PermissionTier) => void
  setPendingTier: (t: PermissionTier | null) => void
  setPermissionWarningOpen: (open: boolean) => void
  confirmPermission: () => void
  toggleAutonomous: () => void
  setActiveProvider: (p: Provider) => void
  setProviderHubOpen: (open: boolean) => void
  addMessage: (m: Message) => void
  sendMessage: (content: string) => void
  stopAll: () => void
  spawnAgent: () => void
  stopAgent: (id: string) => void
  setConnectorConnected: (id: string, connected: boolean) => void
}

// ─── Mock data ────────────────────────────────────────────────────────────────

function buildDefaultProvider(): Provider {
  const saved = loadProviderConfig('anthropic')
  return {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: saved?.baseUrl ?? 'api.anthropic.com',
    model: saved?.model ?? 'claude-sonnet-4-6',
    apiKey: saved?.apiKey ?? '',
    color: '#cc785c',
    initials: 'AN',
    isConnected: !!saved?.apiKey,
  }
}

const MOCK_MESSAGES: Message[] = [
  {
    id: '1',
    role: 'system',
    content: 'Session started. Drodo is ready.',
    timestamp: new Date(Date.now() - 120000),
  },
  {
    id: '2',
    role: 'user',
    content: 'Analyze the project structure and create a comprehensive test suite for the authentication module.',
    timestamp: new Date(Date.now() - 90000),
  },
  {
    id: '3',
    role: 'assistant',
    content: `I'll analyze the authentication module and create a comprehensive test suite. Let me start by examining the codebase structure.\n\n**Analysis complete.** I found 3 auth-related files:\n- \`src/auth/login.ts\` — JWT login handler\n- \`src/auth/middleware.ts\` — Route protection middleware  \n- \`src/auth/refresh.ts\` — Token refresh logic\n\nCreating test suite now...`,
    timestamp: new Date(Date.now() - 60000),
  },
]

const MOCK_AGENTS: AgentInstance[] = [
  {
    id: 'a1',
    name: 'Architect',
    model: 'claude-sonnet-4-6',
    task: 'Designing the database schema for the new analytics pipeline',
    status: 'running',
    tokens: 12847,
    startedAt: new Date(Date.now() - 240000),
  },
  {
    id: 'a2',
    name: 'Coder',
    model: 'gpt-4o',
    task: 'Implementing REST API endpoints for user management',
    status: 'running',
    tokens: 8234,
    startedAt: new Date(Date.now() - 180000),
  },
  {
    id: 'a3',
    name: 'Reviewer',
    model: 'claude-sonnet-4-6',
    task: 'Code review and security audit of the payment module',
    status: 'complete',
    tokens: 31209,
  },
  {
    id: 'a4',
    name: 'Tester',
    model: 'llama3.2',
    task: 'Waiting for Coder to finish before running test suite',
    status: 'idle',
    tokens: 0,
  },
]

const MOCK_TASK_STEPS: TaskStep[] = [
  { id: 's1', label: 'Read project structure', status: 'complete' },
  { id: 's2', label: 'Analyze auth module', status: 'complete' },
  { id: 's3', label: 'Generate unit tests', status: 'running' },
  { id: 's4', label: 'Generate integration tests', status: 'pending' },
  { id: 's5', label: 'Run test suite', status: 'pending' },
  { id: 's6', label: 'Fix failing tests', status: 'pending' },
]

const INITIAL_CONNECTORS: Connector[] = [
  // Social Media
  { id: 'youtube', name: 'YouTube', category: 'Social Media', color: '#ff0000', initials: 'YT', isConnected: false, requiresKey: true, keyPlaceholder: 'AIza...' },
  { id: 'tiktok', name: 'TikTok', category: 'Social Media', color: '#010101', initials: 'TK', isConnected: false, requiresKey: true, keyPlaceholder: 'TikTok API key' },
  { id: 'instagram', name: 'Instagram', category: 'Social Media', color: '#e1306c', initials: 'IG', isConnected: false, requiresKey: true, keyPlaceholder: 'Meta API token' },
  { id: 'twitter', name: 'Twitter / X', category: 'Social Media', color: '#1da1f2', initials: 'X', isConnected: false, requiresKey: true, keyPlaceholder: 'Bearer token' },
  { id: 'reddit', name: 'Reddit', category: 'Social Media', color: '#ff4500', initials: 'RD', isConnected: false, requiresKey: true, keyPlaceholder: 'Client secret' },
  { id: 'linkedin', name: 'LinkedIn', category: 'Social Media', color: '#0077b5', initials: 'LI', isConnected: false, requiresKey: true, keyPlaceholder: 'OAuth token' },
  // Productivity
  { id: 'gworkspace', name: 'Google Workspace', category: 'Productivity', color: '#4285f4', initials: 'GW', isConnected: false, requiresKey: true, keyPlaceholder: 'OAuth2 credentials' },
  { id: 'notion', name: 'Notion', category: 'Productivity', color: '#000000', initials: 'NO', isConnected: false, requiresKey: true, keyPlaceholder: 'secret_...' },
  { id: 'airtable', name: 'Airtable', category: 'Productivity', color: '#18bfff', initials: 'AT', isConnected: false, requiresKey: true, keyPlaceholder: 'pat...' },
  { id: 'slack', name: 'Slack', category: 'Productivity', color: '#4a154b', initials: 'SL', isConnected: false, requiresKey: true, keyPlaceholder: 'xoxb-...' },
  { id: 'discord', name: 'Discord', category: 'Productivity', color: '#5865f2', initials: 'DC', isConnected: false, requiresKey: true, keyPlaceholder: 'Bot token' },
  { id: 'm365', name: 'Microsoft 365', category: 'Productivity', color: '#0078d4', initials: 'MS', isConnected: false, requiresKey: true, keyPlaceholder: 'Client secret' },
  // Development
  { id: 'github', name: 'GitHub', category: 'Development', color: '#181717', initials: 'GH', isConnected: false, requiresKey: true, keyPlaceholder: 'ghp_...' },
  { id: 'vercel', name: 'Vercel', category: 'Development', color: '#000000', initials: 'VC', isConnected: false, requiresKey: true, keyPlaceholder: 'Vercel token' },
  { id: 'supabase', name: 'Supabase', category: 'Development', color: '#3ecf8e', initials: 'SB', isConnected: false, requiresKey: true, keyPlaceholder: 'Service role key' },
  { id: 'cloudflare', name: 'Cloudflare', category: 'Development', color: '#f6821f', initials: 'CF', isConnected: false, requiresKey: true, keyPlaceholder: 'API token' },
  // Automation
  { id: 'n8n', name: 'n8n', category: 'Automation', color: '#ea4b71', initials: 'N8', isConnected: false, requiresKey: true, keyPlaceholder: 'Webhook URL or API key' },
  { id: 'zapier', name: 'Zapier', category: 'Automation', color: '#ff4a00', initials: 'ZP', isConnected: false, requiresKey: true, keyPlaceholder: 'Zapier API key' },
  { id: 'make', name: 'Make', category: 'Automation', color: '#6d00cc', initials: 'MK', isConnected: false, requiresKey: true, keyPlaceholder: 'API key' },
  { id: 'pipedream', name: 'Pipedream', category: 'Automation', color: '#3cb371', initials: 'PD', isConnected: false, requiresKey: true, keyPlaceholder: 'API key' },
  // E-commerce
  { id: 'shopify', name: 'Shopify', category: 'E-commerce', color: '#96bf48', initials: 'SH', isConnected: false, requiresKey: true, keyPlaceholder: 'shpat_...' },
  { id: 'stripe', name: 'Stripe', category: 'E-commerce', color: '#635bff', initials: 'ST', isConnected: false, requiresKey: true, keyPlaceholder: 'sk_live_...' },
  // Media & Creative
  { id: 'elevenlabs', name: 'ElevenLabs', category: 'Media & Creative', color: '#5a5a5a', initials: 'EL', isConnected: false, requiresKey: true, keyPlaceholder: 'xi_api_key' },
  { id: 'runway', name: 'Runway', category: 'Media & Creative', color: '#000000', initials: 'RW', isConnected: false, requiresKey: true, keyPlaceholder: 'API key' },
  { id: 'midjourney', name: 'Midjourney', category: 'Media & Creative', color: '#000000', initials: 'MJ', isConnected: false, requiresKey: true, keyPlaceholder: 'API key' },
  { id: 'stablediff', name: 'Stable Diffusion', category: 'Media & Creative', color: '#7f77dd', initials: 'SD', isConnected: false, requiresKey: true, keyPlaceholder: 'API key' },
  // Communication
  { id: 'gmail', name: 'Gmail', category: 'Communication', color: '#ea4335', initials: 'GM', isConnected: false, requiresKey: true, keyPlaceholder: 'OAuth2 credentials' },
  { id: 'telegram', name: 'Telegram', category: 'Communication', color: '#229ed9', initials: 'TG', isConnected: false, requiresKey: true, keyPlaceholder: 'Bot token' },
  { id: 'whatsapp', name: 'WhatsApp Business', category: 'Communication', color: '#25d366', initials: 'WA', isConnected: false, requiresKey: true, keyPlaceholder: 'Access token' },
]

// Load connector status from localStorage
function loadConnectors(): Connector[] {
  try {
    const saved = localStorage.getItem('drodo_connectors')
    if (!saved) return INITIAL_CONNECTORS
    const savedMap: Record<string, boolean> = JSON.parse(saved)
    return INITIAL_CONNECTORS.map(c => ({ ...c, isConnected: savedMap[c.id] ?? false }))
  } catch {
    return INITIAL_CONNECTORS
  }
}

let agentCounter = MOCK_AGENTS.length + 1

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>((set, get) => ({
  activeView: 'agent',
  sessionName: 'Auth Module Test Suite',
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
  messages: MOCK_MESSAGES,
  agents: MOCK_AGENTS,
  taskSteps: MOCK_TASK_STEPS,
  connectors: loadConnectors(),

  setView: (v) => set({ activeView: v }),
  setSessionName: (name) => set({ sessionName: name }),
  toggleAgentRunning: () => set((s) => ({ agentRunning: !s.agentRunning })),

  setPermission: (t) => {
    if (t === 'wide-open') set({ pendingTier: t, permissionWarningOpen: true })
    else set({ permissionTier: t })
  },
  setPendingTier: (t) => set({ pendingTier: t }),
  setPermissionWarningOpen: (open) => set({ permissionWarningOpen: open }),
  confirmPermission: () => {
    const { pendingTier } = get()
    if (pendingTier) set({ permissionTier: pendingTier, pendingTier: null, permissionWarningOpen: false })
  },

  toggleAutonomous: () => set((s) => ({ autonomousMode: !s.autonomousMode })),

  setActiveProvider: (p) => {
    set({ activeProvider: p })
    // Persist to localStorage
    saveProviderConfig(p.id, {
      apiKey: p.apiKey ?? '',
      baseUrl: p.baseUrl,
      model: p.model ?? '',
    })
  },

  setProviderHubOpen: (open) => set({ providerHubOpen: open }),

  addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),

  stopAll: () => {
    activeStreamHandle?.abort()
    activeStreamHandle = null
    if (autonomousLoopTimer) {
      clearTimeout(autonomousLoopTimer)
      autonomousLoopTimer = null
    }
    set((s) => ({
      agentRunning: false,
      autonomousLoopActive: false,
      autonomousLoopCount: 0,
      // Mark any streaming message as done
      messages: s.messages.map(m =>
        m.streaming ? { ...m, streaming: false, content: m.content + ' [stopped]' } : m
      ),
    }))
  },

  sendMessage: (content) => {
    const state = get()

    // Stop any existing stream
    activeStreamHandle?.abort()
    activeStreamHandle = null
    if (autonomousLoopTimer) {
      clearTimeout(autonomousLoopTimer)
      autonomousLoopTimer = null
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    }
    const assistantId = (Date.now() + 1).toString()
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      streaming: true,
    }

    set((s) => ({
      messages: [
        ...s.messages.map(m => ({ ...m, streaming: false })),
        userMsg,
        assistantMsg,
      ],
      agentRunning: true,
    }))

    let accumulated = ''
    const provider = state.activeProvider
    const currentMessages = [...state.messages.filter(m => !m.streaming), userMsg]

    // If no API key and not local, fall back to a helpful message
    if (!provider.isLocal && !provider.apiKey) {
      setTimeout(() => {
        set((s) => ({
          messages: s.messages.map(m =>
            m.id === assistantId
              ? {
                  ...m,
                  streaming: false,
                  content: `No API key configured for **${provider.name}**. Click the provider badge in the sidebar (or top bar) to open the Provider Hub and enter your API key.`,
                }
              : m
          ),
          agentRunning: false,
        }))
      }, 600)
      return
    }

    activeStreamHandle = streamCompletion(
      provider,
      currentMessages,
      // onChunk
      (chunk) => {
        accumulated += chunk
        set((s) => ({
          messages: s.messages.map(m =>
            m.id === assistantId ? { ...m, content: accumulated } : m
          ),
        }))
      },
      // onDone
      () => {
        activeStreamHandle = null
        const { autonomousMode, autonomousLoopCount, autonomousMaxLoops } = get()

        set((s) => ({
          messages: s.messages.map(m =>
            m.id === assistantId ? { ...m, streaming: false, content: accumulated || m.content } : m
          ),
          agentRunning: false,
          autonomousLoopActive: false,
        }))

        // Autonomous mode: continue if not done and under loop limit
        if (autonomousMode && autonomousLoopCount < autonomousMaxLoops && !looksComplete(accumulated)) {
          set({ autonomousLoopCount: autonomousLoopCount + 1, autonomousLoopActive: true, agentRunning: true })
          autonomousLoopTimer = setTimeout(() => {
            get().sendMessage('Continue with the next step. Be thorough and complete the task.')
          }, 1500)
        } else if (autonomousMode) {
          set({ autonomousLoopCount: 0, autonomousLoopActive: false })
        }
      },
      // onError
      (err) => {
        activeStreamHandle = null
        set((s) => ({
          messages: s.messages.map(m =>
            m.id === assistantId
              ? {
                  ...m,
                  streaming: false,
                  content: `**Error:** ${err.message}\n\nCheck your API key and provider settings in the Provider Hub.`,
                }
              : m
          ),
          agentRunning: false,
          autonomousLoopActive: false,
        }))
      }
    )
  },

  spawnAgent: () => {
    const names = ['Planner', 'Debugger', 'Optimizer', 'Researcher', 'Writer']
    const models = ['claude-sonnet-4-6', 'gpt-4o', 'llama3.2', 'mixtral-8x7b']
    const tasks = [
      'Analyzing system performance bottlenecks',
      'Researching best practices for the current task',
      'Writing documentation for new modules',
      'Debugging failing edge cases in the test suite',
    ]
    const newAgent: AgentInstance = {
      id: `a${agentCounter++}`,
      name: names[Math.floor(Math.random() * names.length)],
      model: models[Math.floor(Math.random() * models.length)],
      task: tasks[Math.floor(Math.random() * tasks.length)],
      status: 'idle',
      tokens: 0,
      startedAt: new Date(),
    }
    set((s) => ({ agents: [...s.agents, newAgent] }))
  },

  stopAgent: (id) => {
    set((s) => ({
      agents: s.agents.map(a => a.id === id ? { ...a, status: 'complete' } : a),
    }))
  },

  setConnectorConnected: (id, connected) => {
    set((s) => {
      const updated = s.connectors.map(c => c.id === id ? { ...c, isConnected: connected } : c)
      // Persist
      const map: Record<string, boolean> = {}
      updated.forEach(c => { if (c.isConnected) map[c.id] = true })
      localStorage.setItem('drodo_connectors', JSON.stringify(map))
      return { connectors: updated }
    })
  },
}))
