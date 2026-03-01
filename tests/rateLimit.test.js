import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock is hoisted to top of file by Vitest — mock @neondatabase/serverless
// before any module imports it.
vi.mock('@neondatabase/serverless', () => {
  // mockSql is a tagged template function: sql`...` => mockSql(strings, ...values)
  // We expose it so individual tests can change the resolved value.
  const mockSql = vi.fn()
  mockSql.mockResolvedValue([])

  // neon() factory returns mockSql every time
  const neon = vi.fn(() => mockSql)

  return { neon, _mockSql: mockSql }
})

// Import after mock is registered
import { checkRateLimit, checkFileRateLimit } from '../api/_rateLimit.js'
import { _mockSql } from '@neondatabase/serverless'

beforeEach(() => {
  vi.resetAllMocks()
  // After reset, re-configure the mock so neon() still returns _mockSql
  // _mockSql itself is reset; give it a safe default
  _mockSql.mockResolvedValue([])
  // Suppress console noise from the module under test
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

// ─── checkRateLimit ───────────────────────────────────────────────────────────

describe('checkRateLimit', () => {
  it('returns {allowed:true, remaining:null} when no databaseUrl', async () => {
    const result = await checkRateLimit({ ip: '1.2.3.4', databaseUrl: undefined, dailyLimit: 20 })
    expect(result).toEqual({ allowed: true, remaining: null })
    // neon should not be called
    const { neon } = await import('@neondatabase/serverless')
    expect(neon).not.toHaveBeenCalled()
  })

  it('count=5 with dailyLimit=20 → {allowed:true, remaining:15}', async () => {
    _mockSql.mockResolvedValue([{ request_count: 5 }])
    const result = await checkRateLimit({ ip: '1.2.3.4', databaseUrl: 'postgres://fake', dailyLimit: 20 })
    expect(result).toEqual({ allowed: true, remaining: 15 })
  })

  it('count=21 with dailyLimit=20 → {allowed:false, limit:20, resetAt:string}', async () => {
    _mockSql.mockResolvedValue([{ request_count: 21 }])
    const result = await checkRateLimit({ ip: '1.2.3.4', databaseUrl: 'postgres://fake', dailyLimit: 20 })
    expect(result.allowed).toBe(false)
    expect(result.limit).toBe(20)
    expect(typeof result.resetAt).toBe('string')
    expect(result.resetAt.length).toBeGreaterThan(0)
  })

  it('count=20 with dailyLimit=20 → {allowed:true, remaining:0} (still allowed)', async () => {
    _mockSql.mockResolvedValue([{ request_count: 20 }])
    const result = await checkRateLimit({ ip: '1.2.3.4', databaseUrl: 'postgres://fake', dailyLimit: 20 })
    expect(result).toEqual({ allowed: true, remaining: 0 })
  })

  it('DB error → fail open {allowed:true, remaining:null}', async () => {
    _mockSql.mockRejectedValue(new Error('DB connection refused'))
    const result = await checkRateLimit({ ip: '1.2.3.4', databaseUrl: 'postgres://fake', dailyLimit: 20 })
    expect(result).toEqual({ allowed: true, remaining: null })
  })
})

// ─── checkFileRateLimit ───────────────────────────────────────────────────────

describe('checkFileRateLimit', () => {
  it('returns {allowed:true} when no databaseUrl', async () => {
    const result = await checkFileRateLimit({ ip: '1.2.3.4', databaseUrl: undefined, dailyLimit: 5 })
    expect(result.allowed).toBe(true)
  })

  it('file_count=2 with dailyLimit=5 → {allowed:true, remaining:3}', async () => {
    _mockSql.mockResolvedValue([{ file_count: 2 }])
    const result = await checkFileRateLimit({ ip: '1.2.3.4', databaseUrl: 'postgres://fake', dailyLimit: 5 })
    expect(result).toEqual({ allowed: true, remaining: 3 })
  })

  it('file_count=5 with dailyLimit=5 → {allowed:false}', async () => {
    _mockSql.mockResolvedValue([{ file_count: 5 }])
    const result = await checkFileRateLimit({ ip: '1.2.3.4', databaseUrl: 'postgres://fake', dailyLimit: 5 })
    expect(result.allowed).toBe(false)
    expect(result.limit).toBe(5)
  })

  it('empty rows (new IP) → {allowed:true, remaining:5}', async () => {
    _mockSql.mockResolvedValue([])
    const result = await checkFileRateLimit({ ip: '9.9.9.9', databaseUrl: 'postgres://fake', dailyLimit: 5 })
    expect(result).toEqual({ allowed: true, remaining: 5 })
  })
})
