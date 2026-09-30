import { neon } from '@neondatabase/serverless'
import { getStripe } from './_stripe.js'
import { isBillingEnabled } from './_billing.js'

// Disable Vercel body parser — Stripe needs the raw body to verify the signature
export const config = { api: { bodyParser: false } }

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!isBillingEnabled()) return res.status(404).json({ error: 'Billing is disabled' })

  const sig = req.headers['stripe-signature']
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET not set')
    return res.status(500).json({ error: 'Webhook secret not configured' })
  }

  let event
  try {
    const rawBody = await getRawBody(req)
    event = getStripe().webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err.message)
    return res.status(400).json({ error: `Webhook error: ${err.message}` })
  }

  const sql = neon(process.env.DATABASE_URL)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.payment_status === 'paid') {
          const { userId, plan } = session.metadata ?? {}
          if (userId && plan) {
            await sql`
              UPDATE users
              SET plan = ${plan}, stripe_subscription_id = ${session.subscription}
              WHERE id = ${userId}
            `
          }
        }
        break
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const { userId, plan } = subscription.metadata ?? {}
        if (subscription.status === 'active' && userId && plan) {
          await sql`
            UPDATE users SET plan = ${plan}
            WHERE stripe_subscription_id = ${subscription.id}
          `
        }
        break
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        await sql`
          UPDATE users SET plan = 'free', stripe_subscription_id = NULL
          WHERE stripe_subscription_id = ${subscription.id}
        `
        break
      }
    }
  } catch (err) {
    console.error(`[stripe-webhook] DB error handling ${event.type}:`, err.message)
    // Return 200 so Stripe doesn't retry — the issue is on our side
  }

  return res.status(200).json({ received: true })
}
