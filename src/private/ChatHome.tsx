import type { WhoAmI } from './client'

// Placeholder until Phase 3 (encrypted messaging) replaces it.
export default function ChatHome({ me, onSignOut }: { me: WhoAmI; onSignOut: () => void }) {
  return (
    <main className="pc pc-center">
      <div className="pc-card pc-login">
        <h1>Hi, {me.username}</h1>
        <p className="pc-muted">
          You're signed in. The encrypted chat with {me.peer?.username ?? 'your contact'} is coming next.
        </p>
        <button className="pc-btn" type="button" onClick={onSignOut}>Sign out</button>
      </div>
    </main>
  )
}
