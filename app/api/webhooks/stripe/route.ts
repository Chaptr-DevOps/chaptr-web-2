import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe-server'
import { createAdminClient } from '@/lib/supabase/admin'
import type Stripe from 'stripe'

export async function POST(req: Request) {
  const body = await req.text()
  const signature = (await headers()).get('Stripe-Signature') as string

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`)
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
  }

  const supabase = createAdminClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const { groupId, userId } = session.metadata ?? {}

      if (!groupId || !userId) {
        console.error('checkout.session.completed missing groupId/userId metadata', session.id)
        break
      }

      const subscriptionId =
        typeof session.subscription === 'string' ? session.subscription : session.subscription?.id

      const { error: subError } = await supabase.from('group_subscribers').upsert(
        {
          subscriber_id: userId,
          group_id: groupId,
          status: 'active',
          stripe_subscription_id: subscriptionId ?? null,
          current_period_end: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'subscriber_id,group_id' },
      )
      if (subError) console.error('Error upserting group_subscribers:', subError)

      const { error: memberError } = await supabase.from('group_memberships').upsert(
        {
          group_id: groupId,
          user_id: userId,
          role: 'member',
          is_active: true,
          last_activity: new Date().toISOString(),
        },
        { onConflict: 'group_id,user_id' },
      )
      if (memberError) console.error('Error upserting group_memberships:', memberError)
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const { groupId, userId } = subscription.metadata ?? {}
      if (!groupId || !userId) break

      const periodEnd = (subscription as any).current_period_end as number | undefined
      const { error } = await supabase
        .from('group_subscribers')
        .update({
          status: subscription.status === 'active' ? 'active' : subscription.status,
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('subscriber_id', userId)
        .eq('group_id', groupId)
      if (error) console.error('Error updating group_subscribers:', error)
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const { groupId, userId } = subscription.metadata ?? {}
      if (!groupId || !userId) break

      const { error } = await supabase
        .from('group_subscribers')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('subscriber_id', userId)
        .eq('group_id', groupId)
      if (error) console.error('Error canceling group_subscribers:', error)

      // Deliberately does not touch group_memberships: every group is free to
      // join, only channels are paid. Losing the subscription costs the premium
      // channel (RLS enforces that) and nothing else.
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}
