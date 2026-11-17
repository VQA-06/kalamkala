import type {
  AdminStatsRepository,
  PlatformStats,
  StoredTransaction,
} from '@kalamkala/app-core'
import { invitations, transactions, users } from '@kalamkala/db-schema'
import { count, desc, eq, sql } from 'drizzle-orm'

import type { AppDatabase } from './database.js'

export type D1AdminStatsRepositoryOptions = {
  db: AppDatabase
}

type TransactionRow = typeof transactions.$inferSelect

const DEFAULT_LATEST_LIMIT = 5
const MAX_LATEST_LIMIT = 50

const toLatestLimit = (requested: number | undefined): number => {
  if (requested === undefined || !Number.isFinite(requested)) return DEFAULT_LATEST_LIMIT
  return Math.min(MAX_LATEST_LIMIT, Math.max(1, Math.trunc(requested)))
}

/** Aggregate counts for the admin overview; never loads full tables. */
export class D1AdminStatsRepository implements AdminStatsRepository {
  private readonly db: AppDatabase

  constructor(options: D1AdminStatsRepositoryOptions) {
    this.db = options.db
  }

  async getPlatformStats(latestLimit?: number): Promise<PlatformStats> {
    const limit = toLatestLimit(latestLimit)

    const [userRows, invitationRows, transactionRows, paidRows, latestRows] = await Promise.all([
      this.db.select({ value: count() }).from(users),
      this.db.select({ value: count() }).from(invitations),
      this.db.select({ value: count() }).from(transactions),
      this.db
        .select({
          revenue: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
          paid: count(),
        })
        .from(transactions)
        .where(eq(transactions.status, 'PAID')),
      this.db
        .select()
        .from(transactions)
        .orderBy(desc(transactions.createdAt), desc(transactions.id))
        .limit(limit),
    ])

    const paid = paidRows[0]
    return {
      userCount: userRows[0]?.value ?? 0,
      invitationCount: invitationRows[0]?.value ?? 0,
      transactionCount: transactionRows[0]?.value ?? 0,
      revenueTotal: paid?.revenue ?? 0,
      paidTransactionCount: paid?.paid ?? 0,
      latestTransactions: latestRows.map((row) => this.toStoredTransaction(row)),
    }
  }

  private toStoredTransaction(row: TransactionRow): StoredTransaction {
    return {
      id: row.id,
      invitationId: row.invitationId,
      userId: row.userId,
      merchantOrderId: row.merchantOrderId,
      gatewayProvider: row.gatewayProvider,
      gatewayReference: row.gatewayReference,
      promoCode: row.promoCode,
      amount: row.amount,
      status: row.status,
      paidAt: row.paidAt,
      createdAt: row.createdAt,
    }
  }
}
