import { useState } from 'react'
import { Logo } from '../components/ui/Logo'
import { signIn, signUp } from '../lib/auth'

type AuthMode = 'signin' | 'signup'

export function AuthView() {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const setAuthMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setError('')
    setSuccessMessage('')
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return

    setError('')
    setSuccessMessage('')

    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.')
      return
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)

    try {
      if (mode === 'signin') {
        const { error: signInError } = await signIn(email.trim(), password)
        if (signInError) throw signInError
      } else {
        const { error: signUpError } = await signUp(email.trim(), password)
        if (signUpError) throw signUpError
        setSuccessMessage('Check your email to confirm your account')
      }
    } catch (authError: unknown) {
      setError(authError instanceof Error ? authError.message : 'Authentication failed.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleContinueWithoutAccount = () => {
    localStorage.setItem('drodo_skip_auth', 'true')
    window.location.reload()
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center px-6 py-10" style={{ background: '#0d0d0f' }}>
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={42} />
          <h1 className="mt-4 text-3xl font-bold tracking-[-0.03em]" style={{ color: '#e8e8ef' }}>
            Drodo
          </h1>
          <p className="mt-2 text-xs uppercase tracking-[0.16em]" style={{ color: '#6b6b78' }}>
            AI Agent Platform
          </p>
        </div>

        <div
          className="rounded-2xl border p-6 shadow-[0_18px_60px_rgba(0,0,0,0.45)]"
          style={{ background: '#141418', borderColor: '#2a2a2e' }}
        >
          <div className="mb-6 flex rounded-xl border p-1" style={{ background: '#0d0d0f', borderColor: '#2a2a2e' }}>
            {([
              { key: 'signin' as const, label: 'Sign In' },
              { key: 'signup' as const, label: 'Sign Up' },
            ]).map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setAuthMode(tab.key)}
                className="flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
                style={
                  mode === tab.key
                    ? { background: '#7f77dd', color: '#ffffff' }
                    : { color: '#9898a8' }
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: '#9898a8' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors"
                style={{ background: '#0d0d0f', borderColor: '#2a2a2e', color: '#e8e8ef' }}
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: '#9898a8' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors"
                style={{ background: '#0d0d0f', borderColor: '#2a2a2e', color: '#e8e8ef' }}
              />
            </div>

            {mode === 'signup' && (
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: '#9898a8' }}>
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={event => setConfirmPassword(event.target.value)}
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors"
                  style={{ background: '#0d0d0f', borderColor: '#2a2a2e', color: '#e8e8ef' }}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: '#7f77dd' }}
            >
              {submitting ? (mode === 'signin' ? 'Signing In…' : 'Signing Up…') : mode === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>

            {error && (
              <p className="text-sm" style={{ color: '#e05050' }}>
                {error}
              </p>
            )}

            {successMessage && (
              <p className="text-sm" style={{ color: '#1d9e75' }}>
                {successMessage}
              </p>
            )}
          </form>

          <button
            type="button"
            onClick={handleContinueWithoutAccount}
            className="mt-5 inline-flex items-center gap-1 text-sm transition-colors"
            style={{ color: '#9898a8' }}
          >
            Continue without account →
          </button>
        </div>
      </div>
    </div>
  )
}
