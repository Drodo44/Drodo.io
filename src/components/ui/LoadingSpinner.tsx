import { Loader2 } from 'lucide-react'

interface LoadingSpinnerProps {
  label?: string
  className?: string
}

export function LoadingSpinner({ label, className = '' }: LoadingSpinnerProps) {
  return (
    <div className={`flex flex-1 flex-col items-center justify-center gap-3 py-12 ${className}`.trim()}>
      <div
        className="flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{ background: '#7f77dd18' }}
      >
        <Loader2 size={22} className="animate-spin" style={{ color: '#7f77dd' }} />
      </div>
      {label && <p className="text-sm text-[var(--text-secondary)]">{label}</p>}
    </div>
  )
}
