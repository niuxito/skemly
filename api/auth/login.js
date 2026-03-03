import { neon } from '@neondatabase/serverless'
import { comparePassword, signToken, setAuthCookie } from '../_auth.js'
import { checkLoginAttempts, incrementLoginAttempt } from '../_rateLimit.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, password } = req.body ?? {}

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' })
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    return res.status(500).json({ error: 'Database not configured' })
  }

  // ─── Rate limiting by IP ────────────────────────────────────────────────
  const ip = (req.headers?.['x-forwarded-for'] ?? '127.0.0.1').split(',')[0].trim()
  const rl = await checkLoginAttempts({ ip, databaseUrl })
  if (!rl.allowed) {
    return res.status(429).json({
      error: {
        type: 'login_rate_limit_exceeded',
        message: 'Demasiados intentos fallidos. Inténtalo de nuevo mañana.',
        reset_at: rl.resetAt,
      },
    })
  }

  const sql = neon(databaseUrl)

  const rows = await sql`SELECT id, email, name, password_hash, email_verified, token_version FROM users WHERE email = ${email.toLowerCase()}`

  // Same error for wrong email or wrong password (no enumeration)
  const GENERIC_ERROR = 'Email o contraseña incorrectos'

  if (rows.length === 0) {
    await incrementLoginAttempt({ ip, databaseUrl })
    return res.status(401).json({ error: GENERIC_ERROR })
  }

  const user = rows[0]
  const valid = await comparePassword(password, user.password_hash)

  if (!valid) {
    await incrementLoginAttempt({ ip, databaseUrl })
    return res.status(401).json({ error: GENERIC_ERROR })
  }

  const token = signToken({ sub: user.id, email: user.email, ver: user.token_version })
  setAuthCookie(res, token)

  return res.status(200).json({ user: { id: user.id, email: user.email, name: user.name, email_verified: user.email_verified } })
}
