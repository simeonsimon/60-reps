import { GOAL } from '../../lib/habits.js'
import { fmtDate } from '../../lib/analytics.js'

// The headline conclusion: when does this habit reach rep 60?
export default function ForecastCard({ habit, fc }) {
  if (fc.done) {
    return (
      <div className="rounded-3xl bg-accent-soft p-4">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-accent">Summit reached</div>
        <div className="mt-1 font-display text-2xl font-extrabold text-ink">⛰️ {fmtDate(fc.summitAt)}</div>
        <p className="mt-1 text-xs text-muted">
          Rep 60 is banked{fc.bonus > 0 ? ` — plus ${fc.bonus} bonus rep${fc.bonus === 1 ? '' : 's'} since` : ''}. The
          climb continues for as long as you want it to.
        </p>
      </div>
    )
  }
  if (fc.stalled) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 bg-surface/60 p-4">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-muted">Summit forecast</div>
        <div className="mt-1 font-display text-xl font-extrabold text-ink">Paused</div>
        <p className="mt-1 text-xs text-muted">
          {fc.remaining} reps to go, but there's no recent pace to project from. One rep restarts the model — no guilt.
        </p>
      </div>
    )
  }
  const pct = Math.min(100, Math.round((habit.reps / GOAL) * 100))
  return (
    <div
      className="rounded-3xl p-4"
      style={{
        background:
          'linear-gradient(135deg, rgb(var(--c-accent) / 0.18), rgb(var(--c-surface)) 55%)',
      }}
    >
      <div className="text-[11px] font-semibold uppercase tracking-widest text-accent">Summit forecast</div>
      <div className="mt-1 font-display text-2xl font-extrabold text-ink">≈ {fmtDate(fc.eta)}</div>
      <p className="mt-1 text-xs text-muted">
        {fc.remaining} reps to go at {fc.perWeek.toFixed(1)} reps/week — about {fc.daysLeft} days if the pace holds.
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-elevated">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>{habit.reps} banked</span>
        <span>60</span>
      </div>
    </div>
  )
}
