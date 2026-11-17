import { D1AdminStatsRepository, D1UserRepository, createAppDatabase } from '@kalamkala/adapters-cloudflare'
import type { TransactionStatus } from '@kalamkala/contracts'
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { env } from 'cloudflare:workers'

import { getAuth } from '../lib/auth'

export type AdminTransactionRow = {
  id: string
  merchantOrderId: string
  amount: number
  status: TransactionStatus
  paidAt: Date | null
}

export type AdminStats = {
  userCount: number
  invitationCount: number
  transactionCount: number
  latestTransactions: AdminTransactionRow[]
}

/** Platform-wide counters for operators; requires the ADMIN role. */
export const getAdminStats = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AdminStats | null> => {
    const session = await getAuth().api.getSession({ headers: getRequestHeaders() })
    if (session === null) return null

    const db = createAppDatabase(env.DB)
    const user = await new D1UserRepository({ db }).findById(session.user.id)
    if (user?.role !== 'ADMIN') return null

    const stats = await new D1AdminStatsRepository({ db }).getPlatformStats(5)

    return {
      userCount: stats.userCount,
      invitationCount: stats.invitationCount,
      transactionCount: stats.transactionCount,
      latestTransactions: stats.latestTransactions.map((transaction) => ({
        id: transaction.id,
        merchantOrderId: transaction.merchantOrderId,
        amount: transaction.amount,
        status: transaction.status,
        paidAt: transaction.paidAt,
      })),
    }
  },
)
