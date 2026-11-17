import type {
  CreateTransactionInput,
  LoggerPort,
  PaymentConfirmation,
  StoredTransaction,
  TransactionRepository,
} from '@kalamkala/app-core'
import { transactions } from '@kalamkala/db-schema'
import { and, eq } from 'drizzle-orm'

import type { AppDatabase } from './database.js'

export type D1TransactionRepositoryOptions = {
  db: AppDatabase
  logger?: LoggerPort
}

type TransactionRow = typeof transactions.$inferSelect

/** Payment attempts; `markPaidIfPending` is the idempotency seam for callbacks. */
export class D1TransactionRepository implements TransactionRepository {
  private readonly db: AppDatabase
  private readonly logger: LoggerPort | undefined

  constructor(options: D1TransactionRepositoryOptions) {
    this.db = options.db
    this.logger = options.logger
  }

  async findById(id: string): Promise<StoredTransaction | null> {
    const row = await this.db.query.transactions.findFirst({ where: eq(transactions.id, id) })
    return row === undefined ? null : this.toStoredTransaction(row)
  }

  async findByMerchantOrderId(merchantOrderId: string): Promise<StoredTransaction | null> {
    const row = await this.db.query.transactions.findFirst({
      where: eq(transactions.merchantOrderId, merchantOrderId),
    })
    return row === undefined ? null : this.toStoredTransaction(row)
  }

  async create(input: CreateTransactionInput): Promise<StoredTransaction> {
    const rows = await this.db
      .insert(transactions)
      .values({
        id: input.id,
        invitationId: input.invitationId,
        userId: input.userId,
        merchantOrderId: input.merchantOrderId,
        gatewayProvider: input.gatewayProvider,
        gatewayReference: input.gatewayReference,
        promoCode: input.promoCode,
        amount: input.amount,
        status: input.status,
      })
      .returning()

    const row = rows[0]
    if (row === undefined) {
      throw new Error(`Failed to create transaction ${input.id}`)
    }
    return this.toStoredTransaction(row)
  }

  async markPaidIfPending(
    merchantOrderId: string,
    confirmation: PaymentConfirmation,
  ): Promise<StoredTransaction | null> {
    // The status predicate is what makes a duplicated gateway callback a no-op.
    const rows = await this.db
      .update(transactions)
      .set({
        status: 'PAID',
        gatewayReference: confirmation.gatewayReference,
        paidAt: confirmation.paidAt,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(transactions.merchantOrderId, merchantOrderId),
          eq(transactions.status, 'PENDING'),
        ),
      )
      .returning()

    const row = rows[0]
    return row === undefined ? null : this.toStoredTransaction(row)
  }

  async markStatus(id: string, status: StoredTransaction['status']): Promise<void> {
    const rows = await this.db
      .update(transactions)
      .set({ status, updatedAt: new Date() })
      .where(eq(transactions.id, id))
      .returning({ id: transactions.id })

    if (rows[0] === undefined) {
      this.logger?.error('Transaction not found while changing status', {
        transactionId: id,
        status,
      })
      throw new Error(`Transaction ${id} not found`)
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
    }
  }
}
