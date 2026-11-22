import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { chatClient, type WhoAmI } from './client'
import {
  decryptPayload, encryptFile, encryptPayload, loadLocalKeys, safetyNumber, sharedKey,
  type MediaInfo, type Payload, type PublicJwk,
} from './crypto'
import AudioBubble from './AudioBubble'
import Recorder, { type Recording } from './Recorder'

export type LocalKeys = Awaited<ReturnType<typeof loadLocalKeys>>
export type KeyDirectory = Map<string, Map<number, PublicJwk>>

type Row = {
  id: string
  sender_id: string
  recipient_id: string
  kind: 'text' | 'voice' | 'audio'
  ciphertext: string | null
  iv: string | null
  sender_key_version: number | null
  recipient_key_version: number | null
  media_path: string | null
  reply_to_id: string | null
  created_at: string
  delivered_at: string | null
  read_at: string | null
  deleted_at: string | null
}
type Msg = {
  row: Row
  payload: Payload | null
  problem: 'none' | 'deleted' | 'nokey' | 'failed'
  local?: 'sending' | 'failed'
}

const PAGE = 50
const MAX_TEXT = 20_000
const MAX_FILE = 24 * 1024 * 1024

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const day = (iso: string) => new Date(iso).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

function preview(m: Msg | undefined) {
  if (!m) return 'Message'
  if (m.problem === 'deleted') return 'Deleted message'
  if (!m.payload) return 'Encrypted message'
  if (m.payload.text) return m.payload.text.slice(0, 120)
  return m.row.kind === 'voice' ? '🎤 Voice note' : `🎵 ${m.payload.media?.name ?? 'Audio'}`
}

