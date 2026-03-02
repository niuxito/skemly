import { neon } from '@neondatabase/serverless'
import { hashPassword, signToken, generateOtp } from '../_auth.js'
import { sendVerificationEmail } from '../_email.js'
import { checkAndIncrementRegisterAttempt } from '../_rateLimit.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, password, name } = req.body ?? {}

  // Basic validation
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Email inválido' })
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' })
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    return res.status(500).json({ error: 'Database not configured' })
  }

  // ─── Rate limiting by IP ────────────────────────────────────────────────
  const ip = (req.headers?.['x-forwarded-for'] ?? '127.0.0.1').split(',')[0].trim()
  const rl = await checkAndIncrementRegisterAttempt({ ip, databaseUrl })
  if (!rl.allowed) {
    return res.status(429).json({
      error: {
        type: 'register_rate_limit_exceeded',
        message: 'Demasiados registros desde esta IP. Inténtalo de nuevo mañana.',
        reset_at: rl.resetAt,
      },
    })
  }

  const sql = neon(databaseUrl)

  // Check if email already exists
  const existing = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase()}`
  if (existing.length > 0) {
    return res.status(409).json({ error: 'Email ya registrado' })
  }

  // Hash password and insert
  const passwordHash = await hashPassword(password)
  const trimmedName = name?.trim() || null

  // Generate OTP for email verification
  const otp = generateOtp()
  const otpExpiry = new Date(Date.now() + 15 * 60 * 1000) // 15 min

  const rows = await sql`
    INSERT INTO users (email, password_hash, name, verify_otp, verify_otp_expires_at, verify_otp_sent_at)
    VALUES (${email.toLowerCase()}, ${passwordHash}, ${trimmedName}, ${otp}, ${otpExpiry}, NOW())
    RETURNING id, email, name
  `
  const user = rows[0]

  // Send verification email (non-blocking — don't fail registration if email fails)
  sendVerificationEmail({ to: user.email, name: user.name, otp }).catch(err => {
    console.error('[register] Failed to send verification email:', err.message)
  })

  const token = signToken({ sub: user.id, email: user.email })

  return res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name, email_verified: false },
  })
}
