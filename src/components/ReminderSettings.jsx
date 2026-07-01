import { useMemo, useState } from 'react'
import { useStore } from '../store/StoreProvider.jsx'
import { isIos, isStandalone } from '../lib/device.js'
import { enablePush, buildSyncPayload, payloadHash, syncIssueUrl, pushSupported } from '../lib/push.js'
import { daysLabel } from '../lib/habits.js'

// Per-habit push reminders. Three states, walked top to bottom:
//  1. Install the app (iOS only allows push for Home-Screen apps)
//  2. Enable notifications on this device (one tap, one time)
//  3. Set times per habit, then sync them to the cloud sender
export default function ReminderSettings() {
  const { habits, profile, setProfile, updateHabit } = useStore()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const needsInstall = isIos() && !isStandalone()
  const enabled = !!profile.pushSubscription

  const payload = useMemo(
    () => buildSyncPayload(habits, profile.pushSubscription),
    [habits, profile.pushSubscription],
  )
  const dirty = enabled && payloadHash(payload) !== profile.lastSyncHash
  const activeCount = payload.reminders.length

  async function handleEnable() {
    setBusy(true)
    setError(null)
    try {
      const sub = await enablePush()
      setProfile({ pushSubscription: sub })
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  function handleSync() {
    // Opens a prefilled GitHub issue; a repo workflow saves the config and
    // closes the issue. GitHub login happens in the browser, not here.
    window.open(syncIssueUrl(payload), '_blank', 'noopener')
    setProfile({ lastSyncHash: payloadHash(payload) })
  }

  return (
    <div className="space-y-2">
      {needsInstall && (
        <div className="rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm">
          <div className="font-semibold text-ink">Install the app first</div>
          <div className="mt-0.5 text-xs leading-relaxed text-muted">
            Reminders on iPhone need the real app: open this page in Safari, tap{' '}
            <span className="text-ink">Share&nbsp;→ Add to Home Screen</span>, then set up reminders from
            the 60&nbsp;Reps icon.
          </div>
        </div>
      )}

      {!needsInstall && !enabled && (
        <button
          onClick={handleEnable}
          disabled={busy || !pushSupported()}
          className="w-full rounded-2xl bg-accent px-4 py-3 text-sm font-bold disabled:opacity-40"
          style={{ color: 'rgb(var(--c-base))' }}
        >
          {busy ? 'Setting up…' : 'Enable notifications on this device'}
        </button>
      )}

      {error && <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-xs text-red-300">{error}</div>}

      {enabled && (
        <>
          {habits.map((h) => {
            const r = h.reminder || { time: '', enabled: false }
            return (
              <div key={h.id} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3">
                <span className="text-xl">{h.emoji || '⛰️'}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">{h.title}</div>
                  <div className="text-[11px] text-muted">{daysLabel(h)}</div>
                </div>
                <input
                  type="time"
                  value={r.time}
                  onChange={(e) =>
                    updateHabit(h.id, { reminder: { time: e.target.value, enabled: !!e.target.value } })
                  }
                  className="rounded-xl border border-white/10 bg-elevated px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
                />
                <button
                  onClick={() => updateHabit(h.id, { reminder: r.time ? { ...r, enabled: !r.enabled } : null })}
                  role="switch"
                  aria-checked={r.enabled}
                  className="relative h-7 w-12 shrink-0 rounded-full transition-colors"
                  style={{ background: r.enabled ? 'rgb(var(--c-accent))' : 'rgb(var(--c-elevated))' }}
                >
                  <span
                    className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all"
                    style={{ left: r.enabled ? '1.75rem' : '0.25rem' }}
                  />
                </button>
              </div>
            )
          })}

          <button
            onClick={handleSync}
            disabled={activeCount === 0 && !dirty}
            className={`relative w-full rounded-2xl px-4 py-3 text-sm font-bold transition-colors disabled:opacity-40 ${
              dirty ? 'bg-accent' : 'bg-surface text-muted'
            }`}
            style={dirty ? { color: 'rgb(var(--c-base))' } : undefined}
          >
            {dirty && <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-red-400" />}
            {dirty ? 'Save reminders to cloud (1 tap on GitHub)' : `Reminders synced · ${activeCount} active`}
          </button>
          <p className="px-1 text-[11px] leading-relaxed text-muted">
            Saving opens a prefilled GitHub issue — just tap <span className="text-ink">Submit</span>. A
            workflow stores the schedule and delivers your pushes, even with the app closed.
          </p>
        </>
      )}
    </div>
  )
}
