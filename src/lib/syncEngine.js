// Orchestration: pull the Reminders sweeps down, fold them in, push a backup up.
//
// Sweep files are never deleted on merge — `reconcileSweep` is idempotent, so
// leaving them lets a second device catch up on the same days. Only genuinely
// stale files get swept away.

import { listDir, readFile, writeFile, deleteFile, INBOX_DIR, STATE_PATH } from './github.js'
import { parseSweepFiles, reconcileSweep } from './remindersSync.js'

const KEEP_SWEEPS_DAYS = 14

/**
 * Fetch every sweep file and reconcile it against `state`.
 * Returns null when there is nothing to apply, otherwise the reconcile result.
 */
export async function pullSweeps(state, now = Date.now()) {
  const entries = await listDir(INBOX_DIR)
  const names = entries.filter((e) => e.type === 'file' && e.name.endsWith('.txt')).map((e) => e.name)
  if (names.length === 0) return null

  const files = await Promise.all(
    names.map(async (name) => {
      const file = await readFile(`${INBOX_DIR}/${name}`)
      return { name, text: file?.text || '' }
    }),
  )

  return reconcileSweep(state, parseSweepFiles(files), now)
}

// Housekeeping so `inbox/` doesn't grow forever. Failures here are ignored —
// stale files are untidy, never incorrect.
export async function pruneSweeps(now = Date.now()) {
  const cutoff = new Date(now - KEEP_SWEEPS_DAYS * 86400000).toISOString().slice(0, 10)
  const entries = await listDir(INBOX_DIR)
  for (const entry of entries) {
    const date = /^(\d{4}-\d{2}-\d{2})--/.exec(entry.name)?.[1]
    if (!date || date >= cutoff) continue
    try {
      await deleteFile(`${INBOX_DIR}/${entry.name}`, entry.sha, `chore: prune sweep ${entry.name}`)
    } catch {
      /* untidy, not wrong */
    }
  }
}

// Mirror the whole store to the repo so history survives a cleared Safari
// cache or a lost phone. Skipped when nothing but the clock has changed.
export async function backupState(state) {
  const existing = await readFile(STATE_PATH)
  const payload = { habits: state.habits, profile: state.profile }
  const serialized = JSON.stringify(payload)

  if (existing) {
    try {
      if (JSON.stringify(JSON.parse(existing.text).state) === serialized) return false
    } catch {
      /* corrupt remote copy — overwrite it */
    }
  }

  const body = JSON.stringify({ v: 1, updatedAt: new Date().toISOString(), state: payload }, null, 2)
  await writeFile(STATE_PATH, body, 'chore: back up habit state', existing?.sha)
  return true
}

// Restore from the repo copy — the "new phone" / "Safari ate my data" path.
export async function restoreState() {
  const file = await readFile(STATE_PATH)
  if (!file) return null
  const parsed = JSON.parse(file.text)
  if (parsed.v !== 1 || !parsed.state?.habits) throw new Error('Backup is not in a format this version understands.')
  return parsed.state
}
