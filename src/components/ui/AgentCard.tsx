import { useEffect, useState } from 'react'
import { Square, Eye, Cpu } from 'lucide-react'
import { clsx } from 'clsx'
import { useAppStore } from '../../store/appStore'
import { StatusBadge } from './StatusBadge'
import type { AgentInstance } from '../../types'

const STATUS_BORDER: Record<string, string> = {
  idle: 'border-[#2a2a2e]',
  running: 'border-[#7f77dd]/40',
  complete: 'border-[#1d9e75]/30',
  error: 'border-[#e05050]/40',
}

interface AgentCardProps {
  agent: AgentInstance
}

export function AgentCard({ agent }: AgentCardProps) {
  const stopAgent = useAppStore(s => s.stopAgent)
  const [displayTokens, setDisplayTokens] = useState(agent.tokens)

  // Live token counter animation for running agents
  useEffect(() => {
    if (agent.status !== 'running') {
      setDisplayTokens(agent.tokens)
      return
    }
    const interval = setInterval(() => {
      setDisplayTokens(prev => prev + Math.floor(Math.random() * 12) + 2)
    }, 400)
    return () => clearInterval(interval)
  }, [agent.status, agent.tokens])

  const formatTokens = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return n.toString()
  }

  return (
    <div
      className={clsx(
        'rounded-xl border p-4 flex flex-col gap-3 transition-all duration-300',
        'bg-[#1c1c22]',
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
              agent.status === 'running' ? 'bg-[#7f77dd]/20 text-[#a09ae8]' : 'bg-[#2a2a2e] text-[#6b6b78]'
            )}
          >
            {agent.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm text-[#e8e8ef] truncate">{agent.name}</div>
            <div className="flex items-center gap-1 mt-0.5">
              <Cpu size={10} className="text-[#6b6b78] flex-shrink-0" />
              <span className="text-xs text-[#6b6b78] truncate">{agent.model}</span>
            </div>
          </div>
        </div>
        <StatusBadge status={agent.status} size="sm" />
      </div>

      {/* Task */}
      <p className="text-xs text-[#9898a8] leading-relaxed line-clamp-2 flex-1">
        {agent.task}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#2a2a2e]">
        <div className="flex items-center gap-1">
          <span className="text-xs text-[#6b6b78]">Tokens:</span>
          <span
            className={clsx(
              'text-xs font-mono font-medium tabular-nums',
              agent.status === 'running' ? 'text-[#a09ae8]' : 'text-[#9898a8]'
            )}
          >
            {formatTokens(displayTokens)}
          </span>
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
          <button className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#2a2a2e] text-[#9898a8] text-xs font-medium hover:bg-[#3a3a42] hover:text-[#e8e8ef] transition-colors">
            <Eye size={10} />
            View
          </button>
        </div>
      </div>
    </div>
  )
}
