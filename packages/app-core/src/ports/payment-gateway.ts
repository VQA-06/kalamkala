import type { PaymentProvider } from '@kalamkala/contracts'

/**
 * Re-exported so core consumers can name a provider without importing
 * the contracts package directly.
 */
export type { PaymentProvider }

/** Request to open a hosted checkout page for one invitation purchase. */
export type CreateCheckoutSessionInput = {
  invitationId: string
  userId: string
  /** Client-side order number that stays stable across retries. */
  merchantOrderId: string
  /** Integer amount in rupiah, greater than zero. */
  amount: number
  promoCode?: string
  /** Absolute URL the provider sends the buyer back to. */
  returnUrl: string
}

export type CheckoutSession = {
  merchantOrderId: string
  provider: PaymentProvider
  /** Reference minted by the provider for this checkout. */
  paymentReference: string
  redirectUrl: string
  expiresAt: Date
}

/**
 * Raw provider callback, kept at transport level on purpose:
 * every gateway has its own header and body format.
 */
export type PaymentCallbackRequest = {
  headers: Record<string, string>
  body: string
}

export type VerifiedPayment = {
  merchantOrderId: string
  provider: PaymentProvider
  status: 'PAID' | 'FAILED' | 'EXPIRED'
  amount: number
  gatewayReference: string
  paidAt: Date | null
}

export type PaymentGatewayErrorCode = 'INVALID_SIGNATURE' | 'EXPIRED' | 'MALFORMED' | 'VALIDATION'

export class PaymentGatewayError extends Error {
  readonly code: PaymentGatewayErrorCode

  constructor(code: PaymentGatewayErrorCode, message: string = code) {
    super(message)
    this.name = 'PaymentGatewayError'
    this.code = code
  }
}

/**
 * The seam every payment provider implements.
 * Application code only ever sees CheckoutSession and VerifiedPayment,
 * so swapping Duitku in later does not touch UI or database code.
 */
export type PaymentGatewayPort = {
  /** Identifies the provider backing this gateway, used to stamp transactions. */
  readonly provider: PaymentProvider
  createCheckoutSession: (input: CreateCheckoutSessionInput) => Promise<CheckoutSession>
  verifyCallback: (request: PaymentCallbackRequest) => Promise<VerifiedPayment>
}
