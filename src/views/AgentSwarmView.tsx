import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Zap, Activity, ChevronDown, ChevronRight, Square, Play } from 'lucide-react'
import { clsx } from 'clsx'
import { useAppStore } from '../store/appStore'
import { notify } from '../lib/notifications'

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentStatus = 'idle' | 'running' | 'complete' | 'error'
type LogType = 'thinking' | 'tool_call' | 'tool_result' | 'stream' | 'error'

interface LocalAgent {
  id: string
  name: string
  task: string
  model: string
  status: AgentStatus
  tokens: number
  startedAt: Date | null
}

interface LogEntry {
  id: string
  agentId: string
  agentName: string
  type: LogType
  label: string
  timestamp: Date
}

// ─── Simulation data ──────────────────────────────────────────────────────────

const THINKING_LABELS = [
  'Analyzing task requirements...',
  'Breaking down objectives...',
  'Evaluating best approach...',
  'Planning next steps...',
]
const TOOL_CALL_LABELS = [
  "web_search('latest AI models')",
  "read_file('context.md')",
  "recall_memory('prior context')",
  "web_scrape('https://...')",
]
const TOOL_RESULT_LABELS = [
  'Retrieved 5 results · 1,240 tokens',
  'File read · 2,341 chars',
  'Memory recalled · 3 entries',
  'Scraped · 4,182 chars',
]
const STREAM_LABELS = [
  'Generating response...',
  'Writing output...',
  'Streaming to user...',
]

const LOG_SEQUENCE: LogType[] = ['thinking', 'tool_call', 'tool_result', 'thinking', 'stream']

const RANDOM_NAMES = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta']
const RANDOM_TASKS = [
  'Analyze competitor pricing data and summarize findings',
  'Review and improve test coverage for core modules',
  'Research latest developments in transformer architectures',
  'Draft technical documentation for the API endpoints',
  'Audit security vulnerabilities in the authentication flow',
  'Optimize database query performance for analytics',
  'Generate comprehensive test cases for the payment module',
  'Summarize recent papers on multi-agent coordination',
]
const RANDOM_MODELS = ['claude-sonnet-4-6', 'gpt-4o', 'gemini-2.0-flash', 'llama-3.3-70b']

function randomFrom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

function getLabelForType(type: LogType, index: number): string {
  switch (type) {
    case 'thinking': return THINKING_LABELS[index % THINKING_LABELS.length]
    case 'tool_call': return TOOL_CALL_LABELS[index % TOOL_CALL_LABELS.length]
    case 'tool_result': return TOOL_RESULT_LABELS[index % TOOL_RESULT_LABELS.length]
    case 'stream': return STREAM_LABELS[index % STREAM_LABELS.length]
    case 'error': return 'Stopped by user'
  }
}

const LOG_ICON: Record<LogType, string> = {
  thinking: '🧠',
  tool_call: '⚙️',
  tool_result: '✅',
  stream: '💬',
  error: '❌',
}

const STATUS_AVATAR_COLOR: Record<AgentStatus, string> = {
  running: '#7f77dd',
  complete: '#1d9e75',
  idle: '#6b6b78',
  error: '#e05050',
}

let agentSeq = 1

