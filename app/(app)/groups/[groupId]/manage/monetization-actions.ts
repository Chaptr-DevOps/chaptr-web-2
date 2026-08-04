'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  ensureConnectAccount,
  createOnboardingLink,
  retrieveAccountStatus,
  createOrUpdateGroupPrice,
  getAccountBalance,
  listRecentPayouts,
} from '@/lib/stripe-server'

async function requireGroupOwner(groupId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: group } = await supabase
    .from('reading_groups')
    .select('id, name, created_by, is_paid, price, stripe_price_id')
    .eq('id', groupId)
    .maybeSingle()

  if (!group || group.created_by !== user.id) {
    throw new Error('Only the group creator can manage monetization')
  }

  return { supabase, user, group }
}

/** Onboarding status for the current user's Stripe Connect account. */
export async function getOnboardingStatus(groupId: string) {
  try {
    const { supabase, user } = await requireGroupOwner(groupId)

    const { data: payoutAccount, error: lookupError } = await supabase
      .from('creator_payout_accounts')
      .select('stripe_account_id, onboarding_complete')
      .eq('user_id', user.id)
      .maybeSingle()

    if (lookupError) return { error: lookupError.message }

    if (!payoutAccount?.stripe_account_id) {
      return { connected: false, chargesEnabled: false, payoutsEnabled: false }
    }

    const status = await retrieveAccountStatus(payoutAccount.stripe_account_id)

    if (status.chargesEnabled && status.payoutsEnabled && !payoutAccount.onboarding_complete) {
      await supabase
        .from('creator_payout_accounts')
        .update({ onboarding_complete: true, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
    }

    return { connected: true, ...status }
  } catch (err: any) {
    return { error: err.message }
  }
}

/** Creates (if needed) the Connect account and returns a Stripe onboarding URL to redirect to. */
export async function startCreatorOnboarding(groupId: string) {
  try {
    const { supabase, user } = await requireGroupOwner(groupId)

    const { data: existing, error: lookupError } = await supabase
      .from('creator_payout_accounts')
      .select('stripe_account_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (lookupError) return { error: lookupError.message }

    const accountId = await ensureConnectAccount(existing?.stripe_account_id ?? null, user.id)

    // Persist before handing the user off to Stripe — if this write fails we
    // would lose the account id entirely and strand the onboarding they're
    // about to complete.
    const { error: saveError } = existing
      ? await supabase
          .from('creator_payout_accounts')
          .update({ stripe_account_id: accountId, updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
      : await supabase.from('creator_payout_accounts').insert({
          user_id: user.id,
          stripe_account_id: accountId,
          onboarding_complete: false,
        })

    if (saveError) return { error: `Could not save your Stripe account: ${saveError.message}` }

    const url = await createOnboardingLink(accountId, groupId)
    return { url }
  } catch (err: any) {
    return { error: err.message }
  }
}

/** Turns paid membership on/off and creates/updates the group's Stripe price. */
export async function setGroupPaid(groupId: string, isPaid: boolean, priceAmount: number | null) {
  try {
    const { supabase, user, group } = await requireGroupOwner(groupId)

    if (!isPaid) {
      const { error } = await supabase
        .from('reading_groups')
        .update({ is_paid: false })
        .eq('id', groupId)
      if (error) return { error: error.message }
      revalidatePath(`/groups/${groupId}/manage`)
      revalidatePath(`/groups/${groupId}`)
      return { success: true }
    }

    if (!priceAmount || priceAmount <= 0) {
      return { error: 'Enter a monthly price greater than $0' }
    }

    const { data: payoutAccount, error: lookupError } = await supabase
      .from('creator_payout_accounts')
      .select('stripe_account_id, onboarding_complete')
      .eq('user_id', user.id)
      .maybeSingle()

    if (lookupError) return { error: lookupError.message }

    if (!payoutAccount?.stripe_account_id || !payoutAccount.onboarding_complete) {
      return { error: 'Connect your Stripe account before setting a price' }
    }

    const stripePriceId = await createOrUpdateGroupPrice({
      stripeAccountId: payoutAccount.stripe_account_id,
      existingPriceId: group.stripe_price_id,
      groupName: group.name,
      priceAmount,
    })

    const { error } = await supabase
      .from('reading_groups')
      .update({ is_paid: true, price: priceAmount, stripe_price_id: stripePriceId })
      .eq('id', groupId)

    if (error) return { error: error.message }

    revalidatePath(`/groups/${groupId}/manage`)
    revalidatePath(`/groups/${groupId}`)
    return { success: true }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function getPayoutSummary(groupId: string) {
  try {
    const { supabase, user } = await requireGroupOwner(groupId)

    const { data: payoutAccount } = await supabase
      .from('creator_payout_accounts')
      .select('stripe_account_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!payoutAccount?.stripe_account_id) {
      return { connected: false, availableBalance: 0, pendingBalance: 0, recentPayouts: [] }
    }

    const [balance, payouts] = await Promise.all([
      getAccountBalance(payoutAccount.stripe_account_id),
      listRecentPayouts(payoutAccount.stripe_account_id),
    ])

    return {
      connected: true,
      currency: balance.available[0]?.currency ?? 'usd',
      availableBalance: (balance.available[0]?.amount ?? 0) / 100,
      pendingBalance: (balance.pending[0]?.amount ?? 0) / 100,
      recentPayouts: payouts.map((p) => ({
        id: p.id,
        amount: p.amount / 100,
        status: p.status,
        date: new Date(p.created * 1000).toISOString(),
      })),
    }
  } catch (err: any) {
    return { error: err.message }
  }
}
