import { neon } from '@neondatabase/serverless'
import { getUserFromRequest, clearAuthCookie } from '../_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const payload = getUserFromRequest(req)

  // Clear the auth cookie regardless of whether the token is valid
  clearAuthCookie(res)

  // Increment token_version to invalidate all existing tokens for this user
  if (payload?.sub && process.env.DATABASE_URL) {
    const sql = neon(process.env.DATABASE_URL)
    await sql`UPDATE users SET token_version = token_version + 1 WHERE id = ${payload.sub}`.catch(() => {})
  }

  return res.status(200).json({ ok: true })
}
