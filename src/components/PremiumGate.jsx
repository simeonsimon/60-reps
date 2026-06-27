import { useStore } from '../store/StoreProvider.jsx'

// Shown in place of a premium feature when the Super! Boring tier is off.
export default function PremiumGate({ feature, blurb }) {
  const { setProfile } = useStore()
  return (
    <div className="rounded-3xl border border-accent/30 bg-accent-soft p-6 text-center">
      <div className="text-3xl">✦</div>
      <h4 className="mt-2 font-display text-lg font-bold text-ink">{feature}</h4>
      <p className="mx-auto mt-1 max-w-xs text-sm text-muted">{blurb}</p>
      <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-accent">Super! Boring tier</p>
      <button
        onClick={() => setProfile({ premium: true })}
        className="mt-4 rounded-full bg-accent px-6 py-2.5 text-sm font-bold"
        style={{ color: 'rgb(var(--c-base))' }}
      >
        Unlock everything
      </button>
    </div>
  )
}
