import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, otp } = req.body ?? {}
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email y código requeridos' })
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    return res.status(500).json({ error: 'Database not configured' })
  }

  const sql = neon(databaseUrl)

  const rows = await sql`
    SELECT id, email, name, verify_otp, verify_otp_expires_at
    FROM users WHERE email = ${email.toLowerCase()}
  `

  if (!rows.length) {
    return res.status(400).json({ error: 'Código inválido o expirado' })
  }

  const user = rows[0]

  if (!user.verify_otp || user.verify_otp !== otp.trim()) {
    return res.status(400).json({ error: 'Código incorrecto' })
  }

  if (!user.verify_otp_expires_at || new Date() > new Date(user.verify_otp_expires_at)) {
    return res.status(400).json({ error: 'El código ha expirado. Solicita uno nuevo.' })
  }

  await sql`
    UPDATE users
    SET email_verified = true, verify_otp = null, verify_otp_expires_at = null
    WHERE id = ${user.id}
  `

  return res.status(200).json({
    user: { id: user.id, email: user.email, name: user.name, email_verified: true },
  })
}
