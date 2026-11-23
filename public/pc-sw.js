// Service worker for chat notifications only. It has no fetch handler,
// so it never caches or changes how the website loads.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = {} }
  const title = data.title || 'Chat'
  const isCall = data.type === 'call'

  event.waitUntil((async () => {
    // Skip message alerts while the chat is open on screen; calls always ring.
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const chatVisible = windows.some((w) => w.visibilityState === 'visible' && /^\/(chat|zx|k7m2q|s|admin)\/?$/.test(new URL(w.url).pathname))
    if (chatVisible && !isCall) return
    await self.registration.showNotification(title, {
      body: data.body || 'New message',
      tag: data.tag || 'pc',
      renotify: true,
      requireInteraction: isCall,
      vibrate: isCall ? [400, 200, 400, 200, 400] : [200],
      icon: '/pc/icon-192.png',
      badge: '/pc/icon-192.png',
      data: { url: data.url || '/zx' },
    })
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/zx'
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const chat = windows.find((w) => /^\/(chat|zx|k7m2q|s|admin)\/?$/.test(new URL(w.url).pathname))
    if (chat) return chat.focus()
    return self.clients.openWindow(target)
  })())
})
