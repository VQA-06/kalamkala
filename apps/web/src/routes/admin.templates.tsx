import {
  createFileRoute,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { Button } from '@base-ui/react/button'
import { Field } from '@base-ui/react/field'
import { Input } from '@base-ui/react/input'
import { CheckIcon } from '@radix-ui/react-icons'
import { useState } from 'react'
import type { FormEvent } from 'react'

import type { StoredCatalogTemplate } from '@kalamkala/app-core'
import type { InvitationTier } from '@kalamkala/contracts'

import {
  listAdminCatalogTemplates,
  updateAdminCatalogTemplate,
} from '../server/admin/templates'

export const Route = createFileRoute('/admin/templates')({
  head: () => ({ meta: [{ title: 'Template Admin — Kalamkala' }] }),
  loader: async () => {
    const data = await listAdminCatalogTemplates()
    if (data === null) {
      throw redirect({ to: '/dashboard' })
    }
    return data
  },
  component: AdminTemplatesPage,
})

const inputClass =
  'w-full border border-line bg-transparent px-3 py-2 text-sm text-ink outline-none focus:border-champagne focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne'

const labelClass =
  'block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-champagne'

const saveButtonClass =
  'inline-flex cursor-pointer items-center gap-1.5 border border-ink bg-ink px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-paper disabled:cursor-progress disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne'

type RowFeedback = { kind: 'ok' | 'error'; message: string }

function AdminTemplatesPage() {
  const { templates } = Route.useLoaderData()

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-champagne">
            Template
          </p>
          <h1 className="mt-2 font-display text-3xl leading-tight text-ink sm:text-4xl">
            Katalog template
          </h1>
        </div>
        <p className="text-xs text-ink/50">{templates.length} template</p>
      </div>

      {templates.length === 0 ? (
        <p className="mt-8 text-sm leading-6 text-ink/60">
          Belum ada template di katalog. Jalankan sinkronisasi katalog terlebih
          dahulu.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-line border-b border-line">
          {templates.map((template) => (
            <TemplateRow key={template.id} template={template} />
          ))}
        </ul>
      )}
    </>
  )
}

function TemplateRow({ template }: { template: StoredCatalogTemplate }) {
  const router = useRouter()
  const [name, setName] = useState(template.name)
  const [tier, setTier] = useState<InvitationTier>(template.tier)
  const [isVisible, setIsVisible] = useState(template.isVisible)
  const [sortOrder, setSortOrder] = useState(String(template.sortOrder))
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<RowFeedback | null>(null)

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault()
    if (saving) return

    const parsedSortOrder = Number.parseInt(sortOrder, 10)
    if (!Number.isFinite(parsedSortOrder)) {
      setFeedback({ kind: 'error', message: 'Urutan harus berupa angka.' })
      return
    }
    if (name.trim().length === 0) {
      setFeedback({ kind: 'error', message: 'Nama template wajib diisi.' })
      return
    }

    setSaving(true)
    setFeedback(null)

    try {
      const result = await updateAdminCatalogTemplate({
        data: {
          id: template.id,
          name: name.trim(),
          tier,
          isVisible,
          sortOrder: parsedSortOrder,
        },
      })
      if (!result.ok) {
        setFeedback({ kind: 'error', message: result.error })
        return
      }

      setName(result.template.name)
      setTier(result.template.tier)
      setIsVisible(result.template.isVisible)
      setSortOrder(String(result.template.sortOrder))
      setFeedback({ kind: 'ok', message: 'Template disimpan.' })
      await router.invalidate()
    } finally {
      setSaving(false)
    }
  }

  const sortOrderId = `sort-order-${template.id}`
  const tierId = `tier-${template.id}`

  return (
    <li className="py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-xs text-ink/55">{template.id}</p>
        <p className="text-[0.62rem] uppercase tracking-[0.12em] text-ink/40">
          Template katalog
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_10rem_8rem_10rem_auto] lg:items-end"
      >
        <Field.Root>
          <Field.Label className={labelClass}>Nama</Field.Label>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClass}
          />
        </Field.Root>

        <div>
          <label htmlFor={tierId} className={labelClass}>
            Tingkat
          </label>
          <select
            id={tierId}
            value={tier}
            onChange={(event) =>
              setTier(event.target.value === 'PREMIUM' ? 'PREMIUM' : 'BASIC')
            }
            className={`mt-1 ${inputClass}`}
          >
            <option value="BASIC">Basic</option>
            <option value="PREMIUM">Premium</option>
          </select>
        </div>

        <Field.Root>
          <Field.Label className={labelClass}>Urutan</Field.Label>
          <Input
            id={sortOrderId}
            type="number"
            step={1}
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
            className={inputClass}
          />
        </Field.Root>

        <label className="flex items-center gap-2 pb-2 text-xs text-ink/70">
          <input
            type="checkbox"
            checked={isVisible}
            onChange={(event) => setIsVisible(event.target.checked)}
            className="size-4 accent-ink"
          />
          Tampil di katalog
        </label>

        <Button type="submit" disabled={saving} className={saveButtonClass}>
          <CheckIcon aria-hidden="true" className="size-3.5" />
          {saving ? 'Menyimpan…' : 'Simpan'}
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
