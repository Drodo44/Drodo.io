import { Shield, ShieldCheck, ShieldAlert } from 'lucide-react'
import { clsx } from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../../store/appStore'
import type { PermissionTier } from '../../types'

const TIER_CONFIG: Record<PermissionTier, {
  label: string
  sublabel: string
  color: string
  bg: string
  border: string
  Icon: typeof Shield
}> = {
  sandboxed: {
    label: 'Sandboxed',
    sublabel: 'Read only',
    color: '#1d9e75',
    bg: 'bg-[#1d9e75]/10',
    border: 'border-[#1d9e75]/30',
    Icon: ShieldCheck,
  },
  standard: {
    label: 'Standard',
    sublabel: 'Files + Web',
    color: '#d4a227',
    bg: 'bg-[#d4a227]/10',
    border: 'border-[#d4a227]/30',
    Icon: Shield,
  },
  'wide-open': {
    label: 'Wide Open',
    sublabel: 'Full computer',
    color: '#e05050',
    bg: 'bg-[#e05050]/10',
    border: 'border-[#e05050]/30',
    Icon: ShieldAlert,
  },
}

const TIER_ORDER: PermissionTier[] = ['sandboxed', 'standard', 'wide-open']

export function PermissionBadge() {
  const { permissionTier, setPermission } = useAppStore(
    useShallow(s => ({ permissionTier: s.permissionTier, setPermission: s.setPermission }))
  )
  const cfg = TIER_CONFIG[permissionTier]
  const { Icon } = cfg

  const handleClick = () => {
    const currentIdx = TIER_ORDER.indexOf(permissionTier)
    const nextTier = TIER_ORDER[(currentIdx + 1) % TIER_ORDER.length]
    setPermission(nextTier)
  }

  return (
    <button
      onClick={handleClick}
      className={clsx(
        'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all duration-200 cursor-pointer hover:opacity-80',
        cfg.bg, cfg.border
      )}
      style={{ color: cfg.color }}
      title="Click to change permission tier"
    >
      <Icon size={13} />
      <span>{cfg.label}</span>
    </button>
  )
}
