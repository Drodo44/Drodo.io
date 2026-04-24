import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Plus, Zap, Activity, ChevronDown, ChevronRight, Square, Workflow, Copy, X, Target } from 'lucide-react'
import { clsx } from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import * as Dialog from '@radix-ui/react-dialog'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAppStore } from '../store/appStore'
import { getMemoryStats, onMemoryStatsChange, type MemoryStats } from '../lib/agentMemory'
import { notify } from '../lib/notifications'
import { getAllSavedModels, getSavedModelDisplayName, getSavedModelDisplayNameMap } from '../lib/providerApi'
import { streamCompletion } from '../lib/streamChat'
import {
  ensureWorkflowCatalogLoaded,
  findWorkflowForTask,
  getWorkflowTemplate,
  type WorkflowMatch,
} from '../lib/workflows'
import type { AgentInstance, OrchestrationRun, SwarmFeedEntry } from '../types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkflowModalState {
  agentId: string
  agentName: string
  task: string
  sourceOutput: string
  matchedWorkflow: WorkflowMatch | null
}

interface ModelOption {
  key: string
  providerId: string
  modelId: string
  label: string
}

const N8N_SYSTEM_PROMPT = 'You are an n8n workflow expert. Convert the following task and output into a valid n8n workflow JSON that accomplishes the same goal permanently and repeatably. Return ONLY valid n8n workflow JSON, nothing else.'
const N8N_TEMPLATE_SYSTEM_PROMPT = 'You are an n8n workflow expert. Start from the provided n8n workflow template JSON, adapt it to the task and the completed agent output, and return ONLY valid n8n workflow JSON.'

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function feedIcon(type: SwarmFeedEntry['type']): string {
  switch (type) {
    case 'start': return '🤖'
    case 'complete': return '✅'
    case 'error': return '❌'
    case 'summary': return '🏁'
    case 'chunk': return '💬'
    default: return '•'
  }
}

// ─── Workflow Handoff Modal ───────────────────────────────────────────────────

