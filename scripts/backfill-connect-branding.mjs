/**
 * One-off backfill: apply ChaptrNote branding to existing Connect accounts.
 *
 * New accounts get branding automatically from `ensureConnectAccount`
 * (lib/stripe-server.ts). This script exists so accounts onboarded before that
 * change don't have to be deleted and re-onboarded.
 *
 * Uploads public/chaptr-icon.png as two File objects — Stripe requires purpose
 * `business_icon` for settings.branding.icon and `business_logo` for
 * settings.branding.logo, and rejects a file used for the wrong field. Set the
 * printed ids as STRIPE_BRANDING_ICON_FILE_ID / STRIPE_BRANDING_LOGO_FILE_ID in
 * .env.local so nothing re-uploads later.
 *
 * Targets are explicit on purpose — the sandbox also holds unrelated legacy
 * test accounts that this app never created, and a blanket update would hit
 * those too.
 *
 * Usage:
 *   node --env-file=.env.local scripts/backfill-connect-branding.mjs                       # list accounts, no writes
 *   node --env-file=.env.local scripts/backfill-connect-branding.mjs acct_123               # dry run on one
 *   node --env-file=.env.local scripts/backfill-connect-branding.mjs acct_123 --apply       # write
 *   node --env-file=.env.local scripts/backfill-connect-branding.mjs --all --apply          # every account
 *
 * Only touches settings.branding. Charge type, application fee, payout
 * schedule and every other account setting are left alone.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import Stripe from 'stripe'

const BRANDING_COLORS = {
  primary_color: '#f8f5ef', // cream — Checkout page background
  secondary_color: '#1d4e4b', // dark teal — Checkout button
}

const ICON_PATH = path.join(process.cwd(), 'public', 'chaptr-icon.png')
const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const ALL = args.includes('--all')
const TARGETS = args.filter((a) => a.startsWith('acct_'))

const key = process.env.STRIPE_SECRET_KEY
if (!key) {
  console.error('STRIPE_SECRET_KEY is not set. Run with: node --env-file=.env.local ...')
  process.exit(1)
}
if (!key.startsWith('sk_test_')) {
  console.error(`Refusing to run: STRIPE_SECRET_KEY is not a sandbox key (starts with "${key.slice(0, 8)}").`)
  process.exit(1)
}

const stripe = new Stripe(key)

/** Reuses a file id from env, or uploads the PNG under the given purpose. */
async function resolveFile(purpose, envVar) {
  const fromEnv = process.env[envVar]
  if (fromEnv) {
    console.log(`Using ${envVar} from env: ${fromEnv}`)
    return fromEnv
  }

  if (!APPLY) {
    console.log(`Would upload ${ICON_PATH} as a File (purpose: ${purpose})`)
    return null
  }

  const data = await readFile(ICON_PATH)
  const file = await stripe.files.create({
    purpose,
    file: { data, name: 'chaptr-icon.png', type: 'image/png' },
  })
  console.log(`Uploaded ${ICON_PATH} as ${purpose} -> ${file.id}`)
  console.log(`  Add to .env.local:  ${envVar}=${file.id}`)
  return file.id
}

/**
 * Stripe validates purpose per field: branding.icon needs `business_icon`,
 * branding.logo needs `business_logo`. The same artwork has to be uploaded
 * twice — one file cannot satisfy both.
 */
async function resolveBrandingFiles() {
  const icon = await resolveFile('business_icon', 'STRIPE_BRANDING_ICON_FILE_ID')
  const logo = await resolveFile('business_logo', 'STRIPE_BRANDING_LOGO_FILE_ID')
  return { icon, logo }
}

async function main() {
  const all = []
  for await (const account of stripe.accounts.list({ limit: 100 })) {
    all.push(account)
  }

  if (!ALL && TARGETS.length === 0) {
    console.log(`${all.length} connected account(s) on this platform:\n`)
    for (const a of all) {
      const created = new Date(a.created * 1000).toISOString().slice(0, 10)
      console.log(`  ${a.id}  ${a.type.padEnd(8)} created ${created}  userId=${a.metadata?.userId ?? '—'}`)
    }
    console.log('\nPass account id(s) to target, or --all. Nothing written.')
    return
  }

  const accounts = ALL ? all : all.filter((a) => TARGETS.includes(a.id))
  const missing = TARGETS.filter((id) => !all.some((a) => a.id === id))
  if (missing.length) {
    console.error(`Unknown account id(s): ${missing.join(', ')}`)
    process.exit(1)
  }

  const { icon, logo } = await resolveBrandingFiles()
  const branding = { ...BRANDING_COLORS, ...(icon ? { icon } : {}), ...(logo ? { logo } : {}) }

  console.log('\nBranding to apply:')
  console.log(JSON.stringify(branding, null, 2))
  console.log(`\nTargeting ${accounts.length} of ${all.length} connected account(s).`)

  for (const account of accounts) {
    const before = account.settings?.branding ?? {}
    console.log(
      `\n${account.id} (${account.type}) — current branding: ` +
        JSON.stringify({
          icon: before.icon ?? null,
          logo: before.logo ?? null,
          primary_color: before.primary_color ?? null,
          secondary_color: before.secondary_color ?? null,
        }),
    )

    if (!APPLY) {
      console.log('  dry run — pass --apply to write')
      continue
    }

    const updated = await stripe.accounts.update(account.id, { settings: { branding } })
    const after = updated.settings?.branding ?? {}
    console.log(
      '  applied -> ' +
        JSON.stringify({
          icon: after.icon ?? null,
          logo: after.logo ?? null,
          primary_color: after.primary_color ?? null,
          secondary_color: after.secondary_color ?? null,
        }),
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
