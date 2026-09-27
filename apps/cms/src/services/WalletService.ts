import type { Payload } from 'payload'
import crypto from 'crypto'
import { createNotificationFanout } from '../utils/notificationFanout'

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function relId(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object' && value !== null && 'id' in (value as any)) {
    return String((value as any).id)
  }
  return null
}

export type WalletEntryType =
  | 'topup'
  | 'payment'
  | 'refund'
  | 'cashback'
  | 'withdrawal'
  | 'adjustment'
  | 'expiry'

export interface PostEntryArgs {
  customerId: number | string
  type: WalletEntryType
  /** Signed PHP amount (+ credit, - debit) */
  amount: number
  orderId?: number | string | null
  paymentIntentId?: string | null
  gateway?: string | null
  idempotencyKey?: string | null
  expiresAt?: string | null
  meta?: Record<string, unknown> | null
}

const COUNTER_FIELD: Record<WalletEntryType, string | null> = {
  topup: 'total_topped_up',
  payment: 'total_spent',
  refund: 'total_refunded',
  cashback: 'total_cashback',
  withdrawal: null,
  adjustment: null,
  expiry: null,
}

/**
 * Gateway-agnostic wallet ledger service.
 * Mirrors CouponService ergonomics: constructed with payload, methods never
 * throw for webhook best-effort paths unless documented.
 */
export class WalletService {
  constructor(private payload: Payload) {}

