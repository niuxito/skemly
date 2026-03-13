import { neon } from '@neondatabase/serverless'
import { getUserFromRequest } from '../_auth.js'
import { checkCsrf } from '../_csrf.js'
import { getStripe } from '../_stripe.js'

const PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro: process.env.STRIPE_PRICE_PRO,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (checkCsrf(req, res)) return

  const user = getUserFromRequest(req)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { plan } = req.body ?? {}
  if (!plan || !PRICE_IDS[plan]) {
    return res.status(400).json({ error: 'Plan inválido. Usa "starter" o "pro".' })
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    return res.status(500).json({ error: 'Database not configured' })
  }

  const sql = neon(databaseUrl)

  const rows = await sql`
    SELECT id, email, plan, stripe_customer_id
    FROM users
    WHERE id = ${user.sub}
  `

  if (rows.length === 0) {
    return res.status(404).json({ error: 'Usuario no encontrado' })
  }

  const dbUser = rows[0]

  if (dbUser.plan === plan) {
    return res.status(400).json({ error: 'Ya tienes este plan' })
  }

  // Get or create Stripe customer
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
