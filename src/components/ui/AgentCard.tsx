import { Square, Cpu, Wrench } from 'lucide-react'
import { clsx } from 'clsx'
import { useAppStore } from '../../store/appStore'
import { StatusBadge } from './StatusBadge'
import type { AgentInstance } from '../../types'

const STATUS_BORDER: Record<string, string> = {
  idle: 'border-[var(--border-color)]',
  running: 'border-[#7f77dd]/40',
  complete: 'border-[#1d9e75]/30',
  error: 'border-[#e05050]/40',
}

interface AgentCardProps {
  agent: AgentInstance
}

export function AgentCard({ agent }: AgentCardProps) {
  const stopAgent = useAppStore(s => s.stopAgent)

  const formatTokens = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return n.toString()
  }

  return (
    <div
      className={clsx(
        'rounded-xl border p-4 flex flex-col gap-3 transition-all duration-300',
        'bg-[var(--bg-tertiary)]',
        STATUS_BORDER[agent.status],
        agent.status === 'running' && 'shadow-[0_0_16px_rgba(127,119,221,0.08)]'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={clsx(
              'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold',
              agent.status === 'running' ? 'bg-[#7f77dd]/20 text-[#a09ae8]' : 'bg-[var(--border-color)] text-[var(--text-secondary)]'
            )}
          >
            {agent.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm text-[var(--text-primary)] truncate">{agent.name}</div>
            <div className="flex items-center gap-1 mt-0.5">
              <Cpu size={10} className="text-[var(--text-secondary)] flex-shrink-0" />
              <span className="text-xs text-[var(--text-secondary)] truncate">{agent.providerName} · {agent.model}</span>
            </div>
          </div>
        </div>
        <StatusBadge status={agent.status} size="sm" />
      </div>

      {/* Task */}
      <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-2 flex-1">
        {agent.task}
      </p>

      {agent.lastUpdate && (
        <div className="text-xs leading-relaxed text-[var(--text-primary)] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-3 py-2">
          {agent.lastUpdate}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--border-color)]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-xs text-[var(--text-secondary)]">Tokens:</span>
            <span
              className={clsx(
                'text-xs font-mono font-medium tabular-nums',
                agent.status === 'running' ? 'text-[#a09ae8]' : 'text-[var(--text-muted)]'
              )}
            >
              {formatTokens(agent.tokens)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
            <Wrench size={10} />
            {agent.toolCalls}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {agent.status === 'running' && (
            <button
              onClick={() => stopAgent(agent.id)}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#e05050]/10 text-[#e05050] border border-[#e05050]/20 text-xs font-medium hover:bg-[#e05050]/20 transition-colors"
            >
              <Square size={10} />
              Stop
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
