import { neon } from '@neondatabase/serverless'
import { getUserFromRequest } from '../_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const payload = getUserFromRequest(req)
  if (!payload) {
    return res.status(401).json({ error: 'Token inválido o expirado' })
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    return res.status(500).json({ error: 'Database not configured' })
  }

  const sql = neon(databaseUrl)
  const rows = await sql`SELECT id, email, name, email_verified, plan, plan_expires_at, token_version FROM users WHERE id = ${payload.sub}`

  if (rows.length === 0) {
    return res.status(401).json({ error: 'Usuario no encontrado' })
  }

  const user = rows[0]

  // Verify token has not been revoked (token_version mismatch means logout was called)
  if (payload.ver !== undefined && user.token_version !== payload.ver) {
    return res.status(401).json({ error: 'Sesión revocada. Por favor inicia sesión de nuevo.' })
  }

  return res.status(200).json({
    user: { id: user.id, email: user.email, name: user.name, email_verified: user.email_verified, plan: user.plan, plan_expires_at: user.plan_expires_at },
  })
}
