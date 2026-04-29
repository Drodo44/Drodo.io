import { useEffect, useState } from 'react'
import { Workflow, RefreshCw, Circle } from 'lucide-react'
import { getN8nStatus, startDependencyBootstrap } from '../lib/tauri'
import { openN8nWindow } from '../lib/n8nWindow'

const N8N_URL = 'http://localhost:5678'

type Status = 'idle' | 'launching' | 'running' | 'error'

export function AutomationsView() {
  const [status, setStatus] = useState<Status>('idle')
  const [launchError, setLaunchError] = useState('')
  const [hasAutoStarted, setHasAutoStarted] = useState(false)

  const waitForN8nReady = async (timeoutMs = 60_000) => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const nextStatus = await getN8nStatus().catch(() => null)
      if (nextStatus?.running) {
        return nextStatus
      }
      if (nextStatus?.lastErrorMessage) {
        throw new Error(nextStatus.lastErrorMessage)
      }
      await new Promise(resolve => window.setTimeout(resolve, 2000))
    }
    throw new Error('n8n is still starting. Wait a moment and try again. If this persists, check the n8n runtime logs.')
  }

  const handleLaunch = async () => {
    setStatus('launching')
    setLaunchError('')

    try {
      await startDependencyBootstrap()
      const readyStatus = await waitForN8nReady()
      await openN8nWindow(readyStatus.url || N8N_URL)
      setStatus('running')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start n8n. Try again in a moment.'
      setLaunchError(message)
      setStatus('error')
    }
  }

  useEffect(() => {
    if (hasAutoStarted) return
    setHasAutoStarted(true)
    void handleLaunch()
  }, [hasAutoStarted])

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f59e0b22' }}>
            <Workflow size={18} style={{ color: '#f59e0b' }} />
          </div>
          <div>
            <h1 className="font-bold text-[var(--text-primary)] text-lg">Automations</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {status === 'running' ? (
                <>
                  <Circle size={8} style={{ color: '#1d9e75', fill: '#1d9e75' }} className="animate-pulse" />
                  <span className="text-xs text-[#1d9e75]">n8n running</span>
                </>
              ) : status === 'launching' ? (
                <>
                  <RefreshCw size={11} className="text-[#f59e0b] animate-spin" />
                  <span className="text-xs text-[#f59e0b]">Starting n8n…</span>
                </>
              ) : (
                <span className="text-xs text-[var(--text-secondary)]">Visual workflow automation</span>
              )}
            </div>
          </div>
        </div>

        {status === 'running' && null}
      </div>

      {/* Body */}
      {status === 'idle' && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-6" style={{ maxWidth: 480 }}>
            <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center" style={{ background: '#f59e0b22' }}>
              <Workflow size={30} style={{ color: '#f59e0b' }} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Automate anything with n8n</h2>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                Connect Drodo agents to hundreds of apps and services with visual, no-code workflows powered by n8n.
              </p>
            </div>
            <ul className="text-left space-y-2.5">
              {[
                'Trigger agents from webhooks, schedules, or app events',
                'Connect to Slack, GitHub, Google Sheets, Notion, and 400+ more',
                'Chain multiple AI agents in a single workflow',
                'Run automations locally — your data never leaves your machine',
              ].map(item => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-[var(--text-muted)]">
                  <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ background: '#f59e0b22', color: '#f59e0b' }}>✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <button
              onClick={() => void handleLaunch()}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white mx-auto transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: '#f59e0b' }}
            >
              <Workflow size={16} />
              Launch n8n
            </button>
            <p className="text-xs text-[var(--text-muted)]">
              Drodo will start n8n locally at localhost:5678.
            </p>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-4" style={{ maxWidth: 460 }}>
            <div className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center" style={{ background: '#e0505022' }}>
              <Workflow size={22} style={{ color: '#e05050' }} />
            </div>
            <p className="text-sm font-medium text-[var(--text-primary)]">n8n did not start</p>
            <p className="text-xs text-[var(--text-secondary)]">{launchError}</p>
            <button
              onClick={() => void handleLaunch()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white mx-auto transition-all hover:opacity-90"
              style={{ background: '#f59e0b' }}
            >
              <RefreshCw size={13} />
              Try Again
            </button>
          </div>
        </div>
      )}

      {status === 'launching' && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center" style={{ background: '#f59e0b22' }}>
              <RefreshCw size={22} style={{ color: '#f59e0b' }} className="animate-spin" />
            </div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Starting n8n…</p>
            <p className="text-xs text-[var(--text-secondary)]">This may take 10–30 seconds on first run.</p>
          </div>
        </div>
      )}

      {status === 'running' && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-4" style={{ maxWidth: 460 }}>
            <div className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center" style={{ background: '#1d9e7522' }}>
              <Workflow size={22} style={{ color: '#1d9e75' }} />
            </div>
            <p className="text-sm font-medium text-[var(--text-primary)]">n8n is running in a dedicated window</p>
            <button
              onClick={() => void handleLaunch()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white mx-auto transition-all hover:opacity-90"
              style={{ background: '#f59e0b' }}
            >
              <Workflow size={13} />
              Open n8n window
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
