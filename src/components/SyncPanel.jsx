import { useState } from 'react'
import { useProfile } from '../store/StoreProvider.jsx'
import { getToken, setToken, hasToken } from '../lib/github.js'
import { restoreState } from '../lib/syncEngine.js'
import { REPO } from '../lib/push.js'

// Apple Reminders sync + off-device backup.
//
// A nightly Shortcut writes the reminders you ticked into the repo; the app
// folds them in on launch. The same connection mirrors your whole history to
// the repo, so it no longer lives only in this browser's storage.
export default function SyncPanel() {
  const { sync, syncNow, backupError, restore } = useProfile()
  const [token, setTokenInput] = useState(getToken())
  const [saved, setSaved] = useState(hasToken())
  const [busy, setBusy] = useState(false)
  const [restoreError, setRestoreError] = useState('')

  function handleSave() {
    setToken(token)
    setSaved(!!token.trim())
    setRestoreError('')
    if (token.trim()) syncNow()
  }

  async function handleRestore() {
    if (!window.confirm('Replace everything on this device with the backup from GitHub?')) return
    setBusy(true)
    setRestoreError('')
    try {
      const next = await restoreState()
      if (!next) throw new Error('No backup found in the repo yet.')
      restore(next)
    } catch (err) {
      setRestoreError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const statusText = {
    off: 'Off — add a token to switch it on',
    idle: 'Ready',
    syncing: 'Checking Reminders…',
    ok: sync.message,
    error: sync.message,
  }[sync.status]

  return (
    <div className="space-y-2">
      <div className="rounded-2xl bg-surface px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink">Apple Reminders</div>
            <div className={`text-xs ${sync.status === 'error' ? 'text-red-300' : 'text-muted'}`}>{statusText}</div>
          </div>
          <button
            onClick={syncNow}
            disabled={!saved || sync.status === 'syncing'}
            className="shrink-0 rounded-xl bg-elevated px-3 py-2 text-xs font-bold text-ink disabled:opacity-40"
          >
            {sync.status === 'syncing' ? '…' : 'Sync now'}
          </button>
        </div>
      </div>

      {sync.unmatched.length > 0 && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3">
          <div className="text-xs font-semibold text-amber-200">
            {sync.unmatched.length} reminder{sync.unmatched.length === 1 ? '' : 's'} didn't match a habit
          </div>
          <div className="mt-1 text-xs2 leading-relaxed text-muted">
            {sync.unmatched.join(' · ')} — rename the reminder to match the habit exactly, or add the habit here.
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-surface px-4 py-3">
        <div className="text-sm font-semibold text-ink">GitHub token</div>
        <div className="mt-0.5 text-xs2 leading-relaxed text-muted">
          A fine-grained token with <span className="text-ink">Contents: Read and write</span> on{' '}
          <span className="text-ink">{REPO}</span> only. It stays on this device — never in the app's code.
        </div>
        <div className="mt-2 flex gap-2">
          <input
            type="password"
            value={token}
            onChange={(e) => {
              setTokenInput(e.target.value)
              setSaved(false)
            }}
            placeholder="github_pat_…"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-xl border border-line/10 bg-elevated px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
          <button
            onClick={handleSave}
            disabled={saved}
            className="shrink-0 rounded-xl bg-accent px-3 py-2 text-xs font-bold disabled:opacity-40"
            style={{ color: 'rgb(var(--c-accent-contrast))' }}
          >
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-surface px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink">Backup</div>
            <div className={`text-xs ${backupError ? 'text-red-300' : 'text-muted'}`}>
              {backupError || (saved ? 'Your history mirrors to the repo automatically' : 'Off')}
            </div>
          </div>
          <button
            onClick={handleRestore}
            disabled={!saved || busy}
            className="shrink-0 rounded-xl bg-elevated px-3 py-2 text-xs font-bold text-ink disabled:opacity-40"
          >
            {busy ? '…' : 'Restore'}
          </button>
        </div>
        {restoreError && <div className="mt-2 text-xs2 text-red-300">{restoreError}</div>}
      </div>

      <p className="px-1 text-xs2 leading-relaxed text-muted">
        Setup is a one-off: build the nightly Shortcut once, and ticking reminders is all you do after that.
        Steps are in <span className="text-ink">docs/reminders-sync.md</span> in the repo.
      </p>
    </div>
  )
}
