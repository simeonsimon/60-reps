// Small presentational atoms shared by both analytics views.

// Insight tones. `warn`/`star` use fixed hues on purpose — they must read as
// "attention"/"gold" on every skin, including Karat where accent is already gold.
const TONE = {
  up: { chip: 'rgb(var(--c-accent) / 0.16)', fg: 'rgb(var(--c-accent))' },
  star: { chip: 'rgb(var(--c-star) / 0.14)', fg: 'rgb(var(--c-star))' },
  warn: { chip: 'rgb(var(--c-warn) / 0.14)', fg: 'rgb(var(--c-warn))' },
  info: { chip: 'rgb(var(--c-elevated))', fg: 'rgb(var(--c-muted))' },
}

export function Stat({ label, value, sub, subTone }) {
  const subColor =
    subTone === 'up'
      ? 'rgb(var(--c-accent))'
      : subTone === 'down'
        ? 'rgb(var(--c-warn))'
        : 'rgb(var(--c-muted))'
  return (
    <div className="rounded-2xl bg-surface px-3.5 py-3">
      <div className="text-xl font-bold leading-tight text-ink">{value}</div>
      <div className="mt-0.5 text-xs2 text-muted">{label}</div>
      {sub && (
        <div className="mt-0.5 text-2xs font-semibold" style={{ color: subColor }}>
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
        {hint && <span className="text-xs2 text-muted">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

export function InsightCard({ ins, index = 0 }) {
  const tone = TONE[ins.tone] || TONE.info
  return (
    <div
      className="flex animate-fade-up items-start gap-3 rounded-3xl border border-line/5 bg-surface p-4"
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
        <p className="mt-0.5 text-sm2 leading-relaxed text-muted">{ins.text}</p>
        {ins.action && (
          <p
            className="mt-2 border-l-2 pl-2 text-xs2 font-medium leading-relaxed text-muted/80"
            style={{ borderColor: tone.fg }}
          >
            {ins.action}
          </p>
        )}
      </div>
    </div>
  )
}

export function HabitHeadline({ headline, onClick, className = '' }) {
  if (!headline) return null
  const tone = TONE[headline.tone] || TONE.info
  const content = (
    <>
      <span aria-hidden="true" className="shrink-0">{headline.icon}</span>
      <span className="truncate">{headline.text}</span>
    </>
  )
  const classes = `flex min-w-0 max-w-full items-center gap-1.5 text-left text-xs2 font-medium ${className}`

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${classes} rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent`}
        style={{ color: tone.fg }}
      >
        {content}
      </button>
    )
  }

  return <span className={classes} style={{ color: tone.fg }}>{content}</span>
}

// Structured's saturated rounded-squircle icon tile — an accent-soft fill
// behind an emoji, used to give each row a consistent glanceable identity.
const TILE_SIZE = {
  sm: 'h-8 w-8 text-base',
  md: 'h-10 w-10 text-lg',
  lg: 'h-12 w-12 text-xl',
}

const TILE_TONE = {
  accent: 'bg-accent-soft',
  warn: 'bg-warn/15',
  star: 'bg-star/15',
  muted: 'bg-elevated',
}

export function EmojiTile({ emoji, size = 'md', tone = 'accent' }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-2xl ${TILE_SIZE[size] || TILE_SIZE.md} ${
        TILE_TONE[tone] || TILE_TONE.accent
      }`}
    >
      {emoji}
    </span>
  )
}
