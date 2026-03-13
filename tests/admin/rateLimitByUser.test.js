import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock is hoisted — must appear before any import of @neondatabase/serverless
vi.mock('@neondatabase/serverless', () => {
  const mockSql = vi.fn()
  mockSql.mockResolvedValue([])
  const neon = vi.fn(() => mockSql)
  return { neon, _mockSql: mockSql }
})

import {
  checkRateLimitByUser,
  incrementRequestCountByUser,
  checkFileRateLimitByUser,
  incrementFileCountByUser,
} from '../../api/_rateLimit.js'
import { _mockSql } from '@neondatabase/serverless'

const FAKE_DB = 'postgres://fake'
const FAKE_IP = '10.0.0.1'
const FAKE_USER = 'uuid-user-aabbccdd'

beforeEach(() => {
  vi.resetAllMocks()
  _mockSql.mockResolvedValue([])
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

// ─── checkRateLimitByUser ─────────────────────────────────────────────────────

describe('checkRateLimitByUser', () => {
  // ── Unlimited (pro) plan ──────────────────────────────────────────────────

  it('returns allowed:true immediately when dailyLimit=null (pro plan)', async () => {
    const result = await checkRateLimitByUser({
      userId: FAKE_USER,
      ip: FAKE_IP,
      databaseUrl: FAKE_DB,
      dailyLimit: null,
    })

    expect(result).toEqual({ allowed: true, count: 0, limit: null })
    // DB must NOT be consulted for unlimited plans
    expect(_mockSql).not.toHaveBeenCalled()
  })

  it('returns allowed:true immediately when dailyLimit=undefined', async () => {
    const result = await checkRateLimitByUser({
      userId: FAKE_USER,
      ip: FAKE_IP,
      databaseUrl: FAKE_DB,
      dailyLimit: undefined,
    })

    expect(result).toEqual({ allowed: true, count: 0, limit: null })
    expect(_mockSql).not.toHaveBeenCalled()
  })

  // ── Authenticated user — under limit ──────────────────────────────────────

  it('returns allowed:true when authenticated user is under daily limit', async () => {
    // First call: INSERT DO NOTHING → []
    // Second call: SELECT request_count → [{ request_count: 5 }]
    _mockSql
      .mockResolvedValueOnce([])               // INSERT
      .mockResolvedValueOnce([{ request_count: 5 }]) // SELECT

    const result = await checkRateLimitByUser({
      userId: FAKE_USER,
      ip: FAKE_IP,
      databaseUrl: FAKE_DB,
      dailyLimit: 20,
    })

    expect(result).toEqual({ allowed: true, count: 5, limit: 20 })
  })

  // ── Authenticated user — at/over limit ───────────────────────────────────

  it('returns allowed:false when authenticated user request_count equals dailyLimit', async () => {
    _mockSql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ request_count: 20 }])

    const result = await checkRateLimitByUser({
      userId: FAKE_USER,
      ip: FAKE_IP,
      databaseUrl: FAKE_DB,
      dailyLimit: 20,
    })

    expect(result).toEqual({ allowed: false, count: 20, limit: 20 })
  })

  it('returns allowed:false when authenticated user request_count exceeds dailyLimit', async () => {
    _mockSql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ request_count: 25 }])

    const result = await checkRateLimitByUser({
      userId: FAKE_USER,
      ip: FAKE_IP,
      databaseUrl: FAKE_DB,
      dailyLimit: 20,
    })

    expect(result).toEqual({ allowed: false, count: 25, limit: 20 })
  })

  it('returns allowed:true when count is one below the dailyLimit boundary', async () => {
    _mockSql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ request_count: 19 }])

    const result = await checkRateLimitByUser({
      userId: FAKE_USER,
      ip: FAKE_IP,
      databaseUrl: FAKE_DB,
      dailyLimit: 20,
    })

    expect(result).toEqual({ allowed: true, count: 19, limit: 20 })
  })

  // ── Anonymous user (userId=null) — delegates to IP-based ─────────────────

  it('delegates to IP-based checkRateLimit when userId=null (returns allowed:true when under limit)', async () => {
    // checkRateLimit does INSERT … RETURNING request_count
    _mockSql.mockResolvedValueOnce([{ request_count: 3 }])

    const result = await checkRateLimitByUser({
      userId: null,
      ip: FAKE_IP,
      databaseUrl: FAKE_DB,
      dailyLimit: 20,
    })

    // IP-based checkRateLimit returns { allowed, remaining } — check minimal shape
    expect(result.allowed).toBe(true)
    expect(typeof result.remaining).toBe('number')
  })

  it('delegates to IP-based checkRateLimit when userId=null and over limit', async () => {
    _mockSql.mockResolvedValueOnce([{ request_count: 21 }])

    const result = await checkRateLimitByUser({
      userId: null,
      ip: FAKE_IP,
      databaseUrl: FAKE_DB,
      dailyLimit: 20,
    })

    expect(result.allowed).toBe(false)
    expect(result.limit).toBe(20)
    expect(typeof result.resetAt).toBe('string')
  })

  // ── New user: no existing row ─────────────────────────────────────────────

  it('returns count=0 allowed:true when no existing rate_limits row for user', async () => {
    _mockSql
      .mockResolvedValueOnce([])  // INSERT DO NOTHING
      .mockResolvedValueOnce([])  // SELECT returns empty (new user, race condition edge-case)

    const result = await checkRateLimitByUser({
      userId: FAKE_USER,
      ip: FAKE_IP,
      databaseUrl: FAKE_DB,
      dailyLimit: 20,
    })

    // rows[0]?.request_count ?? 0 → count=0 → allowed
    expect(result).toEqual({ allowed: true, count: 0, limit: 20 })
  })
})

