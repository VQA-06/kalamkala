import type { PaymentProvider, TransactionStatus } from '@kalamkala/contracts'

export type StoredTransaction = {
  id: string
  invitationId: string
  userId: string
  merchantOrderId: string
  gatewayProvider: PaymentProvider
  gatewayReference: string | null
  promoCode: string | null
  amount: number
  status: TransactionStatus
  paidAt: Date | null
  createdAt: Date
}

export type CreateTransactionInput = {
  id: string
  invitationId: string
  userId: string
  merchantOrderId: string
  gatewayProvider: PaymentProvider
  gatewayReference: string | null
  promoCode: string | null
  amount: number
  status: TransactionStatus
}

export type PaymentConfirmation = {
  gatewayReference: string
  paidAt: Date
}

export type TransactionRepository = {
  findById: (id: string) => Promise<StoredTransaction | null>
  findByMerchantOrderId: (merchantOrderId: string) => Promise<StoredTransaction | null>
  create: (input: CreateTransactionInput) => Promise<StoredTransaction>
  /** Newest first; implementations clamp the limit to 1..200. */
  listRecent: (limit: number) => Promise<StoredTransaction[]>
  /**
   * Returns the paid row, or null when the row was no longer PENDING.
   * The conditional update is what makes duplicate callbacks safe.
   */
  markPaidIfPending: (
    merchantOrderId: string,
    confirmation: PaymentConfirmation,
  ) => Promise<StoredTransaction | null>
  markStatus: (id: string, status: TransactionStatus) => Promise<void>
}
