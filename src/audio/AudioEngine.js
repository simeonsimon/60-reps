/**
 * Web Audio engine. All sounds are synthesized at runtime (no asset files), so
 * the app stays a single self-contained build and works offline. The
 * AudioContext is created lazily on the first user gesture to satisfy browser
 * autoplay policies.
 */
class AudioEngine {
  constructor() {
    this.ctx = null
    this.master = null
    this.enabled = true
  }

  _ensure() {
    if (this.ctx) return
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    this.ctx = new Ctx()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.18
    this.master.connect(this.ctx.destination)
  }

  // Call from a user gesture (pointerdown) to unlock audio.
  resume() {
    this._ensure()
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume()
  }

  setEnabled(on) {
    this.enabled = on
  }

  _blip({ freq = 440, type = 'sine', dur = 0.12, gain = 1, at = 0, glideTo = null }) {
    if (!this.enabled) return
    this._ensure()
    if (!this.ctx) return
    const t0 = this.ctx.currentTime + at
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g)
    g.connect(this.master)
    osc.start(t0)
    osc.stop(t0 + dur + 0.02)
  }

  // A soft tick as a progress step lands.
  tick() {
    this._blip({ freq: 320, type: 'triangle', dur: 0.07, gain: 0.5, glideTo: 380 })
  }

  // The rising hum while holding to complete (called repeatedly, cheap).
  hold(intensity = 0) {
    const base = 180 + intensity * 220
    this._blip({ freq: base, type: 'sawtooth', dur: 0.06, gain: 0.12 + intensity * 0.1 })
  }

  // A satisfying chord when a rep is earned.
  complete() {
    if (!this.enabled) return
    const notes = [523.25, 659.25, 783.99] // C5 E5 G5
    notes.forEach((f, i) => this._blip({ freq: f, type: 'triangle', dur: 0.5, gain: 0.7, at: i * 0.04, glideTo: f * 1.01 }))
  }

  // Bigger arpeggio for hitting the 60 summit.
  summit() {
    if (!this.enabled) return
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]
    notes.forEach((f, i) => this._blip({ freq: f, type: 'triangle', dur: 0.6, gain: 0.7, at: i * 0.08 }))
  }

  achievement() {
    if (!this.enabled) return
    ;[880, 1174.7].forEach((f, i) => this._blip({ freq: f, type: 'square', dur: 0.18, gain: 0.4, at: i * 0.09 }))
  }

  swipe() {
    this._blip({ freq: 260, type: 'sine', dur: 0.08, gain: 0.25, glideTo: 200 })
  }

  blocked() {
    this._blip({ freq: 160, type: 'sine', dur: 0.16, gain: 0.4, glideTo: 120 })
  }
}

export const audio = new AudioEngine()
