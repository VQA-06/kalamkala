import type { StoredTransaction } from './transaction-repository.js'

/** Aggregate counters plus the most recent payments for the admin overview. */
export type PlatformStats = {
  userCount: number
  invitationCount: number
  transactionCount: number
  /** Sum of PAID transaction amounts, in whole rupiah. */
  revenueTotal: number
  paidTransactionCount: number
  latestTransactions: readonly StoredTransaction[]
}

export type AdminStatsRepository = {
  /** latestLimit defaults to 5 and is clamped to 1..50 by the implementation. */
  getPlatformStats: (latestLimit?: number) => Promise<PlatformStats>
}
