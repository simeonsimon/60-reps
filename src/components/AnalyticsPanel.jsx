import { useMemo, useState } from 'react'
import { useSkin } from '../context/SkinContext.jsx'
import { useStore } from '../store/StoreProvider.jsx'
import ClimbChart from './ClimbChart.jsx'
import Heatmap from './Heatmap.jsx'
import { GOAL, isScheduledOn, WEEKDAY_ORDER, WEEKDAY_SHORT } from '../lib/habits.js'
import { analyzeHabit, analyzePortfolio, fmtDate, pctLabel } from '../lib/analytics.js'

// Insight tones. `warn`/`star` use fixed hues on purpose — they must read as
// "attention"/"gold" on every skin, including Karat where accent is already gold.
const TONE = {
  up: { chip: 'rgb(var(--c-accent) / 0.16)', fg: 'rgb(var(--c-accent))' },
  star: { chip: 'rgba(250, 204, 21, 0.14)', fg: '#facc15' },
  warn: { chip: 'rgba(251, 146, 60, 0.14)', fg: '#fb923c' },
  info: { chip: 'rgb(var(--c-elevated))', fg: 'rgb(var(--c-muted))' },
}

function Stat({ label, value, sub, subTone }) {
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

function Section({ title, hint, children }) {
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

function InsightCard({ ins, index = 0 }) {
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

// The headline conclusion: when does this habit reach rep 60?
function ForecastCard({ habit, fc }) {
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

// Last 8 Monday-aligned weeks of reps.
function WeeklyBars({ series }) {
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
function WeekdayBars({ wk }) {
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
function DayPartsBar({ parts }) {
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

function scoreChipStyle(score) {
  if (score >= 65) return { background: 'rgb(var(--c-accent) / 0.16)', color: 'rgb(var(--c-accent))' }
  if (score >= 45) return { background: 'rgba(250, 204, 21, 0.14)', color: '#facc15' }
  return { background: 'rgb(var(--c-elevated))', color: 'rgb(var(--c-muted))' }
}

// One row in the "All habits" comparison list.
function HabitRow({ entry, onOpen }) {
  const h = entry.habit
  const pct = Math.min(100, (h.reps / GOAL) * 100)
  return (
    <button
      onClick={onOpen}
      className="w-full rounded-3xl border border-white/5 bg-surface p-4 text-left transition-transform active:scale-[0.99]"
    >
      <div className="flex items-center gap-2.5">
        <span className="text-lg">{h.emoji || '⛰️'}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{h.title}</span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={scoreChipStyle(entry.score.score)}
        >
          {entry.score.score}
        </span>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-elevated">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted">
        <span>
          {Math.min(h.reps, GOAL)}/{GOAL}
          {h.reps > GOAL ? ` (+${h.reps - GOAL})` : ''}
        </span>
        {entry.streak > 0 && <span className="font-semibold text-accent">🔥 {entry.streak}d</span>}
        {entry.pace.last7 > 0 && <span>{entry.pace.last7} this week</span>}
        <span className="ml-auto">{entry.score.label}</span>
      </div>
    </button>
  )
}

export default function AnalyticsPanel({ habit }) {
  const { def } = useSkin()
  const { habits } = useStore()
  const accent = def.palette.accent
  const [tab, setTab] = useState('habit')
  const [selId, setSelId] = useState(habit?.id)

  const sel = habits.find((h) => h.id === selId) || habit || habits[0]

  const A = useMemo(() => (sel ? analyzeHabit(sel, habits) : null), [sel, habits])
  const P = useMemo(() => (habits.length ? analyzePortfolio(habits) : null), [habits])

  if (!sel || !A) return <p className="py-8 text-center text-sm text-muted">Add a habit to see its analysis.</p>

  // The forecast has its own hero card, so keep it out of the conclusions list.
  const conclusions = A.insights.filter((i) => i.id !== 'forecast' && i.id !== 'summit')
  const weekDelta = A.pace.last7 - A.pace.prev7

  return (
    <div className="space-y-5">
      {/* View switch */}
      <div className="grid grid-cols-2 gap-1 rounded-full bg-surface p-1">
        {[
          ['habit', 'This habit'],
          ['all', 'All habits'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="rounded-full px-3 py-2 text-sm font-semibold transition-colors"
            style={
              tab === id
                ? { background: 'rgb(var(--c-accent))', color: 'rgb(var(--c-base))' }
                : { color: 'rgb(var(--c-muted))' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'habit' ? (
        <>
          {habits.length > 1 && (
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
              {habits.map((h) => {
                const on = h.id === sel.id
                return (
                  <button
                    key={h.id}
                    onClick={() => setSelId(h.id)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      on ? 'border-accent bg-accent-soft text-accent' : 'border-white/5 bg-surface text-muted'
                    }`}
                  >
                    <span>{h.emoji || '⛰️'}</span>
                    <span className="max-w-[8.5rem] truncate">{h.title}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Vital signs */}
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Reps banked" value={`${Math.min(sel.reps, GOAL)}/${GOAL}`} sub={sel.reps > GOAL ? `+${sel.reps - GOAL} bonus` : undefined} subTone="up" />
            <Stat label="Streak" value={`${A.streak}d`} sub={A.streak > 0 && A.streak >= A.longest ? 'personal best' : undefined} subTone="up" />
            <Stat label="Best streak" value={`${A.longest}d`} />
            <Stat label="Hit rate · 4 wks" value={A.w28.rate === null ? '—' : pctLabel(A.w28.rate)} sub={A.w28.scheduled > 0 ? `${A.w28.hit}/${A.w28.scheduled} days` : undefined} />
            <Stat
              label="This week"
              value={A.pace.last7}
              sub={`${weekDelta > 0 ? '+' : ''}${weekDelta} vs last`}
              subTone={weekDelta > 0 ? 'up' : weekDelta < 0 ? 'down' : undefined}
            />
            <Stat label="Consistency" value={A.score.score} sub={A.score.label} subTone={A.score.score >= 65 ? 'up' : A.score.score < 45 ? 'down' : undefined} />
          </div>

          <ForecastCard habit={sel} fc={A.fc} />

          <Section title="Conclusions" hint="read from your history">
            <div className="space-y-2.5">
              {conclusions.length > 0 ? (
                conclusions.map((ins, i) => <InsightCard key={ins.id} ins={ins} index={i} />)
              ) : (
                <p className="rounded-3xl bg-surface p-4 text-xs text-muted">
                  Keep logging — conclusions appear as soon as real patterns emerge.
                </p>
              )}
            </div>
          </Section>

          <Section title="Momentum" hint="reps per week">
            <div className="rounded-3xl bg-surface p-4">
              <WeeklyBars series={A.weekly} />
            </div>
          </Section>

          <Section title="Patterns">
            <div className="space-y-3">
              <div className="rounded-3xl bg-surface p-4">
                <div className="mb-3 text-xs font-semibold text-muted">By weekday</div>
                <WeekdayBars wk={A.wk} />
              </div>
              <div className="rounded-3xl bg-surface p-4">
                <div className="mb-3 text-xs font-semibold text-muted">By time of day</div>
                <DayPartsBar parts={A.parts} />
              </div>
            </div>
          </Section>

          <Section title="The climb" hint={sel.title}>
            <div className="rounded-3xl bg-surface p-4">
              <ClimbChart events={sel.history} accent={accent} goal={GOAL} />
            </div>
          </Section>

          <Section title="Consistency" hint="last 17 weeks">
            <div className="rounded-3xl bg-surface p-4">
              <Heatmap events={sel.history} accent={accent} isScheduled={(d) => isScheduledOn(sel, d)} />
            </div>
          </Section>

          <Section title="Records">
            <div className="grid grid-cols-2 gap-2">
              <Stat
                label="Biggest day"
                value={A.rec.bestDay ? `${A.rec.bestDay.reps} reps` : '—'}
                sub={A.rec.bestDay ? fmtDate(A.rec.bestDay.date) : undefined}
              />
              <Stat label="Active days" value={A.rec.activeDays} sub={`of ${A.pace.ageDays} tracked`} />
              <Stat label="Avg per active day" value={A.rec.activeDays ? A.rec.avgPerActive.toFixed(1) : '—'} />
              <Stat
                label="Longest pause"
                value={A.rec.longestPause > 0 ? `${A.rec.longestPause}d` : '—'}
                sub={A.rec.longestPause > 0 ? 'paused, never reset' : undefined}
              />
            </div>
          </Section>
        </>
      ) : (
        <>
          {/* Portfolio vitals */}
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Lifetime reps" value={P.totalReps} sub={`across ${habits.length} habit${habits.length === 1 ? '' : 's'}`} />
            <Stat
              label="This week"
              value={P.thisWeek}
              sub={`${P.thisWeek - P.lastWeek >= 0 ? '+' : ''}${P.thisWeek - P.lastWeek} vs last`}
              subTone={P.thisWeek > P.lastWeek ? 'up' : P.thisWeek < P.lastWeek ? 'down' : undefined}
            />
            <Stat label="Summits reached" value={P.summits} sub={`of ${habits.length} climbs`} />
            <Stat label="Live streaks" value={P.activeStreaks} sub="2+ days running" />
          </div>

          <Section title="Conclusions" hint="across every habit">
            <div className="space-y-2.5">
              {P.insights.length > 0 ? (
                P.insights.map((ins, i) => <InsightCard key={ins.id} ins={ins} index={i} />)
              ) : (
                <p className="rounded-3xl bg-surface p-4 text-xs text-muted">
                  Keep logging — cross-habit conclusions appear as patterns emerge.
                </p>
              )}
            </div>
          </Section>

          <Section title="Total output" hint="reps per week, all habits">
            <div className="rounded-3xl bg-surface p-4">
              <WeeklyBars series={P.weekly} />
            </div>
          </Section>

          <Section title="Habits compared" hint="tap one to inspect">
            <div className="space-y-2.5">
              {[...P.perHabit]
                .sort((a, b) => b.score.score - a.score.score)
                .map((entry) => (
                  <HabitRow
                    key={entry.habit.id}
                    entry={entry}
                    onOpen={() => {
                      setSelId(entry.habit.id)
                      setTab('habit')
                    }}
                  />
                ))}
            </div>
          </Section>
        </>
      )}
    </div>
  )
}
