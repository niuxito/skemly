import { describe, it, expect, beforeAll } from 'vitest'

// JWT_SECRET must be set before the module is imported so getSecret() finds it
beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-for-vitest'
})

// Dynamic import ensures the env var is in place before module evaluation
const { hashPassword, comparePassword, signToken, verifyToken, generateOtp, getUserFromRequest } =
  await import('../api/_auth.js')

// ─── hashPassword + comparePassword ───────────────────────────────────────────

describe('hashPassword + comparePassword', () => {
  it('correct password returns true', async () => {
    const hash = await hashPassword('mysecret')
    expect(await comparePassword('mysecret', hash)).toBe(true)
  })

  it('incorrect password returns false', async () => {
    const hash = await hashPassword('mysecret')
    expect(await comparePassword('wrongpassword', hash)).toBe(false)
  })

  it('produces a different hash each call (bcrypt salt)', async () => {
    const hash1 = await hashPassword('pass')
    const hash2 = await hashPassword('pass')
    expect(hash1).not.toBe(hash2)
  })
})

// ─── signToken + verifyToken ──────────────────────────────────────────────────

describe('signToken + verifyToken', () => {
  it('valid token returns payload with userId and email', () => {
    const payload = { userId: 'abc123', email: 'user@example.com' }
    const token = signToken(payload)
    const decoded = verifyToken(token)
    expect(decoded).not.toBeNull()
    expect(decoded.userId).toBe('abc123')
    expect(decoded.email).toBe('user@example.com')
  })

  it('invalid token returns null', () => {
    expect(verifyToken('this-is-not-a-token')).toBeNull()
  })

  it('manipulated token returns null', () => {
    const token = signToken({ userId: 'abc' })
    // Tamper with the payload portion (middle segment)
    const parts = token.split('.')
    parts[1] = Buffer.from(JSON.stringify({ userId: 'hacked' })).toString('base64')
    const tampered = parts.join('.')
    expect(verifyToken(tampered)).toBeNull()
  })

  it('empty string returns null', () => {
    expect(verifyToken('')).toBeNull()
  })
})

// ─── generateOtp ─────────────────────────────────────────────────────────────

describe('generateOtp', () => {
  it('returns a string', () => {
    expect(typeof generateOtp()).toBe('string')
  })

  it('returns exactly 6 digits', () => {
    expect(generateOtp()).toMatch(/^\d{6}$/)
  })

  it('value is in range 100000–999999 across many iterations', () => {
    for (let i = 0; i < 20; i++) {
      const n = Number(generateOtp())
      expect(n).toBeGreaterThanOrEqual(100000)
      expect(n).toBeLessThanOrEqual(999999)
    }
  })
})

// ─── getUserFromRequest ───────────────────────────────────────────────────────

describe('getUserFromRequest', () => {
  function makeReq(headers = {}) {
    return { headers }
  }

  it('returns null when no authorization header', () => {
    expect(getUserFromRequest(makeReq({}))).toBeNull()
  })

  it('returns null when header does not start with Bearer ', () => {
    expect(getUserFromRequest(makeReq({ authorization: 'Basic abc123' }))).toBeNull()
  })

  it('returns null when Bearer token is invalid', () => {
    expect(getUserFromRequest(makeReq({ authorization: 'Bearer notavalidtoken' }))).toBeNull()
  })

  it('returns payload when Bearer token is valid', () => {
    const token = signToken({ userId: 'u1', email: 'a@b.com' })
    const result = getUserFromRequest(makeReq({ authorization: `Bearer ${token}` }))
    expect(result).not.toBeNull()
    expect(result.userId).toBe('u1')
    expect(result.email).toBe('a@b.com')
  })

  it('works with capitalized Authorization header', () => {
    const token = signToken({ userId: 'u2', email: 'x@y.com' })
    const result = getUserFromRequest(makeReq({ Authorization: `Bearer ${token}` }))
    expect(result).not.toBeNull()
    expect(result.userId).toBe('u2')
  })
})
