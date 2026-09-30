import { neon } from '@neondatabase/serverless'
import { getUserFromRequest } from './_auth.js'
import { checkCsrf } from './_csrf.js'
import { getStripe } from './_stripe.js'
import { isBillingEnabled } from './_billing.js'

const PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro: process.env.STRIPE_PRICE_PRO,
}

export default async function handler(req, res) {
  const url = req.url

  // ── Status (public) — lets the UI hide plans when billing is disabled ────
  if (url.includes('/stripe/status')) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
    return res.status(200).json({ enabled: isBillingEnabled() })
  }

  if (!isBillingEnabled()) return res.status(404).json({ error: 'Billing is disabled' })

  // ── Checkout ─────────────────────────────────────────────────────────────
  if (url.includes('/stripe/checkout')) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    if (checkCsrf(req, res)) return

    const user = getUserFromRequest(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const { plan } = req.body ?? {}
    if (!plan || !PRICE_IDS[plan]) {
      return res.status(400).json({ error: 'Plan inválido. Usa "starter" o "pro".' })
    }

    const sql = neon(process.env.DATABASE_URL)
    const rows = await sql`SELECT id, email, plan, stripe_customer_id FROM users WHERE id = ${user.sub}`
    if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' })

    const dbUser = rows[0]
    if (dbUser.plan === plan) return res.status(400).json({ error: 'Ya tienes este plan' })

    const stripe = getStripe()
    let customerId = dbUser.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: dbUser.email,
        metadata: { userId: dbUser.id },
      })
      customerId = customer.id
      await sql`UPDATE users SET stripe_customer_id = ${customerId} WHERE id = ${dbUser.id}`
    }

    const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
      success_url: `${appUrl}/pricing?success=1`,
      cancel_url: `${appUrl}/pricing?canceled=1`,
      metadata: { userId: dbUser.id, plan },
      subscription_data: { metadata: { userId: dbUser.id, plan } },
    })

    return res.status(200).json({ url: session.url })
  }

  // ── Portal ────────────────────────────────────────────────────────────────
  if (url.includes('/stripe/portal')) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    if (checkCsrf(req, res)) return

    const user = getUserFromRequest(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const sql = neon(process.env.DATABASE_URL)
    const rows = await sql`SELECT stripe_customer_id FROM users WHERE id = ${user.sub}`
    if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' })

    const { stripe_customer_id } = rows[0]
    if (!stripe_customer_id) return res.status(400).json({ error: 'No tienes una suscripción activa' })

    const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
    const portalSession = await getStripe().billingPortal.sessions.create({
      customer: stripe_customer_id,
      return_url: appUrl,
    })

    return res.status(200).json({ url: portalSession.url })
  }

  res.status(404).json({ error: 'Not found' })
}
