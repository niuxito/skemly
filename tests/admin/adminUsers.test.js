import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

// ── Hoist mocks ───────────────────────────────────────────────────────────────
// Both @neondatabase/serverless and ../_requireAdmin must be mocked BEFORE the
// handler is imported so the handler always uses the mock versions.

vi.mock('@neondatabase/serverless', () => {
  const mockSql = vi.fn()
  mockSql.mockResolvedValue([])
  const neon = vi.fn(() => mockSql)
  return { neon, _mockSql: mockSql }
})

// Mock _requireAdmin so we can control whether admin auth passes or fails
// without needing a real DB or real JWT.
vi.mock('../../api/_requireAdmin.js', () => {
  const requireAdmin = vi.fn()
  return { requireAdmin }
})

beforeAll(() => {
  process.env.DATABASE_URL = 'postgres://fake-admin-users'
  process.env.JWT_SECRET = 'test-secret-admin-users'
})

import handler from '../../api/admin/users.js'
import { requireAdmin } from '../../api/_requireAdmin.js'
import { _mockSql } from '@neondatabase/serverless'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ADMIN_PAYLOAD = { sub: 'uuid-admin', email: 'admin@example.com' }

/** Fake admin payload — requireAdmin returns this to signal success */
function allowAdmin() {
  requireAdmin.mockResolvedValue(ADMIN_PAYLOAD)
}

/** Simulate requireAdmin rejecting with 401/403 — handler must short-circuit */
function denyAdmin() {
  requireAdmin.mockImplementation(async (_req, res) => {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  })
}

function makeRes() {
  const res = {
    _statusCode: 200,
    _body: null,
    status(code) { this._statusCode = code; return this },
    json(body)   { this._body = body; return this },
  }
  return res
}

function makeReq({ method, url, body = {} } = {}) {
  return { method, url, body, headers: {} }
}

