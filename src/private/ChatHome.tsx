import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { chatClient, type WhoAmI } from './client'
import {
  generateKeyPair, loadLocalKeys, makeBackup, restoreBackup,
  type Backup, type PublicJwk,
} from './crypto'
import ChatRoom, { type KeyDirectory, type LocalKeys } from './ChatRoom'

type KeyRow = { user_id: string; key_version: number; public_key: PublicJwk }
type Stage =
  | { name: 'loading' }
  | { name: 'error'; message: string }
  | { name: 'restore'; backups: Backup[] }
  | { name: 'new-device' }
  | { name: 'offer-backup'; version: number }
  | { name: 'ready' }

const skipKey = (userId: string) => `syn-pc-backup-skipped:${userId}`

export default function ChatHome({ me, onSignOut }: { me: WhoAmI; onSignOut: () => void }) {
  const [stage, setStage] = useState<Stage>({ name: 'loading' })
  const [localKeys, setLocalKeys] = useState<LocalKeys>(new Map())
  const [directory, setDirectory] = useState<KeyDirectory>(new Map())

  /** Fetches every published public key for both users. */
  const loadDirectory = useCallback(async (): Promise<KeyDirectory> => {
    const { data, error } = await chatClient!.from('chat_keys').select('user_id, key_version, public_key')
    if (error) throw new Error('Could not load encryption keys.')
    const dir: KeyDirectory = new Map()
    for (const row of (data ?? []) as KeyRow[]) {
      if (!dir.has(row.user_id)) dir.set(row.user_id, new Map())
      dir.get(row.user_id)!.set(row.key_version, row.public_key)
    }
    setDirectory(dir)
    return dir
  }, [])

  const publishNewKey = useCallback(async (version: number) => {
    const publicJwk = await generateKeyPair(me.user_id, version)
    const { error } = await chatClient!.from('chat_keys').insert({ key_version: version, public_key: publicJwk })
    if (error) throw new Error('Could not publish your encryption key.')
  }, [me.user_id])

  const setup = useCallback(async () => {
    setStage({ name: 'loading' })
    try {
      let dir = await loadDirectory()
      const mine = dir.get(me.user_id)
      const latest = mine ? Math.max(...mine.keys()) : 0
      let local = await loadLocalKeys(me.user_id)

      if (latest === 0) {
        await publishNewKey(1)
        dir = await loadDirectory()
        local = await loadLocalKeys(me.user_id)
        setLocalKeys(local)
        setStage(localStorage.getItem(skipKey(me.user_id)) ? { name: 'ready' } : { name: 'offer-backup', version: 1 })
        return
      }
      if (local.has(latest)) {
        setLocalKeys(local)
        setStage({ name: 'ready' })
        return
      }
      const { data: backups, error } = await chatClient!.from('chat_key_backups').select('key_version, wrapped_key, salt, iv, iterations')
      if (error) throw new Error('Could not check for a key backup.')
      const list = (backups ?? []) as Backup[]
      setStage(list.length > 0 ? { name: 'restore', backups: list } : { name: 'new-device' })
    } catch (err) {
      setStage({ name: 'error', message: err instanceof Error ? err.message : 'Setup failed.' })
    }
  }, [loadDirectory, me.user_id, publishNewKey])

  useEffect(() => {
    document.title = 'Chat'
    void setup()
  }, [setup])

  async function startFresh() {
    setStage({ name: 'loading' })
    try {
      const mine = directory.get(me.user_id)
      const next = (mine ? Math.max(...mine.keys()) : 0) + 1
      await publishNewKey(next)
      await loadDirectory()
      setLocalKeys(await loadLocalKeys(me.user_id))
      setStage({ name: 'offer-backup', version: next })
    } catch (err) {
      setStage({ name: 'error', message: err instanceof Error ? err.message : 'Setup failed.' })
    }
  }

  if (stage.name === 'loading') {
    return <div className="pc pc-center"><div className="pc-spinner" aria-label="Loading" /></div>
  }
  if (stage.name === 'error') {
    return (
      <Panel title="Something went wrong" onSignOut={onSignOut}>
        <p className="pc-error">{stage.message}</p>
        <button className="pc-btn pc-btn-primary" type="button" onClick={() => void setup()}>Try again</button>
      </Panel>
    )
  }
  if (stage.name === 'restore') {
    return (
      <RestorePanel
        me={me}
        backups={stage.backups}
        directory={directory}
        onDone={() => void setup()}
        onStartFresh={() => void startFresh()}
        onSignOut={onSignOut}
      />
    )
  }
  if (stage.name === 'new-device') {
    return (
      <Panel title="New device" onSignOut={onSignOut}>
        <p className="pc-muted">
          This browser doesn't have your encryption key, and no backup was saved. You can start fresh here:
          new messages will work, but earlier messages can only be read on the device that has your old key.
        </p>
        <button className="pc-btn pc-btn-primary" type="button" onClick={() => void startFresh()}>Start fresh on this device</button>
      </Panel>
    )
  }
  if (stage.name === 'offer-backup') {
    return (
      <BackupPanel
        me={me}
        version={stage.version}
        onDone={() => setStage({ name: 'ready' })}
        onSkip={() => {
          localStorage.setItem(skipKey(me.user_id), '1')
          setStage({ name: 'ready' })
        }}
      />
    )
  }
  return (
    <ChatRoom
      me={me}
      localKeys={localKeys}
      directory={directory}
      reloadDirectory={loadDirectory}
      onSignOut={onSignOut}
      onKeysChanged={async () => setLocalKeys(await loadLocalKeys(me.user_id))}
    />
  )
}

