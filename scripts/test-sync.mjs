import { parseSweepFiles, reconcileSweep, normalizeTitle } from '../src/lib/remindersSync.js'

let pass = 0
let fail = 0
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ', name) }
  else { fail++; console.log('  FAIL', name, extra !== undefined ? JSON.stringify(extra) : '') }
}

const DAY = 86400000
const NOW = new Date(2026, 6, 31, 21, 30, 0).getTime() // 2026-07-31 21:30 local
const TODAY = '2026-07-31'
const YESTERDAY = '2026-07-30'

function habit(over) {
  return { id: 'h', title: 'Gym', type: 'single', reps: 5, history: [], lastCompletedAt: null, sessionValue: 0, ...over }
}
function state(habits, ticks) {
  return { habits, profile: { syncedTicks: ticks || {} } }
}
const dayOf = (t) => new Date(t).toISOString().slice(0, 10)

console.log('\nnormalizeTitle')
check('accents stripped without joining words', normalizeTitle('Leer 20 páginas') === 'leer 20 paginas', normalizeTitle('Leer 20 páginas'))
check('emoji stripped', normalizeTitle('Gym 💪') === 'gym', normalizeTitle('Gym 💪'))
check('punctuation becomes a gap', normalizeTitle('Chem-paper') === 'chem paper', normalizeTitle('Chem-paper'))
check('case + spacing', normalizeTitle('  GYM   ') === 'gym')

console.log('\nparseSweepFiles')
{
  const byDate = parseSweepFiles([
    { name: `${TODAY}--100.txt`, text: 'Gym\nRead' },
    { name: `${TODAY}--200.txt`, text: 'Gym\nRead\nStretch' },
    { name: `${YESTERDAY}--150.txt`, text: 'Gym' },
    { name: 'README.md', text: 'nope' },
  ])
  check('newest file per date wins', byDate[TODAY].length === 3, byDate[TODAY])
  check('other dates kept', byDate[YESTERDAY].length === 1)
  check('non-sweep files ignored', Object.keys(byDate).length === 2, Object.keys(byDate))
}

console.log('\nreconcile — single')
{
  const r = reconcileSweep(state([habit()]), { [TODAY]: ['Gym'] }, NOW)
  check('one tick = one rep', r.habits[0].reps === 6, r.habits[0].reps)
  check('history lands on the swept day', dayOf(r.habits[0].history[0].t) === TODAY, dayOf(r.habits[0].history[0].t))
  check('tick recorded', r.syncedTicks[`${TODAY}|h`] === 1, r.syncedTicks)

  const again = reconcileSweep(state(r.habits, r.syncedTicks), { [TODAY]: ['Gym'] }, NOW)
  check('replaying the same file is a no-op', again.habits[0].reps === 6, again.habits[0].reps)

  const twice = reconcileSweep(state([habit()]), { [TODAY]: ['Gym', 'Gym'] }, NOW)
  check('single caps at one rep per day', twice.habits[0].reps === 6, twice.habits[0].reps)
}

console.log('\nreconcile — already tapped in the app')
{
  const tapped = habit({ reps: 6, history: [{ t: NOW - 3600000, amount: 1 }], lastCompletedAt: NOW - 3600000 })
  const r = reconcileSweep(state([tapped]), { [TODAY]: ['Gym'] }, NOW)
  check('in-app rep is not double counted', r.habits[0].reps === 6, r.habits[0].reps)
  check('no duplicate history entry', r.habits[0].history.length === 1, r.habits[0].history.length)
}

console.log('\nreconcile — multi')
{
  const m = habit({ type: 'multi', reps: 10 })
  const r = reconcileSweep(state([m]), { [TODAY]: ['Gym', 'Gym', 'Gym'] }, NOW)
  check('three ticks = three reps', r.habits[0].reps === 13, r.habits[0].reps)

  const grew = reconcileSweep(state(r.habits, r.syncedTicks), { [TODAY]: ['Gym', 'Gym', 'Gym', 'Gym'] }, NOW)
  check('a later sweep adds only the difference', grew.habits[0].reps === 14, grew.habits[0].reps)
}

console.log('\nreconcile — yesterday backfill')
{
  const h = habit({ reps: 5, history: [{ t: NOW - 3600000, amount: 1 }], lastCompletedAt: NOW - 3600000 })
  const r = reconcileSweep(state([h]), { [YESTERDAY]: ['Gym'] }, NOW)
  check('backfills the missed day', r.habits[0].reps === 6, r.habits[0].reps)
  check('lastCompletedAt does not move backwards', r.habits[0].lastCompletedAt === NOW - 3600000, r.habits[0].lastCompletedAt)
  check('history stays chronological', r.habits[0].history.every((e, i, a) => i === 0 || a[i - 1].t <= e.t))
  check('backfilled entry is dated yesterday', dayOf(r.habits[0].history[0].t) === YESTERDAY, dayOf(r.habits[0].history[0].t))
}

console.log('\nreconcile — progress')
{
  const p = habit({ id: 'ft', title: '100 Free Throws', type: 'progress', target: 100, step: 20, reps: 3, sessionValue: 80 })
  const r = reconcileSweep(state([p]), { [TODAY]: ['100 Free Throws'] }, NOW)
  check('a tick adds one step and fills the session', r.habits[0].reps === 4, r.habits[0].reps)
  check('session rolls over', r.habits[0].sessionValue === 0, r.habits[0].sessionValue)

  const replay = reconcileSweep(state(r.habits, r.syncedTicks), { [TODAY]: ['100 Free Throws'] }, NOW)
  check('progress replay is a no-op', replay.habits[0].reps === 4 && replay.habits[0].sessionValue === 0, [replay.habits[0].reps, replay.habits[0].sessionValue])
}

console.log('\nreconcile — matching')
{
  const h = habit({ title: 'Leer 20 paginas' })
  const r = reconcileSweep(state([h]), { [TODAY]: ['Leer 20 páginas 📚', 'Meditar'] }, NOW)
  check('accented reminder matches plain habit', r.habits[0].reps === 6, r.habits[0].reps)
  check('unknown reminder surfaces as unmatched', r.unmatched.length === 1 && r.unmatched[0] === 'Meditar', r.unmatched)
}

console.log('\nreconcile — ordering across days')
{
  const m = habit({ type: 'multi', reps: 0 })
  const r = reconcileSweep(state([m]), { [TODAY]: ['Gym'], [YESTERDAY]: ['Gym'] }, NOW)
  check('both days applied', r.habits[0].reps === 2, r.habits[0].reps)
  check('history ordered oldest first', dayOf(r.habits[0].history[0].t) === YESTERDAY, r.habits[0].history.map((e) => dayOf(e.t)))
}

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
