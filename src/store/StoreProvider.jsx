import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import { loadState, saveState } from './storage.js'
import { applyCompletion } from '../lib/habits.js'
import { evaluate, evaluatePassive } from '../achievements/achievements.js'
import { seedHabits, freshProfile } from '../data/seed.js'

const StoreContext = createContext(null)

function reducer(state, action) {
  switch (action.type) {
    case 'REPLACE_HABIT':
      return {
        ...state,
        habits: state.habits.map((h) => (h.id === action.id ? action.habit : h)),
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
    }
  }, [])

  // Expose `premium` at the top level for convenience — consumers (SkinContext,
  // SettingsPanel, QuestPanel) gate features on it. It lives in profile.premium.
  const value = useMemo(
    () => ({ ...state, premium: !!state.profile?.premium, ...actions }),
    [state, actions],
  )
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
