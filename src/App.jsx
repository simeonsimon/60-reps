import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from './store/StoreProvider.jsx'
import { useSkin } from './context/SkinContext.jsx'
import { audio } from './audio/AudioEngine.js'
import HabitCarousel from './components/HabitCarousel.jsx'
import Sheet from './components/Sheet.jsx'
import AnalyticsPanel from './components/AnalyticsPanel.jsx'
import QuestPanel from './components/QuestPanel.jsx'
import AchievementsPanel from './components/AchievementsPanel.jsx'
import SettingsPanel from './components/SettingsPanel.jsx'
import AddHabitPanel from './components/AddHabitPanel.jsx'
import ImportPanel from './components/ImportPanel.jsx'
import { ACHIEVEMENT_MAP } from './achievements/achievements.js'
import {
  BookIcon,
  ChartIcon,
  TrophyIcon,
  PaletteIcon,
  PlusIcon,
  MountainIcon,
} from './components/icons.jsx'

function DockButton({ children, label, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="grid h-11 w-11 place-items-center rounded-full text-muted transition-colors hover:text-ink active:scale-95"
    >
      {children}
    </button>
  )
}

export default function App() {
  const { habits, activeIndex, profile } = useStore()
  const { def } = useSkin()
  const [sheet, setSheet] = useState(null)
  const [toasts, setToasts] = useState([])

  // Keep the audio engine in sync with the master sound toggle.
  useEffect(() => {
    audio.setEnabled(!!profile.sound)
  }, [profile.sound])

  // Dismiss the inline boot screen (index.html) once the app has painted.
  useEffect(() => {
    const boot = document.getElementById('boot')
    if (!boot) return
    boot.classList.add('boot-done')
    const t = setTimeout(() => boot.remove(), 450)
    return () => clearTimeout(t)
  }, [])

  const index = Math.min(activeIndex, Math.max(0, habits.length - 1))
  const active = habits[index]

  function handleUnlock(ids) {
    ids.forEach((id) => {
      const a = ACHIEVEMENT_MAP[id]
      if (!a) return
      const tid = Math.random().toString(36).slice(2)
      setToasts((x) => [...x, { id: tid, name: `${a.name} unlocked`, icon: '🏅' }])
      setTimeout(() => setToasts((x) => x.filter((z) => z.id !== tid)), 3200)
    })
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-base">
      {/* Ambient accent glow tied to the active skin */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-700"
        style={{ background: 'radial-gradient(120% 75% at 50% -12%, rgb(var(--c-accent) / 0.16), transparent 60%)' }}
      />

      {/* Top bar (minimal, floating) */}
      <header
        className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <div className="flex items-center gap-2 text-ink">
          <span className="text-accent">
            <MountainIcon width={20} height={20} />
          </span>
          <span className="font-display text-base font-extrabold tracking-tight">60 Reps</span>
        </div>
        <button
          onClick={() => setSheet('skins')}
          className="flex items-center gap-2 rounded-full bg-surface/70 px-3 py-1.5 text-xs font-medium text-muted backdrop-blur"
        >
          <span className="h-3 w-3 rounded-full" style={{ background: def.swatch }} />
          {def.name}
        </button>
      </header>

      {/* Achievement toasts */}
      <div
        className="pointer-events-none absolute inset-x-0 z-40 flex flex-col items-center gap-2 px-4"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 3.25rem)' }}
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-2 rounded-full bg-surface/90 px-4 py-2 text-sm font-medium text-ink shadow-card backdrop-blur"
            >
              <span className="text-accent">{t.icon || '🏅'}</span> {t.name}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Main pager */}
      <main className="relative min-h-0 flex-1">
        {habits.length > 0 ? (
          <HabitCarousel onUnlock={handleUnlock} paused={sheet !== null} />
        ) : (
          <div className="grid h-full place-items-center px-8 text-center">
            <div className="flex flex-col items-center">
              <span className="text-accent/80">
                <MountainIcon width={44} height={44} />
              </span>
              <h2 className="mt-4 font-display text-xl font-extrabold text-ink">Every summit starts flat</h2>
              <p className="mt-1.5 max-w-[26ch] text-sm text-muted">
                Pick one thing worth 60 reps. Missed days pause the climb — they never reset it.
              </p>
              <button
                onClick={() => setSheet('add')}
                className="mt-6 rounded-full bg-accent px-7 py-3 text-sm font-bold shadow-glow transition-transform active:scale-95"
                style={{ color: 'rgb(var(--c-base))' }}
              >
                Start your first climb
              </button>
              <button
                onClick={() => setSheet('import')}
                className="mt-3 text-xs font-medium text-muted underline underline-offset-2"
              >
                Import from Apple Reminders
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Bottom dock: page dots + action bar */}
      <div
        className="relative z-30 px-4 pt-1"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.875rem)' }}
      >
        {habits.length > 1 && (
          <div className="mb-3 flex justify-center gap-1.5">
            {habits.map((h, i) => (
              <span
                key={h.id}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === index ? '1.25rem' : '0.375rem',
                  background: i === index ? 'rgb(var(--c-accent))' : 'rgb(var(--c-elevated))',
                }}
              />
            ))}
          </div>
        )}
        <div className="mx-auto flex max-w-sm items-center justify-around rounded-full border border-white/5 bg-surface/80 px-2 py-1.5 shadow-card backdrop-blur-xl">
          <DockButton label="Quest book" onClick={() => setSheet('quest')}>
            <BookIcon />
          </DockButton>
          <DockButton label="Stats" onClick={() => setSheet('stats')}>
            <ChartIcon />
          </DockButton>
          <button
            onClick={() => setSheet('add')}
            aria-label="Add habit"
            className="grid h-12 w-12 place-items-center rounded-full bg-accent shadow-glow transition-transform active:scale-95"
            style={{ color: 'rgb(var(--c-base))' }}
          >
            <PlusIcon width={24} height={24} />
          </button>
          <DockButton label="Trophies" onClick={() => setSheet('trophies')}>
            <TrophyIcon />
          </DockButton>
          <DockButton label="Skins & settings" onClick={() => setSheet('skins')}>
            <PaletteIcon />
          </DockButton>
        </div>
      </div>

      {/* Sheets */}
      <Sheet open={sheet === 'quest'} onClose={() => setSheet(null)} title="Quest Book">
        <QuestPanel habit={active} />
      </Sheet>
      <Sheet open={sheet === 'stats'} onClose={() => setSheet(null)} title="Analytics">
        <AnalyticsPanel habit={active} />
      </Sheet>
      <Sheet open={sheet === 'trophies'} onClose={() => setSheet(null)} title="Achievements">
        <AchievementsPanel />
      </Sheet>
      <Sheet open={sheet === 'skins'} onClose={() => setSheet(null)} title="Skins & Settings">
        <SettingsPanel />
      </Sheet>
      <Sheet open={sheet === 'add'} onClose={() => setSheet(null)} title="New Habit">
        <AddHabitPanel onClose={() => setSheet(null)} onImport={() => setSheet('import')} />
      </Sheet>
      <Sheet open={sheet === 'import'} onClose={() => setSheet(null)} title="Import Reminders">
        <ImportPanel
          onClose={(added) => {
            setSheet(null)
            if (added > 0) {
              const tid = Math.random().toString(36).slice(2)
              setToasts((x) => [...x, { id: tid, name: `${added} habit${added === 1 ? '' : 's'} imported`, icon: '⛰️' }])
              setTimeout(() => setToasts((x) => x.filter((z) => z.id !== tid)), 3200)
            }
          }}
        />
      </Sheet>
    </div>
  )
}
