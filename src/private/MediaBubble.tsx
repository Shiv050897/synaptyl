import { useEffect, useState, type MouseEvent } from 'react'
import type { MediaInfo } from './crypto'
import { formatSize, loadDecrypted } from './media'

type Kind = 'image' | 'video' | 'file'

/** Encrypted photo, video or document inside a chat bubble. */
export default function MediaBubble({ path, media, kind }: { path: string; media: MediaInfo; kind: Kind }) {
  const [url, setUrl] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [fullscreen, setFullscreen] = useState(false)

  async function load(): Promise<string | null> {
    setState('loading')
    try {
      const objectUrl = await loadDecrypted(path, media, kind)
      setUrl(objectUrl)
      setState('idle')
      return objectUrl
    } catch {
      setState('error')
      return null
    }
  }

  // Photos load straight away; videos and documents wait for a tap.
  useEffect(() => {
    if (kind === 'image') void load()
  }, [path])

  const stop = (e: MouseEvent) => e.stopPropagation()

  if (kind === 'image') {
    const ratio = media.width && media.height ? `${media.width} / ${media.height}` : '4 / 3'
    return (
      <>
        <div className="pc-photo" style={{ aspectRatio: ratio }} onClick={(e) => { stop(e); if (url) setFullscreen(true) }}>
          {url ? <img src={url} alt="Photo" /> : state === 'error'
            ? <span className="pc-faint">Could not load photo</span>
            : <span className="pc-spinner pc-spinner-tiny" />}
        </div>
        {fullscreen && url && (
          <div className="pc-modal pc-viewer" role="dialog" aria-modal="true" onClick={(e) => { stop(e); setFullscreen(false) }}>
            <img src={url} alt="Photo" />
          </div>
        )}
      </>
    )
  }

  if (kind === 'video') {
    return url ? (
      <video className="pc-video" src={url} controls playsInline autoPlay onClick={stop} />
    ) : (
      <button className="pc-file" type="button" onClick={(e) => { stop(e); void load() }} disabled={state === 'loading'}>
        <span className="pc-file-icon">{state === 'loading' ? <span className="pc-spinner pc-spinner-tiny" /> : '▶'}</span>
        <span className="pc-file-body">
          <b>{state === 'error' ? 'Could not load video' : 'Video'}</b>
          <small>{formatSize(media.size)} · tap to play</small>
        </span>
      </button>
    )
  }

  return (
    <button
      className="pc-file"
      type="button"
      disabled={state === 'loading'}
      onClick={async (e) => {
        stop(e)
        const objectUrl = url ?? (await load())
        if (!objectUrl) return
        const a = document.createElement('a')
        a.href = objectUrl
        a.download = media.name || 'document'
        a.rel = 'noopener'
        a.click()
      }}
    >
      <span className="pc-file-icon">{state === 'loading' ? <span className="pc-spinner pc-spinner-tiny" /> : '📄'}</span>
      <span className="pc-file-body">
        <b>{media.name || 'Document'}</b>
        <small>{state === 'error' ? 'Could not load file' : `${formatSize(media.size)} · tap to download`}</small>
      </span>
    </button>
  )
}