// ─── incrementRequestCountByUser ─────────────────────────────────────────────

describe('incrementRequestCountByUser', () => {
  it('no-ops when userId=null (anonymous already incremented by checkRateLimit)', async () => {
    await incrementRequestCountByUser({ userId: null, ip: FAKE_IP, databaseUrl: FAKE_DB })

    expect(_mockSql).not.toHaveBeenCalled()
  })

  it('executes UPDATE when userId is provided', async () => {
    _mockSql.mockResolvedValueOnce([])

    await incrementRequestCountByUser({ userId: FAKE_USER, ip: FAKE_IP, databaseUrl: FAKE_DB })

    expect(_mockSql).toHaveBeenCalledOnce()
  })
})

// ─── checkFileRateLimitByUser ─────────────────────────────────────────────────

describe('checkFileRateLimitByUser', () => {
  // ── Unlimited plan ────────────────────────────────────────────────────────

  it('returns allowed:true immediately when dailyFileLimit=null', async () => {
    const result = await checkFileRateLimitByUser({
      userId: FAKE_USER,
      ip: FAKE_IP,
      databaseUrl: FAKE_DB,
      dailyFileLimit: null,
    })

    expect(result).toEqual({ allowed: true, count: 0, limit: null })
    expect(_mockSql).not.toHaveBeenCalled()
  })

  it('returns allowed:true immediately when dailyFileLimit=undefined', async () => {
    const result = await checkFileRateLimitByUser({
      userId: FAKE_USER,
      ip: FAKE_IP,
      databaseUrl: FAKE_DB,
      dailyFileLimit: undefined,
    })

    expect(result).toEqual({ allowed: true, count: 0, limit: null })
    expect(_mockSql).not.toHaveBeenCalled()
  })

  // ── Authenticated user — under limit ──────────────────────────────────────

  it('returns allowed:true when authenticated user file_count is under limit', async () => {
    _mockSql
      .mockResolvedValueOnce([])                        // INSERT DO NOTHING
      .mockResolvedValueOnce([{ file_count: 1 }])       // SELECT

    const result = await checkFileRateLimitByUser({
      userId: FAKE_USER,
      ip: FAKE_IP,
      databaseUrl: FAKE_DB,
      dailyFileLimit: 2,
    })

    expect(result).toEqual({ allowed: true, count: 1, limit: 2 })
  })

  // ── Authenticated user — at/over limit ───────────────────────────────────

  it('returns allowed:false when authenticated user file_count equals dailyFileLimit', async () => {
    _mockSql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ file_count: 2 }])

    const result = await checkFileRateLimitByUser({
      userId: FAKE_USER,
      ip: FAKE_IP,
      databaseUrl: FAKE_DB,
      dailyFileLimit: 2,
    })

    expect(result).toEqual({ allowed: false, count: 2, limit: 2 })
  })

  it('returns allowed:false when authenticated user file_count exceeds dailyFileLimit', async () => {
    _mockSql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ file_count: 5 }])

    const result = await checkFileRateLimitByUser({
      userId: FAKE_USER,
      ip: FAKE_IP,
      databaseUrl: FAKE_DB,
      dailyFileLimit: 2,
    })

    expect(result).toEqual({ allowed: false, count: 5, limit: 2 })
  })

  // ── Anonymous user (userId=null) ──────────────────────────────────────────

  it('returns allowed:true for anonymous user when file_count is under limit', async () => {
    // Anonymous path: single SELECT by ip_address
    _mockSql.mockResolvedValueOnce([{ file_count: 0 }])

    const result = await checkFileRateLimitByUser({
      userId: null,
      ip: FAKE_IP,
      databaseUrl: FAKE_DB,
      dailyFileLimit: 2,
    })

    expect(result).toEqual({ allowed: true, count: 0, limit: 2 })
  })

  it('returns allowed:false for anonymous user when file_count equals dailyFileLimit', async () => {
    _mockSql.mockResolvedValueOnce([{ file_count: 2 }])

    const result = await checkFileRateLimitByUser({
      userId: null,
      ip: FAKE_IP,
      databaseUrl: FAKE_DB,
      dailyFileLimit: 2,
    })

    expect(result).toEqual({ allowed: false, count: 2, limit: 2 })
  })

  it('returns allowed:true for anonymous user with no existing row (new IP)', async () => {
    // No row found — file_count defaults to 0
    _mockSql.mockResolvedValueOnce([])

    const result = await checkFileRateLimitByUser({
      userId: null,
      ip: '9.9.9.9',
      databaseUrl: FAKE_DB,
      dailyFileLimit: 2,
    })

    expect(result).toEqual({ allowed: true, count: 0, limit: 2 })
  })

  // ── Anonymous path does not perform INSERT ────────────────────────────────

  it('calls sql only once (SELECT only, no INSERT) for anonymous users', async () => {
    _mockSql.mockResolvedValueOnce([{ file_count: 1 }])

    await checkFileRateLimitByUser({
      userId: null,
      ip: FAKE_IP,
      databaseUrl: FAKE_DB,
      dailyFileLimit: 5,
    })

    expect(_mockSql).toHaveBeenCalledOnce()
  })

  // ── Authenticated path performs INSERT then SELECT ────────────────────────

  it('calls sql twice (INSERT then SELECT) for authenticated users', async () => {
    _mockSql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ file_count: 0 }])

    await checkFileRateLimitByUser({
      userId: FAKE_USER,
      ip: FAKE_IP,
      databaseUrl: FAKE_DB,
      dailyFileLimit: 5,
    })

    expect(_mockSql).toHaveBeenCalledTimes(2)
  })
})

// ─── incrementFileCountByUser ─────────────────────────────────────────────────

describe('incrementFileCountByUser', () => {
  it('updates by ip_address when userId=null (anonymous)', async () => {
    _mockSql.mockResolvedValueOnce([])

    await incrementFileCountByUser({ userId: null, ip: FAKE_IP, databaseUrl: FAKE_DB })

    expect(_mockSql).toHaveBeenCalledOnce()
  })

  it('updates by user_id when userId is provided (authenticated)', async () => {
    _mockSql.mockResolvedValueOnce([])

    await incrementFileCountByUser({ userId: FAKE_USER, ip: FAKE_IP, databaseUrl: FAKE_DB })

    expect(_mockSql).toHaveBeenCalledOnce()
  })
})
