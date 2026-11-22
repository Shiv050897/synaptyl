import { chatClient } from './client'
import { decryptFile, type MediaInfo } from './crypto'

export type MediaKind = 'audio' | 'image' | 'video' | 'file'

export const MAX_FILE = 24 * 1024 * 1024

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
const DOC_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'rtf', 'odt', 'ods', 'odp']

/** What the file picker accepts. */
export const ACCEPT = ['audio/*', ...IMAGE_TYPES, ...VIDEO_TYPES, ...DOC_EXTENSIONS.map((e) => `.${e}`)].join(',')

/** Decides how a picked file is sent, or returns null if it isn't allowed. */
export function classify(file: File): MediaKind | null {
  if (file.type.startsWith('audio/')) return 'audio'
  if (IMAGE_TYPES.includes(file.type)) return 'image'
  if (VIDEO_TYPES.includes(file.type)) return 'video'
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return DOC_EXTENSIONS.includes(ext) ? 'file' : null
}

/**
 * Re-draws a photo to drop hidden metadata (such as GPS location) and to cap
 * its size. GIFs are sent as-is so animations keep working.
 */
export async function preparePhoto(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file)
  if (file.type === 'image/gif') {
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return { blob: file, ...size }
  }
  const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  if (!blob) throw new Error('Could not process the photo.')
  return { blob, width, height }
}

/** Only render media types we expect; anything else is treated as a plain download. */
export function safeMime(kind: string, mime: string): string {
  if (kind === 'image') return IMAGE_TYPES.includes(mime) ? mime : 'application/octet-stream'
  if (kind === 'video') return VIDEO_TYPES.includes(mime) ? mime : 'application/octet-stream'
  if (kind === 'audio' || kind === 'voice') return mime.startsWith('audio/') ? mime : 'application/octet-stream'
  return 'application/octet-stream'
}

// Decrypted media is kept in memory for this tab only.
const cache = new Map<string, Promise<string>>()

/** Downloads the encrypted file through a short-lived signed URL, decrypts it, returns an object URL. */
export function loadDecrypted(path: string, media: MediaInfo, kind: string): Promise<string> {
  let pending = cache.get(path)
  if (!pending) {
    pending = (async () => {
      const { data, error } = await chatClient!.storage.from('chat-media').createSignedUrl(path, 60)
      if (error || !data) throw new Error('no url')
      const res = await fetch(data.signedUrl, { cache: 'no-store', referrerPolicy: 'no-referrer' })
      if (!res.ok) throw new Error('download failed')
      const blob = await decryptFile(await res.arrayBuffer(), { ...media, mime: safeMime(kind, media.mime) })
      return URL.createObjectURL(blob)
    })()
    pending.catch(() => cache.delete(path))
    cache.set(path, pending)
  }
  return pending
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
