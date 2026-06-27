import { useStore } from '../store/StoreProvider.jsx'
import { ACHIEVEMENTS } from '../achievements/achievements.js'

// Stylized vector badge glyphs.
function Glyph({ name }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (name) {
    case 'flag':
      return (<><path {...p} d="M8 21V5" /><path {...p} d="M8 5h9l-2 3 2 3H8" /></>)
    case 'bolt':
      return <path {...p} d="M13 3 5 14h5l-1 7 8-11h-5z" />
    case 'moon':
      return <path {...p} d="M19 14.5A7 7 0 0 1 9.5 5 7 7 0 1 0 19 14.5Z" />
    case 'sun':
      return (<><circle {...p} cx="12" cy="12" r="4" /><path {...p} d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" /></>)
    case 'tent':
      return (<><path {...p} d="M12 4 4 20h16z" /><path {...p} d="M12 4v16" /></>)
    case 'peak':
      return <path {...p} d="M3 19 10 6l3 5 2-3 6 11z" />
    case 'fire':
      return <path {...p} d="M12 3c1 3 4 4 4 8a4 4 0 0 1-8 0c0-1 .4-2 1-2.5C9 11 12 9 12 3Z" />
    case 'compass':
      return (<><circle {...p} cx="12" cy="12" r="9" /><path {...p} d="m15 9-2 5-4 1 2-5z" /></>)
    default:
      return <circle {...p} cx="12" cy="12" r="8" />
  }
}

export default function AchievementsPanel() {
  const { profile } = useStore()
  const unlockedMap = profile.achievements || {}
  const unlockedCount = ACHIEVEMENTS.filter((a) => unlockedMap[a.id]).length

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {unlockedCount} of {ACHIEVEMENTS.length} unlocked
      </p>
      <div className="grid grid-cols-3 gap-3">
        {ACHIEVEMENTS.map((a) => {
          const unlocked = !!unlockedMap[a.id]
          const secret = a.hidden && !unlocked
          return (
            <div
              key={a.id}
              className={`flex flex-col items-center rounded-3xl border p-3 text-center transition-colors ${
                unlocked ? 'border-accent/40 bg-accent-soft' : 'border-white/5 bg-surface'
              }`}
            >
              <div
                className={`grid h-12 w-12 place-items-center rounded-full ${
                  unlocked ? 'text-accent' : 'text-muted/50'
                }`}
                style={{ background: unlocked ? 'rgb(var(--c-accent) / 0.18)' : 'rgb(var(--c-elevated))' }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24">
                  {secret ? (
                    <text x="12" y="17" textAnchor="middle" fontSize="14" fill="currentColor">?</text>
                  ) : (
                    <Glyph name={a.glyph} />
                  )}
                </svg>
              </div>
              <div className="mt-2 text-xs font-semibold text-ink">{secret ? 'Hidden' : a.name}</div>
              <div className="mt-0.5 text-[10px] leading-tight text-muted">
                {secret ? 'Keep climbing to reveal' : a.desc}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
