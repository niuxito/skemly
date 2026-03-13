import { neon } from '@neondatabase/serverless'
import { requireAdmin } from './_requireAdmin.js'

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const sql = neon(process.env.DATABASE_URL)
  const url = req.url

  // ── Users ────────────────────────────────────────────────────────────────
  if (url.includes('/admin/users')) {
    const today = new Date().toISOString().slice(0, 10)

    if (req.method === 'GET') {
      const users = await sql`
        SELECT
          u.id, u.email, u.plan, u.plan_expires_at, u.is_admin,
          COALESCE(rl.request_count, 0) AS requests_today,
          ufo.features AS override_features,
          ufo.notes AS override_notes
        FROM users u
        LEFT JOIN rate_limits rl ON rl.user_id = u.id AND rl.window_date = ${today}
        LEFT JOIN user_feature_overrides ufo ON ufo.user_id = u.id
        ORDER BY u.id DESC
        LIMIT 200
      `
      return res.json({ users })
    }

    const idMatch = url.match(/\/admin\/users\/([^/]+)$/)
    if (req.method === 'PATCH' && idMatch) {
      const userId = idMatch[1]
      const { plan, plan_expires_at } = req.body ?? {}
      await sql`
        UPDATE users SET
          plan = COALESCE(${plan ?? null}, plan),
          plan_expires_at = ${plan_expires_at ?? null}
        WHERE id = ${userId}
      `
      return res.json({ ok: true })
    }

    const overrideMatch = url.match(/\/admin\/users\/([^/]+)\/override$/)
    if (req.method === 'PUT' && overrideMatch) {
      const userId = overrideMatch[1]
      const { features, notes } = req.body ?? {}
      await sql`
        INSERT INTO user_feature_overrides (user_id, features, notes, updated_at)
        VALUES (${userId}, ${JSON.stringify(features)}, ${notes ?? null}, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          features = user_feature_overrides.features || ${JSON.stringify(features)}::jsonb,
          notes = EXCLUDED.notes,
          updated_at = NOW()
      `
      return res.json({ ok: true })
    }

    if (req.method === 'DELETE' && overrideMatch) {
      const userId = overrideMatch[1]
      await sql`DELETE FROM user_feature_overrides WHERE user_id = ${userId}`
      return res.json({ ok: true })
    }
  }

  // ── Plan config ──────────────────────────────────────────────────────────
  if (url.includes('/admin/plan-config')) {
    if (req.method === 'GET') {
      const rows = await sql`SELECT plan, features, updated_at FROM plan_config ORDER BY plan`
      return res.json({ plans: rows })
    }

    const planMatch = url.match(/\/admin\/plan-config\/(free|starter|pro)$/)
    if (req.method === 'PATCH' && planMatch) {
      const plan = planMatch[1]
      const { features } = req.body ?? {}
      await sql`
        UPDATE plan_config
        SET features = features || ${JSON.stringify(features)}::jsonb,
            updated_at = NOW()
        WHERE plan = ${plan}
      `
      const rows = await sql`SELECT plan, features, updated_at FROM plan_config WHERE plan = ${plan}`
      return res.json({ plan: rows[0] })
    }
  }

  res.status(405).json({ error: 'Method not allowed' })
}
