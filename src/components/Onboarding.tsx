import { Logo } from './ui/Logo'
import { useAppStore } from '../store/appStore'

export function OnboardingScreen() {
  const setView = useAppStore(s => s.setView)

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center gap-8"
      style={{ background: '#0d0d0f' }}
    >
      <div className="flex flex-col items-center gap-5 text-center">
        <Logo size={64} />

        <div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 800,
              color: '#7f77dd',
              letterSpacing: '-0.04em',
              lineHeight: 1,
            }}
          >
            Drodo
          </div>
          <div
            style={{
              fontSize: 13,
              color: '#6b6b78',
              marginTop: 6,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            AI Agent Platform
          </div>
        </div>

        <p style={{ fontSize: 15, color: '#9898a8', maxWidth: 380, lineHeight: 1.6 }}>
          Connect any AI model from any provider using your own keys.
        </p>

        <button
          onClick={() => setView('connections')}
          className="px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ background: '#7f77dd', marginTop: 4 }}
        >
          Connect Your First Model
        </button>
      </div>
    </div>
  )
}
