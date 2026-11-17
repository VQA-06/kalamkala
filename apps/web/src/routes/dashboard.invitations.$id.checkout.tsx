import { Field } from '@base-ui/react/field'
import { INVITATION_TIERS } from '@kalamkala/contracts'
import type { InvitationTier } from '@kalamkala/contracts'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'

import { DashboardButton, PageHeading, Panel } from '../components/dashboard/ui'
import { TIER_LABELS, formatCurrency } from '../lib/dashboard-format'
import {
  completeSimulatedPayment,
  getCheckoutPageData,
  startCheckout,
  validatePromoCode,
} from '../server/dashboard/checkout'

export const Route = createFileRoute('/dashboard/invitations/$id/checkout')({
  loader: async ({ params }) => {
    const data = await getCheckoutPageData({ data: { invitationId: params.id } })
    if (data === null) {
      throw redirect({ to: '/login', search: { redirect: '/dashboard' } })
    }
    return data
  },
  component: CheckoutPage,
})

const INPUT_CLASS =
  'w-full border border-line bg-paper px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne'
const LABEL_CLASS = 'text-xs font-semibold uppercase tracking-[0.14em] text-champagne'

const TIER_BENEFITS: Record<InvitationTier, readonly string[]> = {
  BASIC: ['Tema kategori Basic', 'RSVP dan buku tamu', 'Galeri foto', 'Undangan per tamu'],
  PREMIUM: [
    'Semua tema, termasuk Keraton Heritage',
    'QR check-in tamu',
    'Amplop digital dan QRIS',
    'Tanpa watermark platform',
    'Prioritas dukungan',
  ],
}

