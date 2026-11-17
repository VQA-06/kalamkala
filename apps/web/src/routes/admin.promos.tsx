import {
  createFileRoute,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { Button } from '@base-ui/react/button'
import { Dialog } from '@base-ui/react/dialog'
import { Field } from '@base-ui/react/field'
import { Input } from '@base-ui/react/input'
import { CheckIcon, PlusIcon } from '@radix-ui/react-icons'
import { useState } from 'react'
import type { FormEvent } from 'react'

import type { StoredPromo } from '@kalamkala/app-core'
import type { DiscountType } from '@kalamkala/contracts'

import {
  createAdminPromo,
  listAdminPromos,
  updateAdminPromo,
} from '../server/admin/promos'

export const Route = createFileRoute('/admin/promos')({
  head: () => ({ meta: [{ title: 'Promo Admin — Kalamkala' }] }),
  loader: async () => {
    const data = await listAdminPromos()
    if (data === null) {
      throw redirect({ to: '/dashboard' })
    }
    return data
  },
  component: AdminPromosPage,
})

const TYPE_LABELS: Record<DiscountType, string> = {
  PERCENT: 'Persen',
  FIXED: 'Nominal',
}

const currency = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

const formatDate = (value: Date | null): string => {
  if (value === null) return 'Tanpa batas'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(
    new Date(value),
  )
}

const toDateInputValue = (value: Date | null): string =>
  value === null ? '' : new Date(value).toISOString().slice(0, 10)

const formatDiscount = (promo: StoredPromo): string =>
  promo.discountType === 'PERCENT'
    ? `${promo.discountValue}%`
    : currency.format(promo.discountValue)

const inputClass =
  'w-full border border-line bg-transparent px-3 py-2 text-sm text-ink outline-none focus:border-champagne focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne'

const labelClass =
  'block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-champagne'

const buttonPrimary =
  'inline-flex cursor-pointer items-center gap-1.5 border border-ink bg-ink px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-paper disabled:cursor-progress disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne'

const buttonSecondary =
  'inline-flex cursor-pointer items-center gap-1.5 border border-line px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink hover:border-champagne focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne'

type Feedback = { kind: 'ok' | 'error'; message: string }

type CreateFormState = {
  code: string
  discountType: DiscountType
  discountValue: string
  partnerName: string
  commissionPercent: string
  maxUses: string
  expiresAt: string
}

const EMPTY_FORM: CreateFormState = {
  code: '',
  discountType: 'PERCENT',
  discountValue: '',
  partnerName: '',
  commissionPercent: '',
  maxUses: '',
  expiresAt: '',
}

const parseOptionalInteger = (value: string): number | null | 'invalid' => {
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) ? parsed : 'invalid'
}

