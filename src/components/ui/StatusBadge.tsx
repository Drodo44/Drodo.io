import { clsx } from 'clsx'

interface StatusBadgeProps {
  status: 'idle' | 'running' | 'complete' | 'error'
  label?: string
  size?: 'sm' | 'md'
}

const STATUS_CONFIG = {
  idle: { dot: 'bg-[var(--text-secondary)]', text: 'text-[var(--text-muted)]', bg: 'bg-[var(--border-color)]', label: 'Idle' },
  running: { dot: 'bg-[#7f77dd] animate-pulse-dot', text: 'text-[#a09ae8]', bg: 'bg-[#7f77dd]/10', label: 'Running' },
  complete: { dot: 'bg-[#1d9e75]', text: 'text-[#1d9e75]', bg: 'bg-[#1d9e75]/10', label: 'Complete' },
  error: { dot: 'bg-[#e05050]', text: 'text-[#e05050]', bg: 'bg-[#e05050]/10', label: 'Error' },
}

export function StatusBadge({ status, label, size = 'md' }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        cfg.bg, cfg.text,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      )}
    >
      <span className={clsx('rounded-full flex-shrink-0', cfg.dot, size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2')} />
      {label ?? cfg.label}
    </span>
  )
}
