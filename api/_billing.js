/**
 * Billing mode. Stripe is optional: without STRIPE_SECRET_KEY the instance
 * runs in self-hosted mode — no plans, no checkout, and every signed-in user
 * gets the full feature set. Anonymous users keep the free limits so a public
 * instance does not spend its owner's Anthropic key without bounds.
 */
export function isBillingEnabled() {
  // Match the key format rather than truthiness: assigning `undefined` to
  // process.env stores the string "undefined" (see vite.config.js).
  return /^(sk|rk)_/.test(process.env.STRIPE_SECRET_KEY ?? '')
}

/** Plan to enforce for a signed-in user, given the plan stored in the DB. */
export function effectivePlan(storedPlan) {
  if (!isBillingEnabled()) return 'pro'
  return storedPlan ?? 'free'
}
