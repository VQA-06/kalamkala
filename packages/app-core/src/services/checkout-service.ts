import type { ClockPort } from '../ports/clock.js'
import type { CheckoutSession, PaymentGatewayPort } from '../ports/payment-gateway.js'
import type { StoredTransaction, TransactionRepository } from '../ports/transaction-repository.js'
import type { DiscountType } from '@kalamkala/contracts'

export type CheckoutErrorCode = 'AMOUNT_INVALID' | 'PROMO_INVALID'

export class CheckoutError extends Error {
  readonly code: CheckoutErrorCode

  constructor(code: CheckoutErrorCode, message: string = code) {
    super(message)
    this.name = 'CheckoutError'
    this.code = code
  }
}

export type PromoRule = {
  discountType: DiscountType
  discountValue: number
  isActive: boolean
  expiresAt: Date | null
  maxUses: number | null
  usedCount: number
}

export type CheckoutServiceDeps = {
  transactionRepository: TransactionRepository
  paymentGateway: PaymentGatewayPort
  clock: ClockPort
}

export type CheckoutInput = {
  invitationId: string
  userId: string
  merchantOrderId: string
  amount: number
  promo: PromoRule | null
  promoCode: string | null
  returnUrl: string
}

export type CheckoutResult = {
  transaction: StoredTransaction
  session: CheckoutSession
  discountAmount: number
  totalAmount: number
}

const invalidPromo = (reason: string): CheckoutError =>
  new CheckoutError('PROMO_INVALID', `Promo ${reason}`)

/**
 * Web Crypto is available in Node and Cloudflare Workers, but this package
 * compiles against the ES2022 lib only. Declare just the method used here.
 */
declare const crypto: {
  randomUUID: () => string
}

/**
 * Discount in whole rupiah, clamped to the order amount.
 * Throws instead of returning 0 so a bad promo never silently charges full price.
 */
export const calculatePromoDiscount = (
  amount: number,
  promo: PromoRule | null,
  now: Date,
): number => {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new CheckoutError('AMOUNT_INVALID', 'Amount must be a positive integer in rupiah')
  }
  if (promo === null) return 0

  if (!promo.isActive) throw invalidPromo('is inactive')
  if (promo.expiresAt !== null && promo.expiresAt.getTime() <= now.getTime()) {
    throw invalidPromo('has expired')
  }
  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
    throw invalidPromo('has reached its usage limit')
  }

  let discount: number
  if (promo.discountType === 'PERCENT') {
    if (!(promo.discountValue >= 0 && promo.discountValue <= 100)) {
      throw invalidPromo('percentage must be between 0 and 100')
    }
    discount = Math.floor((amount * promo.discountValue) / 100)
  } else {
    if (!(promo.discountValue >= 0)) throw invalidPromo('fixed discount must not be negative')
    discount = Math.floor(promo.discountValue)
  }

  return Math.min(Math.max(discount, 0), amount)
}

export class CheckoutService {
  private readonly transactionRepository: TransactionRepository
  private readonly paymentGateway: PaymentGatewayPort
  private readonly clock: ClockPort

  constructor(deps: CheckoutServiceDeps) {
    this.transactionRepository = deps.transactionRepository
    this.paymentGateway = deps.paymentGateway
    this.clock = deps.clock
  }

  async checkout(input: CheckoutInput): Promise<CheckoutResult> {
    const discountAmount = calculatePromoDiscount(input.amount, input.promo, this.clock.now())
    const totalAmount = input.amount - discountAmount

    const transaction = await this.transactionRepository.create({
      id: crypto.randomUUID(),
      invitationId: input.invitationId,
      userId: input.userId,
      merchantOrderId: input.merchantOrderId,
      gatewayProvider: this.paymentGateway.provider,
      gatewayReference: null,
      promoCode: input.promoCode,
      amount: totalAmount,
      status: 'PENDING',
    })

    const session = await this.paymentGateway.createCheckoutSession({
      invitationId: input.invitationId,
      userId: input.userId,
      merchantOrderId: input.merchantOrderId,
      amount: totalAmount,
      promoCode: input.promoCode ?? undefined,
      returnUrl: input.returnUrl,
    })

    return { transaction, session, discountAmount, totalAmount }
  }
}
