import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock is hoisted — must appear before any import that touches @neondatabase/serverless
vi.mock('@neondatabase/serverless', () => {
  const mockSql = vi.fn()
  mockSql.mockResolvedValue([])
  const neon = vi.fn(() => mockSql)
  return { neon, _mockSql: mockSql }
})

import { resolveUserFeatures } from '../../api/_plans.js'
import { _mockSql } from '@neondatabase/serverless'

// FALLBACK values mirrored from the module under test for assertion clarity
const FALLBACK = {
  free:    { daily_requests: 20,   daily_files: 2,    model_tier: 'default' },
  starter: { daily_requests: 50,   daily_files: 10,   model_tier: 'default' },
  pro:     { daily_requests: null, daily_files: null, model_tier: 'pro' },
}

beforeEach(() => {
  vi.resetAllMocks()
  _mockSql.mockResolvedValue([])
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

// ─── resolveUserFeatures ──────────────────────────────────────────────────────

describe('resolveUserFeatures', () => {
  // ── Happy-path: DB returns plan_features ──────────────────────────────────

  it('returns plan_features from DB when row exists and no overrides', async () => {
    const planFeatures = { daily_requests: 50, daily_files: 10, model_tier: 'default' }
    _mockSql.mockResolvedValue([{ plan_features: planFeatures, user_overrides: null }])

    const result = await resolveUserFeatures({
      userId: 'uuid-user-1',
      userPlan: 'starter',
      databaseUrl: 'postgres://fake',
    })

    expect(result).toEqual(planFeatures)
  })

  it('merges user_overrides on top of plan_features', async () => {
    const planFeatures = { daily_requests: 20, daily_files: 2, model_tier: 'default' }
    const userOverrides = { daily_requests: 999, model_tier: 'pro' }
    _mockSql.mockResolvedValue([{ plan_features: planFeatures, user_overrides: userOverrides }])

    const result = await resolveUserFeatures({
      userId: 'uuid-user-2',
      userPlan: 'free',
      databaseUrl: 'postgres://fake',
    })

    // Overrides must win for the keys they define; non-overridden keys from plan_features remain
    expect(result).toEqual({ daily_requests: 999, daily_files: 2, model_tier: 'pro' })
  })

  it('user_overrides={} (empty object) leaves plan_features unchanged', async () => {
    const planFeatures = { daily_requests: 50, daily_files: 10, model_tier: 'default' }
    _mockSql.mockResolvedValue([{ plan_features: planFeatures, user_overrides: {} }])

    const result = await resolveUserFeatures({
      userId: 'uuid-user-3',
      userPlan: 'starter',
      databaseUrl: 'postgres://fake',
    })

    expect(result).toEqual(planFeatures)
  })

  // ── Fallback: DB returns no rows ──────────────────────────────────────────

  it('falls back to FALLBACK[plan] when DB returns empty rows', async () => {
    _mockSql.mockResolvedValue([]) // no matching plan_config row

    const result = await resolveUserFeatures({
      userId: 'uuid-user-4',
      userPlan: 'free',
      databaseUrl: 'postgres://fake',
    })

    expect(result).toEqual(FALLBACK.free)
  })

  it('falls back to FALLBACK.starter when DB returns empty rows and plan=starter', async () => {
    _mockSql.mockResolvedValue([])

    const result = await resolveUserFeatures({
      userId: 'uuid-user-5',
      userPlan: 'starter',
      databaseUrl: 'postgres://fake',
    })

    expect(result).toEqual(FALLBACK.starter)
  })

  it('falls back to FALLBACK.pro when DB returns empty rows and plan=pro', async () => {
    _mockSql.mockResolvedValue([])

    const result = await resolveUserFeatures({
      userId: 'uuid-user-6',
      userPlan: 'pro',
      databaseUrl: 'postgres://fake',
    })

    expect(result).toEqual(FALLBACK.pro)
  })

  // ── Fallback: DB throws ───────────────────────────────────────────────────

  it('falls back to FALLBACK.free when DB throws and userPlan=free', async () => {
    _mockSql.mockRejectedValue(new Error('connection refused'))

    const result = await resolveUserFeatures({
      userId: 'uuid-user-7',
      userPlan: 'free',
      databaseUrl: 'postgres://fake',
    })

    expect(result).toEqual(FALLBACK.free)
    expect(console.error).toHaveBeenCalledOnce()
  })

  it('falls back to FALLBACK.starter when DB throws and userPlan=starter', async () => {
    _mockSql.mockRejectedValue(new Error('timeout'))

    const result = await resolveUserFeatures({
      userId: 'uuid-user-8',
      userPlan: 'starter',
      databaseUrl: 'postgres://fake',
    })

    expect(result).toEqual(FALLBACK.starter)
  })

  it('falls back to FALLBACK.pro when DB throws and userPlan=pro', async () => {
    _mockSql.mockRejectedValue(new Error('timeout'))

    const result = await resolveUserFeatures({
      userId: 'uuid-user-9',
      userPlan: 'pro',
      databaseUrl: 'postgres://fake',
    })

    expect(result).toEqual(FALLBACK.pro)
  })

  // ── Null userPlan defaults to 'free' ─────────────────────────────────────

  it("uses 'free' plan when userPlan is null", async () => {
    _mockSql.mockResolvedValue([]) // DB returns nothing; expect FALLBACK.free

    const result = await resolveUserFeatures({
      userId: 'uuid-user-10',
      userPlan: null,
      databaseUrl: 'postgres://fake',
    })

    expect(result).toEqual(FALLBACK.free)
  })

  it("uses 'free' plan when userPlan is undefined", async () => {
    _mockSql.mockResolvedValue([])

    const result = await resolveUserFeatures({
      userId: 'uuid-user-11',
      userPlan: undefined,
      databaseUrl: 'postgres://fake',
    })

    expect(result).toEqual(FALLBACK.free)
  })

  it("uses 'free' plan when userPlan is null AND DB throws", async () => {
    _mockSql.mockRejectedValue(new Error('db down'))

    const result = await resolveUserFeatures({
      userId: 'uuid-user-12',
      userPlan: null,
      databaseUrl: 'postgres://fake',
    })

    expect(result).toEqual(FALLBACK.free)
  })

  // ── Null userId does not break the query ─────────────────────────────────

  it('passes userId=null to DB without throwing (anonymous user)', async () => {
    const planFeatures = { daily_requests: 20, daily_files: 2, model_tier: 'default' }
    _mockSql.mockResolvedValue([{ plan_features: planFeatures, user_overrides: null }])

    const result = await resolveUserFeatures({
      userId: null,
      userPlan: 'free',
      databaseUrl: 'postgres://fake',
    })

    expect(result).toEqual(planFeatures)
  })

  // ── Partial plan_features in DB row falls back correctly ─────────────────

  it('uses FALLBACK when row exists but plan_features is null', async () => {
    _mockSql.mockResolvedValue([{ plan_features: null, user_overrides: null }])

    const result = await resolveUserFeatures({
      userId: 'uuid-user-13',
      userPlan: 'free',
      databaseUrl: 'postgres://fake',
    })

    // base = row.plan_features ?? FALLBACK[plan] ?? FALLBACK.free
    expect(result).toEqual(FALLBACK.free)
  })
})
