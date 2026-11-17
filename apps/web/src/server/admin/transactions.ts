import { PaymentActivationError } from '@kalamkala/app-core'
import type { StoredTransaction } from '@kalamkala/app-core'
import type { TransactionStatus } from '@kalamkala/contracts'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { requireAdminServices } from './context.js'

export type AdminTransactionList = { transactions: StoredTransaction[] }
export type ActivateTransactionResult =
  | { ok: true; status: TransactionStatus }
  | { ok: false; error: string }

const listInputSchema = z.object({
  limit: z.number().int().optional(),
})

const activateInputSchema = z.object({
  merchantOrderId: z.string().trim().min(1),
})

const clampLimit = (requested: number | undefined): number => {
  if (requested === undefined || !Number.isFinite(requested)) return 50
  return Math.min(200, Math.max(1, Math.trunc(requested)))
}

const activationErrorMessage = (error: PaymentActivationError): string => {
  switch (error.code) {
    case 'TRANSACTION_NOT_FOUND':
      return 'Transaksi tidak ditemukan.'
    case 'INVITATION_NOT_FOUND':
      return 'Undangan terkait transaksi tidak ditemukan.'
    case 'INVALID_STATE':
      return 'Status transaksi ini tidak dapat diaktifkan secara manual.'
    case 'AMOUNT_MISMATCH':
    case 'PROVIDER_MISMATCH':
      return 'Data pembayaran tidak cocok dengan transaksi.'
  }
}

export const listAdminTransactions = createServerFn({ method: 'GET' })
  .validator((input: unknown) => listInputSchema.parse(input))
  .handler(async ({ data }): Promise<AdminTransactionList | null> => {
    const services = await requireAdminServices()
    if (services === null) return null

    const transactions = await services.transactionRepository.listRecent(
      clampLimit(data.limit),
    )
    return { transactions }
  })

/** Marks a pending/failed/expired order as paid and publishes its invitation. */
export const activateTransactionManually = createServerFn({ method: 'POST' })
  .validator((input: unknown) => activateInputSchema.parse(input))
  .handler(
    async ({ data }): Promise<ActivateTransactionResult> => {
      const services = await requireAdminServices()
      if (services === null) {
        return { ok: false, error: 'Sesi admin tidak valid.' }
      }

      const transaction =
        await services.transactionRepository.findByMerchantOrderId(
          data.merchantOrderId,
        )
      if (transaction === null) {
        return { ok: false, error: 'Transaksi tidak ditemukan.' }
      }
      if (transaction.status === 'PAID') {
        return { ok: true, status: transaction.status }
      }

      try {
        const result = await services.activation.activateManually(
          data.merchantOrderId,
        )
        return { ok: true, status: result.transaction.status }
      } catch (error) {
        services.logger.error('admin.transaction_activation_failed', {
          merchantOrderId: data.merchantOrderId,
          error: error instanceof Error ? error.message : String(error),
        })
        if (error instanceof PaymentActivationError) {
          return { ok: false, error: activationErrorMessage(error) }
        }
        return {
          ok: false,
          error: 'Aktivasi manual gagal. Periksa kembali transaksi ini.',
        }
      }
    },
  )
