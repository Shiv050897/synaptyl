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
      {isVideo && call.remoteStream && call.status === 'active'
        ? <StreamVideo stream={call.remoteStream} className="pc-call-remote" />
        : <StreamAudio stream={call.remoteStream} />}
      {isVideo && call.localStream && (
        <StreamVideo stream={call.localStream} muted className={`pc-call-self ${call.status === 'active' ? '' : 'full'}`} />
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
