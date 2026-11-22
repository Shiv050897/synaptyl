import { chatClient } from './client'
import { decryptPayload, encryptFile, encryptPayload, type MediaInfo } from './crypto'
import { loadDecrypted } from './media'

export type ProfileRow = {
  user_id: string
  avatar_path: string | null
  ciphertext: string | null
  iv: string | null
  sender_key_version: number | null
  recipient_key_version: number | null
  updated_at: string
}

type SharedFor = (myVersion: number, peerVersion: number) => Promise<CryptoKey | null>

const aad = (userId: string) => `avatar:${userId}`

/** Crops the picture to a centred square and re-draws it at 512px (drops hidden metadata). */
async function squarePhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 512
  canvas.getContext('2d')!.drawImage(
    bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 512, 512)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  if (!blob) throw new Error('Could not process the photo.')
  return blob
}

/** Encrypts and uploads a new profile photo for the current user, replacing any old one. */
export async function setAvatar(opts: {
  meId: string; file: File; myVersion: number; peerVersion: number; sharedFor: SharedFor; oldPath: string | null
}) {
  const sb = chatClient!
  const key = await opts.sharedFor(opts.myVersion, opts.peerVersion)
  if (!key) throw new Error('Encryption is not ready yet.')
  const photo = await squarePhoto(opts.file)
  const encrypted = await encryptFile(await photo.arrayBuffer())
  const path = `${opts.meId}/avatar-${crypto.randomUUID()}.bin`
  const { error: upError } = await sb.storage.from('chat-media')
    .upload(path, encrypted.blob, { contentType: 'application/octet-stream', upsert: false })
  if (upError) throw new Error('Upload failed.')
  const media: MediaInfo = { key: encrypted.key, iv: encrypted.iv, mime: 'image/jpeg', size: photo.size }
  const { ciphertext, iv } = await encryptPayload(key, aad(opts.meId), { v: 1, media })
  const { error } = await sb.from('chat_profiles').upsert({
    user_id: opts.meId, avatar_path: path, ciphertext, iv,
    sender_key_version: opts.myVersion, recipient_key_version: opts.peerVersion,
  })
  if (error) throw new Error('Could not save the photo.')
  if (opts.oldPath) await sb.storage.from('chat-media').remove([opts.oldPath])
}

export async function removeAvatar(meId: string, oldPath: string | null) {
  const sb = chatClient!
  const { error } = await sb.from('chat_profiles').upsert({
    user_id: meId, avatar_path: null, ciphertext: null, iv: null,
    sender_key_version: null, recipient_key_version: null,
  })
  if (error) throw new Error('Could not remove the photo.')
  if (oldPath) await sb.storage.from('chat-media').remove([oldPath])
}

/** Decrypts a profile row into an image URL (or null if there is no photo). */
export async function avatarUrl(row: ProfileRow, meId: string, sharedFor: SharedFor): Promise<string | null> {
  if (!row.avatar_path || !row.ciphertext || !row.iv) return null
  const mine = row.user_id === meId
  const myVer = (mine ? row.sender_key_version : row.recipient_key_version) ?? 0
  const peerVer = (mine ? row.recipient_key_version : row.sender_key_version) ?? 0
  const key = await sharedFor(myVer, peerVer)
  if (!key) return null
  const payload = await decryptPayload(key, aad(row.user_id), row.ciphertext, row.iv)
  if (!payload.media) return null
  return loadDecrypted(row.avatar_path, payload.media, 'image')
}
