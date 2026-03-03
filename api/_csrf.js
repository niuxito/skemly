/**
 * CSRF protection for state-mutating API endpoints.
 *
 * Two-layer defense:
 *   1. Content-Type must be application/json — HTML forms cannot set this.
 *   2. Origin header, if present, must be an allowed origin — cross-site
 *      fetch() is blocked by CORS, so only requests from allowed origins
 *      should ever reach the server with a custom origin header.
 *
 * Usage:
 *   if (checkCsrf(req, res)) return   // returns truthy string 'blocked' if rejected
 */

const ALWAYS_ALLOWED = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
]

function getAllowedOrigins() {
  const prod = (process.env.ALLOWED_ORIGIN ?? 'https://skemly.app')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean)
  return [...prod, ...ALWAYS_ALLOWED]
}

export function checkCsrf(req, res) {
  const method = req.method?.toUpperCase()
  if (!method || ['GET', 'HEAD', 'OPTIONS'].includes(method)) return null

  // 1. Content-Type check
  const ct = req.headers?.['content-type'] ?? ''
  if (!ct.includes('application/json')) {
    res.status(403).json({ error: 'Forbidden' })
    return 'blocked'
  }

  // 2. Origin check (only when header is present — same-origin requests may omit it)
  const origin = req.headers?.['origin']
  if (origin && !getAllowedOrigins().includes(origin)) {
    res.status(403).json({ error: 'Forbidden' })
    return 'blocked'
  }

  return null
}
