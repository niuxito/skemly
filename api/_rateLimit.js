/**
 * Shared rate limiting logic for all server environments
 * (Vercel serverless, Vite dev server, standalone node server).
 */
import { neon } from '@neondatabase/serverless'

/**
 * Checks and increments the request count for the given IP.
 * Returns:
 *   { allowed: true,  remaining: number | null }
 *   { allowed: false, limit: number, resetAt: string }
 */
export async function checkRateLimit({ ip, databaseUrl, dailyLimit = 20 }) {
  if (!databaseUrl) {
    console.warn('[rate-limit] DATABASE_URL not set — skipping rate limiting')
    return { allowed: true, remaining: null }
  }

  try {
    const sql = neon(databaseUrl)

    const rows = await sql`
      INSERT INTO rate_limits (ip_address, window_date, request_count, updated_at)
      VALUES (${ip}, CURRENT_DATE, 1, NOW())
      ON CONFLICT (ip_address, window_date)
      DO UPDATE SET
        request_count = rate_limits.request_count + 1,
        updated_at = NOW()
      RETURNING request_count
    `
    const count = rows[0].request_count

    // Fire-and-forget cleanup of rows older than 2 days
    sql`DELETE FROM rate_limits WHERE window_date < CURRENT_DATE - 2`.catch(() => {})

    if (count > dailyLimit) {
      const now = new Date()
      const resetAt = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1
      ))
      return { allowed: false, limit: dailyLimit, resetAt: resetAt.toISOString() }
    }

    return { allowed: true, remaining: Math.max(0, dailyLimit - count) }
  } catch (err) {
    console.error('[rate-limit] Check failed:', err.message)
    return { allowed: true, remaining: null }
  }
}
