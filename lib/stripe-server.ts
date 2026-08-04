import 'server-only'
import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

/** Percentage of each subscription payment the platform keeps. */
export const PLATFORM_FEE_PERCENT = 15

function baseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

// ── Connect onboarding ──────────────────────────────────────────────────

/**
 * ChaptrNote branding for connected accounts. Checkout reads branding from the
 * connected account (direct charges), not the platform, so every account has to
 * carry this itself.
 *
 * `icon`/`logo` must be Stripe File IDs — a URL is rejected, and the purposes
 * are not interchangeable: `icon` needs a file uploaded as `business_icon`,
 * `logo` one uploaded as `business_logo`, so the same artwork is uploaded
 * twice. `scripts/backfill-connect-branding.mjs` does the uploads once and
 * prints the ids for STRIPE_BRANDING_ICON_FILE_ID / STRIPE_BRANDING_LOGO_FILE_ID,
 * so nothing re-uploads per account. Without those env vars the colors still
 * apply; only the artwork is skipped.
 */
export const CONNECT_BRANDING = {
  primaryColor: '#f8f5ef', // cream — Checkout page background
  secondaryColor: '#1d4e4b', // dark teal — Checkout button
} as const

export function connectBrandingSettings(): Stripe.AccountCreateParams.Settings.Branding {
  const icon = process.env.STRIPE_BRANDING_ICON_FILE_ID
  const logo = process.env.STRIPE_BRANDING_LOGO_FILE_ID
  return {
    primary_color: CONNECT_BRANDING.primaryColor,
    secondary_color: CONNECT_BRANDING.secondaryColor,
    ...(icon ? { icon } : {}),
    ...(logo ? { logo } : {}),
  }
}

export async function ensureConnectAccount(
  existingAccountId: string | null,
  userId: string,
): Promise<string> {
  if (existingAccountId) return existingAccountId
  const account = await stripe.accounts.create({
    type: 'express',
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: 'individual',
    metadata: { userId },
    settings: { branding: connectBrandingSettings() },
  })
  return account.id
}

export async function createOnboardingLink(accountId: string, groupId: string): Promise<string> {
  const returnPath = `${baseUrl()}/groups/${groupId}/manage`
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: returnPath,
    return_url: returnPath,
    type: 'account_onboarding',
  })
  return accountLink.url
}

export async function retrieveAccountStatus(accountId: string) {
  const account = await stripe.accounts.retrieve(accountId)
  return {
    detailsSubmitted: account.details_submitted ?? false,
    chargesEnabled: account.charges_enabled ?? false,
    payoutsEnabled: account.payouts_enabled ?? false,
  }
}

// ── Pricing ──────────────────────────────────────────────────────────────

/**
 * Creates (or, if the amount changed, replaces) the Stripe Price for a
 * group's membership on the group creator's connected account.
 * `priceAmount` is whole-currency-unit dollars — converted to cents here.
 */
export async function createOrUpdateGroupPrice(params: {
  stripeAccountId: string
  existingPriceId: string | null
  groupName: string
  priceAmount: number
  currency?: string
}): Promise<string> {
  const { stripeAccountId, existingPriceId, groupName, priceAmount, currency = 'usd' } = params
  const opts = { stripeAccount: stripeAccountId }
  const unitAmount = Math.round(priceAmount * 100)

  let productId: string
  if (existingPriceId) {
    const existingPrice = await stripe.prices.retrieve(existingPriceId, {}, opts)
    productId = existingPrice.product as string
  } else {
    const product = await stripe.products.create({ name: `${groupName} membership` }, opts)
    productId = product.id
  }

  const price = await stripe.prices.create(
    {
      product: productId,
      unit_amount: unitAmount,
      currency,
      recurring: { interval: 'month' },
    },
    opts,
  )
  return price.id
}

// ── Checkout ───────────────────────────────────────────────────────────

export async function createGroupCheckoutSession(params: {
  groupId: string
  userId: string
  priceId: string
  stripeAccountId: string
}): Promise<{ url: string }> {
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'subscription',
      line_items: [{ price: params.priceId, quantity: 1 }],
      success_url: `${baseUrl()}/groups/${params.groupId}?checkout=success`,
      cancel_url: `${baseUrl()}/groups/${params.groupId}/subscribe`,
      // Set on both the session (for checkout.session.completed) and the
      // resulting subscription (for customer.subscription.* events).
      metadata: { groupId: params.groupId, userId: params.userId },
      subscription_data: {
        application_fee_percent: PLATFORM_FEE_PERCENT,
        metadata: { groupId: params.groupId, userId: params.userId },
      },
    },
    { stripeAccount: params.stripeAccountId },
  )

  if (!session.url) throw new Error('Stripe did not return a checkout URL')
  return { url: session.url }
}

// ── Subscription management ────────────────────────────────────────────

/**
 * Schedules a subscription to stop at the end of the period the subscriber
 * has already paid for, rather than ending it immediately. This is what the
 * published refund policy promises: no future charges, access retained until
 * the current period ends. Stripe emits `customer.subscription.deleted` when
 * the period actually lapses, which is where access is revoked.
 */
export async function cancelSubscriptionAtPeriodEnd(params: {
  subscriptionId: string
  stripeAccountId: string
}) {
  const subscription = await stripe.subscriptions.update(
    params.subscriptionId,
    { cancel_at_period_end: true },
    { stripeAccount: params.stripeAccountId },
  )
  return {
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEnd: (subscription as any).current_period_end as number | undefined,
  }
}

/** Re-enables a subscription that is scheduled to cancel but hasn't lapsed yet. */
export async function resumeSubscription(params: {
  subscriptionId: string
  stripeAccountId: string
}) {
  await stripe.subscriptions.update(
    params.subscriptionId,
    { cancel_at_period_end: false },
    { stripeAccount: params.stripeAccountId },
  )
}

export async function retrieveSubscriptionState(params: {
  subscriptionId: string
  stripeAccountId: string
}) {
  const subscription = await stripe.subscriptions.retrieve(
    params.subscriptionId,
    {},
    { stripeAccount: params.stripeAccountId },
  )
  return {
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEnd: (subscription as any).current_period_end as number | undefined,
  }
}

// ── Payouts ────────────────────────────────────────────────────────────

export async function getAccountBalance(stripeAccountId: string) {
  return stripe.balance.retrieve({}, { stripeAccount: stripeAccountId })
}

export async function listRecentPayouts(stripeAccountId: string, limit = 5) {
  const payouts = await stripe.payouts.list({ limit }, { stripeAccount: stripeAccountId })
  return payouts.data
}
