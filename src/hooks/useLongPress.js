import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Click-and-hold gesture. Tracks hold progress 0→1 over `duration` ms via
 * requestAnimationFrame, fires escalating haptic pulses through
 * navigator.vibrate, and resolves onComplete when the hold matures. Releasing
 * early calls onCancel. Returns spreadable pointer handlers plus live state.
 */
export function useLongPress({
  duration = 850,
  disabled = false,
  onStart,
  onProgress,
  onComplete,
  onCancel,
} = {}) {
  const [holding, setHolding] = useState(false)
  const [progress, setProgress] = useState(0)
  const rafRef = useRef(0)
  const startRef = useRef(0)
  const lastVibrateRef = useRef(0)
  const doneRef = useRef(false)

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
  }, [])

  const tick = useCallback(
    (now) => {
      // Clamp low too: the first rAF timestamp can predate the performance.now()
      // captured in begin(), which would briefly yield a negative progress.
      const elapsed = now - startRef.current
      const p = Math.min(Math.max(elapsed / duration, 0), 1)
      setProgress(p)
      onProgress?.(p)

      // Escalating haptics: pulses get closer together as the hold matures.
      const interval = 140 - p * 90
      if (navigator.vibrate && now - lastVibrateRef.current > interval) {
        lastVibrateRef.current = now
        navigator.vibrate(Math.round(6 + p * 14))
      }

      if (p >= 1) {
        if (!doneRef.current) {
          doneRef.current = true
          navigator.vibrate?.([0, 35, 25, 55])
          onComplete?.()
        }
        setHolding(false)
        setProgress(0)
        stop()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    },
    [duration, onComplete, onProgress, stop],
  )

  const begin = useCallback(
    (e) => {
      if (disabled) return
      // Only respond to primary button / touch / pen.
      if (e.button != null && e.button !== 0) return
      // NB: intentionally no setPointerCapture — capturing would steal the
      // pointer stream from the carousel's swipe handler. We cancel the hold on
      // horizontal movement instead (see the card's onPointerMove).
      doneRef.current = false
      startRef.current = performance.now()
      lastVibrateRef.current = 0
      setHolding(true)
      setProgress(0)
      onStart?.()
      stop()
      rafRef.current = requestAnimationFrame(tick)
    },
    [disabled, onStart, stop, tick],
  )

  const end = useCallback(() => {
    if (!holding) return
    stop()
    if (!doneRef.current) {
      // released early
      onCancel?.()
    }
    setHolding(false)
    setProgress(0)
  }, [holding, onCancel, stop])

  useEffect(() => () => stop(), [stop])

  const cancel = useCallback(() => {
    if (!holding) return
    stop()
    doneRef.current = true // suppress onCancel/onComplete for an aborted hold
    setHolding(false)
    setProgress(0)
  }, [holding, stop])

  const handlers = {
    onPointerDown: begin,
    onPointerUp: end,
    onPointerLeave: end,
    onPointerCancel: end,
  }

  return { handlers, holding, progress, cancel }
}
