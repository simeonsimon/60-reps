import { startOfDay } from '../lib/habits.js'

const DAY = 86400000
const WEEKS = 17
const CELL = 13
const GAP = 3
const LEFT = 16 // gutter for weekday letters
const TOP = 13 // gutter for month labels

// GitHub-style contribution calendar built from completion events.
// `isScheduled(dateMs)` (optional) marks which days the habit runs on; empty
// off-days render nearly invisible so rest days never read as misses.
export default function Heatmap({ events = [], accent = '#7aa2ff', isScheduled }) {
  const counts = {}
  let max = 1
  for (const e of events) {
    const d = startOfDay(e.t)
    counts[d] = (counts[d] || 0) + e.amount
    if (counts[d] > max) max = counts[d]
  }

  const today = startOfDay(Date.now())
  const todayWeekday = new Date(today).getDay() // 0 = Sun
  const start = today - ((WEEKS - 1) * 7 + todayWeekday) * DAY

  const cells = []
  for (let i = 0; i < WEEKS * 7; i++) {
    const date = start + i * DAY
    if (date > today) continue
    const col = Math.floor(i / 7)
    const row = i % 7
    const count = counts[date] || 0
    cells.push({ x: LEFT + col * (CELL + GAP), y: TOP + row * (CELL + GAP), count, date })
  }

  // Month labels: mark each column where the month changes (keep 3+ columns
  // of spacing so labels never collide).
  const monthLabels = []
  let prevMonth = -1
  let lastLabelCol = -10
  for (let col = 0; col < WEEKS; col++) {
    const d = new Date(start + col * 7 * DAY)
    const m = d.getMonth()
    if (m !== prevMonth) {
      if (col - lastLabelCol >= 3) {
        monthLabels.push({
          x: LEFT + col * (CELL + GAP),
          text: d.toLocaleDateString(undefined, { month: 'short' }),
        })
        lastLabelCol = col
      }
      prevMonth = m
    }
  }

  const activeDays = cells.filter((c) => c.count > 0).length
  const w = LEFT + WEEKS * (CELL + GAP)
  const h = TOP + 7 * (CELL + GAP)

  const fillFor = (count, date) => {
    if (count <= 0) {
      const offDay = isScheduled && !isScheduled(date)
      return offDay ? 'rgb(var(--c-elevated) / 0.35)' : 'rgb(var(--c-elevated))'
    }
    const alpha = 0.3 + 0.7 * Math.min(1, count / max)
    return hexToRgba(accent, alpha)
  }

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Consistency heatmap">
        {monthLabels.map((m) => (
          <text key={m.x} x={m.x} y={9} fontSize="8.5" fill="rgb(var(--c-muted))">
            {m.text}
          </text>
        ))}
        {[
          { row: 1, label: 'M' },
          { row: 3, label: 'W' },
          { row: 5, label: 'F' },
        ].map((r) => (
          <text
            key={r.label}
            x={0}
            y={TOP + r.row * (CELL + GAP) + CELL - 3}
            fontSize="8.5"
            fill="rgb(var(--c-muted))"
          >
            {r.label}
          </text>
        ))}
        {cells.map((c) => (
          <rect
            key={c.date}
            x={c.x}
            y={c.y}
            width={CELL}
            height={CELL}
            rx={3}
            fill={fillFor(c.count, c.date)}
          >
            <title>{new Date(c.date).toLocaleDateString()} — {c.count} rep{c.count === 1 ? '' : 's'}</title>
          </rect>
        ))}
      </svg>
      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted">
        <span className="mr-auto">{activeDays} active day{activeDays === 1 ? '' : 's'} in 17 weeks</span>
        <span>Less</span>
        {[0, 0.35, 0.6, 1].map((f) => (
          <span
            key={f}
            className="inline-block h-2.5 w-2.5 rounded-[2px]"
            style={{ background: f === 0 ? 'rgb(var(--c-elevated))' : hexToRgba(accent, 0.3 + 0.7 * f) }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}

function hexToRgba(hex, a) {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}