export default function ChatRoom({
  me, localKeys, directory, reloadDirectory, onSignOut,
}: {
  me: WhoAmI
  localKeys: LocalKeys
  directory: KeyDirectory
  reloadDirectory: () => Promise<KeyDirectory>
  onSignOut: () => void
}) {
  const sb = chatClient!
  const peer = me.peer!
  const [messages, setMessages] = useState<Map<string, Msg>>(new Map())
  const [hasOlder, setHasOlder] = useState(false)
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<Msg | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [peerTyping, setPeerTyping] = useState(false)
  const [peerOnline, setPeerOnline] = useState(false)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState('')
  const [showInfo, setShowInfo] = useState(false)
  const [safety, setSafety] = useState('')

  const dirRef = useRef(directory)
  dirRef.current = directory
  const listRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<typeof sb.channel> | null>(null)
  const typingTimer = useRef<number | undefined>(undefined)
  const lastTypingSent = useRef(0)
  const stickToBottom = useRef(true)

  const myLatest = Math.max(0, ...localKeys.keys())
  const peerKeys = directory.get(peer.user_id)
  const peerLatest = peerKeys ? Math.max(...peerKeys.keys()) : 0

  // ---- decryption -------------------------------------------------------
  const decode = useCallback(async (row: Row): Promise<Msg> => {
    if (row.deleted_at || !row.ciphertext || !row.iv) return { row, payload: null, problem: 'deleted' }
    const mine = row.sender_id === me.user_id
    const myVer = (mine ? row.sender_key_version : row.recipient_key_version) ?? 0
    const peerVer = (mine ? row.recipient_key_version : row.sender_key_version) ?? 0
    const priv = localKeys.get(myVer)
    if (!priv) return { row, payload: null, problem: 'nokey' }
    let peerJwk = dirRef.current.get(peer.user_id)?.get(peerVer)
    if (!peerJwk) peerJwk = (await reloadDirectory()).get(peer.user_id)?.get(peerVer)
    if (!peerJwk) return { row, payload: null, problem: 'failed' }
    try {
      const key = await sharedKey(
        { userId: me.user_id, version: myVer, privateKey: priv.privateKey },
        { userId: peer.user_id, version: peerVer, publicJwk: peerJwk },
      )
      return { row, payload: await decryptPayload(key, row.id, row.ciphertext, row.iv), problem: 'none' }
    } catch {
      return { row, payload: null, problem: 'failed' }
    }
  }, [localKeys, me.user_id, peer.user_id, reloadDirectory])

  const upsertRows = useCallback(async (rows: Row[]) => {
    const decoded = await Promise.all(rows.map(decode))
    setMessages((prev) => {
      const next = new Map(prev)
      for (const m of decoded) next.set(m.row.id, m)
      return next
    })
  }, [decode])

  // ---- receipts ---------------------------------------------------------
  const markRead = useCallback(() => {
    if (document.visibilityState !== 'visible') {
      void sb.rpc('chat_mark_messages', { p_status: 'delivered' })
      return
    }
    void sb.rpc('chat_mark_messages', { p_status: 'read' })
  }, [sb])

  // ---- initial load + realtime -----------------------------------------
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data, error: loadError } = await sb
        .from('chat_messages').select('*').order('created_at', { ascending: false }).limit(PAGE)
      if (cancelled) return
      if (loadError) setError('Could not load messages.')
      const rows = ((data ?? []) as Row[]).reverse()
      await upsertRows(rows)
      setHasOlder(rows.length === PAGE)
      setLoading(false)
      markRead()
    })()

    const channel = sb.channel('chat-room', { config: { private: true, broadcast: { self: false }, presence: { key: me.user_id } } })
    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (p) => {
        const row = p.new as Row
        void upsertRows([row])
        if (row.sender_id === peer.user_id) {
          setPeerTyping(false)
          markRead()
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, (p) => {
        void upsertRows([p.new as Row])
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, (p) => {
        const id = (p.old as { id?: string }).id
        if (id) setMessages((prev) => { const next = new Map(prev); next.delete(id); return next })
      })
      .on('broadcast', { event: 'typing' }, (msg) => {
        if (msg.payload?.user !== peer.user_id) return
        setPeerTyping(true)
        window.clearTimeout(typingTimer.current)
        typingTimer.current = window.setTimeout(() => setPeerTyping(false), 4000)
      })
      .on('presence', { event: 'sync' }, () => {
        setPeerOnline(Object.keys(channel.presenceState()).includes(peer.user_id))
      })

    void (async () => {
      await sb.realtime.setAuth()
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await channel.track({ online_at: new Date().toISOString() })
      })
    })()
    channelRef.current = channel

    const onVisible = () => { if (document.visibilityState === 'visible') markRead() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      window.clearTimeout(typingTimer.current)
      void sb.removeChannel(channel)
      channelRef.current = null
    }
  }, [sb, me.user_id, peer.user_id, upsertRows, markRead])

  // ---- ordering + scrolling ---------------------------------------------
  const ordered = useMemo(
    () => [...messages.values()].sort((a, b) => a.row.created_at.localeCompare(b.row.created_at)),
    [messages],
  )

  useEffect(() => {
    const el = listRef.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [ordered.length, peerTyping])

  async function loadOlder() {
    const oldest = ordered[0]?.row.created_at
    if (!oldest) return
    const el = listRef.current
    const before = el?.scrollHeight ?? 0
    stickToBottom.current = false
    const { data } = await sb.from('chat_messages').select('*')
      .lt('created_at', oldest).order('created_at', { ascending: false }).limit(PAGE)
    const rows = ((data ?? []) as Row[]).reverse()
    await upsertRows(rows)
    setHasOlder(rows.length === PAGE)
    requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - before })
  }

  // ---- sending ----------------------------------------------------------
  const canSend = myLatest > 0 && peerLatest > 0

  async function sendPayload(kind: Row['kind'], payload: Payload, mediaPath: string | null, id: string) {
    const priv = localKeys.get(myLatest)!
    const peerJwk = directory.get(peer.user_id)!.get(peerLatest)!
    const key = await sharedKey(
      { userId: me.user_id, version: myLatest, privateKey: priv.privateKey },
      { userId: peer.user_id, version: peerLatest, publicJwk: peerJwk },
    )
    const { ciphertext, iv } = await encryptPayload(key, id, payload)
    const row: Row = {
      id, sender_id: me.user_id, recipient_id: peer.user_id, kind, ciphertext, iv,
      sender_key_version: myLatest, recipient_key_version: peerLatest, media_path: mediaPath,
      reply_to_id: replyTo?.row.id ?? null, created_at: new Date().toISOString(),
      delivered_at: null, read_at: null, deleted_at: null,
    }
    stickToBottom.current = true
    setMessages((prev) => new Map(prev).set(id, { row, payload, problem: 'none', local: 'sending' }))
    setReplyTo(null)
    const { error: insertError } = await sb.from('chat_messages').insert({
      id, recipient_id: peer.user_id, kind, ciphertext, iv,
      sender_key_version: myLatest, recipient_key_version: peerLatest,
      media_path: mediaPath, reply_to_id: row.reply_to_id,
    })
    setMessages((prev) => {
      const current = prev.get(id)
      if (!current) return prev
      return new Map(prev).set(id, { ...current, local: insertError ? 'failed' : undefined })
    })
    if (insertError) setError('A message could not be sent.')
  }

  async function sendText(e: FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body || !canSend) return
    if (body.length > MAX_TEXT) return setError('That message is too long.')
    setText('')
    await sendPayload('text', { v: 1, text: body }, null, crypto.randomUUID())
  }

  async function sendMedia(kind: 'voice' | 'audio', blob: Blob, extra: Partial<MediaInfo>) {
    if (!canSend) return
    if (blob.size > MAX_FILE) return setError('Audio files must be under 24 MB.')
    const id = crypto.randomUUID()
    try {
      const encrypted = await encryptFile(await blob.arrayBuffer())
      const path = `${me.user_id}/${id}.bin`
      const { error: upError } = await sb.storage.from('chat-media')
        .upload(path, encrypted.blob, { contentType: 'application/octet-stream', upsert: false })
      if (upError) throw new Error('Upload failed.')
      const media: MediaInfo = {
        key: encrypted.key, iv: encrypted.iv, mime: blob.type || 'audio/webm', size: blob.size, ...extra,
      }
      await sendPayload(kind, { v: 1, media }, path, id)
    } catch {
      setError('The audio could not be sent.')
    }
  }

  function onType(value: string) {
    setText(value)
    const now = Date.now()
    if (value && now - lastTypingSent.current > 2000 && channelRef.current) {
      lastTypingSent.current = now
      void channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { user: me.user_id } })
    }
  }

  async function deleteForEveryone(m: Msg) {
    setSelected(null)
    if (!window.confirm('Delete this message for everyone?')) return
    const { data: path, error: delError } = await sb.rpc('chat_delete_own_message', { p_message_id: m.row.id })
    if (delError) return setError('Could not delete the message.')
    if (typeof path === 'string' && path) await sb.storage.from('chat-media').remove([path])
  }

  async function openInfo() {
    setShowInfo(true)
    const myJwk = directory.get(me.user_id)?.get(myLatest)
    const peerJwk = peerKeys?.get(peerLatest)
    setSafety(myJwk && peerJwk
      ? await safetyNumber({ userId: me.user_id, jwk: myJwk }, { userId: peer.user_id, jwk: peerJwk })
      : '')
  }

  // ---- render -----------------------------------------------------------
  let lastDay = ''
  return (
    <div className="pc pc-chat">
      <header className="pc-chat-top">
        <div className="pc-avatar" aria-hidden="true">{peer.username.slice(0, 1).toUpperCase()}</div>
        <div className="pc-chat-title">
          <b>{peer.username}</b>
          <small>{peerTyping ? 'typing…' : peerOnline ? 'online' : ' '}</small>
        </div>
        <button className="pc-icon-btn" type="button" onClick={() => void openInfo()} aria-label="Chat info">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
        </button>
      </header>

      <div
        className="pc-messages"
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
        }}
      >
        <p className="pc-e2ee-note">🔒 Messages and voice notes are end-to-end encrypted.</p>
        {hasOlder && <button className="pc-btn pc-btn-link pc-older" type="button" onClick={() => void loadOlder()}>Load earlier messages</button>}
        {loading && <div className="pc-spinner pc-spinner-inline" aria-label="Loading" />}
        {ordered.map((m) => {
          const mine = m.row.sender_id === me.user_id
          const d = day(m.row.created_at)
          const showDay = d !== lastDay
          lastDay = d
          const quoted = m.row.reply_to_id ? messages.get(m.row.reply_to_id) : undefined
          return (
            <div key={m.row.id}>
              {showDay && <div className="pc-day">{d}</div>}
              <div className={`pc-bubble-row ${mine ? 'mine' : 'theirs'}`}>
                <div
                  className={`pc-bubble ${selected === m.row.id ? 'selected' : ''}`}
                  onClick={() => setSelected(selected === m.row.id ? null : m.row.id)}
                >
                  {m.row.reply_to_id && (
                    <div className="pc-quote">
                      <b>{quoted?.row.sender_id === me.user_id ? 'You' : peer.username}</b>
                      <span>{preview(quoted)}</span>
                    </div>
                  )}
                  {m.problem === 'deleted' && <i className="pc-faint">🚫 This message was deleted</i>}
                  {m.problem === 'nokey' && <i className="pc-faint">🔒 Can't be read on this device</i>}
                  {m.problem === 'failed' && <i className="pc-faint">⚠️ Couldn't decrypt this message</i>}
                  {m.payload?.text && <p className="pc-text">{m.payload.text}</p>}
                  {m.payload?.media && m.row.media_path && (
                    <AudioBubble path={m.row.media_path} media={m.payload.media} voice={m.row.kind === 'voice'} />
                  )}
                  <span className="pc-meta">
                    {time(m.row.created_at)}
                    {mine && <Ticks m={m} />}
                  </span>
                </div>
              </div>
              {selected === m.row.id && m.problem !== 'deleted' && (
                <div className={`pc-actions ${mine ? 'mine' : 'theirs'}`}>
                  <button type="button" onClick={() => { setReplyTo(m); setSelected(null) }}>Reply</button>
                  {mine && !m.local && <button type="button" className="danger" onClick={() => void deleteForEveryone(m)}>Delete for everyone</button>}
                </div>
              )}
            </div>
          )
        })}
        {peerTyping && <div className="pc-bubble-row theirs"><div className="pc-bubble pc-typing"><span /><span /><span /></div></div>}
      </div>

      {error && <div className="pc-banner" role="alert" onClick={() => setError('')}>{error} <small>(tap to dismiss)</small></div>}
      {!canSend && !loading && (
        <div className="pc-banner pc-banner-info">
          {peerLatest === 0 ? `${peer.username} needs to open the chat once before you can send messages.` : 'Encryption is not ready on this device.'}
        </div>
      )}

      {replyTo && (
        <div className="pc-replybar">
          <div className="pc-quote">
            <b>{replyTo.row.sender_id === me.user_id ? 'You' : peer.username}</b>
            <span>{preview(replyTo)}</span>
          </div>
          <button className="pc-icon-btn" type="button" aria-label="Cancel reply" onClick={() => setReplyTo(null)}>✕</button>
        </div>
      )}

      <footer className="pc-composer">
        {recording ? (
          <Recorder
            onCancel={() => setRecording(false)}
            onDone={(r: Recording) => {
              setRecording(false)
              void sendMedia('voice', r.blob, { duration: r.duration, wave: r.wave })
            }}
          />
        ) : (
          <form className="pc-composer-form" onSubmit={sendText}>
            <label className="pc-icon-btn" aria-label="Send an audio file">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.5 12.5 21a5.5 5.5 0 0 1-7.8-7.8l9-9a3.7 3.7 0 0 1 5.2 5.2l-9 9a1.8 1.8 0 0 1-2.6-2.6l8.3-8.3" /></svg>
              <input
                type="file"
                accept="audio/*"
                hidden
                disabled={!canSend}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) void sendMedia('audio', file, { name: file.name.slice(0, 120) })
                }}
              />
            </label>
            <textarea
              className="pc-input"
              rows={1}
              placeholder="Message"
              value={text}
              maxLength={MAX_TEXT}
              disabled={!canSend}
              onChange={(e) => onType(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer: fine)').matches) {
                  e.preventDefault()
                  e.currentTarget.form?.requestSubmit()
                }
              }}
            />
            {text.trim() ? (
              <button className="pc-send" type="submit" aria-label="Send" disabled={!canSend}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M3 20.5 21 12 3 3.5l.01 6.6L15 12 3.01 13.9z" /></svg>
              </button>
            ) : (
              <button className="pc-send" type="button" aria-label="Record a voice note" disabled={!canSend} onClick={() => setRecording(true)}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
              </button>
            )}
          </form>
        )}
      </footer>

      {showInfo && (
        <div className="pc-modal" role="dialog" aria-modal="true" onClick={() => setShowInfo(false)}>
          <div className="pc-card pc-login" onClick={(e) => e.stopPropagation()}>
            <h1>Encryption</h1>
            <p className="pc-muted">
              Compare this safety number with {peer.username}'s screen, in person or on a call. If both match,
              nobody has swapped your encryption keys.
            </p>
            <p className="pc-safety">{safety || 'Available once both of you have opened the chat.'}</p>
            <button className="pc-btn" type="button" onClick={() => setShowInfo(false)}>Close</button>
            <button className="pc-btn pc-btn-danger" type="button" onClick={onSignOut}>Sign out</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Ticks({ m }: { m: Msg }) {
  if (m.local === 'sending') return <span className="pc-tick" aria-label="Sending">🕓</span>
  if (m.local === 'failed') return <span className="pc-tick failed" aria-label="Not sent">!</span>
  if (m.row.read_at) return <span className="pc-tick read" aria-label="Read">✓✓</span>
  if (m.row.delivered_at) return <span className="pc-tick" aria-label="Delivered">✓✓</span>
  return <span className="pc-tick" aria-label="Sent">✓</span>
}
