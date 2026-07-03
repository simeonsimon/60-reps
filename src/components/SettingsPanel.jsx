import { useStore } from '../store/StoreProvider.jsx'
import { useSkin, SKIN_LIST } from '../context/SkinContext.jsx'
import ReminderSettings from './ReminderSettings.jsx'

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="relative h-7 w-12 rounded-full transition-colors"
      style={{ background: checked ? 'rgb(var(--c-accent))' : 'rgb(var(--c-elevated))' }}
      role="switch"
      aria-checked={checked}
    >
      <span
        className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all"
        style={{ left: checked ? '1.75rem' : '0.25rem' }}
      />
    </button>
  )
}

function Row({ label, hint, children }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-surface px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-ink">{label}</div>
        {hint && <div className="text-xs text-muted">{hint}</div>}
      </div>
      {children}
    </div>
  )
}

export default function SettingsPanel() {
  const { profile, premium, setProfile, reset } = useStore()
  const { skin, setSkin } = useSkin()

  return (
    <div className="space-y-5">
      {/* Premium tier */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Tier</h4>
        <Row label="Super! Boring" hint="Unlock skins, quests, premium audio & badges">
          <Toggle checked={premium} onChange={(v) => setProfile({ premium: v })} />
        </Row>
      </div>

      {/* Per-habit push reminders */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Reminders</h4>
        <ReminderSettings />
      </div>

      {/* Skins */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Skin</h4>
        <div className="grid grid-cols-2 gap-3">
          {SKIN_LIST.map((s) => {
            const locked = !premium && !s.free
            const isActive = skin === s.id
            return (
              <button
                key={s.id}
                onClick={() => setSkin(s.id)}
                disabled={locked}
                className={`relative overflow-hidden rounded-3xl border p-4 text-left transition-all ${
                  isActive ? 'border-accent' : 'border-white/5'
                } ${locked ? 'opacity-50' : ''}`}
                style={{ background: 'rgb(var(--c-surface))' }}
              >
                <span className="mb-2 inline-block h-6 w-6 rounded-full" style={{ background: s.swatch }} />
                <div className="text-sm font-bold text-ink">{s.name}</div>
                <div className="text-[11px] leading-tight text-muted">{s.blurb}</div>
                {locked && <span className="absolute right-3 top-3 text-xs">🔒</span>}
                {isActive && <span className="absolute right-3 top-3 text-xs text-accent">●</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Audio */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Audio</h4>
        <div className="space-y-2">
          <Row label="Sound effects" hint="Synthesized premium SFX">
            <Toggle checked={profile.sound} onChange={(v) => setProfile({ sound: v })} />
          </Row>
          <Row label="Play when silenced" hint="Override the device's mute switch">
            <Toggle checked={profile.overrideMute} onChange={(v) => setProfile({ overrideMute: v })} />
          </Row>
        </div>
      </div>

      {/* Danger zone */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Data</h4>
        <button
          onClick={() => {
            if (window.confirm('Reset all habits and progress back to the starting three?')) reset()
          }}
          className="w-full rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300"
        >
          Reset all data
        </button>
      </div>

      <p className="pb-1 text-center text-xs text-muted">60 Reps v{__APP_VERSION__}</p>
    </div>
  )
}
