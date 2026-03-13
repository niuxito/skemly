// ─── Plan limits (client-side reference) ──────────────────────────────────────
export const CLIENT_PLAN_LIMITS = {
  free:    { daily_requests: 20,   daily_files: 2 },
  starter: { daily_requests: 50,   daily_files: 10 },
  pro:     { daily_requests: null, daily_files: null },
}

// ─── Session factory & derivation ─────────────────────────────────────────────
export const isPaid = (user) => user?.plan === 'pro' || user?.plan === 'starter'

export function createSession(dsl = '', title = 'Nueva sesión') {
  return {
    id: crypto.randomUUID(),
    title,
    dsl,
    messages: [],
    chatHistory: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export function deriveTitle(dsl, messages, untitled = 'Sin título') {
  const match = dsl?.match(/\[(?:[^\]|]+\|)?([^\]]+)\]/)
  if (match) return match[1].trim().slice(0, 40)
  const firstUser = messages?.find(m => m.role === 'user')
  if (firstUser) return firstUser.content.slice(0, 35)
  return untitled
}

export function relativeTime(ts, t) {
  const diff = Date.now() - ts
  if (diff < 60_000) return t('just_now')
  if (diff < 3_600_000) return t('minutes_ago', Math.floor(diff / 60_000))
  if (diff < 86_400_000) return t('hours_ago', Math.floor(diff / 3_600_000))
  return t('days_ago', Math.floor(diff / 86_400_000))
}

export function toFilename(title) {
  const clean = (title ?? '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase()
  return clean || 'vibediagram'
}
