import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../store/StoreProvider.jsx'
import { audio } from '../audio/AudioEngine.js'
import HabitCard from './HabitCard.jsx'

// Full-viewport horizontal pager. Drag to swipe; snaps to the nearest card on
// release based on offset/velocity. No navbar — the cards are the interface.
export default function HabitCarousel({ onUnlock, paused = false }) {
  const { habits, activeIndex, setActive } = useStore()
  const containerRef = useRef(null)
  const [width, setWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 0))

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const n = habits.length
  const index = Math.min(activeIndex, Math.max(0, n - 1))

  function goTo(i) {
    const ni = Math.max(0, Math.min(n - 1, i))
    if (ni !== index) audio.swipe()
    setActive(ni)
  }

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <motion.div
        className="flex h-full"
        style={{ width: width * n || '100%' }}
        animate={{ x: -index * width }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -(width * (n - 1)), right: 0 }}
        dragElastic={0.12}
        onDragEnd={(_, info) => {
          const threshold = width * 0.18
          if (info.offset.x < -threshold || info.velocity.x < -450) goTo(index + 1)
          else if (info.offset.x > threshold || info.velocity.x > 450) goTo(index - 1)
          else goTo(index)
        }}
      >
        {habits.map((h, i) => (
          <div key={h.id} style={{ width: width || '100%' }} className="h-full shrink-0">
            <HabitCard habit={h} active={i === index} onUnlock={onUnlock} paused={paused} />
          </div>
        ))}
      </motion.div>
    </div>
  )
}
