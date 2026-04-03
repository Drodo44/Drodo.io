import { useState } from 'react'
import { Check, Zap, Activity, Square } from 'lucide-react'
import { clsx } from 'clsx'
import { useAppStore } from '../../store/appStore'
import { PermissionBadge } from '../ui/PermissionBadge'

export function TopBar() {
  const {
    sessionName, setSessionName, agentRunning,
    autonomousMode, autonomousLoopActive, autonomousLoopCount, autonomousMaxLoops,
    agents, stopAll,
  } = useAppStore()
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(sessionName)

  const runningCount = agents.filter(a => a.status === 'running').length
  const totalTokens = agents.reduce((sum, a) => sum + a.tokens, 0)

  const commitName = () => {
    setSessionName(nameInput.trim() || sessionName)
    setEditingName(false)
  }

  return (
    <header
      className="flex items-center gap-4 px-5 flex-shrink-0"
      style={{
        height: 52,
        background: '#1c1c22',
        borderBottom: '1px solid #2a2a2e',
      }}
    >
      {/* Session Name */}
      <div className="flex items-center gap-2 min-w-0">
        {editingName ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => {
                if (e.key === 'Enter') commitName()
                if (e.key === 'Escape') { setNameInput(sessionName); setEditingName(false) }
              }}
              className="bg-[#0d0d0f] border border-[#7f77dd]/60 rounded-md px-2.5 py-1 text-sm text-[#e8e8ef] outline-none font-medium"
              style={{ minWidth: 180 }}
            />
            <button onClick={commitName} className="text-[#1d9e75]">
              <Check size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setNameInput(sessionName); setEditingName(true) }}
            className="text-sm font-semibold text-[#e8e8ef] hover:text-[#7f77dd] transition-colors truncate max-w-[200px]"
            title="Click to rename session"
          >
            {sessionName}
          </button>
        )}
      </div>

      {/* Status Badges */}
      <div className="flex items-center gap-2 flex-1 justify-center flex-wrap">
        {/* Running status */}
        <span
          className={clsx(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
            agentRunning
              ? 'text-[#1d9e75] bg-[#1d9e75]/10 border-[#1d9e75]/30'
              : 'text-[#6b6b78] bg-[#2a2a2e]/50 border-[#2a2a2e]'
          )}
        >
          <span
            className={clsx(
              'w-1.5 h-1.5 rounded-full',
              agentRunning ? 'bg-[#1d9e75] animate-pulse-dot' : 'bg-[#6b6b78]'
            )}
          />
          {agentRunning ? 'Running' : 'Ready'}
        </span>

        {/* Autonomous running banner */}
        {autonomousLoopActive && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#7f77dd]/15 text-[#a09ae8] border border-[#7f77dd]/40 animate-pulse-dot">
            <Zap size={11} className="text-[#7f77dd]" />
            Agent working autonomously ({autonomousLoopCount}/{autonomousMaxLoops})
          </span>
        )}

        {/* Autonomous mode badge (not looping) */}
        {autonomousMode && !autonomousLoopActive && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#7f77dd]/10 text-[#a09ae8] border border-[#7f77dd]/30">
            <Zap size={11} />
            Autonomous
          </span>
        )}

        {/* Stop button — shown while agent is running */}
        {agentRunning && (
          <button
            onClick={stopAll}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all hover:opacity-90 active:scale-95"
            style={{
              background: '#e05050',
              borderColor: '#e05050',
              color: '#fff',
            }}
          >
            <Square size={10} fill="currentColor" />
            Stop
          </button>
        )}

        {/* Running swarm agents */}
        {runningCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#2a2a2e] text-[#9898a8]">
            <Activity size={11} className="text-[#7f77dd]" />
            {runningCount} agent{runningCount !== 1 ? 's' : ''} active
          </span>
        )}
      </div>

      {/* Right: Permission + Usage */}
      <div className="flex items-center gap-2.5">
        <div className="text-xs text-[#6b6b78] font-mono tabular-nums">
          {totalTokens > 0
            ? `${(totalTokens / 1000).toFixed(1)}k tokens`
            : '0 tokens'
          }
        </div>
        <PermissionBadge />
      </div>
    </header>
  )
}
