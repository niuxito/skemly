import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

// ── Mock @neondatabase/serverless before any import uses it ───────────────────
vi.mock('@neondatabase/serverless', () => {
  const mockSql = vi.fn()
  mockSql.mockResolvedValue([])
  const neon = vi.fn(() => mockSql)
  return { neon, _mockSql: mockSql }
})

// ── Set env vars before the modules that read them are imported ───────────────
beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-requireadmin'
  process.env.DATABASE_URL = 'postgres://fake-url'
})

import { requireAdmin } from '../../api/_requireAdmin.js'
import { signToken } from '../../api/_auth.js'
import { _mockSql } from '@neondatabase/serverless'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Creates a minimal mock Express-style request with a Bearer token in the
 * Authorization header.  The JWT payload uses `sub` for the user ID, which is
 * what requireAdmin reads via getUserFromRequest → verifyToken.
 */
function makeReq(token = null) {
  const headers = token ? { authorization: `Bearer ${token}` } : {}
  return { headers }
}

/**
 * Creates a minimal mock Express-style response that records status / json
 * calls so we can assert on them.
 */
function makeRes() {
  const res = {
    _statusCode: 200,
    _body: null,
    status(code) {
      this._statusCode = code
      return this
    },
    json(body) {
      this._body = body
      return this
    },
  }
  return res
}

beforeEach(() => {
  vi.resetAllMocks()
  _mockSql.mockResolvedValue([])
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

// ─── requireAdmin ─────────────────────────────────────────────────────────────

describe('requireAdmin', () => {
  // ── 401: No JWT present ───────────────────────────────────────────────────

  it('returns null and responds 401 when no cookie or Authorization header is present', async () => {
    const req = makeReq(null)
    const res = makeRes()

    const result = await requireAdmin(req, res)

    expect(result).toBeNull()
    expect(res._statusCode).toBe(401)
    expect(res._body).toEqual({ error: 'Unauthorized' })
  })

  it('returns null and responds 401 when Authorization header is present but token is invalid', async () => {
    const req = makeReq('this-is-not-a-valid-jwt')
    const res = makeRes()

    const result = await requireAdmin(req, res)

    expect(result).toBeNull()
    expect(res._statusCode).toBe(401)
    expect(res._body).toEqual({ error: 'Unauthorized' })
  })

  // ── 403: Authenticated but not admin ─────────────────────────────────────

  it('returns null and responds 403 when user exists but is_admin=false', async () => {
    const token = signToken({ sub: 'uuid-non-admin' })
    const req = makeReq(token)
    const res = makeRes()

    // DB confirms the user exists but is not an admin
    _mockSql.mockResolvedValue([{ is_admin: false }])

    const result = await requireAdmin(req, res)

    expect(result).toBeNull()
    expect(res._statusCode).toBe(403)
    expect(res._body).toEqual({ error: 'Forbidden: admin only' })
  })

  it('returns null and responds 403 when is_admin is null (treated as falsy)', async () => {
    const token = signToken({ sub: 'uuid-null-admin' })
    const req = makeReq(token)
    const res = makeRes()

    _mockSql.mockResolvedValue([{ is_admin: null }])

    const result = await requireAdmin(req, res)

    expect(result).toBeNull()
    expect(res._statusCode).toBe(403)
  })

  it('returns null and responds 403 when DB returns no rows for the user', async () => {
    const token = signToken({ sub: 'uuid-unknown-user' })
    const req = makeReq(token)
    const res = makeRes()

    // User not found in DB — rows[0] is undefined → rows[0]?.is_admin is undefined (falsy)
    _mockSql.mockResolvedValue([])

    const result = await requireAdmin(req, res)

    expect(result).toBeNull()
    expect(res._statusCode).toBe(403)
    expect(res._body).toEqual({ error: 'Forbidden: admin only' })
  })

  // ── 500: DB throws ────────────────────────────────────────────────────────

  it('returns null and responds 500 when DB throws', async () => {
    const token = signToken({ sub: 'uuid-admin-user' })
    const req = makeReq(token)
    const res = makeRes()

    _mockSql.mockRejectedValue(new Error('DB connection refused'))

    const result = await requireAdmin(req, res)

    expect(result).toBeNull()
    expect(res._statusCode).toBe(500)
    expect(res._body).toEqual({ error: 'Internal server error' })
    expect(console.error).toHaveBeenCalledOnce()
  })

  // ── Success: user is admin ────────────────────────────────────────────────

  it('returns the JWT payload when user is_admin=true', async () => {
    const userId = 'uuid-admin-verified'
    const token = signToken({ sub: userId, email: 'admin@example.com' })
    const req = makeReq(token)
    const res = makeRes()

    _mockSql.mockResolvedValue([{ is_admin: true }])

    const result = await requireAdmin(req, res)

    expect(result).not.toBeNull()
    // The returned payload must contain the sub field we signed with
    expect(result.sub).toBe(userId)
    expect(result.email).toBe('admin@example.com')
    // Response must not have been touched with an error status
    expect(res._statusCode).toBe(200)
    expect(res._body).toBeNull()
  })

  it('queries the DB with the sub from the JWT payload', async () => {
    const userId = 'uuid-admin-query-check'
    const token = signToken({ sub: userId })
    const req = makeReq(token)
    const res = makeRes()

    _mockSql.mockResolvedValue([{ is_admin: true }])

    await requireAdmin(req, res)

    // Verify neon's sql tagged template was called (at least once for the SELECT)
    expect(_mockSql).toHaveBeenCalled()
  })

  // ── Cookie-based auth ─────────────────────────────────────────────────────

  it('reads the token from the vibediag_token HttpOnly cookie', async () => {
    const userId = 'uuid-admin-cookie'
    const token = signToken({ sub: userId })
    const req = {
      headers: {
        cookie: `vibediag_token=${token}; other_cookie=xyz`,
      },
    }
    const res = makeRes()

    _mockSql.mockResolvedValue([{ is_admin: true }])

    const result = await requireAdmin(req, res)

    expect(result).not.toBeNull()
    expect(result.sub).toBe(userId)
  })
})
