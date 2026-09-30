import { describe, it, expect, afterEach } from 'vitest'
import { isBillingEnabled, effectivePlan } from '../api/_billing.js'
import stripeHandler from '../api/stripe.js'
import stripeWebhookHandler from '../api/stripe-webhook.js'

const ORIGINAL = process.env.STRIPE_SECRET_KEY

function mockRes() {
  const res = { statusCode: 200, body: null }
  res.status = code => { res.statusCode = code; return res }
  res.json = data => { res.body = data; return res }
  res.setHeader = () => res
  return res
}

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.STRIPE_SECRET_KEY
  else process.env.STRIPE_SECRET_KEY = ORIGINAL
})

describe('isBillingEnabled', () => {
  it('is off without a Stripe key', () => {
    delete process.env.STRIPE_SECRET_KEY
    expect(isBillingEnabled()).toBe(false)
  })

  it('is off when the key was stringified from undefined', () => {
    process.env.STRIPE_SECRET_KEY = undefined
    expect(process.env.STRIPE_SECRET_KEY).toBe('undefined')
    expect(isBillingEnabled()).toBe(false)
  })

  it('is on with a secret or restricted key', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    expect(isBillingEnabled()).toBe(true)
    process.env.STRIPE_SECRET_KEY = 'rk_live_123'
    expect(isBillingEnabled()).toBe(true)
  })
})

describe('effectivePlan', () => {
  it('grants pro to everyone when billing is disabled', () => {
    delete process.env.STRIPE_SECRET_KEY
    expect(effectivePlan('free')).toBe('pro')
    expect(effectivePlan(undefined)).toBe('pro')
  })

  it('keeps the stored plan when billing is enabled', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    expect(effectivePlan('starter')).toBe('starter')
    expect(effectivePlan(undefined)).toBe('free')
  })
})

describe('stripe endpoints without billing', () => {
  it('reports status as disabled', async () => {
    delete process.env.STRIPE_SECRET_KEY
    const res = mockRes()
    await stripeHandler({ method: 'GET', url: '/api/stripe/status', headers: {} }, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ enabled: false })
  })

  it('reports status as enabled', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    const res = mockRes()
    await stripeHandler({ method: 'GET', url: '/api/stripe/status', headers: {} }, res)
    expect(res.body).toEqual({ enabled: true })
  })

  it('rejects checkout and portal with 404', async () => {
    delete process.env.STRIPE_SECRET_KEY
    for (const url of ['/api/stripe/checkout', '/api/stripe/portal']) {
      const res = mockRes()
      await stripeHandler({ method: 'POST', url, headers: { 'content-type': 'application/json' }, body: { plan: 'pro' } }, res)
      expect(res.statusCode).toBe(404)
    }
  })

  it('rejects webhooks with 404', async () => {
    delete process.env.STRIPE_SECRET_KEY
    const res = mockRes()
    await stripeWebhookHandler({ method: 'POST', headers: {} }, res)
    expect(res.statusCode).toBe(404)
  })
})
