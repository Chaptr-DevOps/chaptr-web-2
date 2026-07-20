/**
 * Stripe scaffold — PLACEHOLDER ONLY.
 *
 * The real Stripe Connect implementation already exists in the production
 * backend and will be wired in after this pass. These functions return
 * shaped mock data so the UI can be built and demoed end-to-end without a
 * live Stripe account. Do NOT put secret keys here.
 */

export interface GroupCheckoutSession {
  sessionId: string
  url: string
  groupId: string
  priceId: string | null
}

export interface ConnectOnboardingStatus {
  hasAccount: boolean
  onboardingComplete: boolean
  detailsSubmitted: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
  onboardingUrl: string | null
}

export interface CreatorPayoutSummary {
  currency: string
  availableBalance: number
  pendingBalance: number
  lifetimeVolume: number
  activeSubscribers: number
  nextPayoutDate: string | null
  recentPayouts: Array<{
    id: string
    amount: number
    status: 'paid' | 'pending' | 'in_transit'
    date: string
  }>
}

/**
 * Creates a Stripe Checkout session for subscribing to a paid reading group.
 * TODO: replace with the real Stripe Connect destination-charge implementation.
 */
export async function createGroupCheckoutSession(params: {
  groupId: string
  priceId: string | null
  subscriberId: string
}): Promise<GroupCheckoutSession> {
  // Placeholder: real logic will call stripe.checkout.sessions.create(...)
  return {
    sessionId: `cs_test_placeholder_${params.groupId}`,
    url: `/dashboard/subscriptions?checkout=success&group=${params.groupId}`,
    groupId: params.groupId,
    priceId: params.priceId,
  }
}

/**
 * Returns the Stripe Connect onboarding status for a creator.
 * TODO: replace with stripe.accounts.retrieve(...) / account link creation.
 */
export async function getConnectOnboardingStatus(
  userId: string,
): Promise<ConnectOnboardingStatus> {
  // Placeholder shape — reconcile with existing creator_payout_accounts row.
  void userId
  return {
    hasAccount: false,
    onboardingComplete: false,
    detailsSubmitted: false,
    chargesEnabled: false,
    payoutsEnabled: false,
    onboardingUrl: null,
  }
}

/**
 * Returns a payout / earnings summary for a creator's paid groups.
 * TODO: replace with stripe.balance + stripe.payouts aggregation.
 */
export async function getCreatorPayoutSummary(
  userId: string,
): Promise<CreatorPayoutSummary> {
  void userId
  return {
    currency: 'usd',
    availableBalance: 0,
    pendingBalance: 0,
    lifetimeVolume: 0,
    activeSubscribers: 0,
    nextPayoutDate: null,
    recentPayouts: [],
  }
}

export function formatPrice(
  amount: number | null | undefined,
  currency = 'usd',
): string {
  if (amount == null) return 'Free'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount)
}
