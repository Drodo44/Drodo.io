import { useState, useRef } from 'react'
import { GitBranch, Plus, Play, Square, Trash2, ChevronRight, Loader, History, ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'
import { streamCompletion } from '../lib/streamChat'
import { getAllProviders, loadAllSavedConfigs } from '../lib/providerApi'
import { notify } from '../lib/notifications'
import type { Provider, Message } from '../types'

// ─── Storage ──────────────────────────────────────────────────────────────────

const WORKFLOWS_KEY = 'drodo_workflow_defs'
const RUNS_KEY = 'drodo_workflow_runs'

interface StoredWorkflow {
  id: string
  name: string
  systemPrompt: string
  userPrompt: string
  providerId: string
  createdAt: number
}

interface WorkflowRun {
  id: string
  workflowId: string
  workflowName: string
  startedAt: string   // ISO
  finishedAt: string  // ISO
  status: 'complete' | 'error' | 'stopped'
  durationMs: number
  output: string
}

function loadWorkflows(): StoredWorkflow[] {
  try {
    const raw = localStorage.getItem(WORKFLOWS_KEY)
    return raw ? (JSON.parse(raw) as StoredWorkflow[]) : []
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
  // Keep last 100 runs
  localStorage.setItem(RUNS_KEY, JSON.stringify([...runs, run].slice(-100)))
}

function clearRuns(): void {
  localStorage.removeItem(RUNS_KEY)
}

function makeNewWorkflow(providerId: string): StoredWorkflow {
  return {
    id: `wf_${Date.now()}`,
    name: 'Untitled Workflow',
    systemPrompt: '',
    userPrompt: '',
    providerId,
    createdAt: Date.now(),
  }
}

// ─── Provider helpers ─────────────────────────────────────────────────────────

function getSavedProviders(): Provider[] {
  const configs = loadAllSavedConfigs()
  return getAllProviders()
    .filter(p => configs[p.id])
    .map(p => {
      const cfg = configs[p.id]
      return { ...p, apiKey: cfg.apiKey, model: cfg.model, baseUrl: cfg.baseUrl || p.baseUrl }
    })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Run Card ─────────────────────────────────────────────────────────────────

function RunCard({ run }: { run: WorkflowRun }) {
  const [expanded, setExpanded] = useState(false)

  const statusColor =
    run.status === 'complete' ? '#1d9e75' :
    run.status === 'error'    ? '#e05050' : '#9898a8'
  const statusBg =
    run.status === 'complete' ? '#1d9e7515' :
    run.status === 'error'    ? '#e0505015' : '#9898a815'
  const statusBorder =
    run.status === 'complete' ? '#1d9e7530' :
    run.status === 'error'    ? '#e0505030' : '#9898a830'

  return (
    <div
      className="rounded-xl border border-[#2a2a2e] bg-[#141418] overflow-hidden cursor-pointer hover:border-[#3a3a42] transition-colors"
      onClick={() => setExpanded(e => !e)}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-[#e8e8ef] truncate">{run.workflowName}</span>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
              style={{ color: statusColor, background: statusBg, border: `1px solid ${statusBorder}` }}
            >
              {run.status}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-[#6b6b78]">{fmtRelative(run.startedAt)}</span>
            <span className="text-xs text-[#6b6b78]">{fmtDuration(run.durationMs)}</span>
          </div>
          {!expanded && run.output && (
            <p className="text-xs text-[#9898a8] mt-1 line-clamp-1 font-mono">
              {run.output.slice(0, 120)}
            </p>
          )}
        </div>
        <ChevronDown
          size={14}
          className="flex-shrink-0 text-[#6b6b78] transition-transform"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </div>
      {expanded && run.output && (
        <div className="px-4 pb-4" onClick={e => e.stopPropagation()}>
          <div className="bg-[#0d0d0f] border border-[#2a2a2e] rounded-xl px-4 py-3 text-xs text-[#d6d6de] font-mono leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
            {run.output}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function WorkflowsView() {
  const [tab, setTab] = useState<'workflows' | 'history'>('workflows')
  const [workflows, setWorkflows] = useState<StoredWorkflow[]>(loadWorkflows)
  const [runs, setRuns] = useState<WorkflowRun[]>(() => loadRuns().slice().reverse())
  const [selectedId, setSelectedId] = useState<string | null>(() => loadWorkflows()[0]?.id ?? null)
  const [draft, setDraft] = useState<StoredWorkflow | null>(() => {
    const all = loadWorkflows()
    return all[0] ? { ...all[0] } : null
  })
  const [output, setOutput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<{ abort: () => void } | null>(null)
  const runStartRef = useRef<number>(0)
  const [clearConfirm, setClearConfirm] = useState(false)

  const savedProviders = getSavedProviders()

  const refreshRuns = () => setRuns(loadRuns().slice().reverse())

  const selectWorkflow = (wf: StoredWorkflow) => {
    setSelectedId(wf.id)
    setDraft({ ...wf })
    setOutput('')
    setError(null)
  }

  const handleNew = () => {
    const providerId = savedProviders[0]?.id ?? ''
    const wf = makeNewWorkflow(providerId)
    const updated = [...workflows, wf]
    setWorkflows(updated)
    saveWorkflows(updated)
    selectWorkflow(wf)
  }

  const handleSave = () => {
    if (!draft) return
    const updated = workflows.map(w => (w.id === draft.id ? draft : w))
    setWorkflows(updated)
    saveWorkflows(updated)
  }

  const handleDelete = (id: string) => {
    const updated = workflows.filter(w => w.id !== id)
    setWorkflows(updated)
    saveWorkflows(updated)
    if (selectedId === id) {
      const next = updated[0] ?? null
      setSelectedId(next?.id ?? null)
      setDraft(next ? { ...next } : null)
      setOutput('')
      setError(null)
    }
  }

  const handleRun = () => {
    if (!draft || streaming) return
    const provider = savedProviders.find(p => p.id === draft.providerId)
    if (!provider) {
      setError('No provider selected. Connect a model first in Connections.')
      return
    }

    const messages: Message[] = []
    if (draft.systemPrompt.trim()) {
      messages.push({ id: 'sys', role: 'system', content: draft.systemPrompt.trim(), timestamp: new Date() })
    }
    messages.push({ id: 'user', role: 'user', content: draft.userPrompt.trim() || 'Hello', timestamp: new Date() })

    setOutput('')
    setError(null)
    setStreaming(true)
    runStartRef.current = Date.now()
    const startedAt = new Date().toISOString()
    let finalOutput = ''

    const handle = streamCompletion(
      provider,
      messages,
      chunk => {
        finalOutput += chunk
        setOutput(prev => prev + chunk)
      },
      () => {
        setStreaming(false)
        const finishedAt = new Date().toISOString()
        const durationMs = Date.now() - runStartRef.current
        const run: WorkflowRun = {
          id: `run_${Date.now()}`,
          workflowId: draft.id,
          workflowName: draft.name || 'Untitled',
          startedAt,
          finishedAt,
          status: 'complete',
          durationMs,
          output: finalOutput,
        }
        appendRun(run)
        refreshRuns()
        void notify('Workflow complete', `"${draft.name || 'Untitled'}" finished in ${fmtDuration(durationMs)}.`)
      },
      err => {
        setError(err.message)
        setStreaming(false)
        const finishedAt = new Date().toISOString()
        const run: WorkflowRun = {
          id: `run_${Date.now()}`,
          workflowId: draft.id,
          workflowName: draft.name || 'Untitled',
          startedAt,
          finishedAt,
          status: 'error',
          durationMs: Date.now() - runStartRef.current,
          output: err.message,
        }
        appendRun(run)
        refreshRuns()
      }
    )
    streamRef.current = handle
  }

  const handleStop = () => {
    streamRef.current?.abort()
    setStreaming(false)
    if (draft) {
      const finishedAt = new Date().toISOString()
      const run: WorkflowRun = {
        id: `run_${Date.now()}`,
        workflowId: draft.id,
        workflowName: draft.name || 'Untitled',
        startedAt: new Date(runStartRef.current).toISOString(),
        finishedAt,
        status: 'stopped',
        durationMs: Date.now() - runStartRef.current,
        output,
      }
      appendRun(run)
      refreshRuns()
    }
  }

  const updateDraft = (patch: Partial<StoredWorkflow>) => {
    setDraft(prev => (prev ? { ...prev, ...patch } : null))
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: '#0d0d0f' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid #2a2a2e', background: '#141418' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#6366f122' }}>
            <GitBranch size={18} style={{ color: '#6366f1' }} />
          </div>
          <div>
            <h1 className="font-bold text-[#e8e8ef] text-lg">Workflows</h1>
            <p className="text-xs text-[#6b6b78]">
              {workflows.length} workflow{workflows.length !== 1 ? 's' : ''} · {runs.length} run{runs.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Tabs */}
          <div className="flex rounded-xl border border-[#2a2a2e] overflow-hidden" style={{ background: '#0d0d0f' }}>
            {([
              { key: 'workflows' as const, label: 'Workflows', Icon: GitBranch },
              { key: 'history' as const, label: 'Run History', Icon: History },
            ]).map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-colors"
                style={
                  tab === key
                    ? { background: '#7f77dd', color: '#fff' }
                    : { color: '#9898a8' }
                }
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>

          {tab === 'workflows' && (
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

      {/* ── Workflows Tab ── */}
      {tab === 'workflows' && (
        <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: '260px 1fr' }}>
          {/* Left: workflow list */}
          <div className="border-r border-[#2a2a2e] overflow-y-auto p-3 space-y-1">
            {workflows.length === 0 && (
              <p className="text-xs text-[#6b6b78] px-2 py-3">
                No workflows yet. Click &ldquo;New&rdquo; to create one.
              </p>
            )}
            {workflows.map(wf => (
              <button
                key={wf.id}
                onClick={() => selectWorkflow(wf)}
                className={clsx(
                  'w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-left transition-colors group',
                  selectedId === wf.id
                    ? 'bg-[#7f77dd]/12 text-[#e8e8ef]'
                    : 'text-[#9898a8] hover:bg-[#1c1c22] hover:text-[#e8e8ef]'
                )}
              >
                <GitBranch
                  size={14}
                  style={{ color: selectedId === wf.id ? '#7f77dd' : undefined, flexShrink: 0 }}
                />
                <span className="flex-1 truncate">{wf.name || 'Untitled'}</span>
                <ChevronRight size={12} className="opacity-0 group-hover:opacity-60 flex-shrink-0" />
              </button>
            ))}
          </div>

          {/* Right: editor */}
          {draft ? (
            <div className="flex flex-col min-h-0 overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center gap-2 px-5 py-3 border-b border-[#2a2a2e] bg-[#0f0f12]">
                <input
                  value={draft.name}
                  onChange={e => updateDraft({ name: e.target.value })}
                  className="flex-1 bg-transparent text-[#e8e8ef] font-semibold text-sm outline-none border border-transparent rounded-lg px-2 py-1 hover:border-[#2a2a2e] focus:border-[#7f77dd]/60 transition-colors"
                  placeholder="Workflow name"
                />
                <button
                  onClick={handleSave}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#9898a8] hover:text-[#e8e8ef] bg-[#1c1c22] hover:bg-[#252529] transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => handleDelete(draft.id)}
                  className="p-1.5 rounded-lg text-[#6b6b78] hover:text-[#e05050] hover:bg-[#e05050]/10 transition-colors"
                  title="Delete workflow"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* System prompt */}
                <div>
                  <label className="block text-xs font-semibold text-[#9898a8] uppercase tracking-[0.1em] mb-2">
                    System Prompt{' '}
                    <span className="font-normal normal-case text-[#6b6b78]">(optional)</span>
                  </label>
                  <textarea
                    value={draft.systemPrompt}
                    onChange={e => updateDraft({ systemPrompt: e.target.value })}
                    rows={4}
                    className="w-full bg-[#141418] border border-[#2a2a2e] rounded-xl px-4 py-3 text-sm text-[#e8e8ef] outline-none focus:border-[#7f77dd]/60 resize-none font-mono leading-relaxed transition-colors"
                    placeholder="You are a helpful assistant that..."
                  />
                </div>

                {/* User prompt */}
                <div>
                  <label className="block text-xs font-semibold text-[#9898a8] uppercase tracking-[0.1em] mb-2">
                    User Prompt
                  </label>
                  <textarea
                    value={draft.userPrompt}
                    onChange={e => updateDraft({ userPrompt: e.target.value })}
                    rows={7}
                    className="w-full bg-[#141418] border border-[#2a2a2e] rounded-xl px-4 py-3 text-sm text-[#e8e8ef] outline-none focus:border-[#7f77dd]/60 resize-none font-mono leading-relaxed transition-colors"
                    placeholder="Summarize the following text:&#10;&#10;{{input}}"
                  />
                </div>

                {/* Model selector */}
                <div>
                  <label className="block text-xs font-semibold text-[#9898a8] uppercase tracking-[0.1em] mb-2">
                    Model
                  </label>
                  {savedProviders.length > 0 ? (
                    <select
                      value={draft.providerId}
                      onChange={e => updateDraft({ providerId: e.target.value })}
                      className="w-full bg-[#141418] border border-[#2a2a2e] rounded-xl px-4 py-3 text-sm text-[#e8e8ef] outline-none focus:border-[#7f77dd]/60 cursor-pointer transition-colors"
                      style={{ colorScheme: 'dark' }}
                    >
                      {savedProviders.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {p.model}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-xs text-[#e05050] bg-[#e05050]/10 border border-[#e05050]/20 rounded-xl px-4 py-3">
                      No models connected. Add a provider in Connections first.
                    </div>
                  )}
                </div>

                {/* Run / Stop */}
                <div className="flex items-center gap-3">
                  {!streaming ? (
                    <button
                      onClick={handleRun}
                      disabled={!draft.userPrompt.trim() || savedProviders.length === 0}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:opacity-90 active:scale-[0.98]"
                      style={{ background: '#7f77dd' }}
                    >
                      <Play size={14} />
                      Run Workflow
                    </button>
                  ) : (
                    <button
                      onClick={handleStop}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                      style={{ background: '#e05050', color: '#fff' }}
                    >
                      <Square size={14} />
                      Stop
                    </button>
                  )}
                  {streaming && <Loader size={14} className="text-[#7f77dd] animate-spin" />}
                </div>

                {/* Error */}
                {error && (
                  <div className="text-xs text-[#e05050] bg-[#e05050]/10 border border-[#e05050]/20 rounded-xl px-4 py-3">
                    {error}
                  </div>
                )}

                {/* Output */}
                {(output || streaming) && (
                  <div>
                    <label className="block text-xs font-semibold text-[#9898a8] uppercase tracking-[0.1em] mb-2">
                      Output
                      {streaming && (
                        <span className="ml-2 normal-case font-normal text-[#7f77dd]">streaming…</span>
                      )}
                    </label>
                    <div className="bg-[#141418] border border-[#2a2a2e] rounded-xl px-4 py-4 text-sm text-[#d6d6de] font-mono leading-relaxed whitespace-pre-wrap">
                      {output}
                      {streaming && (
                        <span className="inline-block w-1.5 h-4 bg-[#7f77dd] ml-0.5 animate-pulse align-text-bottom" />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <div
                  className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center"
                  style={{ background: '#6366f122' }}
                >
                  <GitBranch size={22} style={{ color: '#6366f1' }} />
                </div>
                <p className="text-sm text-[#9898a8]">Select or create a workflow</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Run History Tab ── */}
      {tab === 'history' && (
        <div className="flex-1 overflow-y-auto p-6">
          {runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-16">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#6366f122' }}>
                <History size={22} style={{ color: '#6366f1' }} />
              </div>
              <p className="text-sm text-[#9898a8]">No runs yet</p>
              <p className="text-xs text-[#6b6b78]">Run a workflow to see history here.</p>
            </div>
          ) : (
            <div style={{ maxWidth: 720 }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-[#6b6b78]">{runs.length} run{runs.length !== 1 ? 's' : ''} total</p>
                {!clearConfirm ? (
                  <button
                    onClick={() => setClearConfirm(true)}
                    className="text-xs text-[#6b6b78] hover:text-[#e05050] transition-colors"
                  >
                    Clear history
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[#e05050]">Clear all runs?</span>
                    <button
                      onClick={() => setClearConfirm(false)}
                      className="text-[#6b6b78] hover:text-[#9898a8] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => { clearRuns(); setRuns([]); setClearConfirm(false) }}
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
