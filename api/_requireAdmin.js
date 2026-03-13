import { neon } from '@neondatabase/serverless'
import { getUserFromRequest } from './_auth.js'

export async function requireAdmin(req, res) {
  const payload = getUserFromRequest(req)
  if (!payload) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
  try {
    const sql = neon(process.env.DATABASE_URL)
    const rows = await sql`SELECT is_admin FROM users WHERE id = ${payload.sub}`
    if (!rows[0]?.is_admin) {
      res.status(403).json({ error: 'Forbidden: admin only' })
      return null
    }
    return payload
  } catch (err) {
    console.error('[_requireAdmin] error:', err.message)
    res.status(500).json({ error: 'Internal server error' })
    return null
  }
}
