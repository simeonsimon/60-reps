import { createContext, useContext, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { loadState, saveState } from './storage.js'
import { applyCompletion } from '../lib/habits.js'
import { evaluate, evaluatePassive } from '../achievements/achievements.js'
import { seedHabits, freshProfile } from '../data/seed.js'
import { hasToken } from '../lib/github.js'
import { pullSweeps, pruneSweeps, backupState } from '../lib/syncEngine.js'

// Two scoped contexts instead of one god store: habit consumers (carousel,
// cards, analytics) must not re-render when only the profile changes, and
// profile consumers (skins, settings, premium gates) must not re-render on
// every rep. Actions are stable and ride along in both.
const HabitsContext = createContext(null)
const ProfileContext = createContext(null)

function reducer(state, action) {
  switch (action.type) {
    case 'REPLACE_HABIT':
      return {
        ...state,
        habits: state.habits.map((h) => (h.id === action.id ? action.habit : h)),
      }
    case 'PATCH_HABIT':
      return {
        ...state,
        habits: state.habits.map((h) => (h.id === action.id ? { ...h, ...action.patch } : h)),
      }
    case 'ADD_HABIT':
      return { ...state, habits: [...state.habits, action.habit], activeIndex: state.habits.length }
    case 'REMOVE_HABIT': {
      const habits = state.habits.filter((h) => h.id !== action.id)
      return { ...state, habits, activeIndex: Math.min(state.activeIndex, Math.max(0, habits.length - 1)) }
    }
    case 'SET_ACTIVE':
      return { ...state, activeIndex: action.index }
    case 'SET_PROFILE':
      return { ...state, profile: { ...state.profile, ...action.patch } }
    case 'UNLOCK': {
      const achievements = { ...state.profile.achievements }
      let changed = false
      for (const id of action.ids) {
        if (!achievements[id]) {
          achievements[id] = action.now
          changed = true
        }
      }
      if (!changed) return state
      return { ...state, profile: { ...state.profile, achievements } }
    }
    case 'BUMP_TAPS':
      return {
        ...state,
        profile: { ...state.profile, stats: { ...state.profile.stats, totalTaps: (state.profile.stats?.totalTaps || 0) + 1 } },
      }
    case 'APPLY_SWEEP':
      return {
        ...state,
        habits: action.habits,
        profile: { ...state.profile, syncedTicks: action.syncedTicks },
      }
    case 'RESTORE':
      return {
        habits: action.state.habits,
        profile: { ...freshProfile(), ...action.state.profile },
        activeIndex: 0,
      }
    case 'RESET':
      return { habits: seedHabits(), profile: freshProfile(), activeIndex: 0 }
    default:
      return state
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, loadState)
  const stateRef = useRef(state)
  stateRef.current = state
  const lastCompleteRef = useRef(0)

  // Persist on every change.
  useEffect(() => {
    saveState(state)
  }, [state])

  // Award passive achievements once on mount (e.g. seeded habits already past 30).
  useEffect(() => {
    const ids = evaluatePassive(stateRef.current)
    if (ids.length) dispatch({ type: 'UNLOCK', ids, now: Date.now() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Apple Reminders sync ──────────────────────────────────────────────────
  const [sync, setSync] = useState({ status: hasToken() ? 'idle' : 'off', message: '', unmatched: [], at: null })

  const syncNow = useCallback(async () => {
    if (!hasToken()) {
      setSync({ status: 'off', message: 'Add a GitHub token below to turn sync on.', unmatched: [], at: null })
      return
    }
    setSync((s) => ({ ...s, status: 'syncing', message: '' }))
    try {
      const result = await pullSweeps(stateRef.current)
      const ticks = result?.appliedTicks || 0
      if (result && (ticks > 0 || JSON.stringify(result.syncedTicks) !== JSON.stringify(stateRef.current.profile.syncedTicks || {}))) {
        dispatch({ type: 'APPLY_SWEEP', habits: result.habits, syncedTicks: result.syncedTicks })
      }
      setSync({
        status: 'ok',
        message: ticks ? `Logged ${ticks} tick${ticks === 1 ? '' : 's'} from Reminders.` : 'Up to date.',
        unmatched: result?.unmatched || [],
        at: Date.now(),
      })
      pruneSweeps().catch(() => {})
    } catch (err) {
      setSync({ status: 'error', message: err.message, unmatched: [], at: Date.now() })
    }
  }, [])

  // Pull on launch, and again whenever the app comes back to the foreground —
  // the sweep runs at night, so the ticks are usually waiting the next morning.
  useEffect(() => {
    if (!hasToken()) return
    syncNow()
    const onVisible = () => {
      if (document.visibilityState === 'visible') syncNow()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [syncNow])

  // Mirror the store to the repo once the tapping stops, so a single rep
  // doesn't cost a commit of its own.
  const [backupError, setBackupError] = useState('')
  useEffect(() => {
    if (!hasToken()) return
    const id = setTimeout(() => {
      backupState(stateRef.current).then(
        () => setBackupError(''),
        (err) => setBackupError(err.message),
      )
    }, 30000)
    return () => clearTimeout(id)
  }, [state])

  const actions = useMemo(() => {
    return {
      /**
       * Run one completion interaction. Returns
       * { meta, unlocked } so the caller can drive particles / audio / toasts.
       */
      complete(id) {
        const cur = stateRef.current
        const habit = cur.habits.find((h) => h.id === id)
        if (!habit) return { meta: { repsGained: 0, blocked: true }, unlocked: [] }

        const now = Date.now()
        const { habit: nextHabit, meta } = applyCompletion(habit, now)
        dispatch({ type: 'BUMP_TAPS' })

        if (meta.blocked) return { meta, unlocked: [] }

        dispatch({ type: 'REPLACE_HABIT', id, habit: nextHabit })

        const gapMs = now - lastCompleteRef.current
        lastCompleteRef.current = now

        // Evaluate achievements against the would-be next state.
        const nextState = { ...cur, habits: cur.habits.map((h) => (h.id === id ? nextHabit : h)) }
        const candidates = evaluate(nextState, { habit: nextHabit, meta, now, gapMs })
        const unlocked = candidates.filter((aid) => !cur.profile.achievements[aid])
        if (unlocked.length) dispatch({ type: 'UNLOCK', ids: unlocked, now })

        return { meta, unlocked }
      },
      addHabit(habit) {
        dispatch({ type: 'ADD_HABIT', habit })
      },
      updateHabit(id, patch) {
        dispatch({ type: 'PATCH_HABIT', id, patch })
      },
      removeHabit(id) {
        dispatch({ type: 'REMOVE_HABIT', id })
      },
      setActive(index) {
        dispatch({ type: 'SET_ACTIVE', index })
      },
      setProfile(patch) {
        dispatch({ type: 'SET_PROFILE', patch })
      },
      reset() {
        dispatch({ type: 'RESET' })
      },
      restore(next) {
        dispatch({ type: 'RESTORE', state: next })
      },
    }
  }, [])

  const habitsValue = useMemo(
    () => ({
      habits: state.habits,
      activeIndex: state.activeIndex,
      complete: actions.complete,
      addHabit: actions.addHabit,
      updateHabit: actions.updateHabit,
      removeHabit: actions.removeHabit,
      setActive: actions.setActive,
    }),
    [state.habits, state.activeIndex, actions],
  )

  // Expose `premium` at the top level for convenience — consumers (SkinContext,
  // SettingsPanel, QuestPanel) gate features on it. It lives in profile.premium.
  const profileValue = useMemo(
    () => ({
      profile: state.profile,
      premium: !!state.profile?.premium,
      setProfile: actions.setProfile,
      reset: actions.reset,
      restore: actions.restore,
      sync,
      syncNow,
      backupError,
    }),
    [state.profile, actions, sync, syncNow, backupError],
  )

  return (
    <HabitsContext.Provider value={habitsValue}>
      <ProfileContext.Provider value={profileValue}>{children}</ProfileContext.Provider>
    </HabitsContext.Provider>
  )
}

export function useHabits() {
  const ctx = useContext(HabitsContext)
  if (!ctx) throw new Error('useHabits must be used within StoreProvider')
  return ctx
}

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used within StoreProvider')
  return ctx
}
