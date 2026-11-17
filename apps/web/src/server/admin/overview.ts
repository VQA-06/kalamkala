import type { StoredTransaction } from '@kalamkala/app-core'
import { createServerFn } from '@tanstack/react-start'

import { requireAdminServices } from './context.js'

export type AdminOverview = {
  userCount: number
  invitationCount: number
  transactionCount: number
  revenueTotal: number
  paidTransactionCount: number
  latestTransactions: StoredTransaction[]
}

/** Counters, revenue, and the five newest payments for the admin dashboard. */
export const getAdminOverview = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AdminOverview | null> => {
    const services = await requireAdminServices()
    if (services === null) return null

    const [stats, latestTransactions] = await Promise.all([
      services.adminStatsRepository.getPlatformStats(5),
      services.transactionRepository.listRecent(5),
    ])

    return {
      userCount: stats.userCount,
      invitationCount: stats.invitationCount,
      transactionCount: stats.transactionCount,
      revenueTotal: stats.revenueTotal,
      paidTransactionCount: stats.paidTransactionCount,
      latestTransactions,
    }
  },
)
