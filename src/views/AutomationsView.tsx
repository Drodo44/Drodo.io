import { useState, useRef } from 'react'
import { Workflow, ExternalLink, RefreshCw, Circle } from 'lucide-react'
import { Command } from '@tauri-apps/plugin-shell'

const N8N_URL = 'http://localhost:5678'

type Status = 'idle' | 'launching' | 'running' | 'error'

export function AutomationsView() {
  const [status, setStatus] = useState<Status>('idle')
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [iframeError, setIframeError] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const pollUntilReady = () => {
    stopPoll()
    pollRef.current = setInterval(() => {
      fetch(N8N_URL, { mode: 'no-cors' })
        .then(() => {
          stopPoll()
          setStatus('running')
          setIframeError(false)
          setIframeLoaded(false)
          // Reload the iframe
          if (iframeRef.current) {
            iframeRef.current.src = N8N_URL
          }
        })
        .catch(() => { /* keep polling */ })
    }, 2000)
  }

  const handleLaunch = async () => {
    setStatus('launching')
    try {
      await Command.create('npx', ['n8n']).spawn()
      pollUntilReady()
    } catch {
      // npx may not be available or n8n not installed — just start polling anyway
      pollUntilReady()
    }
  }

  const handleRetry = () => {
    setIframeError(false)
    setIframeLoaded(false)
    if (iframeRef.current) {
      iframeRef.current.src = N8N_URL
    }
  }

  const handleIframeLoad = () => {
    setIframeLoaded(true)
    setIframeError(false)
  }

  const handleIframeError = () => {
    setIframeError(true)
    setIframeLoaded(false)
    // n8n went down — go back to idle
    setStatus('idle')
    stopPoll()
  }

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

        {status === 'running' && (
          <a
            href={N8N_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <ExternalLink size={12} />
            Open in browser
          </a>
        )}
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
              Requires Node.js. n8n will start locally at localhost:5678.
            </p>
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
        <div className="flex-1 relative min-h-0">
          {!iframeLoaded && !iframeError && (
            <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: 'var(--bg-primary)' }}>
              <div className="text-center space-y-3">
                <RefreshCw size={20} className="text-[var(--text-secondary)] animate-spin mx-auto" />
                <p className="text-xs text-[var(--text-secondary)]">Loading n8n…</p>
              </div>
            </div>
          )}
          {iframeError && (
            <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: 'var(--bg-primary)' }}>
              <div className="text-center space-y-3">
                <p className="text-sm text-[var(--text-muted)]">n8n is not responding</p>
                <button
                  onClick={handleRetry}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white mx-auto transition-all hover:opacity-90"
                  style={{ background: '#f59e0b' }}
                >
                  <RefreshCw size={13} />
                  Retry
                </button>
              </div>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={N8N_URL}
            title="n8n"
            className="w-full h-full border-none"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            style={{ display: iframeLoaded ? 'block' : 'block', background: '#fff' }}
          />
        </div>
      )}
    </div>
  )
}
