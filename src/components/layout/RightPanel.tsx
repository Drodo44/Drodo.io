import { useMemo, useState } from 'react'
import {
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Circle,
  FolderOpen,
  Loader,
  XCircle,
  Trash2,
  Play,
} from 'lucide-react'
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import ts from 'react-syntax-highlighter/dist/cjs/languages/hljs/typescript'
import json from 'react-syntax-highlighter/dist/cjs/languages/hljs/json'
import powershell from 'react-syntax-highlighter/dist/cjs/languages/hljs/powershell'
import shell from 'react-syntax-highlighter/dist/cjs/languages/hljs/shell'
import rust from 'react-syntax-highlighter/dist/cjs/languages/hljs/rust'
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import { clsx } from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../../store/appStore'
import type { TaskStep } from '../../types'

function registerLanguageSafely(name: string, languageModule: unknown) {
  const definition =
    typeof languageModule === 'function'
      ? languageModule
      : typeof (languageModule as { default?: unknown })?.default === 'function'
        ? (languageModule as { default: (hljs: unknown) => unknown }).default
        : null

  if (definition) {
    SyntaxHighlighter.registerLanguage(name, definition)
  }
}

registerLanguageSafely('typescript', ts)
registerLanguageSafely('json', json)
registerLanguageSafely('powershell', powershell)
registerLanguageSafely('shell', shell)
registerLanguageSafely('rust', rust)

function StepIcon({ status }: { status: TaskStep['status'] }) {
  if (status === 'complete') return <CheckCircle size={14} className="text-[#1d9e75] flex-shrink-0" />
  if (status === 'running') return <Loader size={14} className="text-[#7f77dd] flex-shrink-0 animate-spin" />
  if (status === 'error') return <XCircle size={14} className="text-[#e05050] flex-shrink-0" />
  return <Circle size={14} className="text-[var(--border-color)] flex-shrink-0" />
}

function Section({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="flex flex-col border-t border-[var(--border-color)]">
      <button
        onClick={() => setOpen(value => !value)}
        className="flex items-center gap-2 px-4 py-2.5 hover:bg-[var(--bg-tertiary)] transition-colors"
      >
        {open ? <ChevronDown size={12} className="text-[var(--text-secondary)]" /> : <ChevronRight size={12} className="text-[var(--text-secondary)]" />}
        {icon}
        <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{title}</span>
      </button>
      {open && children}
    </div>
  )
}