function createLocalAgent(): LocalAgent {
  const n = agentSeq++
  const nameIndex = (n - 1) % RANDOM_NAMES.length
  return {
    id: `local-${n}-${Date.now()}`,
    name: RANDOM_NAMES[nameIndex],
    task: randomFrom(RANDOM_TASKS),
    model: randomFrom(RANDOM_MODELS),
    status: 'idle',
    tokens: 0,
    startedAt: null,
  }
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

function SwarmAgentCard({
  agent,
  logs,
  onStop,
  onRun,
  tick,
}: {
  agent: LocalAgent
  logs: LogEntry[]
  onStop: () => void
  onRun: () => void
  tick: number
}) {
  const [expanded, setExpanded] = useState(true)
  const avatarColor = STATUS_AVATAR_COLOR[agent.status]
  const elapsed = agent.startedAt
    ? Math.floor((Date.now() - agent.startedAt.getTime()) / 1000)
    : 0

  // Current action: most recent log entry
  const lastLog = logs[logs.length - 1]

  return (
    <div
      className={clsx(
        'rounded-xl border flex flex-col transition-all duration-300',
        'bg-[#1c1c22]',
        agent.status === 'running' && 'border-[#7f77dd]/40 shadow-[0_0_16px_rgba(127,119,221,0.06)]',
        agent.status === 'complete' && 'border-[#1d9e75]/25',
        agent.status === 'idle' && 'border-[#2a2a2e]',
        agent.status === 'error' && 'border-[#e05050]/30',
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 p-4 pb-3">
        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
          style={{ background: avatarColor + '22', color: avatarColor }}
        >
          {agent.name.slice(0, 2).toUpperCase()}
        </div>

        {/* Name + status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[#e8e8ef]">{agent.name}</span>
            {/* Status badge */}
            <span
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
              style={{
                background: avatarColor + '18',
                color: avatarColor,
                border: `1px solid ${avatarColor}30`,
              }}
            >
              {agent.status === 'running' && (
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: avatarColor, animation: 'pulse 1.5s infinite' }}
                />
              )}
              {agent.status}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-[#6b6b78]">
            <span className="font-mono">{agent.tokens.toLocaleString()} tok</span>
            {agent.startedAt && (
              <span>{formatElapsed(elapsed)}</span>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {agent.status === 'running' && (
            <button
              onClick={onStop}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[#e05050]/20 text-[#e05050] bg-[#e05050]/10 hover:bg-[#e05050]/20 transition-colors"
            >
              <Square size={10} />
              Stop
            </button>
          )}
          {agent.status === 'idle' && (
            <button
              onClick={onRun}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-90 transition-colors"
              style={{ background: '#7f77dd' }}
            >
              <Play size={10} />
              Run
            </button>
          )}
        </div>
      </div>

      {/* Current action */}
      {lastLog && agent.status === 'running' && (
        <div className="px-4 pb-3">
          <p className="text-xs italic text-[#6b6b78] leading-relaxed truncate">
            {LOG_ICON[lastLog.type]} {lastLog.label}
          </p>
        </div>
      )}

      {/* Task (idle state) */}
      {agent.status === 'idle' && (
        <div className="px-4 pb-3">
          <p className="text-xs text-[#6b6b78] leading-relaxed line-clamp-2">{agent.task}</p>
        </div>
      )}

      {/* Collapsible timeline */}
      {logs.length > 0 && (
        <div className="border-t border-[#2a2a2e]">
          <button
            onClick={() => setExpanded(e => !e)}
            className="w-full flex items-center gap-2 px-4 py-2 text-xs text-[#6b6b78] hover:text-[#9898a8] transition-colors"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span>Execution Timeline</span>
            <span className="ml-auto">{logs.length} events</span>
          </button>
          {expanded && (
            <div className="px-4 pb-3 space-y-1.5 max-h-40 overflow-y-auto">
              {logs.map(entry => (
                <div key={entry.id} className="flex items-start gap-2 text-xs">
                  <span className="flex-shrink-0 w-4 text-center">{LOG_ICON[entry.type]}</span>
                  <span className="flex-1 text-[#9898a8] leading-relaxed">{entry.label}</span>
                  <span className="flex-shrink-0 text-[#4a4a52] font-mono">{formatTime(entry.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-[#2a2a2e]">
        <span className="text-xs text-[#4a4a52] font-mono">{agent.model}</span>
        <span className="text-xs text-[#4a4a52]">{logs.length} events</span>
      </div>

      {/* suppress unused tick warning */}
      <span style={{ display: 'none' }}>{tick}</span>
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function AgentSwarmView() {
  const stopAgentStore = useAppStore(s => s.stopAgent)

  const [agents, setAgents] = useState<LocalAgent[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [tick, setTick] = useState(0)

  // Intervals and cycle counters per agent
  const intervals = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map())
  const cycles = useRef<Map<string, number>>(new Map())
  const labelIndexes = useRef<Map<string, number>>(new Map())

  // Tick every second for elapsed timers
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // Auto-scroll live feed
  const feedRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = feedRef.current
    if (!el) return
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (isNearBottom) el.scrollTop = el.scrollHeight
  }, [logs])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      intervals.current.forEach(id => clearInterval(id))
    }
  }, [])

  const addLog = useCallback((agentId: string, agentName: string, type: LogType, label: string) => {
    const entry: LogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      agentId,
      agentName,
      type,
      label,
      timestamp: new Date(),
    }
    setLogs(prev => [...prev.slice(-500), entry])
    return entry
  }, [])

  const startSimulation = useCallback((agentId: string, agentName: string) => {
    if (intervals.current.has(agentId)) return
    cycles.current.set(agentId, 0)
    labelIndexes.current.set(agentId, 0)

    const tick = () => {
      const cycle = cycles.current.get(agentId) ?? 0
      const labelIdx = labelIndexes.current.get(agentId) ?? 0
      const type = LOG_SEQUENCE[cycle % LOG_SEQUENCE.length]
      const label = getLabelForType(type, labelIdx)

      addLog(agentId, agentName, type, label)

      // Update agent tokens
      setAgents(prev => prev.map(a =>
        a.id === agentId
          ? { ...a, tokens: a.tokens + Math.floor(Math.random() * 80 + 20) }
          : a
      ))

      cycles.current.set(agentId, cycle + 1)
      labelIndexes.current.set(agentId, labelIdx + 1)

      // Schedule next tick at random interval 1000-1800ms
      const delay = 1000 + Math.floor(Math.random() * 800)
      const next = setTimeout(tick, delay)
      intervals.current.set(agentId, next as unknown as ReturnType<typeof setInterval>)
    }

    const initial = setTimeout(tick, 600 + Math.floor(Math.random() * 400))
    intervals.current.set(agentId, initial as unknown as ReturnType<typeof setInterval>)
  }, [addLog])

  const stopSimulation = useCallback((agentId: string) => {
    const id = intervals.current.get(agentId)
    if (id != null) {
      clearTimeout(id as unknown as ReturnType<typeof setTimeout>)
      intervals.current.delete(agentId)
    }
  }, [])

  const handleSpawnAgent = () => {
    const agent = createLocalAgent()
    setAgents(prev => [...prev, agent])
  }

  const handleRun = (agentId: string) => {
    setAgents(prev => prev.map(a =>
      a.id === agentId ? { ...a, status: 'running', startedAt: new Date() } : a
    ))
    const agent = agents.find(a => a.id === agentId)
    if (agent) startSimulation(agentId, agent.name)
  }

  const handleStop = (agentId: string) => {
    stopSimulation(agentId)
    const agent = agents.find(a => a.id === agentId)
    if (agent) {
      addLog(agentId, agent.name, 'error', 'Stopped by user')
      void notify('Drodo', `${agent.name} has stopped.`)
    }
    setAgents(prev => prev.map(a =>
      a.id === agentId ? { ...a, status: 'error' } : a
    ))
    // Call store stop in case it's also tracked there
    try { stopAgentStore(agentId) } catch { /* local agent */ }
  }

  const runningCount = agents.filter(a => a.status === 'running').length

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden" style={{ background: '#0d0d0f' }}>
      {/* ── Left panel: Agent grid (65%) ─────────────────────── */}
      <div className="flex flex-col min-h-0 overflow-hidden" style={{ width: '65%', borderRight: '1px solid #2a2a2e' }}>
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #2a2a2e', background: '#141418' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#7f77dd22' }}>
              <Zap size={18} style={{ color: '#7f77dd' }} />
            </div>
            <div>
              <h1 className="font-bold text-[#e8e8ef] text-lg">Agent Swarm</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Activity size={11} className="text-[#6b6b78]" />
                <span className="text-xs text-[#6b6b78]">
                  {runningCount} running · {agents.length} total
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={handleSpawnAgent}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
            style={{ background: '#7f77dd', boxShadow: '0 2px 12px rgba(127,119,221,0.35)' }}
          >
            <Plus size={15} />
            Spawn Agent
          </button>
        </div>

        {/* Agent grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: '#1c1c22' }}>
                <Zap size={28} className="text-[#2a2a2e]" />
              </div>
              <p className="text-[#6b6b78] text-sm">
                No agents yet.
                <br />
                Click <strong className="text-[#9898a8]">Spawn Agent</strong> to create one and hit Run.
              </p>
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {agents.map(agent => (
                <SwarmAgentCard
                  key={agent.id}
                  agent={agent}
                  logs={logs.filter(l => l.agentId === agent.id)}
                  onStop={() => handleStop(agent.id)}
                  onRun={() => handleRun(agent.id)}
                  tick={tick}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel: Live Feed (35%) ─────────────────────── */}
      <div className="flex flex-col min-h-0 overflow-hidden" style={{ width: '35%' }}>
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #2a2a2e', background: '#141418' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#e8e8ef]">Live Feed</span>
            {runningCount > 0 && (
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: '#1d9e75', animation: 'pulse 1.5s infinite' }}
              />
            )}
            <span className="text-xs text-[#6b6b78]">({logs.length})</span>
          </div>
          <button
            onClick={() => setLogs([])}
            className="text-xs text-[#6b6b78] hover:text-[#9898a8] px-2 py-1 rounded-lg hover:bg-[#1c1c22] transition-colors"
          >
            Clear
          </button>
        </div>

        {/* Feed scroll area */}
        <div ref={feedRef} className="flex-1 overflow-y-auto p-4 space-y-1.5">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-2 py-10">
              <span className="text-2xl">📡</span>
              <p className="text-xs text-[#6b6b78]">Agent activity will appear here in real time</p>
            </div>
          ) : (
            logs.map(entry => (
              <div key={entry.id} className="flex items-start gap-2 text-xs py-1">
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{ background: '#1c1c22', color: '#7f77dd', fontSize: 10 }}
                >
                  {entry.agentName}
                </span>
                <span className="flex-shrink-0">{LOG_ICON[entry.type]}</span>
                <span className="flex-1 text-[#9898a8] leading-relaxed break-all">{entry.label}</span>
                <span className="flex-shrink-0 text-[#4a4a52] font-mono text-[10px]">
                  {formatTime(entry.timestamp)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
