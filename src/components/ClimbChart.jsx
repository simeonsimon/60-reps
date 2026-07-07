import { useEffect, useRef } from 'react'

// Canvas line chart of cumulative ("lifetime") reps over time — the climb.
// When `goal` is set and the climb is far enough along (≥30%), the y-scale
// stretches to the goal and a dashed summit line shows how much is left.
export default function ClimbChart({ events = [], accent = '#7aa2ff', height = 170, goal = null }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const W = wrap.clientWidth
      const H = height
      canvas.width = W * dpr
      canvas.height = H * dpr
      canvas.style.width = W + 'px'
      canvas.style.height = H + 'px'
      const ctx = canvas.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      const muted = 'rgba(148,148,158,0.5)'
      const padL = 6
      const padR = 6
      const padT = 14
      const padB = 26

      if (!events.length) {
        ctx.fillStyle = muted
        ctx.font = '13px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('No reps logged yet — start the climb.', W / 2, H / 2)
        return
      }

      const sorted = [...events].sort((a, b) => a.t - b.t)
      let cum = 0
      const pts = [{ t: sorted[0].t, y: 0 }]
      for (const e of sorted) {
        cum += e.amount
        pts.push({ t: e.t, y: cum })
      }
      const t0 = pts[0].t
      const t1 = Math.max(pts[pts.length - 1].t, Date.now())
      const showGoal = goal && cum >= goal * 0.3
      const maxY = Math.max(1, showGoal ? Math.max(cum, goal) : cum)
      const xOf = (t) => padL + (W - padL - padR) * ((t - t0) / Math.max(1, t1 - t0))
      const yOf = (v) => H - padB - (H - padT - padB) * (v / maxY)

      // Horizontal grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx.lineWidth = 1
      ctx.fillStyle = muted
      ctx.font = '10px Inter, sans-serif'
      ctx.textAlign = 'left'
      ;[0, 0.5, 1].forEach((f) => {
        const y = yOf(maxY * f)
        ctx.beginPath()
        ctx.moveTo(padL, y)
        ctx.lineTo(W - padR, y)
        ctx.stroke()
        ctx.fillText(String(Math.round(maxY * f)), padL + 2, y - 3)
      })

      // Area fill
      const grad = ctx.createLinearGradient(0, padT, 0, H - padB)
      grad.addColorStop(0, hexToRgba(accent, 0.32))
      grad.addColorStop(1, hexToRgba(accent, 0))
      ctx.beginPath()
      ctx.moveTo(xOf(pts[0].t), yOf(0))
      pts.forEach((p) => ctx.lineTo(xOf(p.t), yOf(p.y)))
      ctx.lineTo(xOf(pts[pts.length - 1].t), yOf(0))
      ctx.closePath()
      ctx.fillStyle = grad
      ctx.fill()

      // Line
      ctx.beginPath()
      pts.forEach((p, i) => {
        const x = xOf(p.t)
        const y = yOf(p.y)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.strokeStyle = accent
      ctx.lineWidth = 2.5
      ctx.lineJoin = 'round'
      ctx.stroke()

      // Dashed summit line — the 60-rep finish this climb is heading for.
      if (showGoal && goal <= maxY) {
        const gy = yOf(goal)
        ctx.save()
        ctx.setLineDash([5, 5])
        ctx.strokeStyle = hexToRgba(accent, 0.5)
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(padL, gy)
        ctx.lineTo(W - padR, gy)
        ctx.stroke()
        ctx.restore()
        ctx.fillStyle = hexToRgba(accent, 0.9)
        ctx.font = '600 10px Inter, sans-serif'
        ctx.textAlign = 'right'
        ctx.fillText(`${goal} · summit`, W - padR - 2, gy - 4)
      }

      // End dot
      const last = pts[pts.length - 1]
      ctx.beginPath()
      ctx.arc(xOf(last.t), yOf(last.y), 4, 0, Math.PI * 2)
      ctx.fillStyle = accent
      ctx.fill()

      // Date axis: where the climb started → today.
      const fmt = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      ctx.fillStyle = muted
      ctx.font = '10px Inter, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(fmt(t0), padL + 2, H - 6)
      ctx.textAlign = 'right'
      ctx.fillText('today', W - padR - 2, H - 6)
    }

    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [events, accent, height, goal])

  return (
    <div ref={wrapRef} className="w-full">
      <canvas ref={canvasRef} />
    </div>
  )
}

function hexToRgba(hex, a) {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${a})`
}
