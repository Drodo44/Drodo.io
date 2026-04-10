import { useEffect, useMemo, useRef, useState } from 'react'
import { open } from '@tauri-apps/plugin-shell'
import {
  GitBranch,
  Plus,
  Play,
  Square,
  Trash2,
  ChevronRight,
  Loader2,
  History,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Check,
  Circle,
  Copy,
  X,
  Search,
  Workflow,
  AlertCircle,
} from 'lucide-react'
import { clsx } from 'clsx'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { streamCompletion } from '../lib/streamChat'
import { getAllProviders, loadAllSavedConfigs } from '../lib/providerApi'
import { notify } from '../lib/notifications'
import { decryptStoredKey } from '../lib/encryption'
import { executeCommand } from '../lib/tauri'
import { getWorkflowCategories, getWorkflowCount, getWorkflowTemplate, searchWorkflows, type WorkflowIndex } from '../lib/workflows'
import { useAppStore } from '../store/appStore'
import type { Message, Provider } from '../types'

const WORKFLOWS_KEY = 'drodo_workflow_defs'
const RUNS_KEY = 'drodo_workflow_runs'
const LEGACY_PROVIDER_PREFIX = 'drodo_provider_'
const TEMPLATE_SECTION_PREVIEW_LIMIT = 6

type WorkflowTab = 'workflows' | 'builder' | 'history'
type StepRunStatus = 'pending' | 'running' | 'complete' | 'error' | 'stopped'
type NodeCheckState = 'checking' | 'available' | 'missing' | 'dismissed'

interface WorkflowStep {
  stepId: string
  label: string
  prompt: string
  model: string
  outputVar: string
  useOutputFrom?: string
}

interface StoredWorkflow {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  steps: WorkflowStep[]
}

interface WorkflowRun {
  id: string
  workflowId: string
  workflowName: string
  startedAt: string
  finishedAt: string
  status: 'complete' | 'error' | 'stopped'
  durationMs: number
  output: string
}

interface StepRunState {
  stepId: string
  label: string
  outputVar: string
  status: StepRunStatus
  output: string
  error?: string
}

type LegacyWorkflow = Partial<StoredWorkflow> & {
  systemPrompt?: string
  userPrompt?: string
  providerId?: string
}

type SavedProviderConfig = {
  apiKey?: string
  baseUrl?: string
  model?: string
}

const WORKFLOW_CATEGORY_ACCENTS: Record<string, string> = {
  marketing: '#f59e0b',
  engineering: '#3b82f6',
  dev: '#3b82f6',
  finance: '#10b981',
  hr: '#8b5cf6',
  recruiting: '#8b5cf6',
  sales: '#ef4444',
  content: '#ec4899',
  creative: '#ec4899',
  research: '#06b6d4',
  productivity: '#f97316',
  general: '#6b7280',
  other: '#6b7280',
}

function getWorkflowAccentColor(category?: string): string {
  const normalized = (category || 'general').toLowerCase()
  for (const [keyword, color] of Object.entries(WORKFLOW_CATEGORY_ACCENTS)) {
    if (normalized.includes(keyword)) return color
  }
  return '#6b7280'
}

function formatNodeCheckFailure(message: string): string {
  return `Node.js is required to launch n8n. Drodo could not run "node --version": ${message}`
}

function cloneSteps(steps: WorkflowStep[]): WorkflowStep[] {
  return steps.map(step => ({ ...step }))
}

function cloneWorkflow(workflow: StoredWorkflow): StoredWorkflow {
  return { ...workflow, steps: cloneSteps(workflow.steps) }
}

function loadLegacyProviderConfigs(): Record<string, SavedProviderConfig> {
  const configs: Record<string, SavedProviderConfig> = {}

  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(LEGACY_PROVIDER_PREFIX) || key === 'drodo_provider_configs') continue

    try {
      const parsed = JSON.parse(localStorage.getItem(key) ?? '{}') as SavedProviderConfig
      const providerId = key.slice(LEGACY_PROVIDER_PREFIX.length)
      if (providerId) {
        configs[providerId] = {
          ...parsed,
          apiKey: decryptStoredKey(parsed.apiKey ?? ''),
        }
      }
    } catch {
      // Ignore malformed legacy provider records.
    }
  }

  return configs
}

function getSavedProviders(): Provider[] {
  const combinedConfigs = {
    ...loadLegacyProviderConfigs(),
    ...loadAllSavedConfigs(),
  }

  return getAllProviders()
    .filter(provider => combinedConfigs[provider.id])
    .map(provider => {
      const config = combinedConfigs[provider.id]
      return {
        ...provider,
        apiKey: config.apiKey ?? '',
        baseUrl: config.baseUrl || provider.baseUrl,
        model: config.model || provider.model || '',
        isConnected: provider.isLocal || !!config.apiKey,
      }
    })
}

function makeStep(modelId: string, index: number): WorkflowStep {
  return {
    stepId: crypto.randomUUID(),
    label: '',
    prompt: '',
    model: modelId,
    outputVar: `step${index + 1}_output`,
    useOutputFrom: '',
  }
}

function makeNewWorkflow(): StoredWorkflow {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    name: 'Untitled Workflow',
    createdAt: now,
    updatedAt: now,
    steps: [],
  }
}

function promptFromLegacyWorkflow(workflow: LegacyWorkflow): string {
  const parts = [
    typeof workflow.systemPrompt === 'string' && workflow.systemPrompt.trim()
      ? `System instructions:\n${workflow.systemPrompt.trim()}`
      : '',
    typeof workflow.userPrompt === 'string' ? workflow.userPrompt.trim() : '',
  ].filter(Boolean)

  return parts.join('\n\n')
}

function normalizeStep(step: Partial<WorkflowStep>, index: number, defaultProviderId: string): WorkflowStep {
  return {
    stepId: typeof step.stepId === 'string' && step.stepId ? step.stepId : crypto.randomUUID(),
    label: typeof step.label === 'string' ? step.label : '',
    prompt: typeof step.prompt === 'string' ? step.prompt : '',
    model: typeof step.model === 'string' && step.model ? step.model : defaultProviderId,
    outputVar: typeof step.outputVar === 'string' && step.outputVar ? step.outputVar : `step${index + 1}_output`,
    useOutputFrom: typeof step.useOutputFrom === 'string' ? step.useOutputFrom : '',
  }
}

function sanitizeStepDependencies(steps: WorkflowStep[]): WorkflowStep[] {
  return steps.map((step, index) => {
    const previousVars = new Set(
      steps
        .slice(0, index)
        .map(previousStep => previousStep.outputVar.trim())
        .filter(Boolean)
    )

    return previousVars.has(step.useOutputFrom?.trim() ?? '')
      ? step
      : { ...step, useOutputFrom: '' }
  })
}

