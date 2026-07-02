import { useRef } from 'react'
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion'
import { CloseIcon } from './icons.jsx'

// Draggable bottom sheet used for Quests, Stats, Trophies, Skins, and Add.
//
// iOS notes:
// - The body must scroll natively, so NOTHING here may set touch-action on the
//   sheet container (framer's `drag` prop force-writes `touch-action: pan-x`,
//   which kills finger-scrolling — mouse wheels are unaffected, so desktop
//   hides the bug). Swipe-to-dismiss is therefore implemented manually with
//   pointer events on the grab-bar/header only.
// - `overscroll-contain` stops sheet scrolling from rubber-banding the page.
export default function Sheet({ open, onClose, title, children }) {
  const y = useMotionValue(0) // manual drag offset, separate from enter/exit
  const velRef = useRef(0)

  function startDrag(e) {
    if (e.button !== undefined && e.button !== 0) return
    const el = e.currentTarget
    const startY = e.clientY
    let lastY = e.clientY
    let lastT = performance.now()
    velRef.current = 0
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* synthetic events have no active pointer — listeners below still work */
    }
    const move = (ev) => {
      const now = performance.now()
      velRef.current = ((ev.clientY - lastY) / Math.max(1, now - lastT)) * 1000
      lastY = ev.clientY
      lastT = now
      y.set(Math.max(0, ev.clientY - startY)) // only drag downward
    }
    const end = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', end)
      el.removeEventListener('pointercancel', end)
      if (y.get() > 120 || velRef.current > 600) {
        onClose()
        // reset for the next open; the exit animation carries it off-screen
        setTimeout(() => y.set(0), 350)
      } else {
        animate(y, 0, { type: 'spring', stiffness: 340, damping: 36 })
      }
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', end)
    el.addEventListener('pointercancel', end)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          {/* Outer layer: enter/exit slide. Inner layer: manual drag offset. */}
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 36 }}
          >
            <motion.div
              style={{ y }}
              className="flex max-h-[88dvh] flex-col rounded-t-5xl border-t border-white/10 bg-base shadow-card"
            >
              {/* Drag handle: grab bar + header. touch-action none here (and
                  only here) so the dismiss gesture wins over native panning. */}
              <div
                className="shrink-0 cursor-grab select-none px-5 pt-3 active:cursor-grabbing"
                style={{ touchAction: 'none' }}
                onPointerDown={startDrag}
              >
                <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-elevated" />
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
                  <button
                    onClick={onClose}
                    aria-label="Close"
                    className="rounded-full p-1.5 text-muted transition-colors hover:text-ink"
                  >
                    <CloseIcon />
                  </button>
                </div>
              </div>

              {/* Natively scrollable body. */}
              <div
                className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5"
                style={{
                  overscrollBehavior: 'contain',
                  WebkitOverflowScrolling: 'touch',
                  paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)',
                }}
              >
                {children}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
