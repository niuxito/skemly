import { neon } from '@neondatabase/serverless'
import { comparePassword, signToken } from '../_auth.js'

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

  const sql = neon(databaseUrl)

  const rows = await sql`SELECT id, email, name, password_hash FROM users WHERE email = ${email.toLowerCase()}`

  // Same error for wrong email or wrong password (no enumeration)
  const GENERIC_ERROR = 'Email o contraseña incorrectos'

  if (rows.length === 0) {
    return res.status(401).json({ error: GENERIC_ERROR })
  }

  const user = rows[0]
  const valid = await comparePassword(password, user.password_hash)

  if (!valid) {
    return res.status(401).json({ error: GENERIC_ERROR })
  }

  const token = signToken({ sub: user.id, email: user.email })

  return res.status(200).json({ token, user: { id: user.id, email: user.email, name: user.name } })
}