function normalizeWorkflow(workflow: LegacyWorkflow, defaultProviderId: string): StoredWorkflow {
  const createdAt = typeof workflow.createdAt === 'number' ? workflow.createdAt : Date.now()
  const updatedAt = typeof workflow.updatedAt === 'number' ? workflow.updatedAt : createdAt

  if (Array.isArray(workflow.steps)) {
    return {
      id: typeof workflow.id === 'string' && workflow.id ? workflow.id : crypto.randomUUID(),
      name: typeof workflow.name === 'string' && workflow.name ? workflow.name : 'Untitled Workflow',
      createdAt,
      updatedAt,
      steps: sanitizeStepDependencies(
        workflow.steps.map((step, index) => normalizeStep(step, index, defaultProviderId))
      ),
    }
  }

  const legacyPrompt = promptFromLegacyWorkflow(workflow)

  return {
    id: typeof workflow.id === 'string' && workflow.id ? workflow.id : crypto.randomUUID(),
    name: typeof workflow.name === 'string' && workflow.name ? workflow.name : 'Untitled Workflow',
    createdAt,
    updatedAt,
    steps: legacyPrompt
      ? [
          {
            stepId: crypto.randomUUID(),
            label: 'Initial Step',
            prompt: legacyPrompt,
            model: typeof workflow.providerId === 'string' && workflow.providerId ? workflow.providerId : defaultProviderId,
            outputVar: 'step1_output',
            useOutputFrom: '',
          },
        ]
      : [],
  }
}

function loadWorkflows(defaultProviderId: string): StoredWorkflow[] {
  try {
    const raw = localStorage.getItem(WORKFLOWS_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.map(workflow => normalizeWorkflow(workflow as LegacyWorkflow, defaultProviderId))
  } catch {
    return []
  }
}

function saveWorkflows(workflows: StoredWorkflow[]): void {
  localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(workflows))
}

function loadRuns(): WorkflowRun[] {
  try {
    const raw = localStorage.getItem(RUNS_KEY)
    return raw ? (JSON.parse(raw) as WorkflowRun[]) : []
  } catch {
    return []
  }
}

function appendRun(run: WorkflowRun): void {
  const runs = loadRuns()
  localStorage.setItem(RUNS_KEY, JSON.stringify([...runs, run].slice(-100)))
}

function clearRuns(): void {
  localStorage.removeItem(RUNS_KEY)
}

function getWorkflowCountLabel(count: number, singular: string): string {
  return `${count} ${singular}${count !== 1 ? 's' : ''}`
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(iso).toLocaleDateString()
}

function fmtTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

function promptPreview(prompt: string, maxLength = 140): string {
  const trimmed = prompt.trim()
  if (!trimmed) return 'No prompt yet.'
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength).trimEnd()}…`
}

function buildStepPrompt(step: WorkflowStep, outputsByVar: Record<string, string>): string {
  const basePrompt = step.prompt.trim()
  const sourceVar = step.useOutputFrom?.trim()
  if (!sourceVar) return basePrompt

  return [
    `Context from ${sourceVar}:`,
    outputsByVar[sourceVar] ?? '',
    '',
    basePrompt,
  ].join('\n')
}

function buildRunOutput(stepRuns: StepRunState[]): string {
  return stepRuns
    .map(stepRun => {
      const label = stepRun.label || 'Untitled Step'
      const body = stepRun.output || stepRun.error || ''
      return `# ${label}\n${body}`.trim()
    })
    .filter(Boolean)
    .join('\n\n')
}

function createMessage(content: string): Message {
  return {
    id: crypto.randomUUID(),
    role: 'user',
    content,
    timestamp: new Date(),
  }
}

function findProvider(savedProviders: Provider[], providerId: string): Provider | null {
  return savedProviders.find(provider => provider.id === providerId) ?? null
}

function providerBadge(savedProviders: Provider[], providerId: string): string {
  const provider = findProvider(savedProviders, providerId)
  return provider?.model || provider?.name || 'No model'
}

function statusIcon(status: StepRunStatus) {
  if (status === 'running') return <Loader2 size={12} className="text-[#7f77dd] animate-spin" />
  if (status === 'complete') return <Check size={12} className="text-[#1d9e75]" />
  if (status === 'error') return <X size={12} className="text-[#e05050]" />
  return <Circle size={10} className="text-[var(--text-secondary)] fill-current" />
}

function RunCard({ run }: { run: WorkflowRun }) {
  const [expanded, setExpanded] = useState(false)

  const statusColor =
    run.status === 'complete' ? '#1d9e75' :
    run.status === 'error' ? '#e05050' : 'var(--text-muted)'
  const statusBg =
    run.status === 'complete' ? '#1d9e7515' :
    run.status === 'error' ? '#e0505015' : 'var(--text-muted)15'
  const statusBorder =
    run.status === 'complete' ? '#1d9e7530' :
    run.status === 'error' ? '#e0505030' : 'var(--text-muted)30'

  return (
    <div
      className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] overflow-hidden cursor-pointer hover:border-[var(--border-color)] transition-colors"
      onClick={() => setExpanded(current => !current)}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-[var(--text-primary)] truncate">{run.workflowName}</span>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
              style={{ color: statusColor, background: statusBg, border: `1px solid ${statusBorder}` }}
            >
              {run.status}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-[var(--text-secondary)]">{fmtRelative(run.startedAt)}</span>
            <span className="text-xs text-[var(--text-secondary)]">{fmtDuration(run.durationMs)}</span>
          </div>
          {!expanded && run.output && (
            <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-1 font-mono">
              {run.output.slice(0, 120)}
            </p>
          )}
        </div>
        <ChevronDown
          size={14}
          className="flex-shrink-0 text-[var(--text-secondary)] transition-transform"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </div>
      {expanded && run.output && (
        <div className="px-4 pb-4" onClick={event => event.stopPropagation()}>
          <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-xs text-[var(--text-primary)] font-mono leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
            {run.output}
          </div>
        </div>
      )}
    </div>
  )
}

