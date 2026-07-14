import { useRef, useState } from 'react'
import { useStore } from '../store/StoreProvider.jsx'

// Words that are Reminders UI chrome, not actual reminders (English + Spanish).
const CHROME = new Set(
  [
    'today', 'scheduled', 'all', 'flagged', 'completed', 'assigned to me',
    'siri suggestions', 'reminders', 'lists', 'my lists', 'new reminder',
    'add list', 'edit', 'done', 'search', 'notes', 'show', 'hide',
    'hoy', 'programado', 'programados', 'todos', 'todas', 'señalado',
    'señalados', 'marcado', 'marcados', 'completado', 'completados',
    'recordatorio', 'recordatorios', 'listas', 'mis listas',
    'nuevo recordatorio', 'añadir lista', 'buscar', 'notas', 'ok', 'listo',
  ].map((w) => w.toLowerCase()),
)

// Best-effort emoji from keywords (English + Spanish) so imported habits
// don't all land as generic mountains.
const EMOJI_RULES = [
  [/gym|weights?|lift|pesas|gimnasio|workout|entrenar/i, '💪'],
  [/run|jog|correr|sprint/i, '🏃'],
  [/read|leer|book|libro|pages?|páginas?/i, '📚'],
  [/water|agua|hydrate|beber/i, '💧'],
  [/study|estudiar|paper|exam|examen|chem|physics|física|química|bio/i, '🧪'],
  [/anki|flashcards?|tarjetas/i, '🃏'],
  [/guitar|guitarra|music|música|piano/i, '🎸'],
  [/sleep|dormir|bed|cama|acostar/i, '🛏️'],
  [/medit|breath|respira|yoga/i, '🧘'],
  [/clean|limpiar|tidy|ordenar|room|cuarto/i, '🧹'],
  [/write|escribir|journal|diario/i, '✍️'],
  [/eat|comer|meal|salad|ensalada|cocinar|cook/i, '🥗'],
  [/throw|basket|tiros|canasta|baloncesto/i, '🏀'],
  [/bike|moto|bici/i, '🏍️'],
  [/walk|caminar|paseo|pasear/i, '🚶'],
  [/pray|rezar|church|iglesia/i, '🙏'],
]

function guessEmoji(title) {
  for (const [re, e] of EMOJI_RULES) if (re.test(title)) return e
  return '⛰️'
}

function slug(s) {
  return (
    s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'habit'
  )
}

// Turn raw OCR (or pasted) text into candidate habit titles.
export function parseReminderLines(text) {
  const seen = new Set()
  const out = []
  for (let raw of String(text).split(/\r?\n/)) {
    let line = raw.trim()
    // Leading completion-circle artifacts: "O ", "o ", "( ) ", "• "…
    line = line.replace(/^[(\[]\s*[)\]]\s*/, '').replace(/^[O0o•·◦□©®@-]\s+/, '')
    // Trailing badge counts ("Gym 3") and times ("Read 21:30").
    line = line.replace(/\s+\d{1,2}[:.]\d{2}\s*(a\.?m\.?|p\.?m\.?)?$/i, '')
    line = line.replace(/\s+\d{1,3}$/, '')
    line = line.trim()
    if (line.length < 3) continue
    if (!/[a-zà-öø-ÿ]/i.test(line)) continue // no letters → time/count/junk
    if (CHROME.has(line.toLowerCase())) continue
    if (/^\d{1,2}[:.]\d{2}/.test(line)) continue
    if (/^(mon|tue|wed|thu|fri|sat|sun|lun|mar|mié|mie|jue|vie|sáb|sab|dom)[a-zé]*,?(\s|$)/i.test(line) && line.split(' ').length <= 3) continue
    const key = line.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(line)
    if (out.length >= 20) break
  }
  return out
}

const ACCENT_BTN = 'w-full rounded-2xl bg-accent px-4 py-3.5 text-sm font-bold transition-transform active:scale-[0.98] disabled:opacity-40'

