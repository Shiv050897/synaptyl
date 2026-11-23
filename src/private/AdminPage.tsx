import { useCallback, useEffect, useState } from 'react'
import { callFunction, chatClient, type WhoAmI } from './client'

type Member = {
  user_id: string
  role: 'x1' | 'x2' | 'admin'
  username: string
  revoked_before: string | null
  last_sign_in_at: string | null
  active_sessions: number
}
type Overview = { locked: boolean; members: Member[]; message_count: number; media_count: number }
type MessageRow = {
  id: string
  kind: 'text' | 'voice' | 'audio' | 'image' | 'video' | 'file' | 'call'
  created_at: string
  read_at: string | null
  deleted_at: string | null
  has_media: boolean
  sender: string | null
  recipient: string | null
}

const PAGE = 50
const KIND_LABEL: Record<MessageRow['kind'], string> = {
  text: 'Text', voice: 'Voice note', audio: 'Audio file', image: 'Photo', video: 'Video', file: 'Document', call: 'Call',
}

function when(value: string | null) {
  return value ? new Date(value).toLocaleString() : '—'
}

export default function AdminPage({ me, onSignOut }: { me: WhoAmI; onSignOut: () => void }) {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmAll, setConfirmAll] = useState('')

  const flash = (kind: 'ok' | 'error', text: string) => {
    setToast({ kind, text })
    window.setTimeout(() => setToast(null), 4000)
  }

  const loadOverview = useCallback(async () => {
    if (!chatClient) return
    const { data, error } = await chatClient.rpc('chat_admin_overview')
    if (error) flash('error', 'Could not load the overview.')
    else setOverview(data as Overview)
  }, [])

  const loadMessages = useCallback(async (before?: string) => {
    if (!chatClient) return
    const { data, error } = await chatClient.rpc('chat_admin_list_messages', {
      p_before: before ?? null,
      p_limit: PAGE,
    })
    if (error) {
      flash('error', 'Could not load messages.')
      return
    }
    const rows = (data ?? []) as MessageRow[]
    setMessages((prev) => (before ? [...prev, ...rows] : rows))
    setHasMore(rows.length === PAGE)
  }, [])

  const refresh = useCallback(async () => {
    setSelected(new Set())
    await Promise.all([loadOverview(), loadMessages()])
  }, [loadOverview, loadMessages])

  useEffect(() => {
    document.title = 'Admin'
    void refresh()
  }, [refresh])

  async function run(action: () => Promise<void>, success: string) {
    if (busy) return
    setBusy(true)
    try {
      await action()
      flash('ok', success)
      await refresh()
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'That did not work.')
    } finally {
      setBusy(false)
    }
  }

  async function rpc(name: string, args: Record<string, unknown>) {
    if (!chatClient) throw new Error('Not configured.')
    const { error } = await chatClient.rpc(name, args)
    if (error) throw new Error(error.message)
  }

  const chatUsers = overview?.members.filter((m) => m.role !== 'admin') ?? []

  return (
    <div className="pc pc-admin">
      <header className="pc-admin-top">
        <div>
          <h1>Control panel</h1>
          <p className="pc-muted">Signed in as {me.username}</p>
        </div>
        <button className="pc-btn" type="button" onClick={onSignOut}>Sign out</button>
      </header>

      {toast && <div className={`pc-toast pc-toast-${toast.kind}`} role="status">{toast.text}</div>}

      <section className="pc-card">
        <div className="pc-row">
          <div>
            <h2>Chat access</h2>
            <p className="pc-muted">
              {overview?.locked
                ? 'Locked: X1 and X2 are signed out and cannot use the chat.'
                : 'Open: X1 and X2 can use the chat.'}
            </p>
          </div>
          <button
            className={`pc-btn ${overview?.locked ? 'pc-btn-primary' : 'pc-btn-danger'}`}
            type="button"
            disabled={!overview || busy}
            onClick={() =>
              run(() => rpc('chat_admin_set_lock', { p_locked: !overview?.locked }),
                overview?.locked ? 'Chat unlocked.' : 'Chat locked.')
            }
          >
            {overview?.locked ? 'Unlock chat' : 'Lock chat'}
          </button>
        </div>
        <p className="pc-stats">
          {overview ? `${overview.message_count} messages · ${overview.media_count} files` : 'Loading…'}
        </p>
      </section>

      <section className="pc-users">
        {chatUsers.map((m) => (
          <UserCard key={m.user_id} member={m} busy={busy} run={run} rpc={rpc} />
        ))}
      </section>

      <section className="pc-card">
        <div className="pc-row">
          <div>
            <h2>Messages</h2>
            <p className="pc-muted">Messages are end-to-end encrypted, so only times and senders are shown here.</p>
          </div>
          <button
            className="pc-btn pc-btn-danger"
            type="button"
            disabled={busy || selected.size === 0}
            onClick={() =>
              window.confirm(`Permanently delete ${selected.size} message(s)? This cannot be undone.`) &&
              run(async () => {
                await callFunction('chat-admin', { action: 'delete_messages', message_ids: [...selected] })
              }, 'Messages deleted.')
            }
          >
            Delete selected ({selected.size})
          </button>
        </div>

        <div className="pc-table-wrap">
          <table className="pc-table">
            <thead>
              <tr>
                <th aria-label="Select" />
                <th>Sent</th>
                <th>From</th>
                <th>To</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {messages.length === 0 && (
                <tr><td colSpan={6} className="pc-muted pc-empty">No messages.</td></tr>
              )}
              {messages.map((m) => (
                <tr key={m.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label="Select message"
                      checked={selected.has(m.id)}
                      onChange={(e) => {
                        const next = new Set(selected)
                        if (e.target.checked) next.add(m.id)
                        else next.delete(m.id)
                        setSelected(next)
                      }}
                    />
                  </td>
                  <td>{when(m.created_at)}</td>
                  <td>{m.sender ?? '—'}</td>
                  <td>{m.recipient ?? '—'}</td>
                  <td>{KIND_LABEL[m.kind]}</td>
                  <td>{m.deleted_at ? 'Deleted by sender' : m.read_at ? 'Read' : 'Sent'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {hasMore && (
          <button
            className="pc-btn pc-btn-link"
            type="button"
            onClick={() => void loadMessages(messages[messages.length - 1]?.created_at)}
          >
            Load older messages
          </button>
        )}
      </section>

      <section className="pc-card pc-danger-zone">
        <h2>Delete entire history</h2>
        <p className="pc-muted">
          Permanently deletes every message and audio file for both users. Type DELETE to confirm.
        </p>
        <div className="pc-inline">
          <input value={confirmAll} onChange={(e) => setConfirmAll(e.target.value)} placeholder="DELETE" aria-label="Type DELETE to confirm" />
          <button
            className="pc-btn pc-btn-danger"
            type="button"
            disabled={busy || confirmAll !== 'DELETE'}
            onClick={() =>
              run(async () => {
                await callFunction('chat-admin', { action: 'delete_messages', confirm_all: true })
                setConfirmAll('')
              }, 'All history deleted.')
            }
          >
            Delete everything
          </button>
        </div>
      </section>
    </div>
  )
}

function UserCard({
  member, busy, run, rpc,
}: {
  member: Member
  busy: boolean
  run: (action: () => Promise<void>, success: string) => Promise<void>
  rpc: (name: string, args: Record<string, unknown>) => Promise<void>
}) {
  const [username, setUsername] = useState(member.username)
  const [password, setPassword] = useState('')
  useEffect(() => setUsername(member.username), [member.username])

  const validName = /^[A-Za-z0-9_.-]{2,32}$/.test(username.trim())

  return (
    <div className="pc-card">
      <div className="pc-row">
        <h2>{member.role.toUpperCase()}</h2>
        <span className={`pc-pill ${member.active_sessions > 0 ? 'pc-pill-on' : ''}`}>
          {member.active_sessions > 0 ? `${member.active_sessions} active session(s)` : 'Signed out'}
        </span>
      </div>
      <p className="pc-muted">Last sign-in: {when(member.last_sign_in_at)}</p>

      <label className="pc-field">
        Username
        <div className="pc-inline">
          <input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={32} />
          <button
            className="pc-btn"
            type="button"
            disabled={busy || !validName || username.trim() === member.username}
            onClick={() =>
              run(() => rpc('chat_admin_set_username', { p_user_id: member.user_id, p_username: username.trim() }),
                'Username updated.')
            }
          >
            Save
          </button>
        </div>
        {!validName && <small className="pc-error">2–32 letters, numbers, dot, dash or underscore.</small>}
      </label>

      <label className="pc-field">
        New password
        <div className="pc-inline">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="At least 12 characters"
            maxLength={128}
          />
          <button
            className="pc-btn"
            type="button"
            disabled={busy || password.length < 12}
            onClick={() =>
              run(async () => {
                await callFunction('chat-admin', { action: 'set_password', user_id: member.user_id, password })
                setPassword('')
              }, 'Password changed and user signed out.')
            }
          >
            Change
          </button>
        </div>
      </label>

      <button
        className="pc-btn pc-btn-danger"
        type="button"
        disabled={busy}
        onClick={() =>
          window.confirm(`Sign ${member.username} out on every device now?`) &&
          run(() => rpc('chat_admin_force_logout', { p_user_id: member.user_id }), 'User signed out everywhere.')
        }
      >
        Force logout
      </button>
    </div>
  )
}
