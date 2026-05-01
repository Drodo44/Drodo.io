import { useEffect, useMemo, useState } from 'react'
import { Workflow, RefreshCw, Circle } from 'lucide-react'
import { getN8nInstallLog, getN8nStatus, startDependencyBootstrap, type N8nStatus } from '../lib/tauri'
import { openN8nWindow } from '../lib/n8nWindow'

const N8N_URL = 'http://localhost:5678'

export function AutomationsView() {
  const [n8nStatus, setN8nStatus] = useState<N8nStatus | null>(null)
  const [installLog, setInstallLog] = useState<string[]>([])
  const [launchError, setLaunchError] = useState('')
  const [hasOpenedN8n, setHasOpenedN8n] = useState(false)

  const running = Boolean(n8nStatus?.running)
  const bootstrapInProgress = Boolean(n8nStatus?.bootstrapInProgress)
  const installComplete = Boolean(n8nStatus?.installComplete)
  const visibleLogLines = useMemo(() => installLog.slice(-10), [installLog])

  const refreshStatus = async () => {
    const status = await getN8nStatus()
    setN8nStatus(status)
    if (status.lastErrorMessage) {
      setLaunchError(status.lastErrorMessage)
    }
  }

  const handleInstall = async () => {
    setLaunchError('')
    setHasOpenedN8n(false)
    setN8nStatus(current => ({
      running: false,
      url: current?.url || N8N_URL,
      port: current?.port || 5678,
      bootstrapInProgress: true,
      installComplete: false,
      lastErrorCategory: null,
      lastErrorMessage: null,
      logPath: current?.logPath ?? null,
      runtimeLogPath: current?.runtimeLogPath ?? null,
      runtimeErrorLogPath: current?.runtimeErrorLogPath ?? null,
    }))
    await startDependencyBootstrap()
    await refreshStatus()
  }

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const status = await getN8nStatus()
        if (!cancelled) {
          setN8nStatus(status)
          if (status.lastErrorMessage) {
            setLaunchError(status.lastErrorMessage)
          }
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Unable to read n8n status.'
          setLaunchError(message)
        }
      }
    }

    void poll()
    const timer = window.setInterval(() => void poll(), 2000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!bootstrapInProgress) return
    let cancelled = false

    const pollLog = async () => {
      try {
        const lines = await getN8nInstallLog()
        if (!cancelled) {
          setInstallLog(lines)
        }
      } catch {
        if (!cancelled) {
          setInstallLog([])
        }
      }
    }

    void pollLog()
    const timer = window.setInterval(() => void pollLog(), 2000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [bootstrapInProgress])

  useEffect(() => {
    if (!running || hasOpenedN8n) return
    setHasOpenedN8n(true)
    void openN8nWindow(n8nStatus?.url || N8N_URL)
  }, [hasOpenedN8n, n8nStatus?.url, running])

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
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
              {running ? (
                <>
                  <Circle size={8} style={{ color: '#1d9e75', fill: '#1d9e75' }} className="animate-pulse" />
                  <span className="text-xs text-[#1d9e75]">n8n running</span>
                </>
              ) : !installComplete && bootstrapInProgress ? (
                <>
                  <RefreshCw size={11} className="text-[#f59e0b] animate-spin" />
                  <span className="text-xs text-[#f59e0b]">Installing automation engine...</span>
                </>
              ) : installComplete ? (
                <>
                  <RefreshCw size={11} className="text-[#f59e0b] animate-spin" />
                  <span className="text-xs text-[#f59e0b]">Starting n8n...</span>
                </>
              ) : (
                <span className="text-xs text-[var(--text-secondary)]">Visual workflow automation</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {!installComplete && !bootstrapInProgress && !running && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-6" style={{ maxWidth: 480 }}>
            <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center" style={{ background: '#f59e0b22' }}>
              <Workflow size={30} style={{ color: '#f59e0b' }} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Set Up Automations</h2>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                Drodo&apos;s automation engine needs to be installed once. This takes 2-5 minutes and only happens on first launch.
              </p>
            </div>
            {launchError && (
              <p className="rounded-lg border border-[#e05050]/25 bg-[#e05050]/10 px-3 py-2 text-xs text-[#e05050]">
                {launchError}
              </p>
            )}
            <button
              onClick={event => {
                event.preventDefault()
                void handleInstall()
              }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white mx-auto transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: '#f59e0b' }}
            >
              <Workflow size={16} />
              Install Now
            </button>
          </div>
        </div>
      )}

      {!installComplete && bootstrapInProgress && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full text-center space-y-5" style={{ maxWidth: 640 }}>
            <div className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center" style={{ background: '#f59e0b22' }}>
              <RefreshCw size={22} style={{ color: '#f59e0b' }} className="animate-spin" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Installing Automation Engine...</h2>
              <p className="text-sm text-[var(--text-secondary)]">This only happens once. Do not close the app.</p>
            </div>
            <div
              className="max-h-56 overflow-y-auto rounded-xl border p-4 text-left font-mono text-xs leading-relaxed"
              style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
            >
              {visibleLogLines.length > 0 ? (
                visibleLogLines.map((line, index) => (
                  <div key={`${index}-${line}`} className="whitespace-pre-wrap break-words">
                    {line}
                  </div>
                ))
              ) : (
                <div>Preparing installer...</div>
              )}
            </div>
          </div>
        </div>
      )}

      {installComplete && !running && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center" style={{ background: '#f59e0b22' }}>
              <RefreshCw size={22} style={{ color: '#f59e0b' }} className="animate-spin" />
            </div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Starting n8n...</p>
            <p className="text-xs text-[var(--text-secondary)]">This may take a few seconds</p>
          </div>
        </div>
      )}

      {running && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-4" style={{ maxWidth: 460 }}>
            <div className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center" style={{ background: '#1d9e7522' }}>
              <Workflow size={22} style={{ color: '#1d9e75' }} />
            </div>
            <p className="text-sm font-medium text-[var(--text-primary)]">n8n is running in a dedicated window</p>
            <button
              onClick={() => void openN8nWindow(n8nStatus?.url || N8N_URL)}
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
