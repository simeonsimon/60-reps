// Habit-reminder sender. Runs on a GitHub Actions schedule (every 15 min).
//
// Reads push/config.json (written by the push-sync workflow from an in-app
// sync) and Web-Pushes any reminder whose local time falls in the current
// 15-minute slot. Slot windows are anchored to the wall clock — not to when
// the (often-delayed) cron actually fires — so a late run still delivers
// exactly the reminders of its own slot: (slotEnd - 15 min, slotEnd].
//
// Usage: node send-reminders.mjs <path-to-config.json>
// Env:   VAPID_PRIVATE_KEY (repo Actions secret)
import { readFileSync, existsSync, writeFileSync } from 'fs'
import webpush from 'web-push'

const VAPID_PUBLIC_KEY =
  'BPX_TV-85_WzJGbxpIlM5rqT7KjZc7vkGZWuWhsiT4GFjKgfbvtwnzirzk9F-qVKI5cHZcm1pgLNhRyRKVfuYDQ'
const APP_URL = 'https://simeonsimon.github.io/60-reps/'
const SLOT_MS = 15 * 60 * 1000

const BODIES = [
  'Time to climb. One rep — that\'s the deal.',
  'The mountain is waiting. Log it.',
  'Small rep now beats a perfect rep never.',
  'Keep the streak breathing — hold to log.',
  'Future you says thanks. Do the rep.',
  'No guilt, just the next rep.',
]

// ── timezone helpers (no deps) ──────────────────────────────────────────────
function partsInTz(ts, tz) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const p = Object.fromEntries(fmt.formatToParts(ts).map((x) => [x.type, x.value]))
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour, mm: +p.minute }
}

// Absolute instant for local calendar date + HH:MM in tz (two-pass fixup).
function zonedTimeToUtc(y, m, d, hh, mm, tz) {
  let ts = Date.UTC(y, m - 1, d, hh, mm)
  for (let i = 0; i < 2; i++) {
    const p = partsInTz(ts, tz)
    ts += Date.UTC(y, m - 1, d, hh, mm) - Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm)
  }
  return ts
}

// ── main ────────────────────────────────────────────────────────────────────
const configPath = process.argv[2]
if (!configPath || !existsSync(configPath)) {
  console.log('No push config yet — nothing to send.')
  process.exit(0)
}
const config = JSON.parse(readFileSync(configPath, 'utf8'))
const { subscription, reminders = [], tz = 'Atlantic/Canary' } = config
if (!subscription?.endpoint || reminders.length === 0) {
  console.log('Config has no subscription/reminders — nothing to send.')
  process.exit(0)
}

const privateKey = process.env.VAPID_PRIVATE_KEY
if (!privateKey) {
  console.error('VAPID_PRIVATE_KEY is not set.')
  process.exit(1)
}
webpush.setVapidDetails('mailto:simonandresmaster@gmail.com', VAPID_PUBLIC_KEY, privateKey)

const slotEnd = Math.floor(Date.now() / SLOT_MS) * SLOT_MS
const slotStart = slotEnd - SLOT_MS

// Candidate local calendar dates that could map into the slot window
// (yesterday matters right after local midnight).
const candidates = [partsInTz(slotEnd, tz), partsInTz(slotEnd - 24 * 60 * 60 * 1000, tz)]

const due = []
for (const r of reminders) {
  const [hh, mm] = String(r.time).split(':').map(Number)
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) continue
  for (const c of candidates) {
    const weekday = new Date(Date.UTC(c.y, c.m - 1, c.d)).getUTCDay()
    if (r.days && !r.days.includes(weekday)) continue
    const at = zonedTimeToUtc(c.y, c.m, c.d, hh, mm, tz)
    if (at > slotStart && at <= slotEnd) {
      due.push(r)
      break
    }
  }
}

if (due.length === 0) {
  console.log(`Slot ${new Date(slotEnd).toISOString()}: no reminders due.`)
  process.exit(0)
}

let expired = false
for (const r of due) {
  const payload = JSON.stringify({
    title: `${r.emoji} ${r.title}`,
    body: BODIES[(new Date().getDate() + r.title.length) % BODIES.length],
    tag: `reminder-${r.habitId}`,
    url: APP_URL,
  })
  try {
    await webpush.sendNotification(subscription, payload, { TTL: 60 * 60 })
    console.log(`Sent: ${r.title} (${r.time} ${tz})`)
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      expired = true
      console.error(`Subscription expired/gone (${err.statusCode}) — re-enable notifications in the app.`)
    } else {
      console.error(`Push failed for "${r.title}":`, err.statusCode || err.message)
    }
  }
}

// Flag for the workflow to open a heads-up issue (once) if the device needs
// to re-subscribe.
if (expired) writeFileSync('expired.flag', '1')
