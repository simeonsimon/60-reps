// Minimal GitHub Contents API client — the transport layer for habit sync.
//
// The app is served from public GitHub Pages, so the write token can never be
// bundled: it is entered once in Settings and lives only in this device's
// localStorage. Reads work without it (public repo) but burn the 60/hr
// anonymous rate limit, so we send it when we have it.

import { REPO } from './push.js'

const API = `https://api.github.com/repos/${REPO}/contents`
const TOKEN_KEY = 'sixtyreps.ghToken'

export const STATE_PATH = 'state.json'
export const INBOX_DIR = 'inbox'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token.trim())
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* private mode — sync just stays off */
  }
}

export function hasToken() {
  return getToken().length > 0
}

function headers(extra) {
  const token = getToken()
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

async function request(path, init = {}) {
  const res = await fetch(`${API}/${path}`, { ...init, headers: headers(init.headers) })
  if (res.status === 404) return null
  if (res.status === 401 || res.status === 403) {
    throw new Error('GitHub rejected the token. Check it in Settings → Sync.')
  }
  if (!res.ok) {
    throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 140)}`)
  }
  return res.json()
}

// ── base64 <-> UTF-8 ────────────────────────────────────────────────────────
// Habit titles are Spanish and full of accents and emoji, so neither direction
// can go through atob/btoa on raw chars.

export function decodeBase64(b64) {
  const bytes = Uint8Array.from(atob(String(b64).replace(/\s/g, '')), (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text)
  // Chunked — spreading a large Uint8Array into fromCharCode blows the stack.
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

// ── files ───────────────────────────────────────────────────────────────────

// Directory listing. Returns [] when the folder doesn't exist yet (first run).
export async function listDir(dir) {
  const json = await request(`${dir}?ref=main&t=${Date.now()}`)
  return Array.isArray(json) ? json : []
}

// Returns { text, sha } or null when absent.
export async function readFile(path) {
  const json = await request(`${path}?ref=main&t=${Date.now()}`)
  if (!json || typeof json.content !== 'string') return null
  return { text: decodeBase64(json.content), sha: json.sha }
}

export async function writeFile(path, text, message, sha) {
  return request(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: encodeBase64(text), sha, branch: 'main' }),
  })
}

export async function deleteFile(path, sha, message) {
  return request(path, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sha, branch: 'main' }),
  })
}
