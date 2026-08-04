/**
 * Business identity used by the public, Stripe-facing pages (/pricing,
 * /terms, /privacy, /refunds and every group subscribe page).
 *
 * TODO(chaptr): replace the four placeholder values below with the real
 * details before submitting any URL to Stripe for review. Stripe checks that
 * the entity named here matches the entity on the Stripe account.
 */
export const LEGAL = {
  /** TODO: real registered entity, e.g. "Chaptr Labs, Inc." */
  entityName: 'Chaptr',
  /** Consumer-facing product name. */
  productName: 'Chaptr',
  /** TODO: a monitored inbox — Stripe will email it during review. */
  supportEmail: 'support@chaptr.app',
  /** TODO: e.g. "Delaware, United States" */
  jurisdiction: 'the United States',
  /** TODO: bump when the policy text below materially changes. */
  effectiveDate: 'July 30, 2026',
} as const

/** Percentage of each subscription the platform retains. Mirrors PLATFORM_FEE_PERCENT. */
export const PLATFORM_FEE_PERCENT = 15
