// Web Push client for per-habit reminders.
//
// Delivery works with zero servers of our own: reminder times + this device's
// push subscription are synced to the GitHub repo (via a prefilled issue that
// a workflow parses), and a scheduled GitHub Action sends the pushes.

// Public half of the VAPID keypair; the private half lives in the repo's
// Actions secrets (VAPID_PRIVATE_KEY). Safe to ship in the client.
export const VAPID_PUBLIC_KEY =
  'BPX_TV-85_WzJGbxpIlM5rqT7KjZc7vkGZWuWhsiT4GFjKgfbvtwnzirzk9F-qVKI5cHZcm1pgLNhRyRKVfuYDQ'

export const REPO = 'simeonsimon/60-reps'
export const SYNC_ISSUE_TITLE = 'push-sync'

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

// Ask permission + subscribe this device. Must be called from a user gesture.
// Returns the subscription JSON, or throws with a human-readable message.
export async function enablePush() {
  if (!pushSupported()) {
    throw new Error('This browser has no push support. On iPhone: install the app first (Share → Add to Home Screen) and open it from the Home Screen.')
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notifications were not allowed. Enable them in iOS Settings → 60 Reps → Notifications.')
  }
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }))
  return sub.toJSON()
}

// Everything the reminder sender needs, in one document.
export function buildSyncPayload(habits, subscription) {
  return {
    v: 1,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Atlantic/Canary',
    updatedAt: new Date().toISOString(),
    subscription,
    reminders: habits
      .filter((h) => h.reminder?.enabled && h.reminder.time)
      .map((h) => ({
        habitId: h.id,
        title: h.title,
        emoji: h.emoji || '⛰️',
        time: h.reminder.time, // local HH:MM
        days: h.days && h.days.length > 0 && h.days.length < 7 ? h.days : null, // null = every day
      })),
  }
}

// Stable-ish hash to show the "out of sync" dot in Settings.
export function payloadHash(payload) {
  const s = JSON.stringify({ r: payload.reminders, e: payload.subscription?.endpoint, tz: payload.tz })
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return String(h)
}

// Prefilled new-issue URL: submitting it hands the config to the sync
// workflow, which commits it and closes the issue. No tokens in the app.
export function syncIssueUrl(payload) {
  const body = ['```json', JSON.stringify(payload, null, 2), '```', '', '_Submit this issue as-is — a workflow saves your reminders and closes it automatically._'].join('\n')
  const params = new URLSearchParams({ title: SYNC_ISSUE_TITLE, body })
  return `https://github.com/${REPO}/issues/new?${params.toString()}`
}
