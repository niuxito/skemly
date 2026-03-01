/**
 * Email sending utility via Resend REST API.
 * Falls back to console.log when RESEND_API_KEY is not set (local dev).
 */

export async function sendVerificationEmail({ to, name, otp }) {
  const apiKey   = process.env.RESEND_API_KEY
  const from     = process.env.FROM_EMAIL || 'onboarding@resend.dev'
  const display  = name || to.split('@')[0]

  if (!apiKey) {
    console.log(`[email] ✉️  OTP para ${to}: ${otp}  (RESEND_API_KEY no configurada — solo dev)`)
    return { ok: true, dev: true }
  }

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
      <h2 style="margin:0 0 8px;font-size:20px;color:#1e293b;">Verifica tu email</h2>
      <p style="margin:0 0 24px;color:#64748b;font-size:14px;">
        Hola ${display}, usa este código para verificar tu cuenta en Skemly:
      </p>
      <div style="background:#f1f5f9;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px;">
        <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1e293b;font-family:monospace;">
          ${otp}
        </span>
      </div>
      <p style="margin:0;color:#94a3b8;font-size:12px;">
        Este código expira en <strong>15 minutos</strong>.
        Si no creaste esta cuenta, ignora este email.
      </p>
    </div>
  `

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `${otp} — tu código de verificación de Skemly`,
      html,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Resend API error ${res.status}`)
  }

  return { ok: true }
}
