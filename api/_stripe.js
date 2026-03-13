import Stripe from 'stripe'

let _stripe = null

/**
 * Returns a shared Stripe instance, lazily initialized.
 * Follows the same lazy pattern as getSecret() in _auth.js to avoid
 * throwing at module load time when env vars may not be set.
 */
export function getStripe() {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY env var not set')
  _stripe = new Stripe(key, { apiVersion: '2024-11-20' })
  return _stripe
}
