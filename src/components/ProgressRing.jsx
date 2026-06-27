// Generic SVG progress ring. value is 0..1. Reused for the 60-rep goal ring
// and the long-press "charging" overlay.
export default function ProgressRing({
  value = 0,
  size = 96,
  stroke = 8,
  trackColor = 'rgb(var(--c-elevated))',
  color = 'rgb(var(--c-accent))',
  children,
  className = '',
  glow = false,
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, value))
  const dash = c * clamped

  return (
    <div className={`relative inline-grid place-items-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" style={glow ? { filter: 'drop-shadow(0 0 8px rgb(var(--c-accent)))' } : undefined}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{ transition: 'stroke-dasharray 0.12s linear' }}
        />
      </svg>
      {children != null && <div className="absolute inset-0 grid place-items-center">{children}</div>}
    </div>
  )
}
