import { callFunction, chatClient } from './client'

// Public half of the Web Push signing key (safe to publish). The private
// half is stored only in the protected database table.
const VAPID_PUBLIC_KEY = 'BCscGlPa_IfhwrviJa_tIPqRbCgcZ5cqjuYxbAR-PVEKi0WbcoJ08uvJJlNmvcY7vi9mJygNgdmRi82G44IFATM'

export type PushStatus = 'unsupported' | 'default' | 'granted' | 'denied'

export function pushStatus(): PushStatus {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  return Notification.permission as PushStatus
}

function keyBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64url.length % 4)) % 4)
  const s = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(s.length))
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

async function registration() {
  await navigator.serviceWorker.register('/pc-sw.js', { scope: '/' })
  return navigator.serviceWorker.ready
}

/** Makes sure this device is subscribed and saved for the signed-in user. */
async function saveSubscription() {
  const reg = await registration()
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) })
  }
  const json = sub.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('Push subscription is incomplete.')
  const { error } = await chatClient!.rpc('chat_register_push', {
    p_endpoint: json.endpoint, p_p256dh: json.keys.p256dh, p_auth: json.keys.auth,
  })
  if (error) throw new Error('Could not save notification settings.')
}

/** Asks for permission (must be called from a tap) and turns notifications on. */
export async function enablePush(): Promise<PushStatus> {
  if (pushStatus() === 'unsupported') return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission === 'granted') await saveSubscription()
  return permission as PushStatus
}

/** On each visit: keep this device registered if notifications are allowed. */
export async function refreshPush() {
  if (pushStatus() === 'granted') await saveSubscription().catch(() => {})
}

/** Stops notifications on this device (used on sign-out and from Settings). */
export async function disablePush() {
  if (pushStatus() === 'unsupported') return
  const reg = await navigator.serviceWorker.getRegistration('/')
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await chatClient?.from('chat_push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe().catch(() => {})
}

/** Tells the server to alert the other person. Failures are ignored. */
export function notifyPeer(body: { type: 'message'; message_id: string } | { type: 'call'; media: 'audio' | 'video' }) {
  void callFunction('chat-push', body).catch(() => {})
}
