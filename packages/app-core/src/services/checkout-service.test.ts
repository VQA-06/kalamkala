import { describe, expect, it } from 'vitest'

import type { ClockPort } from '../ports/clock.js'
import type {
  CreateCheckoutSessionInput,
  PaymentGatewayPort,
} from '../ports/payment-gateway.js'
import type {
  CreateTransactionInput,
  TransactionRepository,
} from '../ports/transaction-repository.js'

import {
  CheckoutError,
  CheckoutService,
  calculatePromoDiscount,
  type CheckoutErrorCode,
  type PromoRule,
} from './checkout-service.js'

const FIXED_NOW = new Date('2026-03-01T08:00:00.000Z')

const createClock = (now: Date): ClockPort => ({ now: () => now })

const createPromo = (overrides: Partial<PromoRule> = {}): PromoRule => ({
  discountType: 'PERCENT',
  discountValue: 10,
  isActive: true,
  expiresAt: null,
  maxUses: null,
  usedCount: 0,
  ...overrides,
})

const catchError = (action: () => unknown): unknown => {
  try {
    action()
    return null
  } catch (error) {
    return error
  }
}

const expectPromoError = (action: () => unknown, code: CheckoutErrorCode): void => {
  const error = catchError(action)
  expect(error).toBeInstanceOf(CheckoutError)
  expect(error).toMatchObject({ code })
}

const createGateway = (): { gateway: PaymentGatewayPort; calls: CreateCheckoutSessionInput[] } => {
  const calls: CreateCheckoutSessionInput[] = []
  const gateway: PaymentGatewayPort = {
    provider: 'SIMULATED',
    createCheckoutSession: async (input) => {
      calls.push(input)
      return {
        merchantOrderId: input.merchantOrderId,
        provider: 'SIMULATED',
        paymentReference: 'sim_reference',
        redirectUrl: 'https://pay.test/simulasi',
        expiresAt: FIXED_NOW,
      }
    },
    verifyCallback: async () => {
      throw new Error('checkout tests never verify callbacks')
    },
  }
  return { gateway, calls }
}

const createTransactionRepository = (): {
  repository: TransactionRepository
  created: CreateTransactionInput[]
} => {
  const created: CreateTransactionInput[] = []
  const repository: TransactionRepository = {
    findById: async () => null,
    findByMerchantOrderId: async () => null,
    create: async (input) => {
      created.push(input)
      return { ...input, paidAt: null }
    },
    markPaidIfPending: async () => null,
    markStatus: async () => {},
  }
  return { repository, created }
}

const BASE_INPUT = {
  invitationId: 'invitation_1',
  userId: 'user_1',
  merchantOrderId: 'order_1',
  amount: 100_000,
  promo: null,
  promoCode: null,
  returnUrl: 'https://undangan.test/invitation_1',
} as const

