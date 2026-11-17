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
  createdAt: Date
}

export type AdminStats = {
  userCount: number
  invitationCount: number
  transactionCount: number
  latestTransactions: AdminTransactionRow[]
}

type RoleRow = { role: 'USER' | 'ADMIN' }
type CountRow = { total: number }
type TransactionRow = {
  id: string
  merchant_order_id: string
  amount: number
  status: TransactionStatus
  created_at: number
}

const countOf = async (table: 'users' | 'invitations' | 'transactions'): Promise<number> => {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS total FROM ${table}`).first<CountRow>()
  return row?.total ?? 0
}

/** Platform-wide counters for operators; requires the ADMIN role. */
export const getAdminStats = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AdminStats | null> => {
    const session = await getAuth().api.getSession({ headers: getRequestHeaders() })
    if (session === null) return null

    const roleRow = await env.DB.prepare('SELECT role FROM users WHERE id = ?1')
      .bind(session.user.id)
      .first<RoleRow>()

    if (roleRow?.role !== 'ADMIN') return null

    const [userCount, invitationCount, transactionCount, latest] = await Promise.all([
      countOf('users'),
      countOf('invitations'),
      countOf('transactions'),
      env.DB.prepare(
        'SELECT id, merchant_order_id, amount, status, created_at FROM transactions ORDER BY created_at DESC LIMIT 5',
      ).all<TransactionRow>(),
    ])

    return {
      userCount,
      invitationCount,
      transactionCount,
      latestTransactions: latest.results.map((row) => ({
        id: row.id,
        merchantOrderId: row.merchant_order_id,
        amount: row.amount,
        status: row.status,
        createdAt: new Date(row.created_at * 1000),
      })),
    }
  },
)
