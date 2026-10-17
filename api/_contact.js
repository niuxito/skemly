/**
 * Contact form on the landing page → Telegram message through a
 * notifications-only bot (NOTIFY_BOT_TOKEN, NOTIFY_CHAT_ID).
 * Dispatched from /api/chat (?op=contact) to stay under Vercel Hobby's
 * 12-function cap.
 */
const LIMITS = { name: [1, 120], contact: [3, 200], message: [10, 3000] }

export function validateContact(body) {
  if (!body || typeof body !== 'object') return 'invalid body'
  for (const [field, [min, max]] of Object.entries(LIMITS)) {
    const value = body[field]
    if (typeof value !== 'string') return `${field} is required`
    const length = value.trim().length
    if (length < min || length > max) return `${field} must be ${min}-${max} characters`
  }
  if (body.lang !== undefined && body.lang !== 'es' && body.lang !== 'en') return 'invalid lang'
  return null
}

export function formatContact({ name, contact, message, lang = 'es' }) {
  return [
    '📩 Skemly · nuevo contacto',
    '',
    `Nombre: ${name.trim()}`,
    `Contacto: ${contact.trim()}`,
    `Idioma: ${lang}`,
    '',
    message.trim(),
  ].join('\n')
}

export async function handleContact(req, res, { ip, checkAndIncrementContact }) {
  const body = req.body ?? {}
  // Honeypot: humans leave it empty; bots get a silent success
  if (typeof body.website === 'string' && body.website !== '') return res.status(200).json({ ok: true })

  const invalid = validateContact(body)
  if (invalid) return res.status(400).json({ error: { type: 'invalid_request', message: invalid } })

  const token = process.env.NOTIFY_BOT_TOKEN
  const chatId = process.env.NOTIFY_CHAT_ID
  if (!token || !chatId) {
    return res.status(503).json({ error: { type: 'contact_disabled', message: 'Contact form is not configured.' } })
  }

  const rl = await checkAndIncrementContact({ ip, databaseUrl: process.env.DATABASE_URL })
  if (!rl.allowed) {
    return res.status(429).json({ error: { type: 'rate_limit_exceeded', message: 'Too many messages today. Please try again tomorrow.' } })
  }

  try {
    const upstream = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: formatContact(body), disable_web_page_preview: true }),
    })
    if (!upstream.ok) {
      const data = await upstream.json().catch(() => ({}))
      console.error('[contact] telegram error:', upstream.status, data?.description)
      return res.status(503).json({ error: { type: 'send_failed', message: 'The message could not be sent. Please try again later.' } })
    }
  } catch (err) {
    console.error('[contact] telegram fetch failed:', err.message)
    return res.status(503).json({ error: { type: 'send_failed', message: 'The message could not be sent. Please try again later.' } })
  }
  return res.status(200).json({ ok: true })
}
