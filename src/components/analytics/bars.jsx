// Hand-rolled bar visualizations for the analytics views.
import { WEEKDAY_ORDER, WEEKDAY_SHORT } from '../../lib/habits.js'
import { fmtDate, pctLabel } from '../../lib/analytics.js'

// Last 8 Monday-aligned weeks of reps.
export function WeeklyBars({ series }) {
  const max = Math.max(1, ...series.map((b) => b.reps))
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height: 104 }}>
        {series.map((b, i) => {
          const last = i === series.length - 1
          const h = b.reps > 0 ? Math.max(8, Math.round((b.reps / max) * 78)) : 3
          return (
            <div key={b.start} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[9px] font-semibold text-muted">{b.reps > 0 ? b.reps : ''}</span>
              <div
                className="w-full rounded-md transition-all"
                style={{
                  height: h,
                  background: last ? 'rgb(var(--c-accent))' : 'rgb(var(--c-accent) / 0.35)',
                }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted">
        <span>{fmtDate(series[0].start)}</span>
        <span>this week</span>
      </div>
    </div>
  )
}

// Hit rate per weekday (Mon-first), best/worst highlighted.
export function WeekdayBars({ wk }) {
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height: 112 }}>
        {WEEKDAY_ORDER.map((wd) => {
          const r = wk.rows[wd]
          const isBest = wk.best?.wd === wd
          const isWorst = !isBest && wk.worst?.wd === wd
          const off = !r.scheduled
          const rate = r.rate ?? 0
          const h = r.rate !== null && rate > 0 ? Math.max(8, Math.round(rate * 74)) : 3
          const bg = off
            ? 'rgb(var(--c-elevated))'
            : isBest
              ? 'rgb(var(--c-accent))'
              : isWorst
                ? '#fb923c'
                : 'rgb(var(--c-accent) / 0.4)'
          return (
            <div key={wd} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[9px] font-semibold text-muted">
                {off ? '💤' : r.rate !== null ? Math.round(rate * 100) : '·'}
              </span>
              <div className="w-full rounded-md" style={{ height: h, background: bg, opacity: off ? 0.5 : 1 }} />
              <span className={`text-[10px] ${isBest ? 'font-bold text-accent' : 'text-muted'}`}>
                {WEEKDAY_SHORT[wd]}
              </span>
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        {wk.best && wk.worst && wk.best.wd !== wk.worst.wd
          ? `Hit rate per weekday, last 12 weeks — strongest on ${wk.best.label} (${pctLabel(wk.best.rate)}), weakest on ${wk.worst.label} (${pctLabel(wk.worst.rate)}).`
          : 'Hit rate per weekday over the last 12 weeks. 💤 marks rest days.'}
      </p>
    </div>
  )
}

// Share of reps by time of day.
export function DayPartsBar({ parts }) {
  if (!parts.total) {
    return <p className="text-xs text-muted">Log a few reps to see when this habit actually happens.</p>
  }
  const alphas = [0.95, 0.7, 0.5, 0.32]
  return (
    <div>
      <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-elevated">
        {parts.parts.map(
          (p, i) =>
            p.share > 0 && (
              <div
                key={p.id}
                style={{ width: `${p.share * 100}%`, background: `rgb(var(--c-accent) / ${alphas[i]})` }}
              />
            ),
        )}
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {parts.parts.map((p, i) => (
          <div key={p.id} className="flex items-center gap-2 text-xs">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: `rgb(var(--c-accent) / ${alphas[i]})` }}
            />
            <span className="truncate text-muted">
              {p.emoji} {p.label}
            </span>
            <span className="ml-auto font-semibold text-ink">{p.reps > 0 ? pctLabel(p.share) : '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
