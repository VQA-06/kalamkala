import {
  createFileRoute,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { Button } from '@base-ui/react/button'
import { Dialog } from '@base-ui/react/dialog'
import { CheckIcon } from '@radix-ui/react-icons'
import { useState } from 'react'

import type { StoredTransaction } from '@kalamkala/app-core'
import type { TransactionStatus } from '@kalamkala/contracts'

import {
  activateTransactionManually,
  listAdminTransactions,
} from '../server/admin/transactions'

export const Route = createFileRoute('/admin/transactions')({
  head: () => ({ meta: [{ title: 'Transaksi Admin — Kalamkala' }] }),
  loader: async () => {
    const data = await listAdminTransactions({ data: { limit: 50 } })
    if (data === null) {
      throw redirect({ to: '/dashboard' })
    }
    return data
  },
  component: AdminTransactionsPage,
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

const formatDate = (value: Date | null): string => {
  if (value === null) return '—'
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

const buttonPrimary =
  'inline-flex cursor-pointer items-center gap-1.5 border border-ink bg-ink px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-paper disabled:cursor-progress disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne'

const buttonSecondary =
  'inline-flex cursor-pointer items-center gap-1.5 border border-line px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink hover:border-champagne focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne'

type Feedback = { kind: 'ok' | 'error'; message: string }

function AdminTransactionsPage() {
  const { transactions } = Route.useLoaderData()
  const router = useRouter()

  const [target, setTarget] = useState<StoredTransaction | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const openDialog = (transaction: StoredTransaction): void => {
    setTarget(transaction)
    setDialogError(null)
    setFeedback(null)
  }

  const closeDialog = (): void => {
    if (submitting) return
    setTarget(null)
    setDialogError(null)
  }

  const handleActivate = async (): Promise<void> => {
    if (target === null || submitting) return

    setSubmitting(true)
    setDialogError(null)

    try {
      const result = await activateTransactionManually({
        data: { merchantOrderId: target.merchantOrderId },
      })
      if (!result.ok) {
        setDialogError(result.error)
        return
      }

      setTarget(null)
      setFeedback({
        kind: 'ok',
        message: `Transaksi ${target.merchantOrderId} ditandai ${STATUS_LABELS[result.status]}.`,
      })
      await router.invalidate()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-champagne">
            Transaksi
          </p>
          <h1 className="mt-2 font-display text-3xl leading-tight text-ink sm:text-4xl">
            Pembayaran terbaru
          </h1>
        </div>
        <p className="text-xs text-ink/50">Maksimal 50 transaksi terakhir</p>
      </div>

      {feedback !== null ? (
        <p
          role={feedback.kind === 'ok' ? 'status' : 'alert'}
          className={`mt-5 border px-4 py-3 text-sm ${
            feedback.kind === 'ok'
              ? 'border-line text-ink/75'
              : 'border-champagne text-ink'
          }`}
        >
          {feedback.message}
        </p>
      ) : null}

      {transactions.length === 0 ? (
        <p className="mt-8 text-sm leading-6 text-ink/60">
          Belum ada transaksi.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto border border-line">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-ink/[0.02] text-[0.62rem] uppercase tracking-[0.12em] text-champagne">
                <th className="px-3 py-3 font-semibold">Order</th>
                <th className="px-3 py-3 font-semibold">Undangan</th>
                <th className="px-3 py-3 font-semibold">Jumlah</th>
                <th className="px-3 py-3 font-semibold">Provider</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Dibuat</th>
                <th className="px-3 py-3 font-semibold">Dibayar</th>
                <th className="px-3 py-3 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td className="px-3 py-3 font-mono text-xs text-ink/80">
                    {transaction.merchantOrderId}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-ink/55">
                    {transaction.invitationId}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-ink">
                    {currency.format(transaction.amount)}
                  </td>
                  <td className="px-3 py-3 text-xs text-ink/65">
                    {transaction.gatewayProvider}
                  </td>
                  <td className="px-3 py-3 text-xs text-ink/70">
                    {STATUS_LABELS[transaction.status]}
                  </td>
                  <td className="px-3 py-3 text-xs text-ink/55">
                    {formatDate(transaction.createdAt)}
                  </td>
                  <td className="px-3 py-3 text-xs text-ink/55">
                    {formatDate(transaction.paidAt)}
                  </td>
                  <td className="px-3 py-3">
                    {transaction.status === 'PAID' ? (
                      <span className="text-xs text-ink/45">Sudah lunas</span>
                    ) : (
                      <Button
                        type="button"
                        onClick={() => openDialog(transaction)}
                        className={buttonSecondary}
                      >
                        Aktivasi Manual
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog.Root
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-ink/60" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,30rem)] -translate-x-1/2 -translate-y-1/2 border border-line bg-paper p-6">
            <Dialog.Title className="font-display text-2xl text-ink">
              Aktivasi manual
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 text-ink/65">
              Tandai transaksi{' '}
              <span className="font-mono text-xs text-ink">
                {target?.merchantOrderId}
              </span>{' '}
              sebagai lunas? Undangan terkait akan diterbitkan.
            </Dialog.Description>

            {dialogError !== null ? (
              <p role="alert" className="mt-4 text-sm leading-6 text-ink">
                {dialogError}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <Dialog.Close className={buttonSecondary}>
                Batal
              </Dialog.Close>
              <Button
                type="button"
                onClick={handleActivate}
                disabled={submitting}
                className={buttonPrimary}
              >
                <CheckIcon aria-hidden="true" className="size-3.5" />
                {submitting ? 'Memproses…' : 'Konfirmasi lunas'}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
