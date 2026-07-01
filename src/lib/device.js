// Small device/environment helpers shared by the 3D scene, install hint and
// push-notification flow.

export function isTouchDevice() {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
}

export function isIos() {
  if (typeof navigator === 'undefined') return false
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ reports as Mac but is touch-capable
    (navigator.userAgent.includes('Mac') && navigator.maxTouchPoints > 1)
  )
}

// True when launched from the Home Screen (installed PWA) — required for
// notifications on iOS.
export function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Renderer pixel-ratio cap: phones get 1.5 (crisp at ~460 ppi, roughly half
// the GPU work of native 3x), everything else up to 2.
export function maxDpr() {
  return isTouchDevice() ? 1.5 : 2
}
