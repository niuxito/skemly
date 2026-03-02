import { neon } from '@neondatabase/serverless'
import { timingSafeEqual } from 'crypto'
import { checkAndIncrementOtpAttempt } from '../_rateLimit.js'

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

  // ─── OTP rate limiting by IP ────────────────────────────────────────────
  const ip = (req.headers?.['x-forwarded-for'] ?? '127.0.0.1').split(',')[0].trim()
  const rl = await checkAndIncrementOtpAttempt({ ip, databaseUrl })
  if (!rl.allowed) {
    return res.status(429).json({
      error: {
        type: 'otp_rate_limit_exceeded',
        message: 'Demasiados intentos de verificación. Inténtalo de nuevo mañana.',
        reset_at: rl.resetAt,
      },
    })
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

  // Timing-safe OTP comparison (prevents timing attacks)
  const otpTrimmed = otp.trim()
  const storedOtp = user.verify_otp ?? ''
  const match =
    storedOtp.length > 0 &&
    storedOtp.length === otpTrimmed.length &&
    timingSafeEqual(Buffer.from(storedOtp), Buffer.from(otpTrimmed))

  if (!match) {
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
