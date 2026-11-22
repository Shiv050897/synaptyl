// End-to-end encryption for the private chat, built on the browser's Web Crypto API.
//
// * Each device holds an ECDH P-256 key pair. Private keys live only in this
//   browser's IndexedDB (or, optionally, in a passphrase-encrypted backup).
// * Two users' keys produce a shared secret (ECDH) that is stretched with HKDF
//   into an AES-GCM 256-bit key. Messages are encrypted with that key and a
//   fresh 96-bit IV, with the message id bound in as additional data.
// * Audio is encrypted with its own random AES-GCM key, which travels inside
//   the (encrypted) message.

export type PublicJwk = { kty: 'EC'; crv: 'P-256'; x: string; y: string }

export type MediaInfo = {
  key: string // base64 raw AES key for the file
  iv: string
  mime: string
  size: number
  name?: string
  duration?: number
  wave?: number[]
}

export type Payload = { v: 1; text?: string; media?: MediaInfo }

const enc = new TextEncoder()
const dec = new TextDecoder()

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------
export function toB64(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000))
  return btoa(s)
}

export function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(s.length))
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(new ArrayBuffer(n)))
}

// ---------------------------------------------------------------------------
// Local key store (IndexedDB). CryptoKey objects are stored directly.
// ---------------------------------------------------------------------------
const DB_NAME = 'syn-pc'
const STORE = 'keys'

type StoredKey = { id: string; userId: string; version: number; privateKey: CryptoKey; publicJwk: PublicJwk }

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode)
      const req = run(t.objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

export async function loadLocalKeys(userId: string): Promise<Map<number, StoredKey>> {
  const all = await tx<StoredKey[]>('readonly', (s) => s.getAll() as IDBRequest<StoredKey[]>)
  const map = new Map<number, StoredKey>()
  for (const k of all) if (k.userId === userId) map.set(k.version, k)
  return map
}

async function saveLocalKey(k: Omit<StoredKey, 'id'>): Promise<void> {
  await tx('readwrite', (s) => s.put({ ...k, id: `${k.userId}:${k.version}` }))
}

/** Removes this device's copy of every chat key (used on explicit reset). */
export async function clearLocalKeys(): Promise<void> {
  await tx('readwrite', (s) => s.clear())
}

// ---------------------------------------------------------------------------
// Key generation, import, backup
// ---------------------------------------------------------------------------
export async function generateKeyPair(userId: string, version: number): Promise<PublicJwk> {
  // Extractable only so it can be wrapped into an optional encrypted backup.
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
  const publicJwk: PublicJwk = { kty: 'EC', crv: 'P-256', x: jwk.x!, y: jwk.y! }
  await saveLocalKey({ userId, version, privateKey: pair.privateKey, publicJwk })
  return publicJwk
}

export const BACKUP_ITERATIONS = 600_000

async function passphraseKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export type Backup = { key_version: number; wrapped_key: string; salt: string; iv: string; iterations: number }

export async function makeBackup(userId: string, version: number, passphrase: string): Promise<Backup> {
  const local = (await loadLocalKeys(userId)).get(version)
  if (!local) throw new Error('No key on this device to back up.')
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', local.privateKey)
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = await passphraseKey(passphrase, salt, BACKUP_ITERATIONS)
  const aad = enc.encode(`syn-pc-backup:${userId}:${version}`)
  const wrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, pkcs8)
  return { key_version: version, wrapped_key: toB64(wrapped), salt: toB64(salt), iv: toB64(iv), iterations: BACKUP_ITERATIONS }
}

/** Restores a private key from its backup; throws if the passphrase is wrong. */
export async function restoreBackup(userId: string, backup: Backup, publicJwk: PublicJwk, passphrase: string) {
  const key = await passphraseKey(passphrase, fromB64(backup.salt), backup.iterations)
  const aad = enc.encode(`syn-pc-backup:${userId}:${backup.key_version}`)
  let pkcs8: ArrayBuffer
  try {
    pkcs8 = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(backup.iv), additionalData: aad }, key, fromB64(backup.wrapped_key))
  } catch {
    throw new Error('Wrong passphrase.')
  }
  const privateKey = await crypto.subtle.importKey('pkcs8', pkcs8, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  await saveLocalKey({ userId, version: backup.key_version, privateKey, publicJwk })
}

// ---------------------------------------------------------------------------
// Shared message keys
// ---------------------------------------------------------------------------
const sharedCache = new Map<string, Promise<CryptoKey>>()

/**
 * AES-GCM key shared by `me` (with my private key `myVersion`) and `peer`
 * (with public key `peerVersion`). Both sides derive the identical key.
 */
export function sharedKey(
  me: { userId: string; version: number; privateKey: CryptoKey },
  peer: { userId: string; version: number; publicJwk: PublicJwk },
): Promise<CryptoKey> {
  const id = `${me.userId}:${me.version}|${peer.userId}:${peer.version}`
  let cached = sharedCache.get(id)
  if (!cached) {
    cached = (async () => {
      const peerKey = await crypto.subtle.importKey('jwk', peer.publicJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
      const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: peerKey }, me.privateKey, 256)
      const hkdf = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey'])
      const parties = [`${me.userId}:${me.version}`, `${peer.userId}:${peer.version}`].sort().join('|')
      return crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: enc.encode('syn-pc-msg-v1'), info: enc.encode(parties) },
        hkdf,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      )
    })()
    cached.catch(() => sharedCache.delete(id))
    sharedCache.set(id, cached)
  }
  return cached
}

export async function encryptPayload(key: CryptoKey, messageId: string, payload: Payload) {
  const iv = randomBytes(12)
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(messageId) }, key, enc.encode(JSON.stringify(payload)))
  return { ciphertext: toB64(ct), iv: toB64(iv) }
}

export async function decryptPayload(key: CryptoKey, messageId: string, ciphertext: string, iv: string): Promise<Payload> {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(iv), additionalData: enc.encode(messageId) }, key, fromB64(ciphertext))
  const parsed = JSON.parse(dec.decode(pt)) as Payload
  if (parsed?.v !== 1) throw new Error('Unsupported message format')
  return parsed
}

// ---------------------------------------------------------------------------
// Files (voice notes, audio)
// ---------------------------------------------------------------------------
export async function encryptFile(data: ArrayBuffer) {
  const raw = randomBytes(32)
  const iv = randomBytes(12)
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt'])
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  return { blob: new Blob([ct], { type: 'application/octet-stream' }), key: toB64(raw), iv: toB64(iv) }
}

export async function decryptFile(data: ArrayBuffer, media: MediaInfo): Promise<Blob> {
  const key = await crypto.subtle.importKey('raw', fromB64(media.key), 'AES-GCM', false, ['decrypt'])
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(media.iv) }, key, data)
  return new Blob([pt], { type: media.mime })
}

// ---------------------------------------------------------------------------
// Safety number: both users can compare it to confirm no key was swapped.
// ---------------------------------------------------------------------------
export async function safetyNumber(a: { userId: string; jwk: PublicJwk }, b: { userId: string; jwk: PublicJwk }) {
  const parts = [a, b].map((p) => `${p.userId}:${p.jwk.x}:${p.jwk.y}`).sort().join('|')
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(parts)))
  const groups: string[] = []
  for (let i = 0; i < 24; i += 2) groups.push(String(((digest[i] << 8) | digest[i + 1]) % 100000).padStart(5, '0'))
  return groups.join(' ')
}
