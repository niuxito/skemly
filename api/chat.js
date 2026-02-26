/**
 * Vercel serverless function — proxies POST /api/chat to Anthropic.
 * ANTHROPIC_API_KEY is read from Vercel environment variables (never exposed to the client).
 * Rate limiting via Neon PostgreSQL (DATABASE_URL + DAILY_LIMIT env vars).
 */
import { checkRateLimit, checkFileRateLimit } from './_rateLimit.js'
import { buildAnthropicBody } from './_buildAnthropicBody.js'

const FILE_MAX_SIZE = parseInt(process.env.FILE_MAX_SIZE_ANON ?? String(2 * 1024 * 1024), 10)
const FILE_DAILY_LIMIT = parseInt(process.env.FILE_DAILY_LIMIT_ANON ?? '5', 10)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: { message: 'ANTHROPIC_API_KEY not configured on server' } })
  }

  const ip = (req.headers['x-forwarded-for'] ?? '127.0.0.1').split(',')[0].trim()

  // ─── Request rate limiting ────────────────────────────────────────────────
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

  // ─── File attachment validation & rate limiting ───────────────────────────
  const { attachment } = req.body
  if (attachment) {
    if (attachment.size > FILE_MAX_SIZE) {
      return res.status(400).json({
        error: {
          type: 'file_too_large',
          message: `El fichero supera el límite de ${Math.round(FILE_MAX_SIZE / 1024 / 1024)} MB.`,
        },
      })
    }

    const frl = await checkFileRateLimit({
      ip,
      databaseUrl: process.env.DATABASE_URL,
      dailyLimit: FILE_DAILY_LIMIT,
    })

    if (!frl.allowed) {
      return res.status(429).json({
        error: {
          type: 'file_rate_limit_exceeded',
          limit: frl.limit,
          reset_at: frl.resetAt,
          remaining: 0,
        },
      })
    }

    if (frl.remaining !== null) {
      res.setHeader('X-FileRateLimit-Remaining', String(frl.remaining))
    }
  }

  // ─── Proxy to Anthropic ───────────────────────────────────────────────────
  try {
    const anthropicBody = buildAnthropicBody(req.body)

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicBody),
    })

    const data = await upstream.json()
    return res.status(upstream.status).json(data)
  } catch (err) {
    return res.status(502).json({ error: { message: `Proxy error: ${err.message}` } })
  }
}
