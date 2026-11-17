import { Dialog } from '@base-ui/react/dialog'
import { Field } from '@base-ui/react/field'
import { templateRegistry } from '@kalamkala/templates/registry'
import { EVENT_CATEGORIES, INVITATION_TIERS } from '@kalamkala/contracts'
import type { EventCategory, InvitationTier } from '@kalamkala/contracts'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { CATEGORY_LABELS, TIER_LABELS } from '../../lib/dashboard-format'
import { createInvitation } from '../../server/dashboard/invitations'
import { DashboardButton } from './ui'

const VISIBLE_TEMPLATES = templateRegistry.filter((entry) => entry.manifest.isVisible)

const SELECT_CLASS =
  'w-full border border-line bg-paper px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne'

export function CreateInvitationDialog() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [templateId, setTemplateId] = useState(VISIBLE_TEMPLATES[0]?.manifest.id ?? '')
  const [tier, setTier] = useState<InvitationTier>('BASIC')
  const [eventCategory, setEventCategory] = useState<EventCategory>('WEDDING')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy || templateId.length === 0) return

    setBusy(true)
    setError('')

    try {
      const result = await createInvitation({ data: { templateId, tier, eventCategory } })
      if (result === null) {
        setError('Sesi berakhir. Muat ulang halaman lalu coba lagi.')
        return
      }
      if ('ok' in result) {
        setError(result.error)
        return
      }

      setOpen(false)
      await navigate({
        to: '/dashboard/invitations/$id/editor',
        params: { id: result.id },
      })
    } catch {
      setError('Undangan gagal dibuat. Silakan coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger render={<DashboardButton variant="primary" />}>
        Buat undangan
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-ink/40" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 border border-line bg-paper p-6">
          <div className="flex items-baseline justify-between gap-4">
            <Dialog.Title className="font-display text-2xl text-ink">
              Buat undangan
            </Dialog.Title>
            <Dialog.Close render={<DashboardButton variant="ghost" />}>Tutup</Dialog.Close>
          </div>
          <Dialog.Description className="mt-2 text-sm leading-6 text-ink/65">
            Pilih tema dan kategori acara. Isi undangan bisa diubah kapan saja sebelum
            diterbitkan.
          </Dialog.Description>

          <form className="mt-6 grid gap-4" onSubmit={submit}>
            <Field.Root>
              <Field.Label className="text-xs font-semibold uppercase tracking-[0.14em] text-champagne">
                Tema
              </Field.Label>
              <Field.Control
                render={
                  <select
                    className={SELECT_CLASS}
                    value={templateId}
                    onChange={(event) => setTemplateId(event.target.value)}
                  >
                    {VISIBLE_TEMPLATES.map((entry) => (
                      <option key={entry.manifest.id} value={entry.manifest.id}>
                        {entry.manifest.name} · {TIER_LABELS[entry.manifest.tier]}
                      </option>
                    ))}
                  </select>
                }
              />
            </Field.Root>

            <Field.Root>
              <Field.Label className="text-xs font-semibold uppercase tracking-[0.14em] text-champagne">
                Paket
              </Field.Label>
              <Field.Control
                render={
                  <select
                    className={SELECT_CLASS}
                    value={tier}
                    onChange={(event) => setTier(event.target.value as InvitationTier)}
                  >
                    {INVITATION_TIERS.map((value) => (
                      <option key={value} value={value}>
                        {TIER_LABELS[value]}
                      </option>
                    ))}
                  </select>
                }
              />
            </Field.Root>

            <Field.Root>
              <Field.Label className="text-xs font-semibold uppercase tracking-[0.14em] text-champagne">
                Kategori acara
              </Field.Label>
              <Field.Control
                render={
                  <select
                    className={SELECT_CLASS}
                    value={eventCategory}
                    onChange={(event) => setEventCategory(event.target.value as EventCategory)}
                  >
                    {EVENT_CATEGORIES.map((value) => (
                      <option key={value} value={value}>
                        {CATEGORY_LABELS[value]}
                      </option>
                    ))}
                  </select>
                }
              />
            </Field.Root>

            {error.length === 0 ? null : (
              <p role="alert" className="text-sm leading-6 text-[#9f3030]">
                {error}
              </p>
            )}

            <div className="mt-2 flex justify-end gap-3">
              <Dialog.Close render={<DashboardButton variant="secondary" />}>
                Batal
              </Dialog.Close>
              <DashboardButton type="submit" variant="primary" disabled={busy}>
                {busy ? 'Menyiapkan…' : 'Buat undangan'}
              </DashboardButton>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
