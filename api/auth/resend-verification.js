import { neon } from '@neondatabase/serverless'
import { generateOtp } from '../_auth.js'
import { sendVerificationEmail } from '../_email.js'
import { checkCsrf } from '../_csrf.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (checkCsrf(req, res)) return

  const { email } = req.body ?? {}
  if (!email) {
    return res.status(400).json({ error: 'Email requerido' })
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    return res.status(500).json({ error: 'Database not configured' })
  }

  const sql = neon(databaseUrl)

  const rows = await sql`
    SELECT id, email, name, email_verified, verify_otp_sent_at
    FROM users WHERE email = ${email.toLowerCase()}
  `

  // Don't reveal whether the email exists or not
  if (!rows.length) {
    return res.status(200).json({ ok: true })
  }

  const user = rows[0]

  if (user.email_verified) {
    return res.status(400).json({ error: 'Este email ya está verificado' })
  }

  // Rate limit: at least 60s between resends
  if (user.verify_otp_sent_at) {
    const elapsed = Date.now() - new Date(user.verify_otp_sent_at).getTime()
    if (elapsed < 60_000) {
      const wait = Math.ceil((60_000 - elapsed) / 1000)
      return res.status(429).json({ error: `Espera ${wait}s antes de reenviar` })
    }
  }

  const otp = generateOtp()
  const otpExpiry = new Date(Date.now() + 15 * 60 * 1000)

  await sql`
    UPDATE users
    SET verify_otp = ${otp}, verify_otp_expires_at = ${otpExpiry}, verify_otp_sent_at = NOW()
    WHERE id = ${user.id}
  `

  await sendVerificationEmail({ to: user.email, name: user.name, otp })

  return res.status(200).json({ ok: true })
}
