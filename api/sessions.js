import { neon } from '@neondatabase/serverless'
import { getUserFromRequest } from './_auth.js'
import { checkCsrf } from './_csrf.js'

/**
 * Strip base64 attachment data from messages before storing in DB.
 * Keeps: role, content, filename, mediaType — drops: data (base64).
 */
function stripAttachments(messages) {
  if (!Array.isArray(messages)) return []
  return messages.map(m => {
    if (!m.data) return m
    // eslint-disable-next-line no-unused-vars
    const { data, ...rest } = m
    return rest
  })
}

export default async function handler(req, res) {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    return res.status(500).json({ error: 'Database not configured' })
  }

  const user = getUserFromRequest(req)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const PAID_PLANS = ['pro', 'starter']

  const sql = neon(databaseUrl)

  // Look up plan from DB — JWT does not carry plan to avoid stale data
  const planRows = await sql`SELECT plan FROM users WHERE id = ${user.sub}`
  const userPlan = planRows[0]?.plan ?? 'free'
  if (!PAID_PLANS.includes(userPlan)) {
    return res.status(403).json({ error: 'Plan upgrade required' })
  }

  // ── GET /api/sessions ────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const rows = await sql`
      SELECT id, title, dsl, messages, chat_history AS "chatHistory",
             title_manual AS "titleManual",
             thumbnail_svg AS "thumbnailSvg",
             EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt",
             EXTRACT(EPOCH FROM updated_at) * 1000 AS "updatedAt"
      FROM user_sessions
      WHERE user_id = ${user.sub}
      ORDER BY updated_at DESC
    `
    return res.status(200).json({ sessions: rows })
  }

  // ── CSRF check for all mutating methods ──────────────────────────────────
  if (checkCsrf(req, res)) return

  // ── POST /api/sessions ───────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { id, title, dsl, messages, chatHistory, titleManual, thumbnailSvg } = req.body ?? {}
    if (!id) {
      return res.status(400).json({ error: 'Missing id' })
    }

    const cleanMessages = stripAttachments(messages ?? [])
    const cleanHistory  = stripAttachments(chatHistory ?? [])

    await sql`
      INSERT INTO user_sessions (id, user_id, title, dsl, messages, chat_history, title_manual, thumbnail_svg)
      VALUES (
        ${id},
        ${user.sub},
        ${title ?? 'Nueva sesión'},
        ${dsl ?? ''},
        ${JSON.stringify(cleanMessages)},
        ${JSON.stringify(cleanHistory)},
        ${titleManual ?? false},
        ${thumbnailSvg ?? null}
      )
      ON CONFLICT (id) DO UPDATE SET
        title        = EXCLUDED.title,
        dsl          = EXCLUDED.dsl,
        messages     = EXCLUDED.messages,
        chat_history = EXCLUDED.chat_history,
        title_manual = EXCLUDED.title_manual,
        thumbnail_svg = EXCLUDED.thumbnail_svg,
        updated_at   = NOW()
    `
    return res.status(200).json({ ok: true })
  }

  // ── PUT /api/sessions?id= ────────────────────────────────────────────────
  if (req.method === 'PUT') {
    const id = req.query?.id ?? new URL(req.url, 'http://x').searchParams.get('id')
    if (!id) {
      return res.status(400).json({ error: 'Missing id' })
    }

    const { title, dsl, messages, chatHistory, titleManual, thumbnailSvg } = req.body ?? {}
    const cleanMessages = stripAttachments(messages ?? [])
    const cleanHistory  = stripAttachments(chatHistory ?? [])

    const result = await sql`
      UPDATE user_sessions SET
        title         = ${title ?? 'Nueva sesión'},
        dsl           = ${dsl ?? ''},
        messages      = ${JSON.stringify(cleanMessages)},
        chat_history  = ${JSON.stringify(cleanHistory)},
        title_manual  = ${titleManual ?? false},
        thumbnail_svg = ${thumbnailSvg ?? null},
        updated_at    = NOW()
      WHERE id = ${id} AND user_id = ${user.sub}
    `
    if (result.count === 0) {
      return res.status(404).json({ error: 'Session not found' })
    }
    return res.status(200).json({ ok: true })
  }

  // ── DELETE /api/sessions?id= ─────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const id = req.query?.id ?? new URL(req.url, 'http://x').searchParams.get('id')
    if (!id) {
      return res.status(400).json({ error: 'Missing id' })
    }

    await sql`DELETE FROM user_sessions WHERE id = ${id} AND user_id = ${user.sub}`
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