describe('calculatePromoDiscount', () => {
  it('returns zero without a promo', () => {
    expect(calculatePromoDiscount(100_000, null, FIXED_NOW)).toBe(0)
  })

  it('applies a percentage discount rounded down', () => {
    const promo = createPromo({ discountType: 'PERCENT', discountValue: 15 })

    expect(calculatePromoDiscount(99_999, promo, FIXED_NOW)).toBe(14_999)
  })

  it('applies a fixed discount', () => {
    const promo = createPromo({ discountType: 'FIXED', discountValue: 25_000 })

    expect(calculatePromoDiscount(100_000, promo, FIXED_NOW)).toBe(25_000)
  })

  it('clamps a fixed discount to the order amount', () => {
    const promo = createPromo({ discountType: 'FIXED', discountValue: 500_000 })

    expect(calculatePromoDiscount(100_000, promo, FIXED_NOW)).toBe(100_000)
  })

  it('treats a 100 percent promo as free', () => {
    const promo = createPromo({ discountType: 'PERCENT', discountValue: 100 })

    expect(calculatePromoDiscount(100_000, promo, FIXED_NOW)).toBe(100_000)
  })

  it('rejects a percentage above 100', () => {
    const promo = createPromo({ discountType: 'PERCENT', discountValue: 101 })

    expectPromoError(() => calculatePromoDiscount(100_000, promo, FIXED_NOW), 'PROMO_INVALID')
  })

  it('rejects an inactive promo', () => {
    const promo = createPromo({ isActive: false })

    expectPromoError(() => calculatePromoDiscount(100_000, promo, FIXED_NOW), 'PROMO_INVALID')
  })

  it('rejects an expired promo', () => {
    const promo = createPromo({ expiresAt: FIXED_NOW })

    expectPromoError(() => calculatePromoDiscount(100_000, promo, FIXED_NOW), 'PROMO_INVALID')
  })

  it('rejects a promo at its usage limit', () => {
    const promo = createPromo({ maxUses: 5, usedCount: 5 })

    expectPromoError(() => calculatePromoDiscount(100_000, promo, FIXED_NOW), 'PROMO_INVALID')
  })

  it.each([0, -1, 1.5])('rejects amount %s as invalid', (amount) => {
    expectPromoError(() => calculatePromoDiscount(amount, null, FIXED_NOW), 'AMOUNT_INVALID')
  })
})

describe('CheckoutService.checkout', () => {
  it('creates a PENDING transaction and checks out the discounted total', async () => {
    const transactions = createTransactionRepository()
    const { gateway, calls } = createGateway()
    const service = new CheckoutService({
      transactionRepository: transactions.repository,
      paymentGateway: gateway,
      clock: createClock(FIXED_NOW),
    })

    const result = await service.checkout({
      ...BASE_INPUT,
      promo: createPromo({ discountType: 'PERCENT', discountValue: 10 }),
      promoCode: 'HEMAT10',
    })

    expect(result.discountAmount).toBe(10_000)
    expect(result.totalAmount).toBe(90_000)
    expect(result.transaction).toMatchObject({
      invitationId: 'invitation_1',
      userId: 'user_1',
      merchantOrderId: 'order_1',
      gatewayProvider: 'SIMULATED',
      gatewayReference: null,
      promoCode: 'HEMAT10',
      amount: 90_000,
      status: 'PENDING',
      paidAt: null,
    })
    expect(transactions.created).toHaveLength(1)
    expect(transactions.created[0]?.amount).toBe(90_000)
    expect(calls).toEqual([
      expect.objectContaining({
        invitationId: 'invitation_1',
        userId: 'user_1',
        merchantOrderId: 'order_1',
        amount: 90_000,
        promoCode: 'HEMAT10',
        returnUrl: 'https://undangan.test/invitation_1',
      }),
    ])
    expect(result.session.provider).toBe('SIMULATED')
  })

  it('omits the promo code from the gateway call when none is given', async () => {
    const transactions = createTransactionRepository()
    const { gateway, calls } = createGateway()
    const service = new CheckoutService({
      transactionRepository: transactions.repository,
      paymentGateway: gateway,
      clock: createClock(FIXED_NOW),
    })

    const result = await service.checkout(BASE_INPUT)

    expect(result.transaction.promoCode).toBeNull()
    expect(result.discountAmount).toBe(0)
    expect(result.totalAmount).toBe(100_000)
    expect(calls[0]?.promoCode).toBeUndefined()
  })

  it('rejects an invalid promo before creating a transaction', async () => {
    const transactions = createTransactionRepository()
    const { gateway } = createGateway()
    const service = new CheckoutService({
      transactionRepository: transactions.repository,
      paymentGateway: gateway,
      clock: createClock(FIXED_NOW),
    })

    await expect(
      service.checkout({ ...BASE_INPUT, promo: createPromo({ isActive: false }) }),
    ).rejects.toMatchObject({ name: 'CheckoutError', code: 'PROMO_INVALID' })
    expect(transactions.created).toHaveLength(0)
  })
})
