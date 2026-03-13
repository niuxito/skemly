import { neon } from '@neondatabase/serverless'
import { requireAdmin } from '../_requireAdmin.js'

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const sql = neon(process.env.DATABASE_URL)

  // GET /api/admin/plan-config
  if (req.method === 'GET') {
    const rows = await sql`SELECT plan, features, updated_at FROM plan_config ORDER BY plan`
    return res.json({ plans: rows })
  }

  // PATCH /api/admin/plan-config/:plan
  const planMatch = req.url.match(/\/api\/admin\/plan-config\/(free|starter|pro)$/)
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

  res.status(405).json({ error: 'Method not allowed' })
}
