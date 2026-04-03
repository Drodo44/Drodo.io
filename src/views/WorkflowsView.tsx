import { GitBranch, Plus, Play, Pause, Clock, CheckCircle } from 'lucide-react'
import { clsx } from 'clsx'
import type { Workflow } from '../types'

const MOCK_WORKFLOWS: Workflow[] = [
  { id: 'w1', name: 'Daily Code Review', trigger: 'Cron: 9:00 AM daily', lastRun: new Date(Date.now() - 3600000), status: 'active', runsCount: 47 },
  { id: 'w2', name: 'PR Analysis', trigger: 'GitHub: pull_request opened', lastRun: new Date(Date.now() - 7200000), status: 'active', runsCount: 183 },
  { id: 'w3', name: 'Deploy Monitor', trigger: 'Webhook: /deploy-complete', lastRun: new Date(Date.now() - 86400000), status: 'running', runsCount: 29 },
  { id: 'w4', name: 'Weekly Report', trigger: 'Cron: Monday 8:00 AM', lastRun: new Date(Date.now() - 604800000), status: 'active', runsCount: 12 },
  { id: 'w5', name: 'Bug Triage', trigger: 'Manual', lastRun: new Date(Date.now() - 172800000), status: 'inactive', runsCount: 8 },
]

const STATUS_CFG = {
  active: { color: '#1d9e75', bg: '#1d9e7515', label: 'Active', Icon: CheckCircle },
  inactive: { color: '#6b6b78', bg: '#6b6b7815', label: 'Inactive', Icon: Pause },
  running: { color: '#7f77dd', bg: '#7f77dd15', label: 'Running', Icon: Play },
}

function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function WorkflowsView() {
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
            <p className="text-xs text-[#6b6b78]">{MOCK_WORKFLOWS.length} workflows configured</p>
          </div>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#7f77dd' }}
        >
          <Plus size={14} />
          New Workflow
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {MOCK_WORKFLOWS.map(wf => {
          const cfg = STATUS_CFG[wf.status]
          const { Icon } = cfg
          return (
            <div
              key={wf.id}
              className="flex items-center gap-4 p-4 rounded-xl border border-[#2a2a2e] bg-[#141418] hover:border-[#3a3a42] transition-all cursor-pointer group"
            >
              <div
                className={clsx(
                  'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                  wf.status === 'running' && 'animate-pulse-ring'
                )}
                style={{ background: cfg.bg }}
              >
                <Icon size={18} style={{ color: cfg.color }} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-medium text-[#e8e8ef] text-sm group-hover:text-[#a09ae8] transition-colors">{wf.name}</div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-[#6b6b78]">{wf.trigger}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-[#6b6b78] flex-shrink-0">
                <span className="flex items-center gap-1">
                  <Play size={10} />
                  {wf.runsCount} runs
                </span>
                {wf.lastRun && (
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {timeAgo(wf.lastRun)}
                  </span>
                )}
                <span
                  className="flex items-center gap-1.5 font-medium px-2.5 py-1 rounded-full"
                  style={{ color: cfg.color, background: cfg.bg }}
                >
                  <Icon size={10} />
                  {cfg.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
