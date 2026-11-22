import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { chatClient } from './client'
import { decryptFile, type MediaInfo } from './crypto'

// Decrypted audio is kept in memory only for this browser tab.
const decrypted = new Map<string, string>()

function fmt(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const s = Math.round(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function AudioBubble({ path, media, voice }: { path: string; media: MediaInfo; voice: boolean }) {
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>(decrypted.has(path) ? 'ready' : 'idle')
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(media.duration ?? 0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => () => audioRef.current?.pause(), [])

  async function ensureLoaded(): Promise<string | null> {
    const cached = decrypted.get(path)
    if (cached) return cached
    setState('loading')
    try {
      // Short-lived signed URL; the file itself is ciphertext.
      const { data, error } = await chatClient!.storage.from('chat-media').createSignedUrl(path, 60)
      if (error || !data) throw new Error('no url')
      const res = await fetch(data.signedUrl, { cache: 'no-store', referrerPolicy: 'no-referrer' })
      if (!res.ok) throw new Error('download failed')
      const blob = await decryptFile(await res.arrayBuffer(), media)
      const url = URL.createObjectURL(blob)
      decrypted.set(path, url)
      setState('ready')
      return url
    } catch {
      setState('error')
      return null
    }
  }

  async function toggle(e: MouseEvent) {
    e.stopPropagation()
    if (playing) {
      audioRef.current?.pause()
      return
    }
    const url = await ensureLoaded()
    if (!url) return
    if (!audioRef.current) {
      const audio = new Audio(url)
      audio.onloadedmetadata = () => { if (Number.isFinite(audio.duration)) setDuration(audio.duration) }
      audio.ontimeupdate = () => setProgress(audio.duration ? audio.currentTime / audio.duration : 0)
      audio.onplay = () => setPlaying(true)
      audio.onpause = () => setPlaying(false)
      audio.onended = () => { setPlaying(false); setProgress(0) }
      audioRef.current = audio
    }
    void audioRef.current.play()
  }

  const bars = media.wave && media.wave.length > 0 ? media.wave : new Array(40).fill(0.3)

  return (
    <div className="pc-audio">
      <button className="pc-play" type="button" onClick={(e) => void toggle(e)} aria-label={playing ? 'Pause' : 'Play'} disabled={state === 'loading'}>
        {state === 'loading' ? <span className="pc-spinner pc-spinner-tiny" /> : playing ? (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        )}
      </button>
      <div className="pc-audio-body">
        {!voice && media.name && <span className="pc-audio-name">🎵 {media.name}</span>}
        <div className="pc-wave" aria-hidden="true">
          {bars.map((h, i) => (
            <span key={i} style={{ height: `${Math.round(h * 100)}%` }} className={i / bars.length < progress ? 'on' : ''} />
          ))}
        </div>
        <span className="pc-audio-time">
          {state === 'error' ? 'Could not load audio' : fmt(playing || progress > 0 ? duration * progress : duration)}
        </span>
      </div>
    </div>
  )
}
