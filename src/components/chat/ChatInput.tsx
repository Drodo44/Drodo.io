import { useRef, useState, useEffect } from 'react'
import { Send, Paperclip, Code2, Zap, Square, Users } from 'lucide-react'
import { clsx } from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../../store/appStore'
import { ModelSwitcher } from './ModelSwitcher'

export function ChatInput() {
  const [value, setValue] = useState('')
  const {
    sendMessage,
    autonomousMode,
    toggleAutonomous,
    agentRunning,
    stopAll,
    autonomousLoopActive,
    chatDraft,
    setChatDraft,
    multiAgentMode,
    toggleMultiAgentMode,
    startOrchestration,
    orchestrationRun,
  } = useAppStore(
    useShallow(s => ({
      sendMessage: s.sendMessage,
      autonomousMode: s.autonomousMode,
      toggleAutonomous: s.toggleAutonomous,
      agentRunning: s.agentRunning,
      stopAll: s.stopAll,
      autonomousLoopActive: s.autonomousLoopActive,
      chatDraft: s.chatDraft,
      setChatDraft: s.setChatDraft,
      multiAgentMode: s.multiAgentMode,
      toggleMultiAgentMode: s.toggleMultiAgentMode,
      startOrchestration: s.startOrchestration,
      orchestrationRun: s.orchestrationRun,
    }))
  )
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Consume chatDraft when it changes (set by Prompt Library "Use in Chat")
  useEffect(() => {
    if (chatDraft) {
      setValue(chatDraft)
      setChatDraft('')
      textareaRef.current?.focus()
    }
  }, [chatDraft, setChatDraft])

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed || agentRunning) return

    if (multiAgentMode) {
      void startOrchestration(trimmed)
    } else {
      sendMessage(trimmed)
    }

    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }

  const planningActive = orchestrationRun?.status === 'planning'

  return (
    <div className="px-4 pb-4 pt-2">
      {/* Orchestration planning banner */}
      {planningActive && (
        <div
          className="mb-2 px-4 py-2 rounded-xl flex items-center gap-2 text-xs animate-fade-in"
          style={{ background: '#7f77dd18', border: '1px solid #7f77dd33' }}
        >
          <Users size={12} className="text-[#7f77dd] animate-pulse-dot flex-shrink-0" />
          <span className="font-medium text-[#a09ae8]">Planning your agent team…</span>
        </div>
      )}

      {/* Autonomous loop banner */}
      {autonomousLoopActive && (
        <div
          className="mb-2 px-4 py-2 rounded-xl flex items-center justify-between text-xs animate-fade-in"
          style={{ background: '#7f77dd18', border: '1px solid #7f77dd33' }}
        >
          <div className="flex items-center gap-2 text-[#a09ae8]">
            <Zap size={12} className="text-[#7f77dd] animate-pulse-dot" />
            <span className="font-medium">Agent is working autonomously — continuing until task is complete</span>
          </div>
          <button
            onClick={stopAll}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
            style={{ background: '#e05050' }}
          >
            <Square size={10} fill="currentColor" />
            Stop
          </button>
        </div>
      )}

      <div
        data-tutorial="chat-input"
        className="rounded-xl border transition-all duration-200"
        style={{
          background: 'var(--bg-tertiary)',
          borderColor: value ? '#7f77dd66' : agentRunning ? '#1d9e7540' : 'var(--border-color)',
          boxShadow: value ? '0 0 0 1px rgba(127,119,221,0.15)' : 'none',
        }}
      >
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={
            agentRunning
              ? 'Agent is working...'
              : multiAgentMode
              ? 'Describe a task for your agent team… (Ctrl+Enter)'
              : 'Message Drodo... (Ctrl+Enter to send)'
          }
          disabled={agentRunning}
          rows={1}
          className={clsx(
            'w-full bg-transparent px-4 pt-3 pb-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] resize-none outline-none',
            agentRunning && 'opacity-60 cursor-not-allowed'
          )}
          style={{ maxHeight: 120, minHeight: 44 }}
        />

        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 pb-2.5 gap-2">
          <div className="flex items-center gap-1.5">
            <button className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-muted)] hover:bg-[var(--border-color)] transition-colors">
              <Paperclip size={15} />
            </button>
            <button className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-muted)] hover:bg-[var(--border-color)] transition-colors">
              <Code2 size={15} />
            </button>
            <div className="w-px h-4 bg-[var(--border-color)]" />
            <ModelSwitcher />
          </div>

          <div className="flex items-center gap-2.5">
            {/* Autonomous toggle */}
            <button
              onClick={toggleAutonomous}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all duration-200',
                autonomousMode
                  ? 'bg-[#7f77dd]/15 border-[#7f77dd]/40 text-[#a09ae8]'
                  : 'bg-transparent border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--border-color)] hover:text-[var(--text-muted)]'
              )}
              title={autonomousMode ? 'Autonomous mode ON — agent will continue until task is done' : 'Enable autonomous mode'}
            >
              <Zap size={11} className={autonomousMode ? 'text-[#7f77dd]' : ''} />
              Autonomous
            </button>

            {/* Multi-Agent toggle */}
            <button
              onClick={toggleMultiAgentMode}
              className={clsx(
                'relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all duration-200',
                multiAgentMode
                  ? 'bg-[#7f77dd]/15 border-[#7f77dd]/50 text-[#a09ae8]'
                  : 'bg-transparent border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--border-color)] hover:text-[var(--text-muted)]'
              )}
              style={
                multiAgentMode
                  ? { boxShadow: '0 0 0 1px rgba(127,119,221,0.25), 0 0 8px rgba(127,119,221,0.15)' }
                  : undefined
              }
              title={multiAgentMode ? 'Multi-Agent mode ON — task will be handled by a team of specialists' : 'Enable multi-agent mode'}
            >
              <Users size={11} className={multiAgentMode ? 'text-[#7f77dd]' : ''} />
              Multi-Agent
              {multiAgentMode && (
                <span
                  className="ml-0.5 px-1 py-px rounded text-[9px] font-bold leading-none"
                  style={{ background: '#7f77dd', color: '#fff' }}
                >
                  ON
                </span>
              )}
            </button>

            {/* Stop button (visible while running) */}
            {agentRunning && (
              <button
                onClick={stopAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all animate-fade-in"
                style={{ background: '#e05050' }}
              >
                <Square size={12} fill="currentColor" />
                Stop
              </button>
            )}

            {/* Send button */}
            {!agentRunning && (
              <button
                onClick={handleSend}
                disabled={!value.trim()}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200',
                  value.trim()
                    ? 'bg-[#7f77dd] text-white hover:bg-[#6a63c8] shadow-[0_2px_8px_rgba(127,119,221,0.3)]'
                    : 'bg-[var(--border-color)] text-[var(--text-secondary)] cursor-not-allowed'
                )}
              >
                <Send size={13} />
                Send
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="text-center mt-2">
        <span className="text-xs text-[var(--text-secondary)]">
          Ctrl+Enter to send
          {autonomousMode && ' · Autonomous mode active — agent will self-continue'}
          {multiAgentMode && ' · Multi-Agent mode active — task routed to specialist team'}
        </span>
      </div>
    </div>
  )
}
