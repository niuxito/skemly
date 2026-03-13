import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

// ── Hoist mocks ───────────────────────────────────────────────────────────────

vi.mock('@neondatabase/serverless', () => {
  const mockSql = vi.fn()
  mockSql.mockResolvedValue([])
  const neon = vi.fn(() => mockSql)
  return { neon, _mockSql: mockSql }
})

vi.mock('../../api/_requireAdmin.js', () => {
  const requireAdmin = vi.fn()
  return { requireAdmin }
})

beforeAll(() => {
  process.env.DATABASE_URL = 'postgres://fake-plan-config'
  process.env.JWT_SECRET = 'test-secret-plan-config'
})

import handler from '../../api/admin/plan-config.js'
import { requireAdmin } from '../../api/_requireAdmin.js'
import { _mockSql } from '@neondatabase/serverless'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ADMIN_PAYLOAD = { sub: 'uuid-admin', email: 'admin@example.com' }

function allowAdmin() {
  requireAdmin.mockResolvedValue(ADMIN_PAYLOAD)
}

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

// ─── GET /api/admin/plan-config ───────────────────────────────────────────────

describe('GET /api/admin/plan-config', () => {
  it('returns 401 when requireAdmin denies', async () => {
    denyAdmin()
    const req = makeReq({ method: 'GET', url: '/api/admin/plan-config' })
    const res = makeRes()

    await handler(req, res)

    expect(res._statusCode).toBe(401)
    expect(res._body).toEqual({ error: 'Unauthorized' })
    expect(_mockSql).not.toHaveBeenCalled()
  })

  it('returns all plan configs when admin is authenticated', async () => {
    allowAdmin()
    const fakePlans = [
      { plan: 'free',    features: { daily_requests: 20, daily_files: 2,    model_tier: 'default' }, updated_at: '2026-01-01T00:00:00Z' },
      { plan: 'pro',     features: { daily_requests: null, daily_files: null, model_tier: 'pro' },    updated_at: '2026-01-01T00:00:00Z' },
      { plan: 'starter', features: { daily_requests: 50, daily_files: 10,   model_tier: 'default' }, updated_at: '2026-01-01T00:00:00Z' },
    ]
    _mockSql.mockResolvedValueOnce(fakePlans)

    const req = makeReq({ method: 'GET', url: '/api/admin/plan-config' })
    const res = makeRes()

    await handler(req, res)

    expect(res._statusCode).toBe(200)
    expect(res._body).toEqual({ plans: fakePlans })
  })

  it('returns empty plans array when plan_config table is empty', async () => {
    allowAdmin()
    _mockSql.mockResolvedValueOnce([])

    const req = makeReq({ method: 'GET', url: '/api/admin/plan-config' })
    const res = makeRes()

    await handler(req, res)

    expect(res._body).toEqual({ plans: [] })
  })
})

// ─── PATCH /api/admin/plan-config/:plan ───────────────────────────────────────

describe('PATCH /api/admin/plan-config/:plan', () => {
  it('returns 401 when requireAdmin denies', async () => {
    denyAdmin()
    const req = makeReq({
      method: 'PATCH',
      url: '/api/admin/plan-config/free',
      body: { features: { daily_requests: 25 } },
    })
    const res = makeRes()

    await handler(req, res)

    expect(res._statusCode).toBe(401)
    expect(_mockSql).not.toHaveBeenCalled()
  })

  it('updates free plan features and returns the updated row', async () => {
    allowAdmin()
    const updatedRow = {
      plan: 'free',
      features: { daily_requests: 25, daily_files: 2, model_tier: 'default' },
      updated_at: '2026-03-12T10:00:00Z',
    }
    _mockSql
      .mockResolvedValueOnce([])           // UPDATE
      .mockResolvedValueOnce([updatedRow]) // SELECT

    const req = makeReq({
      method: 'PATCH',
      url: '/api/admin/plan-config/free',
      body: { features: { daily_requests: 25 } },
    })
    const res = makeRes()

    await handler(req, res)

    expect(res._statusCode).toBe(200)
    expect(res._body).toEqual({ plan: updatedRow })
  })

  it('updates starter plan features and returns the updated row', async () => {
    allowAdmin()
    const updatedRow = {
      plan: 'starter',
      features: { daily_requests: 75, daily_files: 15, model_tier: 'default' },
      updated_at: '2026-03-12T10:00:00Z',
    }
    _mockSql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([updatedRow])

    const req = makeReq({
      method: 'PATCH',
      url: '/api/admin/plan-config/starter',
      body: { features: { daily_requests: 75, daily_files: 15 } },
    })
    const res = makeRes()

    await handler(req, res)

    expect(res._body).toEqual({ plan: updatedRow })
  })

  it('updates pro plan features and returns the updated row', async () => {
    allowAdmin()
    const updatedRow = {
      plan: 'pro',
      features: { daily_requests: null, daily_files: null, model_tier: 'pro' },
      updated_at: '2026-03-12T10:00:00Z',
    }
    _mockSql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([updatedRow])

    const req = makeReq({
      method: 'PATCH',
      url: '/api/admin/plan-config/pro',
      body: { features: { model_tier: 'pro' } },
    })
    const res = makeRes()

    await handler(req, res)

    expect(res._body).toEqual({ plan: updatedRow })
  })

  it('performs exactly two SQL calls (UPDATE then SELECT) for a PATCH', async () => {
    allowAdmin()
    _mockSql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ plan: 'free', features: {}, updated_at: null }])

    const req = makeReq({
      method: 'PATCH',
      url: '/api/admin/plan-config/free',
      body: { features: {} },
    })
    const res = makeRes()

    await handler(req, res)

    expect(_mockSql).toHaveBeenCalledTimes(2)
  })

  // ── URL pattern does NOT match unknown plan names ─────────────────────────

  it('returns 405 for PATCH on an unrecognized plan name', async () => {
    allowAdmin()

    const req = makeReq({
      method: 'PATCH',
      url: '/api/admin/plan-config/enterprise', // not in (free|starter|pro)
      body: { features: { daily_requests: 500 } },
    })
    const res = makeRes()

    await handler(req, res)

    // planMatch fails → falls through to 405
    expect(res._statusCode).toBe(405)
    expect(res._body).toEqual({ error: 'Method not allowed' })
  })
})

// ─── 405 Method Not Allowed ───────────────────────────────────────────────────

describe('405 fallback', () => {
  it('returns 405 for POST', async () => {
    allowAdmin()

    const req = makeReq({ method: 'POST', url: '/api/admin/plan-config' })
    const res = makeRes()

    await handler(req, res)

    expect(res._statusCode).toBe(405)
    expect(res._body).toEqual({ error: 'Method not allowed' })
  })

  it('returns 405 for DELETE', async () => {
    allowAdmin()

    const req = makeReq({ method: 'DELETE', url: '/api/admin/plan-config/free' })
    const res = makeRes()

    await handler(req, res)

    expect(res._statusCode).toBe(405)
    expect(res._body).toEqual({ error: 'Method not allowed' })
  })

  it('returns 405 for PUT', async () => {
    allowAdmin()

    const req = makeReq({ method: 'PUT', url: '/api/admin/plan-config/free' })
    const res = makeRes()

    await handler(req, res)

    expect(res._statusCode).toBe(405)
  })
})
