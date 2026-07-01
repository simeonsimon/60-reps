/* eslint-env serviceworker */
// 60 Reps service worker: offline app-shell precache + Web Push reminders.
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

self.skipWaiting()
clientsClaim()

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// ── Push reminders ─────────────────────────────────────────────────────────
// Payload (JSON): { title, body, tag, url }
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || '60 Reps'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || 'Time to log a rep.',
      tag: data.tag || 'sixtyreps-reminder',
      icon: './pwa-192.png',
      badge: './pwa-192.png',
      data: { url: data.url || './' },
    }),
  )
})

// Tapping the notification opens (or focuses) the app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const scopeUrl = self.registration.scope
      for (const client of all) {
        if (client.url.startsWith(scopeUrl) && 'focus' in client) return client.focus()
      }
      return self.clients.openWindow(event.notification.data?.url || scopeUrl)
    })(),
  )
})
