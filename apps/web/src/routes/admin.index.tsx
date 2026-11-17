import { Link, createFileRoute, redirect } from '@tanstack/react-router'

import type { TransactionStatus } from '@kalamkala/contracts'

import { getAdminOverview } from '../server/admin/overview'

export const Route = createFileRoute('/admin/')({
  head: () => ({ meta: [{ title: 'Ringkasan Admin — Kalamkala' }] }),
  loader: async () => {
    const overview = await getAdminOverview()
    if (overview === null) {
      throw redirect({ to: '/dashboard' })
    }
    return overview
  },
  component: AdminOverviewPage,
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
  new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))

const ADMIN_LINKS = [
  {
    to: '/admin/transactions',
    label: 'Transaksi',
    description: 'Pantau pembayaran dan aktivasi manual.',
  },
  {
    to: '/admin/templates',
    label: 'Template',
    description: 'Atur nama, tingkat, urutan, dan visibilitas tema.',
  },
  {
    to: '/admin/promos',
    label: 'Promo',
    description: 'Kelola kode diskon dan komisi partner.',
  },
] as const

function AdminOverviewPage() {
  const {
    userCount,
    invitationCount,
    transactionCount,
    revenueTotal,
    paidTransactionCount,
    latestTransactions,
  } = Route.useLoaderData()

  const counters = [
    { label: 'Pengguna', value: String(userCount) },
    { label: 'Undangan', value: String(invitationCount) },
    { label: 'Transaksi', value: String(transactionCount) },
    { label: 'Transaksi lunas', value: String(paidTransactionCount) },
  ]

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-champagne">
            Ringkasan
          </p>
          <h1 className="mt-2 font-display text-3xl leading-tight text-ink sm:text-4xl">
            Ringkasan platform
          </h1>
        </div>
        <p className="text-xs text-ink/50">Data langsung dari D1</p>
      </div>

      <section aria-labelledby="revenue-heading" className="mt-8">
        <h2 id="revenue-heading" className="sr-only">
          Pendapatan
        </h2>
        <div className="border border-line px-6 py-7">
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-champagne">
            Pendapatan lunas
          </p>
          <p className="mt-2 font-display text-4xl text-ink sm:text-5xl">
            {currency.format(revenueTotal)}
          </p>
          <p className="mt-2 text-xs text-ink/55">
            {paidTransactionCount} transaksi berstatus lunas
          </p>
        </div>
      </section>

      <dl className="mt-6 grid gap-px border border-line sm:grid-cols-2 lg:grid-cols-4 sm:divide-x sm:divide-line">
        {counters.map((counter) => (
          <div key={counter.label} className="px-5 py-4">
            <dt className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-champagne">
              {counter.label}
            </dt>
            <dd className="mt-1 font-display text-3xl text-ink">{counter.value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="admin-links-heading" className="mt-10">
        <h2 id="admin-links-heading" className="sr-only">
          Bagian admin
        </h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {ADMIN_LINKS.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className="block h-full border border-line px-5 py-5 hover:border-champagne"
              >
                <span className="font-display text-xl text-ink">
                  {item.label}
                </span>
                <span className="mt-2 block text-sm leading-6 text-ink/60">
                  {item.description}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="latest-heading" className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-3">
          <h2
            id="latest-heading"
            className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-champagne"
          >
            Transaksi terbaru
          </h2>
          <Link
            to="/admin/transactions"
            className="text-xs font-semibold text-champagne hover:text-ink"
          >
            Lihat semua transaksi
          </Link>
        </div>

        {latestTransactions.length === 0 ? (
          <p className="mt-6 text-sm leading-6 text-ink/60">
            Belum ada transaksi.
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[0.64rem] uppercase tracking-[0.12em] text-champagne">
                  <th className="py-3 pr-4 font-semibold">Order</th>
                  <th className="py-3 pr-4 font-semibold">Jumlah</th>
                  <th className="py-3 pr-4 font-semibold">Status</th>
                  <th className="py-3 pr-4 font-semibold">Dibuat</th>
                  <th className="py-3 font-semibold">Dibayar</th>
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
                    <td className="py-3 pr-4 text-ink/70">
                      {STATUS_LABELS[transaction.status]}
                    </td>
                    <td className="py-3 pr-4 text-xs text-ink/60">
                      {formatDate(transaction.createdAt)}
                    </td>
                    <td className="py-3 text-xs text-ink/60">
                      {transaction.paidAt === null
                        ? 'Belum dibayar'
                        : formatDate(transaction.paidAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
