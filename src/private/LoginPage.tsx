import { useState, type FormEvent } from 'react'
import { callFunction, chatClient, type ChatRole } from './client'

type LoginResponse = {
  role: ChatRole
  session: { access_token: string; refresh_token: string; expires_at: number }
}

export default function LoginPage({ notice, onSignedIn }: { notice: string; onSignedIn: () => Promise<void> }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!chatClient || busy) return
    setBusy(true)
    setError('')
    try {
      const result = await callFunction<LoginResponse>('chat-login', { username: username.trim(), password })
      const { error: sessionError } = await chatClient.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      })
      if (sessionError) throw new Error('Could not start your session. Please try again.')
      setPassword('')
      await onSignedIn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="pc pc-center">
      <form className="pc-card pc-login" onSubmit={submit} autoComplete="on">
        <div className="pc-lock" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
        </div>
        <h1>Sign in</h1>
        {notice && <p className="pc-notice">{notice}</p>}
        <label>
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={32}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            maxLength={128}
            required
          />
        </label>
        {error && <p className="pc-error" role="alert">{error}</p>}
        <button className="pc-btn pc-btn-primary" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
