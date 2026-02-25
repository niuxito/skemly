/**
 * Vercel serverless function — proxies POST /api/chat to Anthropic.
 * ANTHROPIC_API_KEY is read from Vercel environment variables (never exposed to the client).
 * Rate limiting via Neon PostgreSQL (DATABASE_URL + DAILY_LIMIT env vars).
 */
import { checkRateLimit } from './_rateLimit.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: { message: 'ANTHROPIC_API_KEY not configured on server' } })
  }

  // ─── Rate limiting ────────────────────────────────────────────────────────
  const ip = (req.headers['x-forwarded-for'] ?? '127.0.0.1').split(',')[0].trim()
  const rl = await checkRateLimit({
    ip,
    databaseUrl: process.env.DATABASE_URL,
    dailyLimit: parseInt(process.env.DAILY_LIMIT ?? '20', 10),
  })

  if (!rl.allowed) {
    return res.status(429).json({
      error: {
        type: 'rate_limit_exceeded',
        limit: rl.limit,
        reset_at: rl.resetAt,
        remaining: 0,
      },
    })
  }

  if (rl.remaining !== null) {
    res.setHeader('X-RateLimit-Remaining', String(rl.remaining))
  }

  // ─── Proxy to Anthropic ───────────────────────────────────────────────────
  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    })

    const data = await upstream.json()
    return res.status(upstream.status).json(data)
  } catch (err) {
    return res.status(502).json({ error: { message: `Proxy error: ${err.message}` } })
  }
}