function WorkflowHandoffModal({
  modal,
  generatedJson,
  generationError,
  generationRunning,
  importStatus,
  onClose,
  onGenerate,
  onCopy,
  onImport,
}: {
  modal: WorkflowModalState
  generatedJson: string
  generationError: string | null
  generationRunning: boolean
  importStatus: string | null
  onClose: () => void
  onGenerate: () => void
  onCopy: () => void
  onImport: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6 py-8"
      style={{ background: 'rgba(0, 0, 0, 0.55)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-2xl border overflow-hidden"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        onClick={event => event.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border-color)' }}
        >
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">Agent to n8n Workflow</h2>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {modal.agentName} · convert the completed agent output into a reusable n8n workflow
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid min-h-0 md:grid-cols-[0.95fr,1.05fr]">
          <div className="p-5 space-y-4" style={{ borderRight: '1px solid var(--border-color)' }}>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)] mb-2">
                Agent Task
              </div>
              <div
                className="rounded-xl border px-4 py-3 text-sm text-[var(--text-primary)]"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}
              >
                {modal.task}
              </div>
            </div>

            {modal.matchedWorkflow && (
              <div
                className="rounded-xl border px-4 py-3"
                style={{ background: '#1d9e7510', borderColor: '#1d9e7528' }}
              >
                <div className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: '#1d9e75' }}>
                  Pre-built Template
                </div>
                <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                  Pre-built template found: {modal.matchedWorkflow.workflow.name} - adapted for your task
                </div>
                <div className="mt-1 text-xs text-[var(--text-secondary)]">
                  Confidence {(modal.matchedWorkflow.confidence * 100).toFixed(0)}% · {modal.matchedWorkflow.workflow.category}
                </div>
              </div>
            )}

            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)] mb-2">
                Last Output
              </div>
              <div
                className="rounded-xl border px-4 py-3 text-xs whitespace-pre-wrap font-mono max-h-[360px] overflow-y-auto"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
              >
                {modal.sourceOutput || 'No output captured.'}
              </div>
            </div>

            <button
              onClick={onGenerate}
              disabled={generationRunning}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: 'var(--accent)' }}
            >
              <Workflow size={14} />
              {generationRunning ? 'Generating…' : modal.matchedWorkflow ? 'Adapt Template into Workflow' : 'Generate n8n Workflow'}
            </button>

            {generationError && (
              <div className="text-xs rounded-xl px-4 py-3" style={{ color: '#e05050', background: '#e0505010', border: '1px solid #e0505020' }}>
                {generationError}
              </div>
            )}
          </div>

          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                Generated Workflow JSON
              </div>
              {generatedJson && !generationRunning && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={onCopy}
                    className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    <Copy size={12} />
                    Copy JSON
                  </button>
                  <button
                    onClick={onImport}
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                    style={{ background: 'var(--accent)' }}
                  >
                    Import to n8n
                  </button>
                </div>
              )}
            </div>

            <pre
              className="rounded-xl border px-4 py-3 text-xs font-mono whitespace-pre-wrap break-all min-h-[360px] max-h-[520px] overflow-y-auto"
              style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            >
              {generatedJson || (generationRunning ? 'Streaming workflow JSON…' : 'Generated JSON will appear here.')}
            </pre>

            {importStatus && (
              <div
                className="rounded-xl px-4 py-3 text-xs"
                style={{
                  background: importStatus.startsWith('Imported') ? '#1d9e7510' : '#e0505010',
                  border: `1px solid ${importStatus.startsWith('Imported') ? '#1d9e7520' : '#e0505020'}`,
                  color: importStatus.startsWith('Imported') ? '#1d9e75' : '#e05050',
                }}
              >
                {importStatus}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Spawn Agent Modal ────────────────────────────────────────────────────────

function SpawnAgentModal({
  name,
  task,
  selectedModel,
  modelOptions,
  onClose,
  onNameChange,
  onTaskChange,
  onModelChange,
  onSubmit,
}: {
  name: string
  task: string
  selectedModel: string
  modelOptions: ModelOption[]
  onClose: () => void
  onNameChange: (value: string) => void
  onTaskChange: (value: string) => void
  onModelChange: (value: string) => void
  onSubmit: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6 py-8"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border p-6"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-[var(--text-primary)]">Spawn Agent</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--text-muted)]">Agent Name (optional)</label>
            <input
              value={name}
              onChange={e => onNameChange(e.target.value)}
              placeholder="e.g. Research Agent"
              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[#7f77dd]/60"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--text-muted)]">Task <span className="text-[#e05050]">*</span></label>
            <textarea
              value={task}
              onChange={e => onTaskChange(e.target.value)}
              placeholder="Describe what this agent should do…"
              rows={3}
              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[#7f77dd]/60 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--text-muted)]">Model</label>
            <select
              value={selectedModel}
              onChange={event => onModelChange(event.target.value)}
              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60"
            >
              {modelOptions.map(option => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              disabled={!task.trim()}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#7f77dd' }}
            >
              <Plus size={14} />
              Spawn Agent
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Orchestration Banner ─────────────────────────────────────────────────────

const STATUS_LABEL: Record<OrchestrationRun['status'], string> = {
  planning: 'Planning',
  running: 'Running',
  complete: 'Complete',
  error: 'Error',
}

const STATUS_COLOR: Record<OrchestrationRun['status'], string> = {
  planning: '#7f77dd',
  running: '#f97316',
  complete: '#1d9e75',
  error: '#e05050',
}

function OrchestrationBanner({
  run,
  storeAgents,
  onDismiss,
}: {
  run: OrchestrationRun
  storeAgents: AgentInstance[]
  onDismiss: () => void
}) {
  const orchAgents = storeAgents.filter(a => a.orchestrationStepIndex != null)
  const completedSteps = orchAgents.filter(a => a.status === 'complete').length
  const totalSteps = run.plan.agents.length || orchAgents.length
  const statusColor = STATUS_COLOR[run.status]

  return (
    <div
      className="flex-shrink-0 flex items-center gap-3 px-5 py-3"
      style={{ background: '#7f77dd14', borderBottom: '1px solid #7f77dd28' }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: '#7f77dd22' }}
      >
        <Target size={14} style={{ color: '#7f77dd' }} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
          {run.plan.taskSummary || run.originalTask}
        </p>
        {totalSteps > 0 && run.status !== 'planning' && (
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Step {Math.min(completedSteps + 1, totalSteps)} of {totalSteps}
          </p>
        )}
      </div>

      <span
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0"
        style={{ background: statusColor + '18', color: statusColor, border: `1px solid ${statusColor}30` }}
      >
        {run.status === 'running' && (
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor, animation: 'pulse 1.5s infinite' }} />
        )}
        {STATUS_LABEL[run.status]}
      </span>

      <button
        onClick={onDismiss}
        className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors flex-shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  )
}

// ─── Managed Agent Card (orchestration agents from store) ─────────────────────

const AGENT_STATUS_COLOR: Record<string, string> = {
  running: '#7f77dd',
  complete: '#1d9e75',
  idle: 'var(--text-secondary)',
  error: '#e05050',
}

function ManagedAgentCard({
  agent,
  modelLabel,
  onStop,
  onBuildWorkflow,
}: {
  agent: AgentInstance
  modelLabel: string
  onStop?: () => void
  onBuildWorkflow?: () => void
}) {
  const [outputOpen, setOutputOpen] = useState(false)
  const color = AGENT_STATUS_COLOR[agent.status] ?? 'var(--text-secondary)'
  const stepNum = agent.orchestrationStepIndex

  return (
    <div
      className={clsx(
        'rounded-xl border flex flex-col transition-all duration-300 bg-[var(--bg-tertiary)] overflow-hidden',
        agent.status === 'running' && 'border-[#7f77dd]/40 shadow-[0_0_16px_rgba(127,119,221,0.06)]',
        agent.status === 'complete' && 'border-[#1d9e75]/25',
        agent.status === 'idle' && 'border-[var(--border-color)]',
        agent.status === 'error' && 'border-[#e05050]/30',
      )}
    >
      {/* Progress bar */}
      {agent.status === 'running' && (
        <div className="h-1 w-full overflow-hidden" style={{ background: color + '22' }}>
          <div className="h-full w-1/4" style={{ background: color, animation: 'indeterminate 1.5s ease-in-out infinite' }} />
        </div>
      )}
      {agent.status === 'complete' && (
        <div className="h-1 w-full" style={{ background: color }} />
      )}

      <div className="flex items-center gap-3 p-4 pb-3">
        {/* Avatar with step badge */}
        <div className="relative flex-shrink-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
            style={{ background: color + '22', color }}
          >
            {agent.name.slice(0, 2).toUpperCase()}
          </div>
          {stepNum != null && (
            <span
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
              style={{ background: '#7f77dd' }}
            >
              {stepNum}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[var(--text-primary)]">{agent.name}</span>
            <span
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: color + '18', color, border: `1px solid ${color}30` }}
            >
              {agent.status === 'running' && (
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color, animation: 'pulse 1.5s infinite' }} />
              )}
              {agent.status}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--text-secondary)]">
            <span className="font-mono">{agent.tokens.toLocaleString()} tok</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onStop && agent.status === 'running' && (
            <button
              onClick={onStop}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[#e05050]/20 text-[#e05050] bg-[#e05050]/10 hover:bg-[#e05050]/20 transition-colors"
            >
              <Square size={10} />
              Stop
            </button>
          )}
          {onBuildWorkflow && agent.status === 'complete' && (
            <button
              onClick={onBuildWorkflow}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-90 transition-colors"
              style={{ background: '#7f77dd' }}
            >
              <Workflow size={10} />
              Workflow
            </button>
          )}
        </div>
      </div>

      {/* Task / lastUpdate */}
      <div className="px-4 pb-3">
        <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-3">
          {agent.status === 'idle' ? agent.task : agent.lastUpdate || agent.task}
        </p>
      </div>

      {/* View output link for complete agents */}
      {agent.status === 'complete' && agent.summary && (
        <div className="border-t border-[var(--border-color)]">
          <button
            onClick={() => setOutputOpen(true)}
            className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium hover:bg-[var(--bg-secondary)] transition-colors"
            style={{ color }}
          >
            <ChevronRight size={12} />
            <span>View output &rarr;</span>
          </button>

          <Dialog.Root open={outputOpen} onOpenChange={setOutputOpen}>
            <Dialog.Portal>
              <Dialog.Overlay
                className="fixed inset-0 z-50"
                style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
              />
              <Dialog.Content
                className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl shadow-2xl overflow-hidden animate-fade-in flex flex-col"
                style={{
                  width: 640,
                  maxHeight: '80vh',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                }}
              >
                {/* Modal header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
                  <Dialog.Title className="text-sm font-semibold text-[var(--text-primary)]">
                    {agent.name} — Output
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <button className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors">
                      <X size={16} />
                    </button>
                  </Dialog.Close>
                </div>
                {/* Modal body */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <div className="drodo-prose text-sm">
                    <Markdown remarkPlugins={[remarkGfm]}>{agent.summary}</Markdown>
                  </div>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--border-color)]">
        <span className="text-xs text-[var(--text-muted)] font-mono">{modelLabel}</span>
        <span className="text-xs text-[var(--text-muted)]">
          {stepNum != null ? `Step ${stepNum}` : agent.providerName}
        </span>
      </div>
    </div>
  )
}

// ─── Consolidated Feed Group (collapsible earlier activity) ──────────────────

function ConsolidatedGroupCard({ group }: { group: { summary: string; entries: SwarmFeedEntry[] } }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] mb-2">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-muted)] transition-colors"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span>{'\uD83D\uDCCB'} {group.entries.length} earlier actions completed \u2014 click to expand</span>
      </button>
      {expanded && (
        <div className="px-3 pb-2 space-y-1 max-h-60 overflow-y-auto border-t border-[var(--border-color)]">
          {group.entries.map(entry => (
            <div key={entry.id} className="flex items-start gap-2 text-xs py-0.5">
              <span
                className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                style={{ background: 'var(--bg-tertiary)', color: '#7f77dd', fontSize: 10 }}
              >
                {entry.agentName}
              </span>
              <span className="flex-shrink-0">{feedIcon(entry.type)}</span>
              <span className="flex-1 text-[var(--text-muted)] leading-relaxed break-all">
                {entry.type === 'chunk'
                  ? entry.content.slice(-300)
                  : entry.content.slice(0, 300)}
                {entry.content.length > 300 ? '\u2026' : ''}
              </span>
              <span className="flex-shrink-0 text-[var(--text-muted)] font-mono text-[10px]">
                {formatTime(new Date(entry.timestamp))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function AgentSwarmView() {
  const { stopAgentStore, spawnAgentStore, activeProvider, orchestrationRun, storeAgents, setOrchestrationRun } = useAppStore(
    useShallow(s => ({
      stopAgentStore: s.stopAgent,
      spawnAgentStore: s.spawnAgent,
      activeProvider: s.activeProvider,
      orchestrationRun: s.orchestrationRun,
      storeAgents: s.agents,
      setOrchestrationRun: s.setOrchestrationRun,
    }))
  )

  const [visibleEntries, setVisibleEntries] = useState<SwarmFeedEntry[]>([])
  const [consolidatedGroups, setConsolidatedGroups] = useState<Array<{ summary: string; entries: SwarmFeedEntry[] }>>([])
  const [memoryStats, setMemoryStats] = useState<MemoryStats>({ count: 0, lastUpdated: null })
  const [workflowModal, setWorkflowModal] = useState<WorkflowModalState | null>(null)
  const [generatedWorkflowJson, setGeneratedWorkflowJson] = useState('')
  const [workflowGenerationRunning, setWorkflowGenerationRunning] = useState(false)
  const [workflowGenerationError, setWorkflowGenerationError] = useState<string | null>(null)
  const [n8nImportStatus, setN8nImportStatus] = useState<string | null>(null)
  const [spawnModalOpen, setSpawnModalOpen] = useState(false)
  const [spawnName, setSpawnName] = useState('')
  const [spawnTask, setSpawnTask] = useState('')
  const [selectedModelKey, setSelectedModelKey] = useState('')
  const workflowStreamRef = useRef<{ abort: () => void } | null>(null)
  const feedRef = useRef<HTMLDivElement>(null)
  const previousAgentStateRef = useRef<Map<string, Pick<AgentInstance, 'status' | 'tokens' | 'lastUpdate' | 'summary'>>>(new Map())
  const feedDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingEntriesRef = useRef<SwarmFeedEntry[]>([])
  const savedModelDisplayNames = useMemo(() => getSavedModelDisplayNameMap(), [activeProvider.id, activeProvider.model, storeAgents])

  // Auto-scroll live feed to bottom when new entries arrive
  useEffect(() => {
    const el = feedRef.current
    if (!el) return
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (isNearBottom) el.scrollTop = el.scrollHeight
  }, [visibleEntries])

  useEffect(() => {
    let mounted = true

    void getMemoryStats().then(stats => {
      if (mounted) setMemoryStats(stats)
    })

    const unsubscribe = onMemoryStatsChange(setMemoryStats)
    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    const nextSnapshots = new Map<string, Pick<AgentInstance, 'status' | 'tokens' | 'lastUpdate' | 'summary'>>()
    const newEntries: SwarmFeedEntry[] = []

    for (const agent of storeAgents) {
      const previous = previousAgentStateRef.current.get(agent.id)
      const snapshot = {
        status: agent.status,
        tokens: agent.tokens,
        lastUpdate: agent.lastUpdate,
        summary: agent.summary,
      }

      nextSnapshots.set(agent.id, snapshot)

      if (!previous) {
        newEntries.push({
          id: `feed-${agent.id}-start-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          agentName: agent.name,
          type: 'start',
          content: agent.task,
          timestamp: new Date(),
        })
        continue
      }

      if (previous.status !== agent.status) {
        if (agent.status === 'running') {
          newEntries.push({
            id: `feed-${agent.id}-resume-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            agentName: agent.name,
            type: 'start',
            content: agent.lastUpdate || agent.task,
            timestamp: new Date(),
          })
        } else if (agent.status === 'complete') {
          newEntries.push({
            id: `feed-${agent.id}-complete-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            agentName: agent.name,
            type: 'complete',
            content: agent.summary || agent.lastUpdate || agent.task,
            timestamp: new Date(),
          })
        } else if (agent.status === 'error') {
          newEntries.push({
            id: `feed-${agent.id}-error-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            agentName: agent.name,
            type: 'error',
            content: agent.summary || agent.lastUpdate || agent.task,
            timestamp: new Date(),
          })
        }
        continue
      }

      if (
        agent.status === 'running' &&
        (previous.lastUpdate !== agent.lastUpdate || previous.tokens !== agent.tokens) &&
        agent.lastUpdate
      ) {
        newEntries.push({
          id: `feed-${agent.id}-chunk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          agentName: agent.name,
          type: 'chunk',
          content: agent.lastUpdate,
          timestamp: new Date(),
        })
      }
    }

    previousAgentStateRef.current = nextSnapshots

    if (newEntries.length === 0) return

    // Debounced flush — max one state update per 250ms
    pendingEntriesRef.current = [...pendingEntriesRef.current, ...newEntries]
    if (feedDebounceRef.current) clearTimeout(feedDebounceRef.current)
    feedDebounceRef.current = setTimeout(() => {
      const pending = pendingEntriesRef.current
      pendingEntriesRef.current = []

      setVisibleEntries(current => {
        const merged = [...current, ...pending]
        if (merged.length >= 100) {
          setConsolidatedGroups(groups => [
            ...groups,
            { summary: `${merged.length} earlier actions completed`, entries: merged },
          ])
          return []
        }
        return merged
      })
    }, 250)
  }, [storeAgents])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      workflowStreamRef.current?.abort()
      if (feedDebounceRef.current) clearTimeout(feedDebounceRef.current)
    }
  }, [])

  const modelOptions = useMemo(() => {
    const defaultModel = activeProvider.model ?? activeProvider.name
    const defaultModelLabel = getSavedModelDisplayName(activeProvider.id, defaultModel) || activeProvider.displayName || defaultModel
    const options: ModelOption[] = [
      {
        key: `${activeProvider.id}::${defaultModel}`,
        providerId: activeProvider.id,
        modelId: defaultModel,
        label: `${activeProvider.name} — ${defaultModelLabel}`,
      },
    ]

    for (const entry of getAllSavedModels()) {
      const key = `${entry.providerId}::${entry.model.id}`
      if (options.some(option => option.key === key)) continue
      options.push({
        key,
        providerId: entry.providerId,
        modelId: entry.model.id,
        label: `${entry.providerName} — ${entry.model.label}`,
      })
    }

    return options
  }, [activeProvider])

  useEffect(() => {
    if (!modelOptions.some(option => option.key === selectedModelKey)) {
      setSelectedModelKey(modelOptions[0]?.key ?? '')
    }
  }, [modelOptions, selectedModelKey])

  const handleSpawnAgent = () => {
    setSpawnName('')
    setSpawnTask('')
    setSelectedModelKey(modelOptions[0]?.key ?? '')
    setSpawnModalOpen(true)
  }

  const openWorkflowModal = useCallback(async (agent: AgentInstance) => {
    await ensureWorkflowCatalogLoaded()
    const matchedWorkflow = findWorkflowForTask(agent.task)
    const template = matchedWorkflow ? await getWorkflowTemplate(matchedWorkflow.workflow.id) : null

    setGeneratedWorkflowJson('')
    setWorkflowGenerationError(null)
    setN8nImportStatus(null)
    if (template) {
      setGeneratedWorkflowJson(JSON.stringify(template, null, 2))
    }
    setWorkflowModal({
      agentId: agent.id,
      agentName: agent.name,
      task: agent.task,
      sourceOutput: agent.summary ?? agent.lastUpdate ?? '',
      matchedWorkflow: template ? matchedWorkflow : null,
    })
  }, [])

  const closeWorkflowModal = () => {
    workflowStreamRef.current?.abort()
    workflowStreamRef.current = null
    setWorkflowGenerationRunning(false)
    setWorkflowModal(null)
  }

  const handleGenerateWorkflow = () => {
    if (!workflowModal || workflowGenerationRunning) return
    if (!activeProvider.isLocal && !activeProvider.apiKey) {
      setWorkflowGenerationError('Connect an active provider before generating an n8n workflow.')
      return
    }

    setGeneratedWorkflowJson('')
    setWorkflowGenerationError(null)
    setN8nImportStatus(null)
    setWorkflowGenerationRunning(true)

    workflowStreamRef.current = streamCompletion(
      activeProvider,
      [
        {
          id: `system-${Date.now()}`,
          role: 'system',
          content: workflowModal.matchedWorkflow ? N8N_TEMPLATE_SYSTEM_PROMPT : N8N_SYSTEM_PROMPT,
          timestamp: new Date(),
        },
        {
          id: `user-${Date.now()}`,
          role: 'user',
          content: workflowModal.matchedWorkflow
            ? `Task:\n${workflowModal.task}\n\nOutput:\n${workflowModal.sourceOutput}\n\nStarting Template Name:\n${workflowModal.matchedWorkflow.workflow.name}\n\nStarting Template JSON:\n${generatedWorkflowJson}`
            : `Task:\n${workflowModal.task}\n\nOutput:\n${workflowModal.sourceOutput}`,
          timestamp: new Date(),
        },
      ],
      chunk => { setGeneratedWorkflowJson(current => current + chunk) },
      fullText => {
        setGeneratedWorkflowJson(fullText)
        setWorkflowGenerationRunning(false)
        workflowStreamRef.current = null
      },
      error => {
        setWorkflowGenerationError(error.message)
        setWorkflowGenerationRunning(false)
        workflowStreamRef.current = null
      }
    )
  }

  const handleCopyWorkflowJson = () => {
    if (!generatedWorkflowJson.trim()) return
    void navigator.clipboard.writeText(generatedWorkflowJson).catch(() => {
      setN8nImportStatus('Copy failed. Clipboard access was denied.')
    })
  }

  const handleImportToN8n = async () => {
    if (!generatedWorkflowJson.trim()) return
    try {
      const parsed = JSON.parse(generatedWorkflowJson)
      const response = await fetch('http://localhost:5678/rest/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      })
      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || `HTTP ${response.status}`)
      }
      const imported = await response.json().catch(() => null)
      const workflowName = imported?.name || parsed?.name || 'workflow'
      setN8nImportStatus(`Imported to n8n successfully: ${workflowName}`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      setN8nImportStatus(`Import failed: ${message}`)
    }
  }

  const handleSubmitSpawn = () => {
    const selectedModel = modelOptions.find(option => option.key === selectedModelKey) ?? modelOptions[0]
    if (!selectedModel || !spawnTask.trim()) return

    void spawnAgentStore(
      spawnTask.trim(),
      selectedModel.providerId,
      spawnName.trim() || undefined,
      selectedModel.modelId,
    )
    void notify('Drodo', `Agent spawned: ${spawnName.trim() || spawnTask.trim().slice(0, 40)}`)
    setSpawnModalOpen(false)
    setSpawnName('')
    setSpawnTask('')
  }

  const visibleStoreAgents = storeAgents.filter(agent => !agent.orchestrator)
  const runningCount = visibleStoreAgents.filter(a => a.status === 'running').length
  const formattedMemoryUpdated = memoryStats.lastUpdated
    ? new Date(memoryStats.lastUpdated).toLocaleString()
    : 'No memory yet'

  return (
    <div className="flex w-full flex-1 min-h-0 min-w-0 overflow-hidden flex-col lg:flex-row" style={{ background: 'var(--bg-primary)' }}>
      {/* ── Left panel: Agent grid ─────────────────────── */}
      <div className="flex flex-col min-h-0 min-w-0 overflow-hidden flex-[1.2_1_0] border-r border-[var(--border-color)]">
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#7f77dd22' }}>
              <Zap size={18} style={{ color: '#7f77dd' }} />
            </div>
            <div>
              <h1 className="font-bold text-[var(--text-primary)] text-lg">Agent Swarm</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Activity size={11} className="text-[var(--text-secondary)]" />
                <span className="text-xs text-[var(--text-secondary)]">
                  {runningCount} running · {visibleStoreAgents.length} total
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

        {/* Orchestration banner */}
        {orchestrationRun && (
          <OrchestrationBanner
            run={orchestrationRun}
            storeAgents={storeAgents}
            onDismiss={() => setOrchestrationRun(null)}
          />
        )}

        {/* Agent grid */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div
            className="rounded-2xl border px-4 py-3"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Memory</div>
                <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                  {memoryStats.count.toLocaleString()} persistent entries
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-[var(--text-secondary)]">Last updated</div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">{formattedMemoryUpdated}</div>
              </div>
            </div>
          </div>

          {visibleStoreAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-tertiary)' }}>
                <Zap size={28} className="text-[var(--text-secondary)]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">No agents yet</h2>
                <p className="mt-2 max-w-md text-sm text-[var(--text-secondary)]">
                  Spawn an agent to start parallel work, or enable Multi-Agent mode in chat to start an orchestrated run.
                </p>
              </div>
              <button
                onClick={handleSpawnAgent}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
                style={{ background: '#7f77dd' }}
              >
                <Plus size={14} />
                Spawn Agent
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleStoreAgents.map(agent => (
                <ManagedAgentCard
                  key={agent.id}
                  agent={agent}
                  modelLabel={savedModelDisplayNames[agent.model] || agent.model}
                  onStop={agent.status === 'running' ? () => stopAgentStore(agent.id) : undefined}
                  onBuildWorkflow={agent.status === 'complete' ? () => { void openWorkflowModal(agent) } : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel: Live Feed ─────────────────────── */}
      <div className="flex flex-col min-h-0 min-w-0 overflow-hidden flex-1 border-t lg:border-t-0 lg:border-l lg:border-l-[var(--border-color)]">
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[var(--text-primary)]">Live Feed</span>
            {runningCount > 0 && (
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: '#1d9e75', animation: 'pulse 1.5s infinite' }}
              />
            )}
            <span className="text-xs text-[var(--text-secondary)]">({consolidatedGroups.reduce((sum, g) => sum + g.entries.length, 0) + visibleEntries.length})</span>
          </div>
          <button
            onClick={() => { setVisibleEntries([]); setConsolidatedGroups([]) }}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-muted)] px-2 py-1 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            Clear
          </button>
        </div>

        {/* Feed scroll area — real data from store */}
        <div ref={feedRef} className="flex-1 overflow-y-auto p-4 space-y-1.5">
          {consolidatedGroups.length === 0 && visibleEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--bg-tertiary)]">
                <Activity size={24} className="text-[var(--text-secondary)]" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[var(--text-primary)]">No live activity yet</h2>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  Agent events will stream here as soon as one starts running.
                </p>
              </div>
            </div>
          ) : (
            <>
              {consolidatedGroups.map((group, gi) => (
                <ConsolidatedGroupCard key={`cg-${gi}`} group={group} />
              ))}
              {visibleEntries.map(entry => (
                <div key={entry.id} className="flex items-start gap-2 text-xs py-1">
                  <span
                    className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ background: 'var(--bg-tertiary)', color: '#7f77dd', fontSize: 10 }}
                  >
                    {entry.agentName}
                  </span>
                  <span className="flex-shrink-0">{feedIcon(entry.type)}</span>
                  <span className="flex-1 text-[var(--text-muted)] leading-relaxed break-all">
                    {entry.type === 'chunk'
                      ? entry.content.slice(-300)
                      : entry.content.slice(0, 300)}
                    {entry.content.length > 300 ? '…' : ''}
                  </span>
                  <span className="flex-shrink-0 text-[var(--text-muted)] font-mono text-[10px]">
                    {formatTime(new Date(entry.timestamp))}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {workflowModal && (
        <WorkflowHandoffModal
          modal={workflowModal}
          generatedJson={generatedWorkflowJson}
          generationError={workflowGenerationError}
          generationRunning={workflowGenerationRunning}
          importStatus={n8nImportStatus}
          onClose={closeWorkflowModal}
          onGenerate={handleGenerateWorkflow}
          onCopy={handleCopyWorkflowJson}
          onImport={() => void handleImportToN8n()}
        />
      )}
      {spawnModalOpen && (
        <SpawnAgentModal
          name={spawnName}
          task={spawnTask}
          selectedModel={selectedModelKey}
          modelOptions={modelOptions}
          onClose={() => setSpawnModalOpen(false)}
          onNameChange={setSpawnName}
          onTaskChange={setSpawnTask}
          onModelChange={setSelectedModelKey}
          onSubmit={handleSubmitSpawn}
        />
      )}
    </div>
  )
}
