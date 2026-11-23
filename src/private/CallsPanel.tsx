import type { CallInfo } from './crypto'

export type CallEntry = { id: string; at: string; outgoing: boolean; call: CallInfo }

export function callLabel(c: CallInfo, outgoing: boolean): { text: string; missed: boolean } {
  const kind = c.media === 'video' ? 'video call' : 'voice call'
  if (c.outcome === 'completed') return { text: `${outgoing ? 'Outgoing' : 'Incoming'} ${kind}`, missed: false }
  if (outgoing) {
    const why = c.outcome === 'declined' ? 'Declined' : c.outcome === 'busy' ? 'Busy'
      : c.outcome === 'failed' ? "Couldn't connect" : c.outcome === 'cancelled' ? 'Cancelled' : 'No answer'
    return { text: `${why} · ${kind}`, missed: false }
  }
  return { text: c.outcome === 'declined' ? `Declined ${kind}` : `Missed ${kind}`, missed: true }
}

export function formatDuration(sec?: number) {
  if (!sec) return ''
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

export function CallIcon({ media, outgoing, missed }: { media: 'audio' | 'video'; outgoing: boolean; missed: boolean }) {
  return (
    <span className={`pc-callicon ${missed ? 'missed' : ''}`} aria-hidden="true">
      {media === 'video'
        ? <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3z" /></svg>
        : <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" /></svg>}
      <b>{outgoing ? '↗' : '↙'}</b>
    </span>
  )
}

export default function CallsPanel({
  entries, loading, peerName, canCall, onCall, onClose,
}: {
  entries: CallEntry[]
  loading: boolean
  peerName: string
  canCall: boolean
  onCall: (media: 'audio' | 'video') => void
  onClose: () => void
}) {
  return (
    <div className="pc-modal" role="dialog" aria-modal="true" aria-label="Call history" onClick={onClose}>
      <div className="pc-card pc-settings" onClick={(e) => e.stopPropagation()}>
        <div className="pc-row">
          <h1>Calls</h1>
          <button className="pc-icon-btn" type="button" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <div className="pc-row pc-calls-actions">
          <button className="pc-btn pc-btn-primary" type="button" disabled={!canCall} onClick={() => onCall('audio')}>📞 Voice call</button>
          <button className="pc-btn pc-btn-primary" type="button" disabled={!canCall} onClick={() => onCall('video')}>🎥 Video call</button>
        </div>
        {loading && <div className="pc-spinner pc-spinner-inline" aria-label="Loading" />}
        {!loading && entries.length === 0 && <p className="pc-muted">No calls yet.</p>}
        <ul className="pc-calls">
          {entries.map((e) => {
            const { text, missed } = callLabel(e.call, e.outgoing)
            const d = new Date(e.at)
            return (
              <li key={e.id}>
                <CallIcon media={e.call.media} outgoing={e.outgoing} missed={missed} />
                <div className="pc-calls-body">
                  <b className={missed ? 'missed' : ''}>{text}</b>
                  <small>
                    {d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}, {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {e.call.duration ? ` · ${formatDuration(e.call.duration)}` : ''}
                  </small>
                </div>
                <button className="pc-icon-btn" type="button" disabled={!canCall} aria-label={`Call ${peerName} back`} onClick={() => onCall(e.call.media)}>
                  {e.call.media === 'video' ? '🎥' : '📞'}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