export function WorkflowsView() {
  const initialProviderId = getSavedProviders()[0]?.id ?? ''
  const n8nReady = useAppStore(state => state.n8nReady)
  const n8nUrl = useAppStore(state => state.n8nUrl)
  const [tab, setTab] = useState<WorkflowTab>('workflows')
  const [loading, setLoading] = useState(true)
  const [workflows, setWorkflows] = useState<StoredWorkflow[]>([])
  const [runs, setRuns] = useState<WorkflowRun[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<StoredWorkflow | null>(null)
  const [workflowRunning, setWorkflowRunning] = useState(false)
  const [builderError, setBuilderError] = useState<string | null>(null)
  const [workflowNameError, setWorkflowNameError] = useState<string | null>(null)
  const [stepRuns, setStepRuns] = useState<StepRunState[]>([])
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({})
  const [expandedOutputs, setExpandedOutputs] = useState<Record<string, boolean>>({})
  const [clearConfirm, setClearConfirm] = useState(false)
  const [templateQuery, setTemplateQuery] = useState('')
  const [activeTemplateCategory, setActiveTemplateCategory] = useState('All')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [selectedTemplateJson, setSelectedTemplateJson] = useState('')
  const [templateImportStatus, setTemplateImportStatus] = useState<string | null>(null)
  const [nodeCheckState, setNodeCheckState] = useState<NodeCheckState>('checking')
  const [nodeVersion, setNodeVersion] = useState('')
  const [nodeCheckError, setNodeCheckError] = useState<string | null>(null)
  const [n8nLaunchError, setN8nLaunchError] = useState<string | null>(null)
  const [templatePage, setTemplatePage] = useState(0)
  const TEMPLATES_PER_PAGE = 50
  const activeStreamRef = useRef<{ abort: () => void } | null>(null)
  const pendingStepAbortResolverRef = useRef<(() => void) | null>(null)
  const stepRunsRef = useRef<StepRunState[]>([])
  const stopRequestedRef = useRef(false)
  const runStartRef = useRef(0)
  const savedProviders = getSavedProviders()

  useEffect(() => {
    const storedWorkflows = loadWorkflows(initialProviderId)
    setWorkflows(storedWorkflows)
    setRuns(loadRuns().slice().reverse())
    setSelectedId(storedWorkflows[0]?.id ?? null)
    setDraft(storedWorkflows[0] ? cloneWorkflow(storedWorkflows[0]) : null)
    setLoading(false)
  }, [initialProviderId])

  useEffect(() => {
    setTemplatePage(0)
  }, [templateQuery, activeTemplateCategory])

  useEffect(() => {
    let cancelled = false

    void executeCommand('node --version')
      .then(result => {
        if (cancelled) return
        if (result.success) {
          setNodeCheckState('available')
          setNodeVersion(result.stdout.trim() || result.combined.trim())
          setNodeCheckError(null)
          return
        }

        setNodeCheckState('missing')
        setNodeCheckError(formatNodeCheckFailure(result.stderr.trim() || result.combined.trim() || `exit code ${result.exitCode}`))
      })
      .catch(error => {
        if (cancelled) return
        const message = error instanceof Error ? error.message : String(error)
        setNodeCheckState('missing')
        setNodeCheckError(formatNodeCheckFailure(message))
      })

    return () => {
      cancelled = true
    }
  }, [])

  const applyStepRuns = (
    updater: StepRunState[] | ((current: StepRunState[]) => StepRunState[])
  ) => {
    setStepRuns(current => {
      const next = typeof updater === 'function' ? updater(current) : updater
      stepRunsRef.current = next
      return next
    })
  }

  const updateStepRun = (
    stepId: string,
    updater: (current: StepRunState) => StepRunState
  ) => {
    applyStepRuns(current =>
      current.map(stepRun => (stepRun.stepId === stepId ? updater(stepRun) : stepRun))
    )
  }

  const refreshRuns = () => setRuns(loadRuns().slice().reverse())

  const resetRunState = () => {
    setBuilderError(null)
    applyStepRuns([])
    setExpandedOutputs({})
  }

  const selectWorkflow = (workflow: StoredWorkflow) => {
    setSelectedId(workflow.id)
    setDraft(cloneWorkflow(workflow))
    setExpandedSteps({})
    setWorkflowNameError(null)
    resetRunState()
  }

  const persistWorkflows = (nextWorkflows: StoredWorkflow[]) => {
    setWorkflows(nextWorkflows)
    saveWorkflows(nextWorkflows)
  }

  const handleNew = () => {
    const workflow = makeNewWorkflow()
    const nextWorkflows = [workflow, ...workflows]
    persistWorkflows(nextWorkflows)
    selectWorkflow(workflow)
    setTab('builder')
  }

  const handleSave = () => {
    if (!draft) return
    const name = draft.name.trim()
    if (!name) {
      setWorkflowNameError('Workflow name is required.')
      return
    }

    const nextWorkflow: StoredWorkflow = {
      ...cloneWorkflow(draft),
      name,
      updatedAt: Date.now(),
      steps: sanitizeStepDependencies(cloneSteps(draft.steps)),
    }

    const nextWorkflows = workflows.some(workflow => workflow.id === nextWorkflow.id)
      ? workflows.map(workflow => (workflow.id === nextWorkflow.id ? nextWorkflow : workflow))
      : [nextWorkflow, ...workflows]

    persistWorkflows(nextWorkflows)
    setDraft(cloneWorkflow(nextWorkflow))
    setWorkflowNameError(null)
  }

  const handleDeleteWorkflow = (workflowId: string) => {
    const nextWorkflows = workflows.filter(workflow => workflow.id !== workflowId)
    persistWorkflows(nextWorkflows)

    if (selectedId === workflowId) {
      const nextSelectedWorkflow = nextWorkflows[0] ?? null
      setSelectedId(nextSelectedWorkflow?.id ?? null)
      setDraft(nextSelectedWorkflow ? cloneWorkflow(nextSelectedWorkflow) : null)
      setExpandedSteps({})
      resetRunState()
    }
  }

  const updateDraft = (updater: (current: StoredWorkflow) => StoredWorkflow) => {
    setDraft(current => (current ? updater(current) : null))
  }

  const toggleStepExpanded = (stepId: string) => {
    setExpandedSteps(current => ({ ...current, [stepId]: !current[stepId] }))
  }

  const addStep = () => {
    if (!draft) return

    const defaultProviderId = savedProviders[0]?.id ?? ''
    const nextStep = makeStep(defaultProviderId, draft.steps.length)

    updateDraft(current => ({
      ...current,
      steps: [...current.steps, nextStep],
    }))
    setExpandedSteps(current => ({ ...current, [nextStep.stepId]: true }))
  }

  const updateStep = (stepId: string, patch: Partial<WorkflowStep>) => {
    updateDraft(current => ({
      ...current,
      steps: current.steps.map(step => (step.stepId === stepId ? { ...step, ...patch } : step)),
    }))
  }

  const deleteStep = (stepId: string) => {
    updateDraft(current => ({
      ...current,
      steps: sanitizeStepDependencies(current.steps.filter(step => step.stepId !== stepId)),
    }))
    setExpandedSteps(current => {
      const next = { ...current }
      delete next[stepId]
      return next
    })
  }

  const moveStep = (stepId: string, direction: -1 | 1) => {
    updateDraft(current => {
      const index = current.steps.findIndex(step => step.stepId === stepId)
      const targetIndex = index + direction
      if (index < 0 || targetIndex < 0 || targetIndex >= current.steps.length) return current

      const nextSteps = cloneSteps(current.steps)
      const [moved] = nextSteps.splice(index, 1)
      nextSteps.splice(targetIndex, 0, moved)

      return {
        ...current,
        steps: sanitizeStepDependencies(nextSteps),
      }
    })
  }

  const runStep = (
    step: WorkflowStep,
    provider: Provider,
    prompt: string
  ): Promise<{ status: StepRunStatus; output: string; error?: string }> =>
    new Promise(resolve => {
      let streamedOutput = ''
      let settled = false

      const settle = (result: { status: StepRunStatus; output: string; error?: string }) => {
        if (settled) return
        settled = true
        activeStreamRef.current = null
        pendingStepAbortResolverRef.current = null
        resolve(result)
      }

      pendingStepAbortResolverRef.current = () => {
        updateStepRun(step.stepId, current => ({
          ...current,
          status: 'stopped',
          output: streamedOutput,
        }))
        settle({ status: 'stopped', output: streamedOutput })
      }

      activeStreamRef.current = streamCompletion(
        provider,
        [createMessage(prompt)],
        chunk => {
          streamedOutput += chunk
          updateStepRun(step.stepId, current => ({
            ...current,
            output: current.output + chunk,
          }))
        },
        fullText => {
          const finalOutput = fullText || streamedOutput
          updateStepRun(step.stepId, current => ({
            ...current,
            status: 'complete',
            output: finalOutput,
          }))
          settle({ status: 'complete', output: finalOutput })
        },
        error => {
          const message = error.message
          updateStepRun(step.stepId, current => ({
            ...current,
            status: 'error',
            output: streamedOutput || message,
            error: message,
          }))
          settle({
            status: 'error',
            output: streamedOutput || message,
            error: message,
          })
        }
      )
    })

  const handleRun = async () => {
    if (!draft || workflowRunning) return
    if (draft.steps.length === 0) {
      setBuilderError('Add at least one step before running the workflow.')
      return
    }
    if (savedProviders.length === 0) {
      setBuilderError('No saved providers found. Connect a model first in Connections.')
      return
    }

    const workflow = cloneWorkflow(draft)
    const startedAt = new Date().toISOString()
    const outputsByVar: Record<string, string> = {}
    let finalStatus: WorkflowRun['status'] = 'complete'

    setBuilderError(null)
    stopRequestedRef.current = false
    runStartRef.current = Date.now()
    setWorkflowRunning(true)

    const initialStepRuns = workflow.steps.map(step => ({
      stepId: step.stepId,
      label: step.label.trim() || 'Untitled Step',
      outputVar: step.outputVar.trim(),
      status: 'pending' as const,
      output: '',
      error: '',
    }))

    applyStepRuns(initialStepRuns)
    setExpandedOutputs(
      Object.fromEntries(initialStepRuns.map(stepRun => [stepRun.stepId, true]))
    )

    for (const step of workflow.steps) {
      if (stopRequestedRef.current) {
        finalStatus = 'stopped'
        break
      }

      const provider = findProvider(savedProviders, step.model)
      if (!provider) {
        finalStatus = 'error'
        const message = 'Selected model is no longer available.'
        setBuilderError(message)
        updateStepRun(step.stepId, current => ({ ...current, status: 'error', error: message, output: message }))
        break
      }

      const trimmedPrompt = step.prompt.trim()
      if (!trimmedPrompt) {
        finalStatus = 'error'
        const message = 'Step prompt is required.'
        setBuilderError(message)
        updateStepRun(step.stepId, current => ({ ...current, status: 'error', error: message, output: message }))
        break
      }

      const requestedContext = step.useOutputFrom?.trim()
      if (requestedContext && !Object.prototype.hasOwnProperty.call(outputsByVar, requestedContext)) {
        finalStatus = 'error'
        const message = `Context variable "${requestedContext}" is not available.`
        setBuilderError(message)
        updateStepRun(step.stepId, current => ({ ...current, status: 'error', error: message, output: message }))
        break
      }

      updateStepRun(step.stepId, current => ({
        ...current,
        status: 'running',
        output: '',
        error: '',
      }))

      const stepPrompt = buildStepPrompt(step, outputsByVar)
      const result = await runStep(step, provider, stepPrompt)

      if (result.status === 'complete') {
        const outputVar = step.outputVar.trim()
        if (outputVar) outputsByVar[outputVar] = result.output
        continue
      }

      if (result.status === 'stopped') {
        finalStatus = 'stopped'
        break
      }

      finalStatus = 'error'
      setBuilderError(result.error ?? 'Step execution failed.')
      break
    }

    if (stopRequestedRef.current && finalStatus === 'complete') {
      finalStatus = 'stopped'
    }

    setWorkflowRunning(false)
    activeStreamRef.current = null
    pendingStepAbortResolverRef.current = null

    const finishedAt = new Date().toISOString()
    const durationMs = Date.now() - runStartRef.current
    const output = buildRunOutput(stepRunsRef.current)

    appendRun({
      id: `run_${Date.now()}`,
      workflowId: workflow.id,
      workflowName: workflow.name || 'Untitled Workflow',
      startedAt,
      finishedAt,
      status: finalStatus,
      durationMs,
      output,
    })
    refreshRuns()

    if (finalStatus === 'complete') {
      void notify(workflow.name || 'Untitled Workflow', 'Workflow complete')
    }
  }

  const handleStop = () => {
    stopRequestedRef.current = true
    activeStreamRef.current?.abort()
    pendingStepAbortResolverRef.current?.()
  }

  const selectedWorkflow = workflows.find(workflow => workflow.id === selectedId) ?? null
  const combinedOutput = buildRunOutput(stepRuns)
  const showOutputPanel = workflowRunning || stepRuns.length > 0
  const allTemplates = useMemo(() => searchWorkflows(''), [])
  const templateCategories = useMemo(() => ['All', ...getWorkflowCategories()], [])
  const searchedTemplates = useMemo(() => searchWorkflows(templateQuery), [templateQuery])
  const filteredTemplates = useMemo(() => {
    if (activeTemplateCategory === 'All') {
      return searchedTemplates
    }

    return searchedTemplates.filter(template => template.category === activeTemplateCategory)
  }, [activeTemplateCategory, searchedTemplates])
  const previewTemplateSections = useMemo(() => {
    if (templateQuery.trim() || activeTemplateCategory !== 'All') {
      return []
    }

    return getWorkflowCategories()
      .map(category => {
        const templates = allTemplates.filter(template => template.category === category)
        return {
          category,
          count: templates.length,
          templates: templates.slice(0, TEMPLATE_SECTION_PREVIEW_LIMIT),
        }
      })
      .filter(section => section.count > 0)
  }, [activeTemplateCategory, allTemplates, templateQuery])
  const templateCategoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const template of allTemplates) {
      counts.set(template.category, (counts.get(template.category) ?? 0) + 1)
    }
    return counts
  }, [allTemplates])
  const displayedTemplates = useMemo(() => {
    if (!templateQuery.trim() && activeTemplateCategory === 'All') {
      return []
    }
    return filteredTemplates
  }, [activeTemplateCategory, filteredTemplates, templateQuery])
  const selectedTemplate = useMemo(
    () => allTemplates.find(template => template.id === selectedTemplateId) ?? null,
    [allTemplates, selectedTemplateId]
  )

  const openTemplate = (template: WorkflowIndex) => {
    const templateJson = getWorkflowTemplate(template.id)
    if (!templateJson) {
      setTemplateImportStatus('Template JSON could not be loaded.')
      return
    }

    setSelectedTemplateId(template.id)
    setSelectedTemplateJson(JSON.stringify(templateJson, null, 2))
    setTemplateImportStatus(null)
  }

  const copySelectedTemplate = () => {
    if (!selectedTemplateJson.trim()) return
    void navigator.clipboard.writeText(selectedTemplateJson).catch(() => {
      setTemplateImportStatus('Copy failed. Clipboard access was denied.')
    })
  }

  const handleLaunchN8n = async () => {
    setN8nLaunchError(null)

    try {
      const nodeResult = await executeCommand('node --version')
      if (!nodeResult.success) {
        const message = formatNodeCheckFailure(nodeResult.stderr.trim() || nodeResult.combined.trim() || `exit code ${nodeResult.exitCode}`)
        setNodeCheckState('missing')
        setNodeCheckError(message)
        throw new Error(message)
      }

      setNodeCheckState('available')
      setNodeVersion(nodeResult.stdout.trim() || nodeResult.combined.trim())

      if (!n8nReady) {
        throw new Error('n8n is still starting. Wait a moment and try again. If this persists, check that port 5678 is available.')
      }

      await open(n8nUrl)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      setN8nLaunchError(message)
      void notify('Drodo', message)
    }
  }

  const deploySelectedTemplate = async () => {
    if (!selectedTemplateJson.trim()) return

    try {
      const parsed = JSON.parse(selectedTemplateJson)
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
      const workflowName = imported?.name || parsed?.name || selectedTemplate?.name || 'workflow'
      setTemplateImportStatus(`Imported to n8n successfully: ${workflowName}`)
      void notify('Drodo', `Template deployed: ${workflowName}`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      setTemplateImportStatus(`Import failed: ${message}`)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <div
        className="flex items-center justify-between px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#6366f122' }}>
            <GitBranch size={18} style={{ color: '#6366f1' }} />
          </div>
          <div>
            <h1 className="font-bold text-[var(--text-primary)] text-lg">Workflows</h1>
            <p className="text-xs text-[var(--text-secondary)]">
              {getWorkflowCountLabel(workflows.length, 'workflow')} · {getWorkflowCountLabel(getWorkflowCount(), 'template')} · {getWorkflowCountLabel(runs.length, 'run')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-[var(--border-color)] overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
            {([
              { key: 'workflows' as const, label: 'Workflows', Icon: GitBranch },
              { key: 'builder' as const, label: 'Builder', Icon: Plus },
              { key: 'history' as const, label: 'Run History', Icon: History },
            ]).map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-colors"
                style={tab === key ? { background: '#7f77dd', color: '#fff' } : { color: 'var(--text-muted)' }}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>

          {tab !== 'history' && (
            <button
              onClick={handleNew}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: '#7f77dd' }}
            >
              <Plus size={14} />
              New
            </button>
          )}
        </div>
      </div>

      <div
        className="flex items-center justify-between gap-3 px-6 py-3 flex-shrink-0 flex-wrap"
        style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
            style={n8nReady
              ? { color: '#1d9e75', background: '#1d9e7515', borderColor: '#1d9e7533' }
              : { color: '#b58a24', background: '#b58a2415', borderColor: '#b58a2433' }}
          >
            {n8nReady ? <Check size={12} /> : <Loader2 size={12} className="animate-spin" />}
            {n8nReady ? 'n8n Ready' : 'n8n Starting...'}
          </span>
          <span className="text-xs text-[var(--text-secondary)]">
            {n8nReady
              ? `Dashboard available at ${n8nUrl}${nodeVersion ? ` · Node ${nodeVersion}` : ''}`
              : 'Drodo is bootstrapping Node.js, Git, and n8n in the background.'}
          </span>
        </div>

        <button
          onClick={() => void handleLaunchN8n()}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:border-[#7f77dd]/50 hover:text-white"
          style={{ background: 'var(--bg-secondary)' }}
        >
          <Workflow size={12} />
          Launch n8n
        </button>
      </div>

      {n8nLaunchError && (
        <div
          className="mx-6 mt-3 flex flex-wrap items-start justify-between gap-3 rounded-xl px-4 py-3 text-xs"
          style={{ background: '#e0505010', border: '1px solid #e0505030', color: '#e05050' }}
        >
          <span>{n8nLaunchError}</span>
          <button
            onClick={() => setN8nLaunchError(null)}
            className="font-semibold text-[#e05050] underline-offset-2 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {nodeCheckState === 'missing' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div
            className="w-full max-w-md rounded-xl border p-5 shadow-2xl"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: '#e0505015', color: '#e05050' }}>
                  <AlertCircle size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">Node.js was not detected</h2>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                    {nodeCheckError ?? 'Drodo could not run "node --version". Install Node.js or make sure it is available on PATH, then try launching n8n again.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setNodeCheckState('dismissed')}
                className="rounded-lg p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
                aria-label="Close Node.js notice"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                onClick={() => setNodeCheckState('dismissed')}
                className="rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
              >
                Dismiss
              </button>
              <button
                onClick={() => void open('https://nodejs.org/en/download')}
                className="rounded-lg px-3 py-2 text-xs font-semibold text-white"
                style={{ background: '#7f77dd' }}
              >
                Download Node.js
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex-1">
          <LoadingSpinner label="Loading workflows…" />
        </div>
      ) : tab === 'workflows' && (
        <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: '260px 1fr' }}>
          <div className="border-r border-[var(--border-color)] overflow-y-auto p-3 space-y-1">
            {workflows.length === 0 && (
              <div className="flex flex-col items-start rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 text-left">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--bg-tertiary)]">
                  <GitBranch size={18} className="text-[var(--text-secondary)]" />
                </div>
                <h2 className="mt-4 text-sm font-semibold text-[var(--text-primary)]">No workflows yet</h2>
                <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                  Create your first workflow to start chaining model steps together.
                </p>
                <button
                  onClick={handleNew}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-white"
                  style={{ background: '#7f77dd' }}
                >
                  <Plus size={12} />
                  New Workflow
                </button>
              </div>
            )}
            {workflows.map(workflow => (
              <button
                key={workflow.id}
                onClick={() => selectWorkflow(workflow)}
                className={clsx(
                  'w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-left transition-colors group',
                  selectedId === workflow.id
                    ? 'bg-[#7f77dd]/12 text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                )}
                style={{ borderLeft: `4px solid ${getWorkflowAccentColor('General')}` }}
              >
                <GitBranch
                  size={14}
                  style={{ color: selectedId === workflow.id ? '#7f77dd' : undefined, flexShrink: 0 }}
                />
                <span className="flex-1 truncate">{workflow.name || 'Untitled Workflow'}</span>
                <ChevronRight size={12} className="opacity-0 group-hover:opacity-60 flex-shrink-0" />
              </button>
            ))}
          </div>

          <div className="flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: '#1d9e7518' }}>
                        <Workflow size={18} style={{ color: '#1d9e75' }} />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-[var(--text-primary)]">Template Library</h2>
                        <p className="text-xs text-[var(--text-secondary)]">
                          Browse {getWorkflowCountLabel(getWorkflowCount(), 'bundled template')} across official and starred public n8n sources.
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {templateCategories.map(category => {
                        const count = category === 'All'
                          ? allTemplates.length
                          : (templateCategoryCounts.get(category) ?? 0)

                        return (
                          <button
                            key={category}
                            onClick={() => setActiveTemplateCategory(category)}
                            className={clsx(
                              'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                              activeTemplateCategory === category
                                ? 'text-white'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            )}
                            style={activeTemplateCategory === category
                              ? { background: '#7f77dd', borderColor: '#7f77dd' }
                              : { borderColor: 'var(--border-color)' }}
                          >
                            {category} ({count})
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <label
                    className="flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 lg:w-[360px]"
                    style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}
                  >
                    <Search size={14} className="text-[var(--text-secondary)]" />
                    <input
                      value={templateQuery}
                      onChange={event => setTemplateQuery(event.target.value)}
                      placeholder="Search name, description, tags, or services..."
                      className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)]"
                    />
                  </label>
                </div>

                {selectedTemplate && (
                  <div
                    className="mt-5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] overflow-hidden"
                    style={{ borderLeft: `4px solid ${getWorkflowAccentColor(selectedTemplate.category)}` }}
                  >
                    <div className="flex flex-col gap-3 border-b border-[var(--border-color)] px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: '#1d9e7518', color: '#1d9e75' }}>
                            {selectedTemplate.category}
                          </span>
                          <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: '#7f77dd18', color: '#a09ae8' }}>
                            {selectedTemplate.complexity}
                          </span>
                        </div>
                        <h3 className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{selectedTemplate.name}</h3>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">{selectedTemplate.description}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {selectedTemplate.required_services.slice(0, 8).map(service => (
                            <span
                              key={service}
                              className="rounded-full border px-2 py-0.5 text-[11px] text-[var(--text-secondary)]"
                              style={{ borderColor: 'var(--border-color)' }}
                            >
                              {service}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={copySelectedTemplate}
                          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                        >
                          <Copy size={12} />
                          Copy JSON
                        </button>
                        <button
                          onClick={() => void deploySelectedTemplate()}
                          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white"
                          style={{ background: '#1d9e75' }}
                        >
                          <Play size={12} />
                          Deploy to n8n
                        </button>
                      </div>
                    </div>

                    <div className="px-4 py-4">
                      <pre className="max-h-[420px] overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-3 text-xs text-[var(--text-primary)] whitespace-pre-wrap break-all">
                        {selectedTemplateJson}
                      </pre>
                      {templateImportStatus && (
                        <div
                          className="mt-3 rounded-xl px-4 py-3 text-xs"
                          style={{
                            background: templateImportStatus.startsWith('Imported') ? '#1d9e7510' : '#e0505010',
                            border: `1px solid ${templateImportStatus.startsWith('Imported') ? '#1d9e7528' : '#e0505028'}`,
                            color: templateImportStatus.startsWith('Imported') ? '#1d9e75' : '#e05050',
                          }}
                        >
                          {templateImportStatus}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!templateQuery.trim() && activeTemplateCategory === 'All' ? (
                  <div className="mt-5 space-y-5">
                    {previewTemplateSections.map(section => (
                      <div key={section.category}>
                        <div className="mb-3 flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{section.category}</h3>
                            <p className="text-xs text-[var(--text-secondary)]">{getWorkflowCountLabel(section.count, 'template')}</p>
                          </div>
                          <button
                            onClick={() => setActiveTemplateCategory(section.category)}
                            className="text-xs font-semibold text-[#7f77dd] hover:opacity-80 transition-opacity"
                          >
                            View Category
                          </button>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {section.templates.map(template => (
                            <div
                              key={template.id}
                              className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-4"
                              style={{ borderLeft: `4px solid ${getWorkflowAccentColor(template.category)}` }}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="rounded-full inline-flex px-2 py-0.5 text-[10px] font-semibold" style={{ background: '#7f77dd18', color: '#a09ae8' }}>
                                    {template.complexity}
                                  </div>
                                  <h4 className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{template.name}</h4>
                                  <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">{template.description}</p>
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {template.required_services.slice(0, 4).map(service => (
                                  <span
                                    key={service}
                                    className="rounded-full border px-2 py-0.5 text-[11px] text-[var(--text-secondary)]"
                                    style={{ borderColor: 'var(--border-color)' }}
                                  >
                                    {service}
                                  </span>
                                ))}
                              </div>
                              <button
                                onClick={() => openTemplate(template)}
                                className="mt-4 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white"
                                style={{ background: '#7f77dd' }}
                              >
                                <Workflow size={12} />
                                Use Template
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (() => {
                  const totalPages = Math.ceil(displayedTemplates.length / TEMPLATES_PER_PAGE)
                  const pagedTemplates = displayedTemplates.slice(
                    templatePage * TEMPLATES_PER_PAGE,
                    (templatePage + 1) * TEMPLATES_PER_PAGE,
                  )
                  const startIdx = templatePage * TEMPLATES_PER_PAGE + 1
                  const endIdx = Math.min((templatePage + 1) * TEMPLATES_PER_PAGE, displayedTemplates.length)
                  return (
                    <div className="mt-5">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-xs text-[var(--text-secondary)]">
                          {displayedTemplates.length > 0
                            ? `Showing ${startIdx}–${endIdx} of ${displayedTemplates.length.toLocaleString()} templates`
                            : 'No templates match this filter'}
                        </p>
                      </div>

                      {displayedTemplates.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--bg-primary)] px-5 py-10 text-center">
                          <h3 className="text-sm font-semibold text-[var(--text-primary)]">No templates match this filter</h3>
                          <p className="mt-2 text-xs text-[var(--text-secondary)]">
                            Adjust the search terms or switch categories to broaden the results.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {pagedTemplates.map(template => (
                              <div
                                key={template.id}
                                className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-4"
                                style={{ borderLeft: `4px solid ${getWorkflowAccentColor(template.category)}` }}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: '#1d9e7518', color: '#1d9e75' }}>
                                        {template.category}
                                      </span>
                                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: '#7f77dd18', color: '#a09ae8' }}>
                                        {template.complexity}
                                      </span>
                                    </div>
                                    <h4 className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{template.name}</h4>
                                    <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">{template.description}</p>
                                  </div>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {template.required_services.slice(0, 5).map(service => (
                                    <span
                                      key={service}
                                      className="rounded-full border px-2 py-0.5 text-[11px] text-[var(--text-secondary)]"
                                      style={{ borderColor: 'var(--border-color)' }}
                                    >
                                      {service}
                                    </span>
                                  ))}
                                </div>
                                <button
                                  onClick={() => openTemplate(template)}
                                  className="mt-4 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white"
                                  style={{ background: '#7f77dd' }}
                                >
                                  <Workflow size={12} />
                                  Use Template
                                </button>
                              </div>
                            ))}
                          </div>

                          {totalPages > 1 && (
                            <div className="mt-5 flex items-center justify-between gap-3">
                              <span className="text-xs text-[var(--text-secondary)]">
                                Page {templatePage + 1} of {totalPages.toLocaleString()}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  disabled={templatePage === 0}
                                  onClick={() => setTemplatePage(p => p - 1)}
                                  className="rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] disabled:opacity-40 hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors"
                                >
                                  Previous
                                </button>
                                <button
                                  disabled={templatePage >= totalPages - 1}
                                  onClick={() => setTemplatePage(p => p + 1)}
                                  className="rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] disabled:opacity-40 hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors"
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })()}
              </section>

              {selectedWorkflow ? (
                <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] overflow-hidden">
                  <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-primary)]">
                    <div>
                      <h2 className="text-sm font-semibold text-[var(--text-primary)]">{selectedWorkflow.name || 'Untitled Workflow'}</h2>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">
                        {getWorkflowCountLabel(selectedWorkflow.steps.length, 'step')} · updated {fmtTimestamp(selectedWorkflow.updatedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setTab('builder')}
                        className="rounded-lg bg-[var(--bg-tertiary)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                      >
                        Open Builder
                      </button>
                      <button
                        onClick={() => handleDeleteWorkflow(selectedWorkflow.id)}
                        className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[#e05050] hover:bg-[#e05050]/10 transition-colors"
                        title="Delete workflow"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="p-5 space-y-5">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-4">
                        <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">Created</div>
                        <div className="mt-2 text-sm text-[var(--text-primary)]">{fmtTimestamp(selectedWorkflow.createdAt)}</div>
                      </div>
                      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-4">
                        <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">Updated</div>
                        <div className="mt-2 text-sm text-[var(--text-primary)]">{fmtTimestamp(selectedWorkflow.updatedAt)}</div>
                      </div>
                      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-4">
                        <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">Steps</div>
                        <div className="mt-2 text-sm text-[var(--text-primary)]">{selectedWorkflow.steps.length}</div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {selectedWorkflow.steps.length === 0 ? (
                        <div className="flex flex-col items-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-8 text-center">
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--bg-tertiary)]">
                            <Plus size={22} className="text-[var(--text-secondary)]" />
                          </div>
                          <h3 className="mt-4 text-base font-semibold text-[var(--text-primary)]">No steps yet</h3>
                          <p className="mt-2 max-w-md text-sm text-[var(--text-secondary)]">
                            Open this workflow in Builder to add ordered steps and run it.
                          </p>
                          <button
                            onClick={() => setTab('builder')}
                            className="mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
                            style={{ background: '#7f77dd' }}
                          >
                            <Plus size={14} />
                            Open Builder
                          </button>
                        </div>
                      ) : (
                        selectedWorkflow.steps.map((step, index) => (
                          <div key={step.stepId} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                                    Step {index + 1}
                                  </span>
                                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                                    {step.label.trim() || 'Untitled Step'}
                                  </span>
                                  <span
                                    className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                                    style={{ background: '#7f77dd18', color: '#a09ae8' }}
                                  >
                                    {providerBadge(savedProviders, step.model)}
                                  </span>
                                </div>
                                <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">{promptPreview(step.prompt)}</p>
                              </div>
                              <div className="text-right text-xs text-[var(--text-secondary)]">
                                <div>{step.outputVar || 'No output var'}</div>
                                {step.useOutputFrom && <div className="mt-1">uses {step.useOutputFrom}</div>}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </section>
              ) : (
                <section className="rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--bg-secondary)] px-5 py-10 text-center">
                  <div
                    className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center"
                    style={{ background: '#6366f122' }}
                  >
                    <GitBranch size={22} style={{ color: '#6366f1' }} />
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">Select a saved workflow</h2>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    Choose a workflow from the left or create a new one to inspect its steps after browsing the template library.
                  </p>
                  <button
                    onClick={handleNew}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
                    style={{ background: '#7f77dd' }}
                  >
                    <Plus size={14} />
                    New Workflow
                  </button>
                </section>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'builder' && (
        <div
          className="flex-1 min-h-0 grid"
          style={{ gridTemplateColumns: showOutputPanel ? 'minmax(0, 1fr) minmax(320px, 40%)' : 'minmax(0, 1fr)' }}
        >
          {draft ? (
            <>
              <div className="flex flex-col min-h-0 overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-primary)]">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <input
                        value={draft.name}
                        onChange={event => {
                          updateDraft(current => ({ ...current, name: event.target.value }))
                          if (event.target.value.trim()) setWorkflowNameError(null)
                        }}
                        className="flex-1 bg-transparent text-[var(--text-primary)] font-semibold text-sm outline-none border rounded-lg px-2 py-1 transition-colors"
                        style={{ borderColor: workflowNameError ? '#e05050' : 'transparent' }}
                        placeholder="Workflow name"
                      />
                      <button
                        onClick={handleSave}
                        className="rounded-lg bg-[var(--bg-tertiary)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                      >
                        Save Workflow
                      </button>
                    </div>
                    {workflowNameError && <p className="mt-2 text-xs text-[#e05050]">{workflowNameError}</p>}
                  </div>

                  <div className="flex items-center gap-2">
                    {!workflowRunning ? (
                      <button
                        onClick={() => void handleRun()}
                        disabled={draft.steps.length === 0 || savedProviders.length === 0}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:opacity-90"
                        style={{ background: '#7f77dd' }}
                      >
                        <Play size={14} />
                        Run Workflow
                      </button>
                    ) : (
                      <button
                        onClick={handleStop}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                        style={{ background: '#e05050' }}
                      >
                        <Square size={14} />
                        Stop
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {builderError && (
                    <div className="text-xs text-[#e05050] bg-[#e05050]/10 border border-[#e05050]/20 rounded-xl px-4 py-3">
                      {builderError}
                    </div>
                  )}

                  {draft.steps.length === 0 ? (
                    <div className="flex flex-col items-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-10 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--bg-tertiary)]">
                        <Plus size={22} className="text-[var(--text-secondary)]" />
                      </div>
                      <h2 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">No steps yet</h2>
                      <p className="mt-2 max-w-md text-sm text-[var(--text-secondary)]">
                        Add a step to define what this workflow should do and how outputs flow forward.
                      </p>
                      <button
                        onClick={addStep}
                        className="mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
                        style={{ background: '#7f77dd' }}
                      >
                        <Plus size={14} />
                        Add First Step
                      </button>
                    </div>
                  ) : (
                    draft.steps.map((step, index) => {
                      const previousOutputVars = draft.steps
                        .slice(0, index)
                        .map(previousStep => previousStep.outputVar.trim())
                        .filter(Boolean)
                      const isExpanded = !!expandedSteps[step.stepId]

                      return (
                        <div
                          key={step.stepId}
                          className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] overflow-hidden"
                        >
                          <button
                            onClick={() => toggleStepExpanded(step.stepId)}
                            className="w-full px-4 py-4 text-left"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                                    Step {index + 1}
                                  </span>
                                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                                    {step.label.trim() || 'Untitled Step'}
                                  </span>
                                  <span
                                    className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                                    style={{ background: '#7f77dd18', color: '#a09ae8' }}
                                  >
                                    {providerBadge(savedProviders, step.model)}
                                  </span>
                                </div>
                                <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">{promptPreview(step.prompt)}</p>
                                <div className="mt-3 flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                                  <span>output: {step.outputVar || 'unset'}</span>
                                  {step.useOutputFrom && <span>context: {step.useOutputFrom}</span>}
                                </div>
                              </div>

                              <div className="flex items-center gap-1 flex-shrink-0" onClick={event => event.stopPropagation()}>
                                <button
                                  onClick={() => moveStep(step.stepId, -1)}
                                  disabled={index === 0}
                                  className="rounded-lg border border-[var(--border-color)] p-2 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed"
                                  aria-label={`Move ${step.label || `step ${index + 1}`} up`}
                                >
                                  <ArrowUp size={14} />
                                </button>
                                <button
                                  onClick={() => moveStep(step.stepId, 1)}
                                  disabled={index === draft.steps.length - 1}
                                  className="rounded-lg border border-[var(--border-color)] p-2 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed"
                                  aria-label={`Move ${step.label || `step ${index + 1}`} down`}
                                >
                                  <ArrowDown size={14} />
                                </button>
                                <button
                                  onClick={() => deleteStep(step.stepId)}
                                  className="rounded-lg border border-[var(--border-color)] p-2 text-[var(--text-secondary)] transition-colors hover:text-[#e05050]"
                                  aria-label={`Delete ${step.label || `step ${index + 1}`}`}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="border-t border-[var(--border-color)] px-4 py-4 space-y-4">
                              <div>
                                <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-[0.1em] mb-2">
                                  Label
                                </label>
                                <input
                                  value={step.label}
                                  onChange={event => updateStep(step.stepId, { label: event.target.value })}
                                  placeholder="Research Phase"
                                  className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60 transition-colors"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-[0.1em] mb-2">
                                  Prompt
                                </label>
                                <textarea
                                  value={step.prompt}
                                  onChange={event => updateStep(step.stepId, { prompt: event.target.value })}
                                  rows={6}
                                  placeholder="Tell the model what this step should do."
                                  className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60 resize-none font-mono leading-relaxed transition-colors"
                                />
                              </div>

                              <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                  <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-[0.1em] mb-2">
                                    Model
                                  </label>
                                  {savedProviders.length > 0 ? (
                                    <select
                                      value={step.model}
                                      onChange={event => updateStep(step.stepId, { model: event.target.value })}
                                      className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60 cursor-pointer transition-colors"
                                      style={{ colorScheme: 'dark' }}
                                    >
                                      {savedProviders.map(provider => (
                                        <option key={provider.id} value={provider.id}>
                                          {provider.name} — {provider.model || provider.name}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <div className="rounded-xl border border-[#e05050]/20 bg-[#e05050]/10 px-4 py-3 text-xs text-[#e05050]">
                                      No saved providers found.
                                    </div>
                                  )}
                                </div>

                                <div>
                                  <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-[0.1em] mb-2">
                                    Output Variable
                                  </label>
                                  <input
                                    value={step.outputVar}
                                    onChange={event => updateStep(step.stepId, { outputVar: event.target.value })}
                                    placeholder="step1_output"
                                    className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60 transition-colors"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-[0.1em] mb-2">
                                  Use Output From
                                </label>
                                <select
                                  value={step.useOutputFrom || ''}
                                  onChange={event => updateStep(step.stepId, { useOutputFrom: event.target.value })}
                                  className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60 cursor-pointer transition-colors"
                                  style={{ colorScheme: 'dark' }}
                                >
                                  <option value="">No injected context</option>
                                  {previousOutputVars.map(outputVar => (
                                    <option key={outputVar} value={outputVar}>
                                      {outputVar}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}

                  <button
                    onClick={addStep}
                    className="w-full rounded-xl border border-dashed border-[var(--border-color)] px-4 py-3 text-sm font-medium text-[var(--text-muted)] transition-colors hover:border-[#7f77dd]/40 hover:text-[var(--text-primary)]"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Plus size={14} />
                      Add Step
                    </span>
                  </button>
                </div>
              </div>

              {showOutputPanel && (
                <div className="border-l border-[var(--border-color)] bg-[var(--bg-primary)] flex flex-col min-h-0">
                  <div className="flex items-center justify-between gap-3 px-4 py-4 border-b border-[var(--border-color)]">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Live Output</h3>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {workflowRunning ? 'Streaming step outputs…' : 'Latest workflow output'}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (!combinedOutput.trim()) return
                        void navigator.clipboard.writeText(combinedOutput).catch(() => {})
                      }}
                      disabled={!combinedOutput.trim()}
                      className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Copy size={12} />
                      Copy All Output
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {stepRuns.map(stepRun => (
                      <div key={stepRun.stepId} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] overflow-hidden">
                        <button
                          onClick={() =>
                            setExpandedOutputs(current => ({
                              ...current,
                              [stepRun.stepId]: !current[stepRun.stepId],
                            }))
                          }
                          className="w-full flex items-center gap-3 px-4 py-3 text-left"
                        >
                          {statusIcon(stepRun.status)}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-[var(--text-primary)]">{stepRun.label}</div>
                            <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                              {stepRun.outputVar || 'No output variable'}
                            </div>
                          </div>
                          <ChevronDown
                            size={14}
                            className="text-[var(--text-secondary)] transition-transform"
                            style={{ transform: expandedOutputs[stepRun.stepId] ? 'rotate(180deg)' : 'rotate(0deg)' }}
                          />
                        </button>

                        {expandedOutputs[stepRun.stepId] && (
                          <div className="px-4 pb-4">
                            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-4 py-3 text-xs text-[var(--text-primary)] font-mono leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                              {stepRun.output || stepRun.error || (
                                <span className="text-[var(--text-secondary)]">No output yet.</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="max-w-sm text-center space-y-3">
                <div
                  className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center"
                  style={{ background: '#6366f122' }}
                >
                  <GitBranch size={22} style={{ color: '#6366f1' }} />
                </div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Open the builder</h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  Select an existing workflow or create a new one to start editing steps.
                </p>
                <button
                  onClick={handleNew}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
                  style={{ background: '#7f77dd' }}
                >
                  <Plus size={14} />
                  New Workflow
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="flex-1 overflow-y-auto p-6">
          {runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-16">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: '#6366f122' }}>
                <History size={22} style={{ color: '#6366f1' }} />
              </div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">No runs yet</h2>
              <p className="max-w-md text-sm text-[var(--text-secondary)]">
                Run a workflow to capture step-by-step output history here.
              </p>
              <button
                onClick={() => setTab('builder')}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
                style={{ background: '#7f77dd' }}
              >
                <Play size={14} />
                Open Builder
              </button>
            </div>
          ) : (
            <div style={{ maxWidth: 720 }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-[var(--text-secondary)]">{getWorkflowCountLabel(runs.length, 'run')} total</p>
                {!clearConfirm ? (
                  <button
                    onClick={() => setClearConfirm(true)}
                    className="text-xs text-[var(--text-secondary)] hover:text-[#e05050] transition-colors"
                  >
                    Clear history
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[#e05050]">Clear all runs?</span>
                    <button
                      onClick={() => setClearConfirm(false)}
                      className="text-[var(--text-secondary)] hover:text-[var(--text-muted)] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        clearRuns()
                        setRuns([])
                        setClearConfirm(false)
                      }}
                      className="text-[#e05050] font-semibold hover:opacity-80 transition-opacity"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {runs.map(run => (
                  <RunCard key={run.id} run={run} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