function Panel({ title, children, onSignOut }: { title: string; children: ReactNode; onSignOut?: () => void }) {
  return (
    <main className="pc pc-center">
      <div className="pc-card pc-login">
        <h1>{title}</h1>
        {children}
        {onSignOut && <button className="pc-btn pc-btn-link" type="button" onClick={onSignOut}>Sign out</button>}
      </div>
    </main>
  )
}

function BackupPanel({ me, version, onDone, onSkip }: { me: WhoAmI; version: number; onDone: () => void; onSkip: () => void }) {
  const [pass, setPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(e: FormEvent) {
    e.preventDefault()
    if (pass.length < 8) return setError('Use at least 8 characters.')
    if (pass !== confirm) return setError('The two passphrases do not match.')
    setBusy(true)
    setError('')
    try {
      const backup = await makeBackup(me.user_id, version, pass)
      const { error: dbError } = await chatClient!.from('chat_key_backups').insert(backup)
      if (dbError) throw new Error('Could not save the backup.')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the backup.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="pc pc-center">
      <form className="pc-card pc-login" onSubmit={save}>
        <h1>Protect your messages</h1>
        <p className="pc-muted">
          Set a backup passphrase so you can read your messages on a new phone or after clearing this browser.
          It never leaves this device unencrypted. If you forget it, it can't be recovered.
        </p>
        <label>Backup passphrase
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" />
        </label>
        <label>Repeat passphrase
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </label>
        {error && <p className="pc-error" role="alert">{error}</p>}
        <button className="pc-btn pc-btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save backup'}</button>
        <button className="pc-btn pc-btn-link" type="button" onClick={onSkip} disabled={busy}>Skip for now</button>
      </form>
    </main>
  )
}

function RestorePanel({
  me, backups, directory, onDone, onStartFresh, onSignOut,
}: {
  me: WhoAmI
  backups: Backup[]
  directory: KeyDirectory
  onDone: () => void
  onStartFresh: () => void
  onSignOut: () => void
}) {
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function restore(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const mine = directory.get(me.user_id)
      for (const backup of backups) {
        const jwk = mine?.get(backup.key_version)
        if (jwk) await restoreBackup(me.user_id, backup, jwk, pass)
      }
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="pc pc-center">
      <form className="pc-card pc-login" onSubmit={restore}>
        <h1>Restore your messages</h1>
        <p className="pc-muted">Enter your backup passphrase to unlock your messages on this device.</p>
        <label>Backup passphrase
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <p className="pc-error" role="alert">{error}</p>}
        <button className="pc-btn pc-btn-primary" type="submit" disabled={busy}>{busy ? 'Unlocking…' : 'Unlock'}</button>
        <button
          className="pc-btn pc-btn-link"
          type="button"
          disabled={busy}
          onClick={() => window.confirm('Start fresh? Earlier messages will stay unreadable on this device.') && onStartFresh()}
        >
          I forgot it — start fresh
        </button>
        <button className="pc-btn pc-btn-link" type="button" onClick={onSignOut}>Sign out</button>
      </form>
    </main>
  )
}
