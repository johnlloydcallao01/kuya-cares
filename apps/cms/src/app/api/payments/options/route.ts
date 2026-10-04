import { NextResponse } from 'next/server'

/**
 * GET /api/payments/options
 *
 * Single source of truth for customer-facing payment options (PayMongo
 * pay-in rails). Public — options are visible pre-login, exactly like the
 * system-settings global. No user, no DB reads, no auth: the list is
 * platform configuration, so it can never leak personal data.
 *
 * Canonical method set mirrors the server-side `payment_method_allowed`
 * intents (payload.config create-payment-intent + topupProviders). Clients
 * must NOT hardcode their own lists — fetch this and filter client-side
 * (e.g. checkout excludes `card`, like mobile).
 *
 * Response: { data: { methods: [{ id, label, hint }] } }
 * Logos stay client-side (presentation assets, not API data).
 */
const PAYMENT_METHODS = [
  { id: 'card', label: 'Cards (Visa/Mastercard)', hint: 'Credit & debit cards' },
  { id: 'gcash', label: 'GCash', hint: 'GCash e-wallet' },
  { id: 'grab_pay', label: 'GrabPay', hint: 'GrabPay e-wallet' },
  { id: 'paymaya', label: 'Maya', hint: 'Maya e-wallet' },
  { id: 'billease', label: 'BillEase (BNPL)', hint: 'Buy now, pay later' },
  { id: 'dob', label: 'Online Banking (BPI/UBP)', hint: 'BPI or UnionBank' },
  { id: 'brankas', label: 'Online Banking (BDO/Metrobank/LandBank)', hint: 'BDO, Metrobank or LandBank' },
  { id: 'qrph', label: 'QR Ph', hint: 'Any QR Ph app' },
] as const

export async function GET() {
  return NextResponse.json({ data: { methods: PAYMENT_METHODS } })
}
