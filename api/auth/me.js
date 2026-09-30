import { neon } from '@neondatabase/serverless'
import { getUserFromRequest } from '../_auth.js'
import { effectivePlan } from '../_billing.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const payload = getUserFromRequest(req)
  if (!payload) {
    return res.status(401).json({ error: 'Token inválido o expirado' })
  }

  // Require a session ID (tokens without sid are from before the auth_sessions migration)
  if (!payload.sid) {
    return res.status(401).json({ error: 'Sesión inválida. Por favor inicia sesión de nuevo.' })
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    return res.status(500).json({ error: 'Database not configured' })
  }

  const sql = neon(databaseUrl)

  // Verify session is still active and load user data in one query
  const rows = await sql`
    SELECT u.id, u.email, u.name, u.email_verified, u.plan, u.plan_expires_at, u.is_admin
    FROM users u
    JOIN auth_sessions s ON s.user_id = u.id
    WHERE u.id = ${payload.sub}
      AND s.id = ${payload.sid}
      AND s.revoked_at IS NULL
  `

  if (rows.length === 0) {
    return res.status(401).json({ error: 'Sesión no encontrada o revocada. Por favor inicia sesión de nuevo.' })
  }

  // Update last_used_at (fire and forget)
  sql`UPDATE auth_sessions SET last_used_at = NOW() WHERE id = ${payload.sid}`.catch(() => {})

  const user = rows[0]
  return res.status(200).json({
    user: { id: user.id, email: user.email, name: user.name, email_verified: user.email_verified, plan: effectivePlan(user.plan), plan_expires_at: user.plan_expires_at, is_admin: user.is_admin ?? false },
  })
}