export default function ImportPanel({ onClose }) {
  const { addHabit, habits } = useStore()
  const [phase, setPhase] = useState('idle') // idle | reading | review | error
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [items, setItems] = useState([]) // { title, emoji, on }
  const [pasteMode, setPasteMode] = useState(false)
  const [pasted, setPasted] = useState('')
  const fileRef = useRef(null)

  function toReview(lines) {
    if (!lines.length) {
      setError("Couldn't find any reminders in that. Try a closer screenshot, or paste the text instead.")
      setPhase('error')
      return
    }
    setItems(lines.map((title) => ({ title, emoji: guessEmoji(title), on: true })))
    setPhase('review')
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // same file can be re-picked after an error
    setPhase('reading')
    setProgress(0)
    try {
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng+spa', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') setProgress(m.progress)
        },
      })
      try {
        const { data } = await worker.recognize(file)
        toReview(parseReminderLines(data.text))
      } finally {
        await worker.terminate()
      }
    } catch (err) {
      console.error(err)
      setError('Reading the image failed — this needs internet the first time. You can also paste the text instead.')
      setPhase('error')
    }
  }

  function toggle(i) {
    setItems((xs) => xs.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))
  }
  function rename(i, title) {
    setItems((xs) => xs.map((x, j) => (j === i ? { ...x, title, emoji: guessEmoji(title) } : x)))
  }

  const picked = items.filter((x) => x.on && x.title.trim())

  function importAll() {
    const now = Date.now()
    const existing = new Set(habits.map((h) => h.title.toLowerCase()))
    let added = 0
    for (const it of picked) {
      const title = it.title.trim()
      if (existing.has(title.toLowerCase())) continue
      addHabit({
        id: `${slug(title)}-${Math.random().toString(36).slice(2, 6)}`,
        title,
        type: 'single',
        emoji: it.emoji,
        reps: 0,
        history: [],
        createdAt: now,
        sessionValue: 0,
        lastCompletedAt: null,
      })
      added++
    }
    onClose?.(added)
  }

  // ── Review ────────────────────────────────────────────────────────────
  if (phase === 'review') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Found {items.length} reminder{items.length === 1 ? '' : 's'}. Untick what you don't want, rename anything —
          each becomes a daily habit you can tune later.
        </p>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors ${
                it.on ? 'border-accent/40 bg-surface' : 'border-white/5 bg-surface/40'
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(i)}
                aria-pressed={it.on}
                aria-label={it.on ? 'Skip this reminder' : 'Include this reminder'}
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-bold transition-colors ${
                  it.on ? 'border-accent bg-accent' : 'border-white/20 bg-transparent'
                }`}
                style={it.on ? { color: 'rgb(var(--c-base))' } : undefined}
              >
                {it.on ? '✓' : ''}
              </button>
              <span className="text-xl">{it.emoji}</span>
              <input
                value={it.title}
                onChange={(e) => rename(i, e.target.value)}
                className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${it.on ? 'text-ink' : 'text-muted line-through'}`}
              />
            </div>
          ))}
        </div>
        <div className="sticky bottom-0 -mx-1 space-y-2 bg-gradient-to-t from-base via-base/90 to-transparent px-1 pb-1 pt-3">
          <button type="button" onClick={importAll} disabled={picked.length === 0} className={ACCENT_BTN} style={{ color: 'rgb(var(--c-base))' }}>
            {picked.length === 0 ? 'Nothing selected' : `Start ${picked.length} climb${picked.length === 1 ? '' : 's'}`}
          </button>
          <button type="button" onClick={() => setPhase('idle')} className="w-full py-1 text-center text-xs font-medium text-muted">
            Start over
          </button>
        </div>
      </div>
    )
  }

  // ── Reading ───────────────────────────────────────────────────────────
  if (phase === 'reading') {
    return (
      <div className="space-y-4 py-6 text-center">
        <p className="text-sm font-medium text-ink">Reading your screenshot…</p>
        <div className="mx-auto h-2 w-56 overflow-hidden rounded-full bg-elevated">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-200"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <p className="text-xs text-muted">All on your phone — the photo never leaves this device.</p>
      </div>
    )
  }

  // ── Idle / error ──────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {phase === 'error' && (
        <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>
      )}

      {!pasteMode ? (
        <>
          <p className="text-sm text-muted">
            Take a screenshot of your Apple Reminders list, pick it here, and each reminder becomes a 60-rep climb.
          </p>
          <button type="button" onClick={() => fileRef.current?.click()} className={ACCENT_BTN} style={{ color: 'rgb(var(--c-base))' }}>
            Choose screenshot
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" aria-label="Reminders screenshot" />
          <button type="button" onClick={() => setPasteMode(true)} className="w-full py-1 text-center text-xs font-medium text-muted underline underline-offset-2">
            Or paste the text instead
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted">
            In Reminders: select all, copy, and paste here — one reminder per line.
          </p>
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={6}
            placeholder={'Gym\nRead 10 pages\nAnki reviews'}
            className="w-full resize-none rounded-2xl border border-white/10 bg-surface px-4 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
          />
          <button
            type="button"
            onClick={() => toReview(parseReminderLines(pasted))}
            disabled={!pasted.trim()}
            className={ACCENT_BTN}
            style={{ color: 'rgb(var(--c-base))' }}
          >
            Read the list
          </button>
          <button type="button" onClick={() => setPasteMode(false)} className="w-full py-1 text-center text-xs font-medium text-muted underline underline-offset-2">
            Back to screenshot
          </button>
        </>
      )}

      <p className="text-xs text-muted">
        Reading a screenshot downloads the text reader once (~5 MB), so the first import needs internet.
      </p>
    </div>
  )
}
