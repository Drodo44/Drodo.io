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
  return <Circle size={14} className="text-[#2a2a2e] flex-shrink-0" />
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
    <div className="flex flex-col border-t border-[#2a2a2e]">
      <button
        onClick={() => setOpen(value => !value)}
        className="flex items-center gap-2 px-4 py-2.5 hover:bg-[#1c1c22] transition-colors"
      >
        {open ? <ChevronDown size={12} className="text-[#6b6b78]" /> : <ChevronRight size={12} className="text-[#6b6b78]" />}
        {icon}
        <span className="text-xs font-semibold text-[#9898a8] uppercase tracking-wider">{title}</span>
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
        background: '#141418',
        borderLeft: '1px solid #2a2a2e',
      }}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2a2a2e]">
        <button
          onClick={() => setTab('output')}
          className={clsx(
            'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
            tab === 'output' ? 'bg-[#7f77dd]/14 text-[#e8e8ef]' : 'text-[#9898a8] hover:text-[#e8e8ef] hover:bg-[#1c1c22]'
          )}
        >
          Live Output
        </button>
        <button
          onClick={() => setTab('terminal')}
          className={clsx(
            'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
            tab === 'terminal' ? 'bg-[#7f77dd]/14 text-[#e8e8ef]' : 'text-[#9898a8] hover:text-[#e8e8ef] hover:bg-[#1c1c22]'
          )}
        >
          Terminal
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'output' ? (
          <div className="h-full flex flex-col">
            <div className="px-4 py-3 border-b border-[#2a2a2e]">
              <div className="text-xs uppercase tracking-[0.18em] text-[#6b6b78]">Current Buffer</div>
              <div className="text-sm text-[#e8e8ef] truncate mt-1">{liveOutputTitle}</div>
            </div>
            <div className="flex-1 overflow-auto">
              {activeDocumentLoading ? (
                <div className="p-4 flex items-center gap-2 text-sm text-[#9898a8]">
                  <Loader size={14} className="animate-spin" />
                  Loading…
                </div>
              ) : (
                <SyntaxHighlighter
                  language={liveOutputLanguage}
                  style={atomOneDark}
                  customStyle={{
                    background: '#0d0d0f',
                    margin: 0,
                    padding: '16px',
                    minHeight: '100%',
                    fontSize: 11,
                    lineHeight: 1.6,
                  }}
                  showLineNumbers
                  lineNumberStyle={{ color: '#3a3a42', fontSize: 10 }}
                >
                  {liveOutputContent || '// No output yet.'}
                </SyntaxHighlighter>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2e]">
              <div className="text-sm font-semibold text-[#e8e8ef]">Terminal & Action Log</div>
              <button
                onClick={clearTerminal}
                className="p-1.5 rounded-lg text-[#6b6b78] hover:text-[#e8e8ef] hover:bg-[#1c1c22] transition-colors"
                title="Clear log"
              >
                <Trash2 size={13} />
              </button>
            </div>

            <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
              {recentLogs.map(entry => (
                <div key={entry.id} className="rounded-lg border border-[#2a2a2e] bg-[#0d0d0f] overflow-hidden">
                  <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b6b78] border-b border-[#2a2a2e]">
                    {entry.title}
                  </div>
                  <pre className="px-3 py-2 text-xs text-[#d6d6de] whitespace-pre-wrap break-words font-mono">
                    {entry.content}
                  </pre>
                </div>
              ))}
            </div>

            <form
              className="border-t border-[#2a2a2e] p-3 space-y-2"
              onSubmit={event => {
                event.preventDefault()
                if (!command.trim()) return
                void runManualCommand(command)
                setCommand('')
              }}
            >
              <label className="text-xs uppercase tracking-[0.18em] text-[#6b6b78]">Run Command</label>
              <div className="flex items-center gap-2">
                <input
                  value={command}
                  onChange={event => setCommand(event.target.value)}
                  placeholder="npm run build"
                  className="flex-1 bg-[#0d0d0f] border border-[#2a2a2e] rounded-lg px-3 py-2 text-sm text-[#e8e8ef] outline-none focus:border-[#7f77dd]/60 font-mono"
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
            <div className="px-4 pb-3 text-xs text-[#6b6b78]">No files opened or touched yet.</div>
          ) : (
            recentPaths.map(path => (
              <button
                key={path}
                onClick={() => void openDocument(path)}
                className="w-full px-4 py-1.5 text-left text-xs text-[#9898a8] hover:text-[#e8e8ef] hover:bg-[#1c1c22] transition-colors truncate"
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
                      background: step.status === 'complete' ? '#1d9e75' : '#2a2a2e',
                    }}
                  />
                )}
              </div>
              <span
                className={clsx(
                  'text-xs leading-tight pt-0.5',
                  step.status === 'complete' && 'text-[#9898a8] line-through',
                  step.status === 'running' && 'text-[#e8e8ef] font-medium',
                  step.status === 'pending' && 'text-[#6b6b78]',
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
