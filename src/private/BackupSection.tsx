import { useEffect, useState, type FormEvent } from 'react'
import { chatClient } from './client'
import { makeBackup, restoreBackup, type Backup, type PublicJwk } from './crypto'

type Props = {
  meId: string
  myKeys: Map<number, PublicJwk> | undefined // all my published keys
  localVersions: number[] // keys present on this device
  onKeysChanged: () => Promise<void>
}

/** Restore older keys from backups, and back up this device's current key. */
export default function BackupSection({ meId, myKeys, localVersions, onKeysChanged }: Props) {
  const [backups, setBackups] = useState<Backup[] | null>(null)
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const load = async () => {
    const { data } = await chatClient!.from('chat_key_backups').select('key_version, wrapped_key, salt, iv, iterations')
    setBackups((data ?? []) as Backup[])
  }
  useEffect(() => { void load() }, [])

  if (!backups || !myKeys) return null
  const latest = Math.max(0, ...myKeys.keys())
  const restorable = backups.filter((b) => !localVersions.includes(b.key_version) && myKeys.has(b.key_version))
  const needsBackup = localVersions.includes(latest) && !backups.some((b) => b.key_version === latest)
  if (restorable.length === 0 && !needsBackup) {
    return <p className="pc-muted">✓ Your messages are backed up and unlocked on this device.</p>
  }

  async function restore(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      for (const b of restorable) await restoreBackup(meId, b, myKeys!.get(b.key_version)!, pass)
      await onKeysChanged()
      setMessage({ ok: true, text: 'Older messages unlocked.' })
      setPass('')
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Could not unlock.' })
    } finally {
      setBusy(false)
    }
  }

  async function backUp(e: FormEvent) {
    e.preventDefault()
    if (pass.length < 8) return setMessage({ ok: false, text: 'Use at least 8 characters.' })
    setBusy(true)
    setMessage(null)
    try {
      const backup = await makeBackup(meId, latest, pass)
      const { error } = await chatClient!.from('chat_key_backups').insert(backup)
      if (error) throw new Error('Could not save the backup.')
      await load()
      setMessage({ ok: true, text: 'This device is now backed up.' })
      setPass('')
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Could not save the backup.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pc-backup">
      {restorable.length > 0 ? (
        <form onSubmit={restore} className="pc-backup-form">
          <p className="pc-muted">Some earlier messages are locked on this device. Enter your backup passphrase to unlock them.</p>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Backup passphrase" autoComplete="current-password" aria-label="Backup passphrase" />
          <button className="pc-btn pc-btn-primary" type="submit" disabled={busy || !pass}>{busy ? 'Unlocking…' : 'Restore older messages'}</button>
        </form>
      ) : (
        <form onSubmit={backUp} className="pc-backup-form">
          <p className="pc-muted">This device's key isn't backed up yet. Set a passphrase (you can reuse your old one) so you never lose messages.</p>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Backup passphrase" autoComplete="new-password" aria-label="Backup passphrase" />
          <button className="pc-btn pc-btn-primary" type="submit" disabled={busy || !pass}>{busy ? 'Saving…' : 'Back up this device'}</button>
        </form>
      )}
      {message && <p className={message.ok ? 'pc-notice' : 'pc-error'} role="status">{message.text}</p>}
    </div>
  )
}
