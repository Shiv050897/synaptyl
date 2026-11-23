import { useEffect, useRef, useState } from 'react'
import type { useCall } from './useCall'

type Call = ReturnType<typeof useCall>

function Clock({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const s = Math.max(0, Math.floor((now - since) / 1000))
  return <>{Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}</>
}

function StreamVideo({ stream, muted, className }: { stream: MediaStream | null; muted?: boolean; className: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])
  return <video ref={ref} className={className} autoPlay playsInline muted={muted} />
}

/** Big call video: pinch to zoom, drag to pan while zoomed, double-tap to zoom in/out. */
function ZoomableVideo({ stream, muted, mirrored }: { stream: MediaStream | null; muted?: boolean; mirrored?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ dist: number; scale: number; x: number; y: number; cx: number; cy: number } | null>(null)
  const lastTap = useRef(0)

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])

  const clamp = (v: { scale: number; x: number; y: number }) => {
    const scale = Math.min(4, Math.max(1, v.scale))
    const el = ref.current
    const maxX = el ? (el.clientWidth * (scale - 1)) / 2 : 0
    const maxY = el ? (el.clientHeight * (scale - 1)) / 2 : 0
    return { scale, x: Math.min(maxX, Math.max(-maxX, v.x)), y: Math.min(maxY, Math.max(-maxY, v.y)) }
  }

  const startGesture = () => {
    const pts = [...pointers.current.values()]
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length
    const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0
    gesture.current = { dist, scale: view.scale, x: view.x, y: view.y, cx, cy }
  }

  return (
    <video
      ref={ref}
      className="pc-call-remote"
      autoPlay
      playsInline
      muted={muted}
      style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})${mirrored ? ' scaleX(-1)' : ''}`, touchAction: 'none' }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        startGesture()
        if (pointers.current.size === 1) {
          const now = Date.now()
          if (now - lastTap.current < 300) setView((v) => (v.scale > 1 ? { scale: 1, x: 0, y: 0 } : clamp({ scale: 2.5, x: 0, y: 0 })))
          lastTap.current = now
        }
      }}
      onPointerMove={(e) => {
        if (!pointers.current.has(e.pointerId) || !gesture.current) return
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        const pts = [...pointers.current.values()]
        const g = gesture.current
        const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length
        const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length
        const scale = pts.length > 1 && g.dist > 0
          ? g.scale * (Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) / g.dist)
          : g.scale
        setView(clamp({ scale, x: g.x + (cx - g.cx), y: g.y + (cy - g.cy) }))
      }}
      onPointerUp={(e) => { pointers.current.delete(e.pointerId); if (pointers.current.size) startGesture(); else gesture.current = null }}
      onPointerCancel={(e) => { pointers.current.delete(e.pointerId); gesture.current = null }}
    />
  )
}

function StreamAudio({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])
  return <audio ref={ref} autoPlay />
}

const Icon = {
  phone: <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" /></svg>,
  mic: <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>,
  micOff: <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l18 18M9 9v2a3 3 0 0 0 5 2.2M15 9.3V6a3 3 0 0 0-5.7-1.3M19 11a7 7 0 0 1-1.2 3.9M5 11a7 7 0 0 0 11 5.7M12 18v3" /></svg>,
  cam: <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3z" /></svg>,
  camOff: <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l18 18M16 16v0a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1M10 6h4a2 2 0 0 1 2 2v2l5-3v10" /></svg>,
}

export default function CallScreen({ call, peerName }: { call: Call; peerName: string }) {
  const [swapped, setSwapped] = useState(false)
  useEffect(() => { if (call.status === 'idle') setSwapped(false) }, [call.status])

  if (call.status === 'idle') {
    return call.notice ? <div className="pc-call-toast" role="status">{call.notice}</div> : null
  }

  const isVideo = call.media === 'video'
  const label =
    call.status === 'incoming' ? `Incoming ${isVideo ? 'video' : 'voice'} call`
      : call.status === 'outgoing' ? 'Ringing…'
        : call.status === 'connecting' ? 'Connecting…'
          : null

  return (
    <div className={`pc-call ${isVideo ? 'video' : 'voice'}`} role="dialog" aria-modal="true" aria-label="Call">
      {isVideo && call.remoteStream && call.status === 'active' ? (
        <>
          <ZoomableVideo
            key={swapped ? 'self-big' : 'peer-big'}
            stream={swapped ? call.localStream : call.remoteStream}
            muted={swapped}
            mirrored={swapped}
          />
          <button type="button" className="pc-call-self-btn" aria-label="Swap videos" onClick={() => setSwapped((s) => !s)}>
            <StreamVideo stream={swapped ? call.remoteStream : call.localStream} muted className={`pc-call-self ${swapped ? 'peer' : ''}`} />
          </button>
          {swapped && <StreamAudio stream={call.remoteStream} />}
        </>
      ) : (
        <>
          <StreamAudio stream={call.remoteStream} />
          {isVideo && call.localStream && <StreamVideo stream={call.localStream} muted className="pc-call-self full" />}
        </>
      )}

      <div className="pc-call-info">
        {!(isVideo && call.status === 'active') && <div className="pc-call-avatar">{peerName.slice(0, 1).toUpperCase()}</div>}
        <b>{peerName}</b>
        <span>{label ?? (call.startedAt ? <Clock since={call.startedAt} /> : '')}</span>
        <small>🔒 End-to-end encrypted</small>
      </div>

      <div className="pc-call-controls">
        {call.status === 'incoming' ? (
          <>
            <button type="button" className="pc-call-btn end" onClick={call.decline} aria-label="Decline">{Icon.phone}</button>
            <button type="button" className="pc-call-btn accept" onClick={() => void call.accept()} aria-label="Accept">{Icon.phone}</button>
          </>
        ) : (
          <>
            <button type="button" className={`pc-call-btn ${call.muted ? 'on' : ''}`} onClick={call.toggleMute} aria-label={call.muted ? 'Unmute' : 'Mute'}>
              {call.muted ? Icon.micOff : Icon.mic}
            </button>
            {isVideo && (
              <button type="button" className={`pc-call-btn ${call.cameraOff ? 'on' : ''}`} onClick={call.toggleCamera} aria-label={call.cameraOff ? 'Turn camera on' : 'Turn camera off'}>
                {call.cameraOff ? Icon.camOff : Icon.cam}
              </button>
            )}
            <button type="button" className="pc-call-btn end" onClick={call.hangUp} aria-label="End call">{Icon.phone}</button>
          </>
        )}
      </div>
    </div>
  )
}
