import { describe, it, expect, vi, afterEach } from 'vitest'
import { validateContact, formatContact, handleContact } from '../api/_contact.js'

function mockRes() {
  return {
    statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this },
    json(data) { this.body = data; return this },
  }
}

const valid = { name: 'Ada', contact: 'ada@example.com', message: 'Quiero hablar de mi producto', lang: 'es' }
const allow = async () => ({ allowed: true })

afterEach(() => {
  delete process.env.NOTIFY_BOT_TOKEN
  delete process.env.NOTIFY_CHAT_ID
  vi.unstubAllGlobals()
})

describe('validateContact', () => {
  it('accepts a valid message', () => expect(validateContact(valid)).toBeNull())
  it('rejects short messages and bad lang', () => {
    expect(validateContact({ ...valid, message: 'corto' })).not.toBeNull()
    expect(validateContact({ ...valid, lang: 'fr' })).not.toBeNull()
    expect(validateContact({ ...valid, name: '' })).not.toBeNull()
  })
})

describe('formatContact', () => {
  it('includes every field', () => {
    const text = formatContact(valid)
    expect(text).toContain('Ada')
    expect(text).toContain('ada@example.com')
    expect(text).toContain('Quiero hablar')
  })
})

describe('handleContact', () => {
  it('drops honeypot submissions silently', async () => {
    const res = mockRes()
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    await handleContact({ body: { ...valid, website: 'spam' } }, res, { ip: '1.1.1.1', checkAndIncrementContact: allow })
    expect(res.statusCode).toBe(200)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns 503 when Telegram is not configured', async () => {
    const res = mockRes()
    await handleContact({ body: valid }, res, { ip: '1.1.1.1', checkAndIncrementContact: allow })
    expect(res.statusCode).toBe(503)
  })

  it('returns 429 over the daily limit', async () => {
    process.env.NOTIFY_BOT_TOKEN = 't'; process.env.NOTIFY_CHAT_ID = '1'
    const res = mockRes()
    await handleContact({ body: valid }, res, { ip: '1.1.1.1', checkAndIncrementContact: async () => ({ allowed: false }) })
    expect(res.statusCode).toBe(429)
  })

  it('sends the message to Telegram', async () => {
    process.env.NOTIFY_BOT_TOKEN = 't'; process.env.NOTIFY_CHAT_ID = '42'
    const fetchSpy = vi.fn(async () => ({ ok: true, json: async () => ({}) }))
    vi.stubGlobal('fetch', fetchSpy)
    const res = mockRes()
    await handleContact({ body: valid }, res, { ip: '1.1.1.1', checkAndIncrementContact: allow })
    expect(res.statusCode).toBe(200)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://api.telegram.org/bott/sendMessage')
    expect(JSON.parse(init.body).chat_id).toBe('42')
  })
})