function CheckoutPage() {
  const data = Route.useLoaderData()
  const { invitation, prices } = data
  const [tier, setTier] = useState<InvitationTier>(invitation.tier)
  const [promoCode, setPromoCode] = useState('')
  const [promo, setPromo] = useState<{ code: string; discount: number; total: number } | null>(null)
  const [promoError, setPromoError] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [activation, setActivation] = useState<{ total: number; orderId: string } | null>(null)

  const price = promo === null && tier === invitation.tier ? prices[tier] : (promo?.total ?? prices[tier])

  const checkPromo = async () => {
    setPromoError('')
    setPromo(null)
    if (promoCode.trim().length === 0) {
      setPromoError('Masukkan kode promo terlebih dahulu.')
      return
    }

    const result = await validatePromoCode({
      data: { invitationId: invitation.id, code: promoCode, tier },
    })
    if (!result.ok) {
      setPromoError(result.error)
      return
    }
    setPromo({
      code: result.promoCode,
      discount: result.discountAmount,
      total: result.totalAmount,
    })
  }

  const payAndActivate = async () => {
    if (busy) return
    setBusy(true)
    setError('')

    try {
      const started = await startCheckout({
        data: {
          invitationId: invitation.id,
          tier,
          promoCode: promo?.code ?? undefined,
        },
      })
      if (!started.ok) {
        setError(started.error)
        return
      }

      const completed = await completeSimulatedPayment({
        data: { invitationId: invitation.id, merchantOrderId: started.merchantOrderId },
      })
      if (!completed.ok) {
        setError(completed.error)
        return
      }

      setActivation({ total: started.totalAmount, orderId: started.merchantOrderId })
    } catch {
      setError('Pembayaran simulasi gagal diproses. Silakan coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeading
        eyebrow="Checkout"
        title={`/u/${invitation.slug}`}
        description="Susun gratis; biaya muncul saat undangan diterbitkan. Pembayaran di lingkungan ini memakai gateway simulasi."
        actions={
          <Link
            to="/dashboard/invitations/$id/editor"
            params={{ id: invitation.id }}
            className="border border-line px-4 py-2 text-sm font-semibold text-ink"
          >
            Kembali ke editor
          </Link>
        }
      />

      <div className="mt-4 text-sm text-ink/70">
        Status undangan:{' '}
        <span className="font-semibold text-ink">
          {invitation.status === 'ACTIVE'
            ? 'Aktif'
            : invitation.status === 'EXPIRED'
              ? 'Kedaluwarsa'
              : 'Draf'}
        </span>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {INVITATION_TIERS.map((value) => {
          const selected = tier === value
          return (
            <section
              key={value}
              className={`border bg-paper p-5 ${selected ? 'border-ink' : 'border-line'}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-2xl text-ink">{TIER_LABELS[value]}</h2>
                <p className="text-sm text-ink/70">{formatCurrency(prices[value])}</p>
              </div>

              <ul className="mt-4 space-y-2 text-sm leading-6 text-ink/70">
                {TIER_BENEFITS[value].map((benefit) => (
                  <li key={benefit}>· {benefit}</li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => {
                  setTier(value)
                  setPromo(null)
                  setPromoError('')
                }}
                aria-pressed={selected}
                className={`mt-5 w-full border px-4 py-2 text-sm font-semibold ${
                  selected
                    ? 'border-ink bg-ink text-paper'
                    : 'border-line bg-paper text-ink hover:border-champagne'
                }`}
              >
                {selected ? 'Dipilih' : `Pilih ${TIER_LABELS[value]}`}
              </button>
            </section>
          )
        })}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Panel title="Kode promo" description="Opsional. Diskon dihitung di server.">
          <div className="grid gap-3">
            <Field.Root>
              <Field.Label className={LABEL_CLASS}>Kode promo</Field.Label>
              <Field.Control
                className={INPUT_CLASS}
                value={promoCode}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setPromoCode(event.target.value.toUpperCase())
                }
                placeholder="Mis. KERATON"
              />
            </Field.Root>

            {promoError.length === 0 ? null : (
              <p role="alert" className="text-sm text-[#9f3030]">
                {promoError}
              </p>
            )}

            {promo === null ? null : (
              <p className="text-sm text-champagne">
                {promo.code}: potongan {formatCurrency(promo.discount)}
              </p>
            )}

            <div>
              <DashboardButton type="button" variant="secondary" onClick={() => void checkPromo()}>
                Validasi
              </DashboardButton>
            </div>
          </div>
        </Panel>

        <Panel title="Ringkasan" description="Total yang dibayar untuk paket terpilih.">
          <dl className="grid gap-2 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink/60">Paket</dt>
              <dd className="text-ink">{TIER_LABELS[tier]}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink/60">Harga</dt>
              <dd className="text-ink">{formatCurrency(prices[tier])}</dd>
            </div>
            {promo === null ? null : (
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-ink/60">Diskon</dt>
                <dd className="text-ink">−{formatCurrency(promo.discount)}</dd>
              </div>
            )}
            <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-line pt-3">
              <dt className="font-semibold text-ink">Total</dt>
              <dd className="font-display text-2xl text-ink">{formatCurrency(price)}</dd>
            </div>
          </dl>

          {error.length === 0 ? null : (
            <p role="alert" className="mt-4 text-sm leading-6 text-[#9f3030]">
              {error}
            </p>
          )}

          {activation === null ? (
            <div className="mt-5">
              <DashboardButton
                type="button"
                variant="primary"
                disabled={busy}
                onClick={() => void payAndActivate()}
              >
                {busy ? 'Memproses…' : 'Bayar & Aktifkan (simulasi)'}
              </DashboardButton>
            </div>
          ) : (
            <div className="mt-5 border border-champagne bg-paper px-4 py-3">
              <p className="text-sm font-semibold text-champagne">
                Undangan aktif setelah pembayaran simulasi.
              </p>
              <p className="mt-1 text-xs text-ink/60">
                Total {formatCurrency(activation.total)} · order {activation.orderId}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to="/u/$slug"
                  params={{ slug: invitation.slug }}
                  search={{ to: undefined, g: undefined }}
                  target="_blank"
                  rel="noreferrer"
                  className="border border-line px-3 py-1.5 text-xs font-semibold text-ink"
                >
                  Lihat undangan publik
                </Link>
                <Link
                  to="/dashboard/invitations/$id/editor"
                  params={{ id: invitation.id }}
                  className="border border-line px-3 py-1.5 text-xs font-semibold text-ink"
                >
                  Kembali ke editor
                </Link>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
