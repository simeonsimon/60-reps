import { motion, AnimatePresence } from 'framer-motion'
import { CloseIcon } from './icons.jsx'

// Draggable bottom sheet used for Quests, Stats, Trophies, Skins, and Add.
export default function Sheet({ open, onClose, title, children }) {
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
          <motion.div
            className="no-scrollbar fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-5xl border-t border-white/10 bg-base px-5 pt-3 shadow-card"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 36 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose()
            }}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-elevated" />
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
              <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted transition-colors hover:text-ink">
                <CloseIcon />
              </button>
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