function AdminPromosPage() {
  const { promos } = Route.useLoaderData()
  const router = useRouter()

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<CreateFormState>(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const updateField = <K extends keyof CreateFormState>(
    key: K,
    value: CreateFormState[K],
  ): void => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleCreate = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault()
    if (creating) return

    setCreateError(null)
    const discountValue = Number.parseInt(form.discountValue, 10)
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      setCreateError('Nilai diskon harus berupa angka lebih dari nol.')
      return
    }

    const commissionPercent = parseOptionalInteger(form.commissionPercent)
    if (commissionPercent === 'invalid') {
      setCreateError('Komisi harus berupa angka bulat.')
      return
    }
    if (
      commissionPercent !== null &&
      (commissionPercent < 0 || commissionPercent > 100)
    ) {
      setCreateError('Komisi partner harus antara 0 dan 100 persen.')
      return
    }
    const maxUses = parseOptionalInteger(form.maxUses)
    if (maxUses === 'invalid') {
      setCreateError('Batas pemakaian harus berupa angka bulat.')
      return
    }
    if (maxUses !== null && maxUses < 1) {
      setCreateError('Batas pemakaian minimal satu kali.')
      return
    }
    if (form.discountType === 'PERCENT' && discountValue > 100) {
      setCreateError('Diskon persen tidak boleh lebih dari 100.')
      return
    }

    setCreating(true)
    try {
      const result = await createAdminPromo({
        data: {
          code: form.code,
          discountType: form.discountType,
          discountValue,
          partnerName:
            form.partnerName.trim().length === 0
              ? null
              : form.partnerName.trim(),
          commissionPercent,
          maxUses,
          expiresAt: form.expiresAt.length === 0 ? null : form.expiresAt,
        },
      })
      if (!result.ok) {
        setCreateError(result.error)
        return
      }

      setCreateOpen(false)
      setForm(EMPTY_FORM)
      setNotice(`Promo ${result.promo.code} dibuat.`)
      await router.invalidate()
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-champagne">
            Promo
          </p>
          <h1 className="mt-2 font-display text-3xl leading-tight text-ink sm:text-4xl">
            Kode diskon
          </h1>
        </div>
        <Button
          type="button"
          onClick={() => {
            setCreateOpen(true)
            setCreateError(null)
          }}
          className={buttonPrimary}
        >
          <PlusIcon aria-hidden="true" className="size-3.5" />
          Buat promo
        </Button>
      </div>

      {notice !== null ? (
        <p role="status" className="mt-5 border border-line px-4 py-3 text-sm text-ink/75">
          {notice}
        </p>
      ) : null}

      {promos.length === 0 ? (
        <p className="mt-8 text-sm leading-6 text-ink/60">
          Belum ada promo. Buat kode pertama untuk mulai melacak diskon dan
          komisi partner.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-line border-b border-line">
          {promos.map((promo) => (
            <PromoRow key={promo.id} promo={promo} />
          ))}
        </ul>
      )}

      <Dialog.Root
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) setCreateError(null)
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-ink/60" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(92vw,34rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-line bg-paper p-6">
            <Dialog.Title className="font-display text-2xl text-ink">
              Buat promo
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 text-ink/65">
              Kode promo memakai huruf besar, angka, dan tanda hubung.
            </Dialog.Description>

            <form onSubmit={handleCreate} className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field.Root>
                <Field.Label className={labelClass}>Kode</Field.Label>
                <Input
                  value={form.code}
                  onChange={(event) =>
                    updateField('code', event.target.value.toUpperCase())
                  }
                  className={inputClass}
                  placeholder="RAMADAN-2027"
                />
              </Field.Root>

              <div>
                <label htmlFor="promo-discount-type" className={labelClass}>
                  Jenis diskon
                </label>
                <select
                  id="promo-discount-type"
                  value={form.discountType}
                  onChange={(event) =>
                    updateField(
                      'discountType',
                      event.target.value === 'FIXED' ? 'FIXED' : 'PERCENT',
                    )
                  }
                  className={`mt-1 ${inputClass}`}
                >
                  <option value="PERCENT">Persen</option>
                  <option value="FIXED">Nominal rupiah</option>
                </select>
              </div>

              <Field.Root>
                <Field.Label className={labelClass}>Nilai diskon</Field.Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={form.discountValue}
                  onChange={(event) =>
                    updateField('discountValue', event.target.value)
                  }
                  className={inputClass}
                />
              </Field.Root>

              <Field.Root>
                <Field.Label className={labelClass}>Partner</Field.Label>
                <Input
                  value={form.partnerName}
                  onChange={(event) =>
                    updateField('partnerName', event.target.value)
                  }
                  className={inputClass}
                />
              </Field.Root>

              <Field.Root>
                <Field.Label className={labelClass}>Komisi partner (%)</Field.Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={form.commissionPercent}
                  onChange={(event) =>
                    updateField('commissionPercent', event.target.value)
                  }
                  className={inputClass}
                />
              </Field.Root>

              <Field.Root>
                <Field.Label className={labelClass}>Batas pemakaian</Field.Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={form.maxUses}
                  onChange={(event) => updateField('maxUses', event.target.value)}
                  className={inputClass}
                />
              </Field.Root>

              <div className="sm:col-span-2">
                <label htmlFor="promo-expires-at" className={labelClass}>
                  Kedaluwarsa
                </label>
                <Input
                  id="promo-expires-at"
                  type="date"
                  value={form.expiresAt}
                  onChange={(event) =>
                    updateField('expiresAt', event.target.value)
                  }
                  className={`mt-1 ${inputClass}`}
                />
              </div>

              {createError !== null ? (
                <p role="alert" className="text-sm text-ink sm:col-span-2">
                  {createError}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-3 sm:col-span-2">
                <Dialog.Close className={buttonSecondary}>Batal</Dialog.Close>
                <Button type="submit" disabled={creating} className={buttonPrimary}>
                  <CheckIcon aria-hidden="true" className="size-3.5" />
                  {creating ? 'Menyimpan…' : 'Simpan promo'}
                </Button>
              </div>
            </form>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

function PromoRow({ promo }: { promo: StoredPromo }) {
  const router = useRouter()
  const [discountType, setDiscountType] = useState<DiscountType>(
    promo.discountType,
  )
  const [discountValue, setDiscountValue] = useState(String(promo.discountValue))
  const [partnerName, setPartnerName] = useState(promo.partnerName ?? '')
  const [commissionPercent, setCommissionPercent] = useState(
    promo.commissionPercent === null ? '' : String(promo.commissionPercent),
  )
  const [maxUses, setMaxUses] = useState(
    promo.maxUses === null ? '' : String(promo.maxUses),
  )
  const [expiresAt, setExpiresAt] = useState(
    toDateInputValue(promo.expiresAt),
  )
  const [isActive, setIsActive] = useState(promo.isActive)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const handleSave = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault()
    if (saving) return

    const parsedValue = Number.parseInt(discountValue, 10)
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      setFeedback({
        kind: 'error',
        message: 'Nilai diskon harus berupa angka lebih dari nol.',
      })
      return
    }
    const parsedCommission = parseOptionalInteger(commissionPercent)
    if (parsedCommission === 'invalid') {
      setFeedback({ kind: 'error', message: 'Komisi harus berupa angka bulat.' })
      return
    }
    if (
      parsedCommission !== null &&
      (parsedCommission < 0 || parsedCommission > 100)
    ) {
      setFeedback({
        kind: 'error',
        message: 'Komisi partner harus antara 0 dan 100 persen.',
      })
      return
    }
    const parsedMaxUses = parseOptionalInteger(maxUses)
    if (parsedMaxUses === 'invalid') {
      setFeedback({
        kind: 'error',
        message: 'Batas pemakaian harus berupa angka bulat.',
      })
      return
    }
    if (parsedMaxUses !== null && parsedMaxUses < 1) {
      setFeedback({
        kind: 'error',
        message: 'Batas pemakaian minimal satu kali.',
      })
      return
    }
    if (discountType === 'PERCENT' && parsedValue > 100) {
      setFeedback({
        kind: 'error',
        message: 'Diskon persen tidak boleh lebih dari 100.',
      })
      return
    }

    setSaving(true)
    setFeedback(null)

    try {
      const result = await updateAdminPromo({
        data: {
          id: promo.id,
          discountType,
          discountValue: parsedValue,
          partnerName: partnerName.trim().length === 0 ? null : partnerName.trim(),
          commissionPercent: parsedCommission,
          maxUses: parsedMaxUses,
          isActive,
          expiresAt: expiresAt.length === 0 ? null : expiresAt,
        },
      })
      if (!result.ok) {
        setFeedback({ kind: 'error', message: result.error })
        return
      }

      setDiscountType(result.promo.discountType)
      setDiscountValue(String(result.promo.discountValue))
      setPartnerName(result.promo.partnerName ?? '')
      setCommissionPercent(
        result.promo.commissionPercent === null
          ? ''
          : String(result.promo.commissionPercent),
      )
      setMaxUses(result.promo.maxUses === null ? '' : String(result.promo.maxUses))
      setExpiresAt(toDateInputValue(result.promo.expiresAt))
      setIsActive(result.promo.isActive)
      setFeedback({ kind: 'ok', message: 'Promo disimpan.' })
      await router.invalidate()
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (): Promise<void> => {
    if (toggling) return
    setToggling(true)
    setFeedback(null)

    try {
      const result = await updateAdminPromo({
        data: { id: promo.id, isActive: !isActive },
      })
      if (!result.ok) {
        setFeedback({ kind: 'error', message: result.error })
        return
      }
      setIsActive(result.promo.isActive)
      setFeedback({
        kind: 'ok',
        message: result.promo.isActive ? 'Promo diaktifkan.' : 'Promo dinonaktifkan.',
      })
      await router.invalidate()
    } finally {
      setToggling(false)
    }
  }

  const typeId = `promo-type-${promo.id}`
  const expiresId = `promo-expires-${promo.id}`

  return (
    <li className="py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <p className="font-mono text-sm text-ink">{promo.code}</p>
          <span className="border border-line px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-champagne">
            {isActive ? 'Aktif' : 'Nonaktif'}
          </span>
          <p className="text-xs text-ink/60">
            {TYPE_LABELS[promo.discountType]} · {formatDiscount(promo)}
          </p>
        </div>
        <Button
          type="button"
          onClick={handleToggle}
          disabled={toggling}
          className={buttonSecondary}
        >
          {toggling ? 'Memproses…' : isActive ? 'Nonaktifkan' : 'Aktifkan'}
        </Button>
      </div>

      <p className="mt-2 text-xs text-ink/55">
        {promo.partnerName ?? 'Tanpa partner'} · komisi{' '}
        {promo.commissionPercent === null
          ? '—'
          : `${promo.commissionPercent}%`}{' '}
        · dipakai {promo.usedCount}/{promo.maxUses ?? '∞'} ·{' '}
        {formatDate(promo.expiresAt)}
      </p>

      <form
        onSubmit={handleSave}
        className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end"
      >
        <div>
          <label htmlFor={typeId} className={labelClass}>
            Jenis
          </label>
          <select
            id={typeId}
            value={discountType}
            onChange={(event) =>
              setDiscountType(event.target.value === 'FIXED' ? 'FIXED' : 'PERCENT')
            }
            className={`mt-1 ${inputClass}`}
          >
            <option value="PERCENT">Persen</option>
            <option value="FIXED">Nominal</option>
          </select>
        </div>

        <Field.Root>
          <Field.Label className={labelClass}>Nilai</Field.Label>
          <Input
            type="number"
            min={1}
            step={1}
            value={discountValue}
            onChange={(event) => setDiscountValue(event.target.value)}
            className={inputClass}
          />
        </Field.Root>

        <Field.Root>
          <Field.Label className={labelClass}>Partner</Field.Label>
          <Input
            value={partnerName}
            onChange={(event) => setPartnerName(event.target.value)}
            className={inputClass}
          />
        </Field.Root>

        <Field.Root>
          <Field.Label className={labelClass}>Komisi (%)</Field.Label>
          <Input
            type="number"
            min={0}
            max={100}
            step={1}
            value={commissionPercent}
            onChange={(event) => setCommissionPercent(event.target.value)}
            className={inputClass}
          />
        </Field.Root>

        <Field.Root>
          <Field.Label className={labelClass}>Batas</Field.Label>
          <Input
            type="number"
            min={1}
            step={1}
            value={maxUses}
            onChange={(event) => setMaxUses(event.target.value)}
            className={inputClass}
          />
        </Field.Root>

        <div>
          <label htmlFor={expiresId} className={labelClass}>
            Kedaluwarsa
          </label>
          <Input
            id={expiresId}
            type="date"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </div>

        <Button
          type="submit"
          disabled={saving}
          className={`${buttonPrimary} lg:col-span-6 lg:justify-self-start`}
        >
          <CheckIcon aria-hidden="true" className="size-3.5" />
          {saving ? 'Menyimpan…' : 'Simpan perubahan'}
        </Button>
      </form>

      {feedback !== null ? (
        <p
          role={feedback.kind === 'ok' ? 'status' : 'alert'}
          className="mt-3 text-xs text-ink/65"
        >
          {feedback.message}
        </p>
      ) : null}
    </li>
  )
}
