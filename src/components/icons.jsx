// Minimal inline stroke-icon set. All inherit `currentColor` so they pick up
// the active skin's text/accent tokens.
const base = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export const BookIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H20v14H6a2 2 0 0 0-2 2z" />
    <path d="M4 5.5V19a1.5 1.5 0 0 0 1.5 1.5H20" />
  </svg>
)

export const ChartIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 19V5" />
    <path d="M4 15l4-4 4 3 7-7" />
    <path d="M19 7v4h-4" />
  </svg>
)

export const TrophyIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M7 4h10v4a5 5 0 0 1-10 0z" />
    <path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" />
    <path d="M12 13v3M9 20h6M10 20v-1.5a2 2 0 0 1 4 0V20" />
  </svg>
)

export const PaletteIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3a9 9 0 1 0 0 18 2 2 0 0 0 2-2 1.8 1.8 0 0 1 1.8-1.8H18a3 3 0 0 0 3-3A8 8 0 0 0 12 3Z" />
    <circle cx="7.5" cy="11.5" r="1" fill="currentColor" />
    <circle cx="10.5" cy="7.5" r="1" fill="currentColor" />
    <circle cx="14.5" cy="7.5" r="1" fill="currentColor" />
  </svg>
)

export const PlusIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const CloseIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export const MountainIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M3 20l6.5-12 4 7 2.5-4L21 20z" />
    <path d="M8 12.5l1.5-2.5" />
  </svg>
)

export const SoundOnIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 9v6h4l5 4V5L8 9z" />
    <path d="M16 9a3 3 0 0 1 0 6M18.5 7a6 6 0 0 1 0 10" />
  </svg>
)

export const SoundOffIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 9v6h4l5 4V5L8 9z" />
    <path d="M22 9l-5 6M17 9l5 6" />
  </svg>
)

export const FlameIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3c1 3 4 4 4 8a4 4 0 0 1-8 0c0-1 .4-2 1-2.5C9 11 12 9 12 3Z" />
  </svg>
)

export const TrashIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
    <path d="M10 11v6M14 11v6" />
  </svg>
)
