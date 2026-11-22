import { useEffect, useRef, useState } from 'react'

export type Recording = { blob: Blob; duration: number; wave: number[] }

const MAX_SECONDS = 300
const BARS = 40

function pickMime(): string {
  for (const type of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type
  }
  return ''
}

/** Squeezes the level samples into a fixed number of bars between 0 and 1. */
function toBars(levels: number[]): number[] {
  if (levels.length === 0) return new Array(BARS).fill(0.1)
  const out: number[] = []
  const step = levels.length / BARS
  for (let i = 0; i < BARS; i++) {
    const slice = levels.slice(Math.floor(i * step), Math.max(Math.floor((i + 1) * step), Math.floor(i * step) + 1))
    out.push(Math.max(...slice))
  }
  const peak = Math.max(...out, 0.01)
  return out.map((v) => Math.round(Math.max(0.08, v / peak) * 100) / 100)
}

export default function Recorder({ onDone, onCancel }: { onDone: (r: Recording) => void; onCancel: () => void }) {
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const levels = useRef<number[]>([])
  const started = useRef(0)
  const sendOnStop = useRef(false)
  const cleanup = useRef<() => void>(() => {})

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        const mime = pickMime()
        const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
        recorderRef.current = recorder

        const ctx = new AudioContext()
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 512
        ctx.createMediaStreamSource(stream).connect(analyser)
        const buf = new Uint8Array(new ArrayBuffer(analyser.fftSize))
        const sampler = window.setInterval(() => {
          analyser.getByteTimeDomainData(buf)
          let sum = 0
          for (const v of buf) sum += ((v - 128) / 128) ** 2
          levels.current.push(Math.sqrt(sum / buf.length))
          const elapsed = (Date.now() - started.current) / 1000
          setSeconds(Math.floor(elapsed))
          if (elapsed >= MAX_SECONDS) { sendOnStop.current = true; recorder.stop() }
        }, 100)

        cleanup.current = () => {
          window.clearInterval(sampler)
          stream.getTracks().forEach((t) => t.stop())
          void ctx.close()
        }

        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data) }
        recorder.onstop = () => {
          cleanup.current()
          if (!sendOnStop.current) return
          const blob = new Blob(chunks.current, { type: recorder.mimeType || mime || 'audio/webm' })
          const duration = Math.round((Date.now() - started.current) / 100) / 10
          onDone({ blob, duration, wave: toBars(levels.current) })
        }
        started.current = Date.now()
        recorder.start(250)
      } catch {
        setError('Microphone access was blocked. Allow it in your browser settings.')
      }
    })()
    return () => {
      cancelled = true
      sendOnStop.current = false
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      cleanup.current()
    }
    // onDone is captured once for this recording session on purpose.
  }, [])

  const stop = (send: boolean) => {
    sendOnStop.current = send
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    if (!send) onCancel()
  }

  const mm = String(Math.floor(seconds / 60))
  const ss = String(seconds % 60).padStart(2, '0')

  return (
    <div className="pc-recorder">
      <button className="pc-icon-btn" type="button" aria-label="Discard recording" onClick={() => stop(false)}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
      </button>
      {error ? (
        <span className="pc-error">{error}</span>
      ) : (
        <span className="pc-rec-time"><span className="pc-rec-dot" /> {mm}:{ss}</span>
      )}
      <button className="pc-send" type="button" aria-label="Send voice note" disabled={!!error || seconds < 1} onClick={() => stop(true)}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M3 20.5 21 12 3 3.5l.01 6.6L15 12 3.01 13.9z" /></svg>
      </button>
    </div>
  )
}
