/**
 * Client-safe Stripe utilities. Real Stripe SDK calls live in
 * lib/stripe-server.ts (server-only — imports the Stripe Node SDK and reads
 * STRIPE_SECRET_KEY) so that importing formatPrice from a client component
 * never pulls the SDK into the browser bundle.
 */

/** `amount` is whole-currency-unit dollars (matches reading_groups.price), not cents. */
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