  async getOrCreateWallet(customerId: number | string): Promise<any> {
    const existing = await (this.payload as any).find({
      collection: 'wallets',
      where: { customer: { equals: Number(customerId) || customerId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing?.docs?.[0]) return existing.docs[0]
    const created = await (this.payload as any).create({
      collection: 'wallets',
      data: { customer: Number(customerId) || customerId, balance: 0, currency: 'PHP', status: 'active' },
      overrideAccess: true,
    })
    return created
  }

  async getBalance(customerId: number | string): Promise<{ balance: number; currency: string; status: string; walletId: number | string }> {
    const wallet = await this.getOrCreateWallet(customerId)
    return {
      balance: Number(wallet.balance ?? 0),
      currency: wallet.currency || 'PHP',
      status: wallet.status || 'active',
      walletId: wallet.id,
    }
  }

  /** Idempotent ledger post — retries with the same key return the existing row. */
  async postEntry(args: PostEntryArgs): Promise<any> {
    const amount = roundMoney(Number(args.amount))
    if (!Number.isFinite(amount) || amount === 0) {
      throw new Error('Wallet amount must be a non-zero number')
    }
    const idempotencyKey = args.idempotencyKey || crypto.randomUUID()

    const dup = await (this.payload as any).find({
      collection: 'wallet-transactions',
      where: { idempotency_key: { equals: idempotencyKey } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (dup?.docs?.[0]) return dup.docs[0]

    const wallet = await this.getOrCreateWallet(args.customerId)
    if (wallet.status !== 'active' && !(args.type === 'adjustment' && wallet.status === 'frozen')) {
      throw new Error(`WALLET_NOT_ACTIVE (status=${wallet.status})`)
    }

    const current = roundMoney(Number(wallet.balance ?? 0))
    const next = roundMoney(current + amount)
    if (next < 0) {
      throw new Error('INSUFFICIENT_WALLET_BALANCE')
    }

    const entry = await (this.payload as any).create({
      collection: 'wallet-transactions',
      data: {
        wallet: wallet.id,
        customer: Number(args.customerId) || args.customerId,
        type: args.type,
        amount,
        balance_after: next,
        order: args.orderId ? Number(args.orderId) || args.orderId : undefined,
        payment_intent_id: args.paymentIntentId || undefined,
        gateway: args.gateway || process.env.WALLET_TOPUP_PROVIDER || 'paymongo',
        idempotency_key: idempotencyKey,
        status: 'posted',
        expires_at: args.expiresAt || undefined,
        meta: args.meta || undefined,
      },
      overrideAccess: true,
    })

    const counter = COUNTER_FIELD[args.type]
    const patch: Record<string, unknown> = { balance: next }
    if (counter) {
      patch[counter] = roundMoney(Number((wallet as any)[counter] ?? 0) + Math.abs(amount))
    }
    await (this.payload as any).update({
      collection: 'wallets',
      id: wallet.id,
      data: patch,
      overrideAccess: true,
    })

    try {
      const userLink = await (this.payload as any).findByID({
        collection: 'customers',
        id: Number(args.customerId) || args.customerId,
        depth: 0,
        overrideAccess: true,
      })
      const userId = relId((userLink as any)?.user)
      if (userId) {
        await createNotificationFanout({
          payload: this.payload,
          userId,
          typeKey: `wallet.${args.type}`,
          domain: 'order',
          priority: 'info',
          title: `Wallet ${args.type}`,
          body: `${amount > 0 ? '+' : ''}₱${Math.abs(amount).toFixed(2)} ${args.type} — new balance ₱${next.toFixed(2)}.`,
          sourceEntityType: 'wallet-transaction',
          sourceEntityId: entry.id,
          metadata: { customerId: String(args.customerId), type: args.type, amount, balanceAfter: next },
        })
      }
    } catch (e) {
      console.error('[wallet] fanout error:', e)
    }

    return entry
  }

  /** Pay for a pending order with wallet balance (full or partial via `amount`). */
  async payWithWallet(args: { orderId: number | string; customerId: number | string; amount?: number }): Promise<{ entry: any; orderTotal: number; walletUsed: number }> {
    const order = await (this.payload as any).findByID({
      collection: 'orders',
      id: Number(args.orderId) || args.orderId,
      depth: 0,
      overrideAccess: true,
    })
    if (!order) throw new Error('ORDER_NOT_FOUND')
    if (relId((order as any).customer) !== String(args.customerId)) {
      throw new Error('CONTACT_NOT_ALLOWED')
    }
    if ((order as any).status !== 'pending') {
      throw new Error('ORDER_NOT_EDITABLE')
    }
    const subtotal = Number((order as any).subtotal ?? 0)
    const deliveryFee = Number((order as any).delivery_fee ?? 0)
    const platformFee = Number((order as any).platform_fee ?? 0)
    const priorityFee = Number((order as any).priority_fee ?? 0)
    const discountTotal = Number((order as any).discount_total ?? 0)
    const alreadyUsed = Number((order as any).wallet_amount_used ?? 0)
    const gross = roundMoney(subtotal + deliveryFee + platformFee + priorityFee - discountTotal - alreadyUsed)
    const { balance } = await this.getBalance(args.customerId)
    const requested = args.amount !== undefined ? roundMoney(Number(args.amount)) : gross
    if (!Number.isFinite(requested) || requested <= 0) throw new Error('Invalid wallet amount')
    const walletUsed = roundMoney(Math.min(requested, gross, balance))
    if (walletUsed <= 0) throw new Error('INSUFFICIENT_WALLET_BALANCE')

    const entry = await this.postEntry({
      customerId: args.customerId,
      type: 'payment',
      amount: -walletUsed,
      orderId: args.orderId,
      idempotencyKey: `wallet-pay:${String(args.orderId)}:${String(args.customerId)}:${walletUsed}`,
      meta: { orderId: String(args.orderId) },
    })

    const newUsed = roundMoney(alreadyUsed + walletUsed)
    const newTotal = roundMoney(Math.max(0, gross - walletUsed))
    await (this.payload as any).update({
      collection: 'orders',
      id: (order as any).id,
      data: { wallet_amount_used: newUsed, paid_with_wallet: true, total: newTotal },
      overrideAccess: true,
    })

    return { entry, orderTotal: newTotal, walletUsed }
  }

  /** Credit a refund back to the wallet. Never throws (webhook best-effort). */
  async refundToWallet(orderId: number | string, amount?: number): Promise<void> {
    try {
      const order = await (this.payload as any).findByID({
        collection: 'orders',
        id: Number(orderId) || orderId,
        depth: 0,
        overrideAccess: true,
      })
      if (!order) return
      const customerId = relId((order as any).customer)
      if (!customerId) return
      const fallback = Number((order as any).wallet_amount_used ?? (order as any).total ?? 0)
      const credit = roundMoney(Number(amount ?? fallback))
      if (!Number.isFinite(credit) || credit <= 0) return
      await this.postEntry({
        customerId,
        type: 'refund',
        amount: credit,
        orderId,
        idempotencyKey: `wallet-refund:${String(orderId)}:${credit}`,
        meta: { orderId: String(orderId) },
      })
    } catch (e) {
      console.error('[wallet] refundToWallet error:', e)
    }
  }

  /** Grant cashback/coins with optional expiry. Never throws. */
  async grantCashback(orderId: number | string, amount: number, expiresAt?: string | null): Promise<void> {
    try {
      const credit = roundMoney(Number(amount))
      if (!Number.isFinite(credit) || credit <= 0) return
      const order = await (this.payload as any).findByID({
        collection: 'orders',
        id: Number(orderId) || orderId,
        depth: 0,
        overrideAccess: true,
      })
      const customerId = relId((order as any)?.customer)
      if (!customerId) return
      await this.postEntry({
        customerId,
        type: 'cashback',
        amount: credit,
        orderId,
        idempotencyKey: `wallet-cashback:${String(orderId)}:${credit}`,
        expiresAt: expiresAt || undefined,
        meta: { orderId: String(orderId) },
      })
    } catch (e) {
      console.error('[wallet] grantCashback error:', e)
    }
  }
}
