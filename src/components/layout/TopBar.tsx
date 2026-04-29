import { useState } from 'react'
import { Check, Zap, Activity, Square } from 'lucide-react'
import { clsx } from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../../store/appStore'
import { PermissionBadge } from '../ui/PermissionBadge'

export function TopBar() {
  const {
    sessionName, setSessionName, agentRunning,
    autonomousMode, autonomousLoopActive, autonomousLoopCount, autonomousMaxLoops,
    runningAgentCount, totalAgentTokens, stopAll,
  } = useAppStore(
    useShallow(s => ({
      sessionName: s.sessionName,
      setSessionName: s.setSessionName,
      agentRunning: s.agentRunning,
      autonomousMode: s.autonomousMode,
      autonomousLoopActive: s.autonomousLoopActive,
      autonomousLoopCount: s.autonomousLoopCount,
      autonomousMaxLoops: s.autonomousMaxLoops,
      runningAgentCount: s.runningAgentCount,
      totalAgentTokens: s.totalAgentTokens,
      stopAll: s.stopAll,
    }))
  )
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(sessionName)

  const commitName = () => {
    setSessionName(nameInput.trim() || sessionName)
    setEditingName(false)
  }

  return (
    <header
      className="flex items-center gap-4 px-5 flex-shrink-0"
      style={{
        height: 52,
        background: 'var(--bg-tertiary)',
        borderBottom: '1px solid var(--border-color)',
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
              className="bg-[var(--bg-primary)] border border-[#7f77dd]/60 rounded-md px-2.5 py-1 text-sm text-[var(--text-primary)] outline-none font-medium"
              style={{ minWidth: 180 }}
            />
            <button onClick={commitName} className="text-[#1d9e75]">
              <Check size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setNameInput(sessionName); setEditingName(true) }}
            className="text-sm font-semibold text-[var(--text-primary)] hover:text-[#7f77dd] transition-colors truncate max-w-[200px]"
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
              : 'text-[var(--text-secondary)] bg-[var(--border-color)]/50 border-[var(--border-color)]'
          )}
        >
          <span
            className={clsx(
              'w-1.5 h-1.5 rounded-full',
              agentRunning ? 'bg-[#1d9e75] animate-pulse-dot' : 'bg-[var(--text-secondary)]'
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
        {runningAgentCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--border-color)] text-[var(--text-muted)]">
            <Activity size={11} className="text-[#7f77dd]" />
            {runningAgentCount} agent{runningAgentCount !== 1 ? 's' : ''} active
          </span>
        )}
      </div>

      {/* Right: Permission + Usage */}
      <div className="flex items-center gap-2.5">
        <div className="text-xs text-[var(--text-secondary)] font-mono tabular-nums">
          {totalAgentTokens > 0
            ? `${(totalAgentTokens / 1000).toFixed(1)}k tokens`
            : '0 tokens'
          }
        </div>
        <PermissionBadge />
      </div>
    </header>
  )
}
