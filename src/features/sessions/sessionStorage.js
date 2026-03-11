// ─── Session storage keys ────────────────────────────────────────────────────
export const sessionsKey = (userId) =>
  userId ? `vibediag_sessions_${userId}` : 'vibediag_sessions'

export const activeKey = (userId) =>
  userId ? `vibediag_active_${userId}` : 'vibediag_active'

// ─── localStorage helpers ─────────────────────────────────────────────────────
export function loadSessions(key) {
  try {
    const raw = localStorage.getItem(key ?? 'vibediag_sessions')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveSessionsToStorage(sessions, key) {
  try {
    localStorage.setItem(key ?? 'vibediag_sessions', JSON.stringify(sessions))
  } catch { /* quota exceeded – skip */ }
}
