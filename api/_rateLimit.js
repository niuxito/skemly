/**
 * Shared rate limiting logic for all server environments
 * (Vercel serverless, Vite dev server, standalone node server).
 */
import { neon } from '@neondatabase/serverless'

function midnight() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString()
}

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
      ON CONFLICT (ip_address, window_date) WHERE user_id IS NULL
      DO UPDATE SET
        request_count = rate_limits.request_count + 1,
        updated_at = NOW()
      RETURNING request_count
    `
    const count = rows[0].request_count

    // Fire-and-forget cleanup of rows older than 2 days
    sql`DELETE FROM rate_limits WHERE window_date < CURRENT_DATE - 2`.catch(() => {})

    if (count > dailyLimit) {
      return { allowed: false, limit: dailyLimit, resetAt: midnight() }
    }

    return { allowed: true, remaining: Math.max(0, dailyLimit - count) }
  } catch (err) {
    console.error('[rate-limit] Check failed:', err.message)
    return { allowed: true, remaining: null }
  }
}

/**
 * Checks the current file upload count for the given IP WITHOUT incrementing.
 * Call this before attempting the upstream request.
 * Returns:
 *   { allowed: true,  remaining: number | null }
 *   { allowed: false, limit: number, resetAt: string }
 */
export async function checkFileRateLimit({ ip, databaseUrl, dailyLimit = 5 }) {
  if (!databaseUrl) {
    console.warn('[file-rate-limit] DATABASE_URL not set — skipping')
    return { allowed: true, remaining: null }
  }

  try {
    const sql = neon(databaseUrl)
    const rows = await sql`
      SELECT COALESCE(file_count, 0) AS file_count
      FROM rate_limits
      WHERE ip_address = ${ip} AND window_date = CURRENT_DATE
    `
    const count = rows[0]?.file_count ?? 0

    if (count >= dailyLimit) {
      return { allowed: false, limit: dailyLimit, resetAt: midnight() }
    }

    return { allowed: true, remaining: Math.max(0, dailyLimit - count) }
  } catch (err) {
    console.error('[file-rate-limit] Check failed:', err.message)
    return { allowed: true, remaining: null }
  }
}

/**
 * Checks (read-only) whether the IP has exceeded the login attempt limit.
 * Does NOT increment — call incrementLoginAttempt() on each failed attempt.
 */
export async function checkLoginAttempts({ ip, databaseUrl, limit = 20 }) {
  if (!databaseUrl) {
    console.warn('[login-rate-limit] DATABASE_URL not set — skipping')
    return { allowed: true, remaining: null }
  }
  try {
    const sql = neon(databaseUrl)
    const rows = await sql`
      SELECT COALESCE(login_count, 0) AS login_count
      FROM rate_limits
      WHERE ip_address = ${ip} AND window_date = CURRENT_DATE
    `
    const count = rows[0]?.login_count ?? 0
    if (count >= limit) {
      return { allowed: false, limit, resetAt: midnight() }
    }
    return { allowed: true, remaining: Math.max(0, limit - count) }
  } catch (err) {
    console.error('[login-rate-limit] Check failed:', err.message)
    return { allowed: true, remaining: null }
  }
}

/**
 * Increments the failed login counter for the given IP.
 * Call ONLY on failed login attempts (wrong password / unknown email).
 */
export async function incrementLoginAttempt({ ip, databaseUrl }) {
  if (!databaseUrl) return
  try {
    const sql = neon(databaseUrl)
    await sql`
      INSERT INTO rate_limits (ip_address, window_date, request_count, login_count, updated_at)
      VALUES (${ip}, CURRENT_DATE, 0, 1, NOW())
      ON CONFLICT (ip_address, window_date) WHERE user_id IS NULL
      DO UPDATE SET
        login_count = rate_limits.login_count + 1,
        updated_at = NOW()
    `
  } catch (err) {
    console.error('[login-rate-limit] Increment failed:', err.message)
  }
}

/**
 * Increments the OTP attempt counter for the given IP and checks the limit.
 * Call on EVERY OTP verification attempt (before comparing the code).
 * Returns { allowed, remaining, limit, resetAt }
 */
export async function checkAndIncrementOtpAttempt({ ip, databaseUrl, limit = 10 }) {
  if (!databaseUrl) {
    console.warn('[otp-rate-limit] DATABASE_URL not set — skipping')
    return { allowed: true, remaining: null }
  }
  try {
    const sql = neon(databaseUrl)
    const rows = await sql`
      INSERT INTO rate_limits (ip_address, window_date, request_count, otp_count, updated_at)
      VALUES (${ip}, CURRENT_DATE, 0, 1, NOW())
      ON CONFLICT (ip_address, window_date) WHERE user_id IS NULL
      DO UPDATE SET
        otp_count = rate_limits.otp_count + 1,
        updated_at = NOW()
      RETURNING otp_count
    `
    const count = rows[0].otp_count
    if (count > limit) {
      return { allowed: false, limit, resetAt: midnight() }
    }
    return { allowed: true, remaining: Math.max(0, limit - count) }
  } catch (err) {
    console.error('[otp-rate-limit] Check failed:', err.message)
    return { allowed: true, remaining: null }
  }
}

/**
 * Increments the share counter for the given IP and checks the limit.
 * Call on EVERY POST /api/share attempt.
 * Returns { allowed, remaining, limit, resetAt }
 */
export async function checkAndIncrementShareAttempt({ ip, databaseUrl, limit = 50 }) {
  if (!databaseUrl) {
    console.warn('[share-rate-limit] DATABASE_URL not set — skipping')
    return { allowed: true, remaining: null }
  }
  try {
    const sql = neon(databaseUrl)
    const rows = await sql`
      INSERT INTO rate_limits (ip_address, window_date, request_count, share_count, updated_at)
      VALUES (${ip}, CURRENT_DATE, 0, 1, NOW())
      ON CONFLICT (ip_address, window_date) WHERE user_id IS NULL
      DO UPDATE SET
        share_count = rate_limits.share_count + 1,
        updated_at = NOW()
      RETURNING share_count
    `
    const count = rows[0].share_count
    if (count > limit) {
      return { allowed: false, limit, resetAt: midnight() }
    }
    return { allowed: true, remaining: Math.max(0, limit - count) }
  } catch (err) {
    console.error('[share-rate-limit] Check failed:', err.message)
    return { allowed: true, remaining: null }
  }
}

/**
 * Increments the registration counter for the given IP and checks the limit.
 * Call on EVERY registration attempt (before inserting the user).
 * Returns { allowed, remaining, limit, resetAt }
 */
export async function checkAndIncrementRegisterAttempt({ ip, databaseUrl, limit = 5 }) {
  if (!databaseUrl) {
    console.warn('[register-rate-limit] DATABASE_URL not set — skipping')
    return { allowed: true, remaining: null }
  }
  try {
    const sql = neon(databaseUrl)
    const rows = await sql`
      INSERT INTO rate_limits (ip_address, window_date, request_count, register_count, updated_at)
      VALUES (${ip}, CURRENT_DATE, 0, 1, NOW())
      ON CONFLICT (ip_address, window_date) WHERE user_id IS NULL
      DO UPDATE SET
        register_count = rate_limits.register_count + 1,
        updated_at = NOW()
      RETURNING register_count
    `
    const count = rows[0].register_count
    if (count > limit) {
      return { allowed: false, limit, resetAt: midnight() }
    }
    return { allowed: true, remaining: Math.max(0, limit - count) }
  } catch (err) {
    console.error('[register-rate-limit] Check failed:', err.message)
    return { allowed: true, remaining: null }
  }
}

/**
 * Increments the prompt injection counter for the given IP and checks the limit.
 * Call on EVERY detected injection attempt (before forwarding to Anthropic).
 * Returns { allowed: boolean, limit: number, resetAt?: string }
 */
export async function checkAndIncrementInjectionAttempt({ ip, databaseUrl, limit = 10 }) {
  if (!databaseUrl) {
    console.warn('[injection-guard] DATABASE_URL not set — skipping')
    return { allowed: true }
  }
  try {
    const sql = neon(databaseUrl)
    const rows = await sql`
      INSERT INTO rate_limits (ip_address, window_date, request_count, injection_count, updated_at)
      VALUES (${ip}, CURRENT_DATE, 0, 1, NOW())
      ON CONFLICT (ip_address, window_date) WHERE user_id IS NULL
      DO UPDATE SET
        injection_count = rate_limits.injection_count + 1,
        updated_at = NOW()
      RETURNING injection_count
    `
    const count = rows[0].injection_count
    if (count > limit) {
      return { allowed: false, limit, resetAt: midnight() }
    }
    return { allowed: true }
  } catch (err) {
    console.error('[injection-guard] Increment failed:', err.message)
    return { allowed: true }
  }
}

/**
 * Increments the file upload count for the given IP.
 * Call this only after the upstream request succeeds.
 */
export async function incrementFileCount({ ip, databaseUrl }) {
  if (!databaseUrl) return
  try {
    const sql = neon(databaseUrl)
    await sql`
      INSERT INTO rate_limits (ip_address, window_date, request_count, file_count, updated_at)
      VALUES (${ip}, CURRENT_DATE, 0, 1, NOW())
      ON CONFLICT (ip_address, window_date)
      WHERE user_id IS NULL
      DO UPDATE SET
        file_count = rate_limits.file_count + 1,
        updated_at = NOW()
    `
  } catch (err) {
    console.error('[file-rate-limit] Increment failed:', err.message)
  }
}

// ── User-aware rate limiting ──────────────────────────────────────────────────

/**
 * Checks (and for anonymous users, increments) the daily request count.
 * For authenticated users: check-only (increment separately via incrementRequestCountByUser).
 * For anonymous: delegates to IP-based checkRateLimit which increments atomically.
 * Returns: { allowed: boolean, count: number, limit: number|null }
 */
export async function checkRateLimitByUser({ userId, ip, databaseUrl, dailyLimit }) {
  // No limit for pro plan (null = unlimited)
  if (dailyLimit === null || dailyLimit === undefined) return { allowed: true, count: 0, limit: null }

  if (!userId) return checkRateLimit({ ip, databaseUrl, dailyLimit })

  const sql = neon(databaseUrl)
  const today = new Date().toISOString().slice(0, 10)

  await sql`
    INSERT INTO rate_limits (user_id, window_date, request_count)
    VALUES (${userId}, ${today}, 0)
    ON CONFLICT (user_id, window_date)
    WHERE user_id IS NOT NULL
    DO NOTHING
  `
  const rows = await sql`
    SELECT request_count FROM rate_limits
    WHERE user_id = ${userId} AND window_date = ${today}
  `
  const count = rows[0]?.request_count ?? 0
  if (count >= dailyLimit) return { allowed: false, count, limit: dailyLimit }
  return { allowed: true, count, limit: dailyLimit }
}

/**
 * Increments the request count for an authenticated user.
 * For anonymous users, delegates to IP-based increment (no-op since checkRateLimit already incremented).
 */
export async function incrementRequestCountByUser({ userId, ip, databaseUrl }) {
  if (!userId) return // IP-based already incremented atomically in checkRateLimit

  const sql = neon(databaseUrl)
  const today = new Date().toISOString().slice(0, 10)
  await sql`
    UPDATE rate_limits SET request_count = request_count + 1
    WHERE user_id = ${userId} AND window_date = ${today}
  `
}

/**
 * Checks the daily file upload count for an authenticated user or anonymous IP.
 * Does NOT increment — call incrementFileCountByUser after successful upload.
 */
export async function checkFileRateLimitByUser({ userId, ip, databaseUrl, dailyFileLimit }) {
  if (dailyFileLimit === null || dailyFileLimit === undefined) return { allowed: true, count: 0, limit: null }

  const sql = neon(databaseUrl)
  const today = new Date().toISOString().slice(0, 10)

  if (!userId) {
    const rows = await sql`
      SELECT file_count FROM rate_limits
      WHERE ip_address = ${ip} AND window_date = ${today} AND user_id IS NULL
    `
    const count = rows[0]?.file_count ?? 0
    if (count >= dailyFileLimit) return { allowed: false, count, limit: dailyFileLimit }
    return { allowed: true, count, limit: dailyFileLimit }
  }

  await sql`
    INSERT INTO rate_limits (user_id, window_date, request_count, file_count)
    VALUES (${userId}, ${today}, 0, 0)
    ON CONFLICT (user_id, window_date)
    WHERE user_id IS NOT NULL
    DO NOTHING
  `
  const rows = await sql`SELECT file_count FROM rate_limits WHERE user_id = ${userId} AND window_date = ${today}`
  const count = rows[0]?.file_count ?? 0
  if (count >= dailyFileLimit) return { allowed: false, count, limit: dailyFileLimit }
  return { allowed: true, count, limit: dailyFileLimit }
}

/**
 * Increments the file upload count for an authenticated user or anonymous IP.
 * Call only after the upstream request succeeds.
 */
export async function incrementFileCountByUser({ userId, ip, databaseUrl }) {
  const sql = neon(databaseUrl)
  const today = new Date().toISOString().slice(0, 10)
  if (!userId) {
    await sql`
      UPDATE rate_limits SET file_count = file_count + 1
      WHERE ip_address = ${ip} AND window_date = ${today} AND user_id IS NULL
    `
    return
  }
  await sql`
    UPDATE rate_limits SET file_count = COALESCE(file_count, 0) + 1
    WHERE user_id = ${userId} AND window_date = ${today}
  `
}
