import { NextRequest, NextResponse } from 'next/server'
import { getStripe, STRIPE_WEBHOOK_SECRET } from '@/lib/stripe'
import { getUserByStripeCustomerId, updateUserPlan, updateStripeInfo } from '@/lib/db/userDb'
import type Stripe from 'stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid signature'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const customerId = session.customer as string
        const subscriptionId = session.subscription as string
        const user = await getUserByStripeCustomerId(customerId)
        if (user) {
          await updateStripeInfo(user.id, customerId, subscriptionId)
          await updateUserPlan(user.id, 'PREMIUM')
        }
        break
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        const user = await getUserByStripeCustomerId(customerId)
        if (user) await updateUserPlan(user.id, 'PREMIUM')
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string
        const user = await getUserByStripeCustomerId(customerId)
        if (user) {
          await updateUserPlan(user.id, 'FREE')
          await updateStripeInfo(user.id, customerId, null)
        }
        break
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
  }

  return NextResponse.json({ received: true })
}
