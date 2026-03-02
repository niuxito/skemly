import { neon } from '@neondatabase/serverless'
import { getUserFromRequest } from './_auth.js'

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

  if (user.plan !== 'pro' && user.plan !== 'starter') {
    return res.status(403).json({ error: 'Plan upgrade required' })
  }

  const sql = neon(databaseUrl)

  // ── GET /api/sessions ────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const rows = await sql`
      SELECT id, title, dsl, messages, chat_history AS "chatHistory",
             title_manual AS "titleManual",
             EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt",
             EXTRACT(EPOCH FROM updated_at) * 1000 AS "updatedAt"
      FROM user_sessions
      WHERE user_id = ${user.id}
      ORDER BY updated_at DESC
    `
    return res.status(200).json({ sessions: rows })
  }

  // ── POST /api/sessions ───────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { id, title, dsl, messages, chatHistory, titleManual } = req.body ?? {}
    if (!id) {
      return res.status(400).json({ error: 'Missing id' })
    }

    const cleanMessages = stripAttachments(messages ?? [])
    const cleanHistory  = stripAttachments(chatHistory ?? [])

    await sql`
      INSERT INTO user_sessions (id, user_id, title, dsl, messages, chat_history, title_manual)
      VALUES (
        ${id},
        ${user.id},
        ${title ?? 'Nueva sesión'},
        ${dsl ?? ''},
        ${JSON.stringify(cleanMessages)},
        ${JSON.stringify(cleanHistory)},
        ${titleManual ?? false}
      )
      ON CONFLICT (id) DO UPDATE SET
        title       = EXCLUDED.title,
        dsl         = EXCLUDED.dsl,
        messages    = EXCLUDED.messages,
        chat_history = EXCLUDED.chat_history,
        title_manual = EXCLUDED.title_manual,
        updated_at  = NOW()
    `
    return res.status(200).json({ ok: true })
  }

  // ── PUT /api/sessions?id= ────────────────────────────────────────────────
  if (req.method === 'PUT') {
    const id = req.query?.id ?? new URL(req.url, 'http://x').searchParams.get('id')
    if (!id) {
      return res.status(400).json({ error: 'Missing id' })
    }

    const { title, dsl, messages, chatHistory, titleManual } = req.body ?? {}
    const cleanMessages = stripAttachments(messages ?? [])
    const cleanHistory  = stripAttachments(chatHistory ?? [])

    const result = await sql`
      UPDATE user_sessions SET
        title        = ${title ?? 'Nueva sesión'},
        dsl          = ${dsl ?? ''},
        messages     = ${JSON.stringify(cleanMessages)},
        chat_history = ${JSON.stringify(cleanHistory)},
        title_manual = ${titleManual ?? false},
        updated_at   = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
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

    await sql`DELETE FROM user_sessions WHERE id = ${id} AND user_id = ${user.id}`
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
