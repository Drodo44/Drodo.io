import { useState } from 'react'
import { Logo } from '../components/ui/Logo'
import { signIn, signUp } from '../lib/auth'

type AuthMode = 'signin' | 'signup'

export function AuthView() {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [confirmPasswordError, setConfirmPasswordError] = useState('')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const setAuthMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setError('')
    setSuccessMessage('')
    setEmailError('')
    setPasswordError('')
    setConfirmPasswordError('')
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return

    setError('')
    setSuccessMessage('')
    setEmailError('')
    setPasswordError('')
    setConfirmPasswordError('')

    const nextEmail = email.trim()
    let hasError = false

    if (!nextEmail || !nextEmail.includes('@')) {
      setEmailError('Enter a valid email address.')
      hasError = true
    }

    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters.')
      hasError = true
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match.')
      hasError = true
    }

    if (hasError) {
      return
    }

    setSubmitting(true)

    try {
      if (mode === 'signin') {
        const { error: signInError } = await signIn(nextEmail, password)
        if (signInError) throw signInError
      } else {
        const { error: signUpError } = await signUp(nextEmail, password)
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
    <div className="flex h-screen w-screen items-center justify-center px-6 py-10" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={42} />
          <h1 className="mt-4 text-3xl font-bold tracking-[-0.03em]" style={{ color: 'var(--text-primary)' }}>
            Drodo
          </h1>
          <p className="mt-2 text-xs uppercase tracking-[0.16em]" style={{ color: 'var(--text-secondary)' }}>
            AI Agent Platform
          </p>
        </div>

        <div
          className="rounded-2xl border p-6 shadow-[0_18px_60px_rgba(0,0,0,0.45)]"
          style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        >
          <div className="mb-6 flex rounded-xl border p-1" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
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
                    : { color: 'var(--text-muted)' }
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={event => {
                  setEmail(event.target.value)
                  if (event.target.value.trim().includes('@')) setEmailError('')
                }}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors"
                style={{ background: 'var(--bg-primary)', borderColor: emailError ? '#e05050' : 'var(--border-color)', color: 'var(--text-primary)' }}
              />
              {emailError && <p className="mt-2 text-xs" style={{ color: '#e05050' }}>{emailError}</p>}
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={event => {
                  setPassword(event.target.value)
                  if (event.target.value.length >= 8) setPasswordError('')
                  if (mode === 'signup' && confirmPassword && event.target.value === confirmPassword) {
                    setConfirmPasswordError('')
                  }
                }}
                placeholder="Enter your password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors"
                style={{ background: 'var(--bg-primary)', borderColor: passwordError ? '#e05050' : 'var(--border-color)', color: 'var(--text-primary)' }}
              />
              {passwordError && <p className="mt-2 text-xs" style={{ color: '#e05050' }}>{passwordError}</p>}
            </div>

            {mode === 'signup' && (
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={event => {
                    setConfirmPassword(event.target.value)
                    if (password === event.target.value) setConfirmPasswordError('')
                  }}
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors"
                  style={{ background: 'var(--bg-primary)', borderColor: confirmPasswordError ? '#e05050' : 'var(--border-color)', color: 'var(--text-primary)' }}
                />
                {confirmPasswordError && <p className="mt-2 text-xs" style={{ color: '#e05050' }}>{confirmPasswordError}</p>}
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
            style={{ color: 'var(--text-muted)' }}
          >
            Continue without account →
          </button>
        </div>
      </div>
    </div>
  )
}
