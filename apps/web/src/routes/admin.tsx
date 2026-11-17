import { Link, createFileRoute, redirect } from '@tanstack/react-router'

import type { TransactionStatus } from '@kalamkala/contracts'

import { requireAdmin } from '../lib/route-guard'
import { getAdminStats } from '../server/admin-stats'

export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ location }) => requireAdmin(location.href),
  loader: async () => {
    const stats = await getAdminStats()
    if (stats === null) {
      throw redirect({ to: '/dashboard' })
    }
    return stats
  },
  component: AdminPage,
})

const STATUS_LABELS: Record<TransactionStatus, string> = {
  PENDING: 'Menunggu',
  PAID: 'Lunas',
  FAILED: 'Gagal',
  EXPIRED: 'Kedaluwarsa',
}

const currency = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

const formatDate = (value: Date): string =>
  new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(value)

function AdminPage() {
  const { userCount, invitationCount, transactionCount, latestTransactions } =
    Route.useLoaderData()

  const counters = [
    { label: 'Pengguna', value: userCount },
    { label: 'Undangan', value: invitationCount },
    { label: 'Transaksi', value: transactionCount },
  ]

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-16 sm:py-24">
      <header className="flex flex-wrap items-baseline justify-between gap-4 border-b border-line pb-6">
        <Link to="/" className="font-display text-lg tracking-tight text-ink">
          Kalamkala
        </Link>
        <Link to="/dashboard" className="text-xs text-champagne">
          Kembali ke dasbor
        </Link>
      </header>

      <main className="mt-12">
        <p className="text-[0.69rem] font-semibold uppercase tracking-[0.18em] text-champagne">
          Admin
        </p>
        <h1 className="mt-3 font-display text-4xl leading-[1.05] text-ink">
          Ringkasan platform
        </h1>

        <dl className="mt-8 grid gap-px border-y border-line sm:grid-cols-3 sm:divide-x sm:divide-line">
          {counters.map((counter) => (
            <div key={counter.label} className="py-4 sm:px-6 sm:first:pl-0">
              <dt className="text-[0.69rem] font-semibold uppercase tracking-[0.16em] text-champagne">
                {counter.label}
              </dt>
              <dd className="mt-1 font-display text-3xl text-ink">{counter.value}</dd>
            </div>
          ))}
        </dl>

        <section className="mt-12">
          <h2 className="border-b border-line pb-3 text-[0.69rem] font-semibold uppercase tracking-[0.18em] text-champagne">
            Transaksi terbaru
          </h2>

          {latestTransactions.length === 0 ? (
            <p className="mt-6 text-sm leading-6 text-ink/70">Belum ada transaksi.</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-[0.69rem] uppercase tracking-[0.14em] text-champagne">
                    <th className="py-3 pr-4 font-semibold">Order</th>
                    <th className="py-3 pr-4 font-semibold">Jumlah</th>
                    <th className="py-3 pr-4 font-semibold">Status</th>
                    <th className="py-3 font-semibold">Tanggal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {latestTransactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="py-3 pr-4 font-mono text-xs text-ink/80">
                        {transaction.merchantOrderId}
                      </td>
                      <td className="py-3 pr-4 text-ink">
                        {currency.format(transaction.amount)}
                      </td>
                      <td className="py-3 pr-4 text-ink/80">
                        {STATUS_LABELS[transaction.status]}
                      </td>
                      <td className="py-3 text-ink/80">
                        {formatDate(new Date(transaction.createdAt))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