export function RightPanel() {
  const {
    activeDocumentLoading,
    clearTerminal,
    liveOutputContent,
    liveOutputLanguage,
    liveOutputTitle,
    openDocument,
    recentPaths,
    runManualCommand,
    taskSteps,
    terminalEntries,
  } = useAppStore(
    useShallow(state => ({
      activeDocumentLoading: state.activeDocumentLoading,
      clearTerminal: state.clearTerminal,
      liveOutputContent: state.liveOutputContent,
      liveOutputLanguage: state.liveOutputLanguage,
      liveOutputTitle: state.liveOutputTitle,
      openDocument: state.openDocument,
      recentPaths: state.recentPaths,
      runManualCommand: state.runManualCommand,
      taskSteps: state.taskSteps,
      terminalEntries: state.terminalEntries,
    }))
  )

  const [tab, setTab] = useState<'output' | 'terminal'>('output')
  const [command, setCommand] = useState('')
  const recentLogs = useMemo(() => terminalEntries.slice(-60), [terminalEntries])

  return (
    <aside
      className="flex flex-col h-full flex-shrink-0 overflow-hidden"
      style={{
        width: 360,
        background: 'var(--bg-secondary)',
        borderLeft: '1px solid var(--border-color)',
      }}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-color)]">
        <button
          onClick={() => setTab('output')}
          className={clsx(
            'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
            tab === 'output' ? 'bg-[#7f77dd]/14 text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
          )}
        >
          Live Output
        </button>
        <button
          onClick={() => setTab('terminal')}
          className={clsx(
            'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
            tab === 'terminal' ? 'bg-[#7f77dd]/14 text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
          )}
        >
          Terminal
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'output' ? (
          <div className="h-full flex flex-col">
            <div className="px-4 py-3 border-b border-[var(--border-color)]">
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">Current Buffer</div>
              <div className="text-sm text-[var(--text-primary)] truncate mt-1">{liveOutputTitle}</div>
            </div>
            <div className="flex-1 overflow-auto">
              {activeDocumentLoading ? (
                <div className="p-4 flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  <Loader size={14} className="animate-spin" />
                  Loading…
                </div>
              ) : (
                <SyntaxHighlighter
                  language={liveOutputLanguage}
                  style={atomOneDark}
                  customStyle={{
                    background: 'var(--bg-primary)',
                    margin: 0,
                    padding: '16px',
                    minHeight: '100%',
                    fontSize: 11,
                    lineHeight: 1.6,
                  }}
                  showLineNumbers
                  lineNumberStyle={{ color: 'var(--border-color)', fontSize: 10 }}
                >
                  {liveOutputContent || '// No output yet.'}
                </SyntaxHighlighter>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
              <div className="text-sm font-semibold text-[var(--text-primary)]">Terminal & Action Log</div>
              <button
                onClick={clearTerminal}
                className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                title="Clear log"
              >
                <Trash2 size={13} />
              </button>
            </div>

            <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
              {recentLogs.map(entry => (
                <div key={entry.id} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] overflow-hidden">
                  <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)] border-b border-[var(--border-color)]">
                    {entry.title}
                  </div>
                  <pre className="px-3 py-2 text-xs text-[var(--text-primary)] whitespace-pre-wrap break-words font-mono">
                    {entry.content}
                  </pre>
                </div>
              ))}
            </div>

            <form
              className="border-t border-[var(--border-color)] p-3 space-y-2"
              onSubmit={event => {
                event.preventDefault()
                if (!command.trim()) return
                void runManualCommand(command)
                setCommand('')
              }}
            >
              <label className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">Run Command</label>
              <div className="flex items-center gap-2">
                <input
                  value={command}
                  onChange={event => setCommand(event.target.value)}
                  placeholder="npm run build"
                  className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60 font-mono"
                />
                <button
                  type="submit"
                  className="p-2 rounded-lg bg-[#7f77dd] text-white hover:opacity-90 transition-opacity"
                  title="Run command"
                >
                  <Play size={14} />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      <Section title="Recent Files" icon={<FolderOpen size={13} className="text-[#d4a227]" />}>
        <div className="py-1.5 max-h-36 overflow-auto">
          {recentPaths.length === 0 ? (
            <div className="px-4 pb-3 text-xs text-[var(--text-secondary)]">No files opened or touched yet.</div>
          ) : (
            recentPaths.map(path => (
              <button
                key={path}
                onClick={() => void openDocument(path)}
                className="w-full px-4 py-1.5 text-left text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors truncate"
              >
                {path}
              </button>
            ))
          )}
        </div>
      </Section>

      <Section title="Task Progress" icon={<CheckCircle size={13} className="text-[#1d9e75]" />}>
        <div className="p-4 space-y-3 overflow-auto">
          {taskSteps.map((step, index) => (
            <div key={step.id} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <StepIcon status={step.status} />
                {index < taskSteps.length - 1 && (
                  <div
                    className="w-px flex-1 mt-1"
                    style={{
                      height: 16,
                      background: step.status === 'complete' ? '#1d9e75' : 'var(--border-color)',
                    }}
                  />
                )}
              </div>
              <span
                className={clsx(
                  'text-xs leading-tight pt-0.5',
                  step.status === 'complete' && 'text-[var(--text-muted)] line-through',
                  step.status === 'running' && 'text-[var(--text-primary)] font-medium',
                  step.status === 'pending' && 'text-[var(--text-secondary)]',
                  step.status === 'error' && 'text-[#e05050]'
                )}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </Section>
    </aside>
  )
}
