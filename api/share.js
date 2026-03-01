import { neon } from '@neondatabase/serverless'

function generateShortId(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

function titleToSlug(title) {
  return (title ?? 'diagram')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50)
    || 'diagram'
}

export default async function handler(req, res) {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    return res.status(500).json({ error: 'Database not configured' })
  }

  const sql = neon(databaseUrl)

  // ── GET /api/share?id={short_id} ─────────────────────────────────────────
  if (req.method === 'GET') {
    const shortId = req.query?.id ?? new URL(req.url, 'http://x').searchParams.get('id')
    if (!shortId) {
      return res.status(400).json({ error: 'Missing id parameter' })
    }
    const rows = await sql`SELECT title, dsl FROM shared_diagrams WHERE short_id = ${shortId}`
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Diagram not found' })
    }
    return res.status(200).json({ title: rows[0].title, dsl: rows[0].dsl })
  }

  // ── POST /api/share ───────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { dsl, title } = req.body ?? {}
    if (!dsl) {
      return res.status(400).json({ error: 'Missing dsl' })
    }

    const slug = titleToSlug(title)
    let short_id
    let attempts = 0
    while (attempts < 10) {
      short_id = generateShortId(6)
      const existing = await sql`SELECT id FROM shared_diagrams WHERE short_id = ${short_id}`
      if (existing.length === 0) break
      attempts++
    }

    await sql`
      INSERT INTO shared_diagrams (short_id, slug, title, dsl)
      VALUES (${short_id}, ${slug}, ${title ?? null}, ${dsl})
    `

    return res.status(200).json({ path: `/s/${slug}-${short_id}` })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
