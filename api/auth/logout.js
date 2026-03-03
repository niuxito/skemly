import { neon } from '@neondatabase/serverless'
import { getUserFromRequest, clearAuthCookie } from '../_auth.js'
import { checkCsrf } from '../_csrf.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (checkCsrf(req, res)) return

  const payload = getUserFromRequest(req)

  // Clear the auth cookie regardless of token validity
  clearAuthCookie(res)

  // Revoke only this specific session (other devices remain logged in)
  if (payload?.sid && process.env.DATABASE_URL) {
    const sql = neon(process.env.DATABASE_URL)
    await sql`UPDATE auth_sessions SET revoked_at = NOW() WHERE id = ${payload.sid}`.catch(() => {})
  }

  return res.status(200).json({ ok: true })
}
