import * as Dialog from '@radix-ui/react-dialog'
import { ShieldAlert, X, AlertTriangle } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../../store/appStore'

export function PermissionWarningModal() {
  const { permissionWarningOpen, setPermissionWarningOpen, confirmPermission, setPendingTier } = useAppStore(
    useShallow(s => ({
      permissionWarningOpen: s.permissionWarningOpen,
      setPermissionWarningOpen: s.setPermissionWarningOpen,
      confirmPermission: s.confirmPermission,
      setPendingTier: s.setPendingTier,
    }))
  )

  const handleCancel = () => {
    setPermissionWarningOpen(false)
    setPendingTier(null)
  }

  return (
    <Dialog.Root open={permissionWarningOpen} onOpenChange={v => { if (!v) handleCancel() }}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
        />
        <Dialog.Content
          className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
          style={{
            width: 420,
            background: 'var(--bg-secondary)',
            border: '1px solid #e05050',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-5"
            style={{ borderBottom: '1px solid var(--border-color)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: '#e0505020' }}
              >
                <ShieldAlert size={18} style={{ color: '#e05050' }} />
              </div>
              <Dialog.Title className="font-bold text-[var(--text-primary)]">Wide Open Mode</Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-color)] transition-colors" onClick={handleCancel}>
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            <div
              className="flex gap-3 p-4 rounded-xl"
              style={{ background: '#e0505012', border: '1px solid #e0505030' }}
            >
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#e05050' }} />
              <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                <span className="font-semibold" style={{ color: '#e05050' }}>Wide Open</span> grants Drodo full computer access — it can read, write, execute files, run system commands, and access the network without restriction.
              </p>
            </div>

            <ul className="space-y-2">
              {[
                'The agent can modify or delete any file on your system',
                'Network access is unrestricted — data may leave your machine',
                'System commands can be executed without confirmation',
                'Only enable this for trusted, audited workflows',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-[var(--text-muted)]">
                  <span className="w-1 h-1 rounded-full flex-shrink-0 mt-1.5" style={{ background: '#e05050' }} />
                  {item}
                </li>
              ))}
            </ul>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--border-color)] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmPermission}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ background: '#e05050' }}
              >
                Enable Wide Open
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
