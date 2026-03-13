import { neon } from '@neondatabase/serverless'

const FALLBACK = {
  free:    { daily_requests: 20,   daily_files: 2,    model_tier: 'default' },
  starter: { daily_requests: 50,   daily_files: 10,   model_tier: 'default' },
  pro:     { daily_requests: null, daily_files: null, model_tier: 'pro' },
}

export async function resolveUserFeatures({ userId, userPlan, databaseUrl }) {
  try {
    const sql = neon(databaseUrl)
    const plan = userPlan ?? 'free'
    const rows = await sql`
      SELECT
        pc.features AS plan_features,
        ufo.features AS user_overrides
      FROM plan_config pc
      LEFT JOIN user_feature_overrides ufo ON ufo.user_id = ${userId ?? null}
      WHERE pc.plan = ${plan}
    `
    const row = rows[0]
    const base     = row?.plan_features  ?? FALLBACK[plan] ?? FALLBACK.free
    const override = row?.user_overrides ?? {}
    return { ...base, ...override }
  } catch (err) {
    console.error('[_plans] resolveUserFeatures error:', err.message)
    const plan = userPlan ?? 'free'
    return FALLBACK[plan] ?? FALLBACK.free
  }
}
