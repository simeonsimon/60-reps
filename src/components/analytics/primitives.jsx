// Small presentational atoms shared by both analytics views.

// Insight tones. `warn`/`star` use fixed hues on purpose — they must read as
// "attention"/"gold" on every skin, including Karat where accent is already gold.
const TONE = {
  up: { chip: 'rgb(var(--c-accent) / 0.16)', fg: 'rgb(var(--c-accent))' },
  star: { chip: 'rgba(250, 204, 21, 0.14)', fg: '#facc15' },
  warn: { chip: 'rgba(251, 146, 60, 0.14)', fg: '#fb923c' },
  info: { chip: 'rgb(var(--c-elevated))', fg: 'rgb(var(--c-muted))' },
}

export function Stat({ label, value, sub, subTone }) {
  const subColor =
    subTone === 'up' ? 'rgb(var(--c-accent))' : subTone === 'down' ? '#fb923c' : 'rgb(var(--c-muted))'
  return (
    <div className="rounded-2xl bg-surface px-3.5 py-3">
      <div className="text-xl font-bold leading-tight text-ink">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted">{label}</div>
      {sub && (
        <div className="mt-0.5 text-[10px] font-semibold" style={{ color: subColor }}>
          {sub}
        </div>
      )}
    </div>
  )
}

export function Section({ title, hint, children }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h4 className="text-sm font-semibold text-ink">{title}</h4>
        {hint && <span className="text-[11px] text-muted">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

export function InsightCard({ ins, index = 0 }) {
  const tone = TONE[ins.tone] || TONE.info
  return (
    <div
      className="flex animate-fade-up items-start gap-3 rounded-3xl border border-white/5 bg-surface p-4"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl text-base"
        style={{ background: tone.chip }}
      >
        {ins.icon}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-bold text-ink">{ins.title}</div>
        <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{ins.text}</p>
      </div>
    </div>
  )
}