beforeEach(() => {
  vi.resetAllMocks()
  _mockSql.mockResolvedValue([])
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

// ─── GET /api/admin/users ─────────────────────────────────────────────────────

describe('GET /api/admin/users', () => {
  it('returns 401 when requireAdmin denies (not admin)', async () => {
    denyAdmin()
    const req = makeReq({ method: 'GET', url: '/api/admin/users' })
    const res = makeRes()

    await handler(req, res)

    expect(res._statusCode).toBe(401)
    expect(res._body).toEqual({ error: 'Unauthorized' })
    // SQL must not be executed by the handler itself
    expect(_mockSql).not.toHaveBeenCalled()
  })

  it('returns users list from DB when admin is authenticated', async () => {
    allowAdmin()
    const fakeUsers = [
      {
        id: 'uuid-user-1',
        email: 'alice@example.com',
        plan: 'free',
        plan_expires_at: null,
        is_admin: false,
        requests_today: 3,
        override_features: null,
        override_notes: null,
      },
      {
        id: 'uuid-user-2',
        email: 'bob@example.com',
        plan: 'starter',
        plan_expires_at: '2026-06-01',
        is_admin: false,
        requests_today: 12,
        override_features: { daily_requests: 100 },
        override_notes: 'special partner',
      },
    ]
    _mockSql.mockResolvedValueOnce(fakeUsers)

    const req = makeReq({ method: 'GET', url: '/api/admin/users' })
    const res = makeRes()

    await handler(req, res)

    expect(res._statusCode).toBe(200)
    expect(res._body).toEqual({ users: fakeUsers })
  })

  it('returns empty users array when no users in DB', async () => {
    allowAdmin()
    _mockSql.mockResolvedValueOnce([])

    const req = makeReq({ method: 'GET', url: '/api/admin/users' })
    const res = makeRes()

    await handler(req, res)

    expect(res._body).toEqual({ users: [] })
  })
})

// ─── PATCH /api/admin/users/:id ───────────────────────────────────────────────

describe('PATCH /api/admin/users/:id', () => {
  const USER_ID = 'uuid-target-user'

  it('returns 401 when requireAdmin denies', async () => {
    denyAdmin()
    const req = makeReq({
      method: 'PATCH',
      url: `/api/admin/users/${USER_ID}`,
      body: { plan: 'starter' },
    })
    const res = makeRes()

    await handler(req, res)

    expect(res._statusCode).toBe(401)
    expect(_mockSql).not.toHaveBeenCalled()
  })

  it('updates plan and responds ok:true', async () => {
    allowAdmin()
    _mockSql.mockResolvedValueOnce([]) // UPDATE result

    const req = makeReq({
      method: 'PATCH',
      url: `/api/admin/users/${USER_ID}`,
      body: { plan: 'starter', plan_expires_at: '2026-12-31' },
    })
    const res = makeRes()

    await handler(req, res)

    expect(res._statusCode).toBe(200)
    expect(res._body).toEqual({ ok: true })
    expect(_mockSql).toHaveBeenCalledOnce()
  })

  it('works when only plan_expires_at is provided (plan=undefined)', async () => {
    allowAdmin()
    _mockSql.mockResolvedValueOnce([])

    const req = makeReq({
      method: 'PATCH',
      url: `/api/admin/users/${USER_ID}`,
      body: { plan_expires_at: '2026-12-31' },
    })
    const res = makeRes()

    await handler(req, res)

    expect(res._body).toEqual({ ok: true })
  })

  it('works with an empty body (no-op update)', async () => {
    allowAdmin()
    _mockSql.mockResolvedValueOnce([])

    const req = makeReq({
      method: 'PATCH',
      url: `/api/admin/users/${USER_ID}`,
      body: {},
    })
    const res = makeRes()

    await handler(req, res)

    expect(res._body).toEqual({ ok: true })
  })
})

// ─── PUT /api/admin/users/:id/override ───────────────────────────────────────

describe('PUT /api/admin/users/:id/override', () => {
  const USER_ID = 'uuid-override-target'

  it('returns 401 when requireAdmin denies', async () => {
    denyAdmin()
    const req = makeReq({
      method: 'PUT',
      url: `/api/admin/users/${USER_ID}/override`,
      body: { features: { daily_requests: 999 } },
    })
    const res = makeRes()

    await handler(req, res)

    expect(res._statusCode).toBe(401)
    expect(_mockSql).not.toHaveBeenCalled()
  })

  it('upserts override features and responds ok:true', async () => {
    allowAdmin()
    _mockSql.mockResolvedValueOnce([]) // INSERT/UPDATE result

    const req = makeReq({
      method: 'PUT',
      url: `/api/admin/users/${USER_ID}/override`,
      body: { features: { daily_requests: 999, model_tier: 'pro' }, notes: 'VIP user' },
    })
    const res = makeRes()

    await handler(req, res)

    expect(res._statusCode).toBe(200)
    expect(res._body).toEqual({ ok: true })
    expect(_mockSql).toHaveBeenCalledOnce()
  })

  it('accepts PUT with notes=undefined (no notes provided)', async () => {
    allowAdmin()
    _mockSql.mockResolvedValueOnce([])

    const req = makeReq({
      method: 'PUT',
      url: `/api/admin/users/${USER_ID}/override`,
      body: { features: { daily_requests: 50 } },
    })
    const res = makeRes()

    await handler(req, res)

    expect(res._body).toEqual({ ok: true })
  })
})

// ─── DELETE /api/admin/users/:id/override ────────────────────────────────────

describe('DELETE /api/admin/users/:id/override', () => {
  const USER_ID = 'uuid-delete-override'

  it('returns 401 when requireAdmin denies', async () => {
    denyAdmin()
    const req = makeReq({
      method: 'DELETE',
      url: `/api/admin/users/${USER_ID}/override`,
    })
    const res = makeRes()

    await handler(req, res)

    expect(res._statusCode).toBe(401)
    expect(_mockSql).not.toHaveBeenCalled()
  })

  it('deletes override and responds ok:true', async () => {
    allowAdmin()
    _mockSql.mockResolvedValueOnce([]) // DELETE result

    const req = makeReq({
      method: 'DELETE',
      url: `/api/admin/users/${USER_ID}/override`,
    })
    const res = makeRes()

    await handler(req, res)

    expect(res._statusCode).toBe(200)
    expect(res._body).toEqual({ ok: true })
    expect(_mockSql).toHaveBeenCalledOnce()
  })
})

// ─── 405 Method Not Allowed ───────────────────────────────────────────────────

describe('405 fallback', () => {
  it('returns 405 for POST requests', async () => {
    allowAdmin()

    const req = makeReq({ method: 'POST', url: '/api/admin/users' })
    const res = makeRes()

    await handler(req, res)

    expect(res._statusCode).toBe(405)
    expect(res._body).toEqual({ error: 'Method not allowed' })
  })

  it('returns 405 for PUT on the base /users URL (no override path match)', async () => {
    allowAdmin()

    const req = makeReq({ method: 'PUT', url: '/api/admin/users' })
    const res = makeRes()

    await handler(req, res)

    expect(res._statusCode).toBe(405)
  })
})
