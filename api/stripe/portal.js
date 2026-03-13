import { neon } from '@neondatabase/serverless'
import { getUserFromRequest } from '../_auth.js'
import { checkCsrf } from '../_csrf.js'
import { getStripe } from '../_stripe.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (checkCsrf(req, res)) return

  const user = getUserFromRequest(req)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    return res.status(500).json({ error: 'Database not configured' })
  }

  const sql = neon(databaseUrl)

  const rows = await sql`
    SELECT stripe_customer_id FROM users WHERE id = ${user.sub}
  `

  if (rows.length === 0) {
    return res.status(404).json({ error: 'Usuario no encontrado' })
  }

  const { stripe_customer_id } = rows[0]
  if (!stripe_customer_id) {
    return res.status(400).json({ error: 'No tienes una suscripción activa' })
  }

  const appUrl = process.env.APP_URL ?? 'http://localhost:5173'

  const portalSession = await getStripe().billingPortal.sessions.create({
    customer: stripe_customer_id,
    return_url: appUrl,
  })

  return res.status(200).json({ url: portalSession.url })
}
