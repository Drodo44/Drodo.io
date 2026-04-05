import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Component, type ComponentType, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
  retryKey: number
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
    retryKey: 0,
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('View render failed.', error, errorInfo)
  }

  private handleReset = () => {
    this.setState(current => ({
      error: null,
      retryKey: current.retryKey + 1,
    }))
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-8 text-center shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: '#e0505014' }}
            >
              <AlertTriangle size={24} className="text-[#e05050]" />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-[var(--text-primary)]">Something went wrong</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              This view hit a render error. Reload it to try again.
            </p>
            <pre className="mt-5 overflow-x-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-4 py-3 text-left text-xs text-[var(--text-primary)]">
              <code>{this.state.error.message || 'Unknown render error.'}</code>
            </pre>
            <button
              onClick={this.handleReset}
              className="mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent)' }}
            >
              <RotateCcw size={14} />
              Reload View
            </button>
          </div>
        </div>
      )
    }

    return <div key={this.state.retryKey} className="flex min-h-0 flex-1">{this.props.children}</div>
  }
}

export function withErrorBoundary<P extends object>(WrappedComponent: ComponentType<P>) {
  function WrappedWithBoundary(props: P) {
    return (
      <ErrorBoundary>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    )
  }

  WrappedWithBoundary.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`

  return WrappedWithBoundary
}
