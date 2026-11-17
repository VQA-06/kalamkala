import { Field } from '@base-ui/react/field'
import {
  DEFAULT_WHATSAPP_TEMPLATE,
  GUEST_CATEGORIES,
  buildWhatsAppDirectUrl,
} from '@kalamkala/contracts'
import type { GuestCategory } from '@kalamkala/contracts'
import type { StoredGuest } from '@kalamkala/app-core'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useRef, useState } from 'react'

import {
  DashboardButton,
  EmptyState,
  PageHeading,
  Panel,
  StatusBadge,
} from '../components/dashboard/ui'
import { formatDate, statusTone } from '../lib/dashboard-format'
import {
  addGuest,
  addGuestsBulk,
  getGuestsPageData,
  markGuestWhatsappSent,
  saveWhatsappTemplate,
  updateGuestSettings,
} from '../server/dashboard/guests'

export const Route = createFileRoute('/dashboard/invitations/$id/guests')({
  loader: async ({ params }) => {
    const data = await getGuestsPageData({ data: { invitationId: params.id } })
    if (data === null) {
      throw redirect({ to: '/login', search: { redirect: '/dashboard' } })
    }
    return data
  },
  component: GuestsPage,
})

const CATEGORY_LABELS: Record<GuestCategory, string> = {
  VIP: 'VIP',
  KELUARGA: 'Keluarga',
  REGULER: 'Reguler',
}

const TIME_ZONES = {
  WIB: 'Asia/Jakarta',
  WITA: 'Asia/Makassar',
  WIT: 'Asia/Jayapura',
} as const

const INPUT_CLASS =
  'w-full border border-line bg-paper px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne'
const LABEL_CLASS =
  'text-xs font-semibold uppercase tracking-[0.14em] text-champagne'

const eventDateLabel = (iso: string, timezone: keyof typeof TIME_ZONES): string =>
  new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeZone: TIME_ZONES[timezone],
  }).format(new Date(iso))

type BulkEntry = { name: string; phone: string }

const parseBulkEntries = (text: string): BulkEntry[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [rawName, rawPhone] = line.split('|')
      return { name: (rawName ?? '').trim(), phone: (rawPhone ?? '').trim() }
    })
    .filter((entry) => entry.name.length > 0)

function GuestsPage() {
  const data = Route.useLoaderData()
  const { invitation, siteUrl } = data
  const [guests, setGuests] = useState<StoredGuest[]>(data.guests)
  const [template, setTemplate] = useState(
    invitation.whatsappTemplate ?? DEFAULT_WHATSAPP_TEMPLATE,
  )
  const templateRef = useRef<HTMLTextAreaElement | null>(null)

  const [single, setSingle] = useState({
    name: '',
    phone: '',
    category: 'REGULER' as GuestCategory,
    maxPax: 2,
    tableNumber: '',
    sessionLabel: '',
  })
  const [singleStatus, setSingleStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(
    null,
  )

  const [bulkText, setBulkText] = useState('')
  const [bulkCategory, setBulkCategory] = useState<GuestCategory>('REGULER')
  const [bulkMaxPax, setBulkMaxPax] = useState(1)
  const [bulkStatus, setBulkStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const [templateStatus, setTemplateStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(
    null,
  )
  const [sendingGuestId, setSendingGuestId] = useState<string | null>(null)

  const bulkEntries = parseBulkEntries(bulkText)

  const firstEvent = invitation.content.events[0]
  const primaryHost = invitation.content.hosts.primary
  const secondaryHost = invitation.content.hosts.secondary
  const coupleLabel = [
    primaryHost.nickname ?? primaryHost.fullName,
    secondaryHost?.nickname ?? secondaryHost?.fullName,
  ]
    .filter((value): value is string => value !== undefined && value.length > 0)
    .join(' & ')
  const eventDate =
    firstEvent === undefined
      ? ''
      : eventDateLabel(firstEvent.startsAt, firstEvent.timezone)
  const eventSession = firstEvent?.name ?? ''

  const submitSingle = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSingleStatus(null)

    const result = await addGuest({
      data: {
        invitationId: invitation.id,
        name: single.name,
        phone: single.phone,
        category: single.category,
        maxPax: single.maxPax,
        tableNumber: single.tableNumber.trim() === '' ? null : single.tableNumber,
        sessionLabel: single.sessionLabel.trim() === '' ? null : single.sessionLabel,
      },
    })

    if (!result.ok) {
      setSingleStatus({ tone: 'error', text: result.error })
      return
    }

    setGuests((current) => [...current, result.guest])
    setSingle({
      name: '',
      phone: '',
      category: single.category,
      maxPax: single.maxPax,
      tableNumber: '',
      sessionLabel: '',
    })
    setSingleStatus({ tone: 'ok', text: 'Tamu ditambahkan.' })
  }

  const submitBulk = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBulkStatus(null)
    if (bulkEntries.length === 0) {
      setBulkStatus({ tone: 'error', text: 'Belum ada baris yang bisa diimpor.' })
      return
    }

    const result = await addGuestsBulk({
      data: {
        invitationId: invitation.id,
        entries: bulkEntries,
        category: bulkCategory,
        maxPax: bulkMaxPax,
      },
    })

    setGuests((current) => [...current, ...result.created])
    const skippedText =
      result.skipped.length === 0
        ? ''
        : ` ${result.skipped.length} dilewati: ${result.skipped
            .map((entry) => `${entry.name || 'tanpa nama'} (${entry.reason})`)
            .join(', ')}.`
    setBulkStatus({
      tone: result.created.length > 0 ? 'ok' : 'error',
      text: `${result.created.length} tamu ditambahkan.${skippedText}`,
    })
    if (result.created.length > 0) setBulkText('')
  }

  const insertVariable = (variable: string) => {
    const node = templateRef.current
    if (node === null) {
      setTemplate((current) => `${current}${variable}`)
      return
    }
    const start = node.selectionStart ?? template.length
    const end = node.selectionEnd ?? start
    const next = `${template.slice(0, start)}${variable}${template.slice(end)}`
    setTemplate(next)
    requestAnimationFrame(() => {
      node.focus()
      node.selectionStart = start + variable.length
      node.selectionEnd = start + variable.length
    })
  }

  const saveTemplate = async () => {
    setTemplateStatus(null)
    const result = await saveWhatsappTemplate({
      data: { invitationId: invitation.id, template },
    })
    setTemplateStatus(
      result.ok
        ? { tone: 'ok', text: 'Template disimpan.' }
        : { tone: 'error', text: result.error },
    )
  }

  const saveGuest = async (guest: StoredGuest, patch: { category?: GuestCategory; maxPax?: number }) => {
    const result = await updateGuestSettings({
      data: {
        invitationId: invitation.id,
        guestId: guest.id,
        category: patch.category ?? guest.category,
        maxPax: patch.maxPax ?? guest.maxPax,
        tableNumber: guest.tableNumber,
        sessionLabel: guest.sessionLabel,
      },
    })
    if (result.ok) {
      setGuests((current) => current.map((row) => (row.id === guest.id ? result.guest : row)))
    }
  }

  const sendWhatsApp = async (guest: StoredGuest) => {
    if (guest.phoneNormalized === null || sendingGuestId !== null) return
    setSendingGuestId(guest.id)

    try {
      const link = `${siteUrl}/u/${invitation.slug}?to=${encodeURIComponent(guest.name)}&g=${guest.qrToken}`
      const url = buildWhatsAppDirectUrl({
        phoneNumber: guest.phoneNormalized,
        template,
        variables: {
          nama: guest.name,
          link,
          mempelai: coupleLabel,
          tanggal: eventDate,
          sesi: guest.sessionLabel ?? eventSession,
        },
      })
      window.open(url, '_blank', 'noopener,noreferrer')

      const result = await markGuestWhatsappSent({
        data: { invitationId: invitation.id, guestId: guest.id },
      })
      if (result.ok) {
        setGuests((current) =>
          current.map((row) =>
            row.id === guest.id ? { ...row, waSentStatus: 'SENT', waSentAt: new Date() } : row,
          ),
        )
      }
    } catch {
      // Invalid phone numbers are already normalized server-side; nothing to do here.
    } finally {
      setSendingGuestId(null)
    }
  }

  return (
    <div>
      <PageHeading
        eyebrow="Tamu"
        title={`/u/${invitation.slug}`}
        description="Kelola daftar tamu, nomor WhatsApp, dan kuota orang per tamu."
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

      <div className="mt-4 flex items-center gap-3">
        <StatusBadge tone={statusTone(invitation.status, null)}>
          {invitation.status === 'DRAFT'
            ? 'Draf'
            : invitation.status === 'ACTIVE'
              ? 'Aktif'
              : 'Kedaluwarsa'}
        </StatusBadge>
        <p className="text-xs text-ink/60">{guests.length} tamu</p>
      </div>

      <div className="mt-8 grid gap-4 xl:grid-cols-2">
        <Panel title="Tambah satu tamu" description="Nama wajib; nomor WhatsApp opsional.">
          <form className="grid gap-4" onSubmit={submitSingle}>
            <Field.Root>
              <Field.Label className={LABEL_CLASS}>Nama</Field.Label>
              <Field.Control
                className={INPUT_CLASS}
                value={single.name}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setSingle((current) => ({ ...current, name: event.target.value }))
                }
                required
              />
            </Field.Root>

            <Field.Root>
              <Field.Label className={LABEL_CLASS}>Nomor WhatsApp</Field.Label>
              <Field.Control
                className={INPUT_CLASS}
                value={single.phone}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setSingle((current) => ({ ...current, phone: event.target.value }))
                }
                placeholder="08xx atau 628xx"
              />
            </Field.Root>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field.Root>
                <Field.Label className={LABEL_CLASS}>Kategori</Field.Label>
                <Field.Control
                  render={
                    <select
                      className={INPUT_CLASS}
                      value={single.category}
                      onChange={(event) =>
                        setSingle((current) => ({
                          ...current,
                          category: event.target.value as GuestCategory,
                        }))
                      }
                    >
                      {GUEST_CATEGORIES.map((value) => (
                        <option key={value} value={value}>
                          {CATEGORY_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  }
                />
              </Field.Root>

              <Field.Root>
                <Field.Label className={LABEL_CLASS}>Maks. orang</Field.Label>
                <Field.Control
                  type="number"
                  min={1}
                  max={20}
                  className={INPUT_CLASS}
                  value={single.maxPax}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setSingle((current) => ({
                      ...current,
                      maxPax: Number(event.target.value) || 1,
                    }))
                  }
                />
              </Field.Root>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field.Root>
                <Field.Label className={LABEL_CLASS}>Nomor meja</Field.Label>
                <Field.Control
                  className={INPUT_CLASS}
                  value={single.tableNumber}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setSingle((current) => ({ ...current, tableNumber: event.target.value }))
                  }
                />
              </Field.Root>

              <Field.Root>
                <Field.Label className={LABEL_CLASS}>Sesi</Field.Label>
                <Field.Control
                  className={INPUT_CLASS}
                  value={single.sessionLabel}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setSingle((current) => ({ ...current, sessionLabel: event.target.value }))
                  }
                  placeholder={eventSession}
                />
              </Field.Root>
            </div>

            {singleStatus === null ? null : (
              <p
                role={singleStatus.tone === 'error' ? 'alert' : 'status'}
                className={
                  singleStatus.tone === 'error'
                    ? 'text-sm text-[#9f3030]'
                    : 'text-sm text-champagne'
                }
              >
                {singleStatus.text}
              </p>
            )}

            <div>
              <DashboardButton type="submit" variant="primary">
                Tambah tamu
              </DashboardButton>
            </div>
          </form>
        </Panel>

        <Panel
          title="Impor daftar tamu"
          description="Satu tamu per baris dengan format Nama | Nomor WhatsApp."
        >
          <form className="grid gap-4" onSubmit={submitBulk}>
            <Field.Root>
              <Field.Label className={LABEL_CLASS}>Daftar tamu</Field.Label>
              <Field.Control
                render={
                  <textarea
                    rows={6}
                    className={INPUT_CLASS}
                    value={bulkText}
                    onChange={(event) => setBulkText(event.target.value)}
                    placeholder={'Bapak Sutedjo | 08123456789\nIbu Ratna | 6281234567890'}
                  />
                }
              />
            </Field.Root>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field.Root>
                <Field.Label className={LABEL_CLASS}>Kategori</Field.Label>
                <Field.Control
                  render={
                    <select
                      className={INPUT_CLASS}
                      value={bulkCategory}
                      onChange={(event) => setBulkCategory(event.target.value as GuestCategory)}
                    >
                      {GUEST_CATEGORIES.map((value) => (
                        <option key={value} value={value}>
                          {CATEGORY_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  }
                />
              </Field.Root>

              <Field.Root>
                <Field.Label className={LABEL_CLASS}>Maks. orang per tamu</Field.Label>
                <Field.Control
                  type="number"
                  min={1}
                  max={20}
                  className={INPUT_CLASS}
                  value={bulkMaxPax}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setBulkMaxPax(Number(event.target.value) || 1)
                  }
                />
              </Field.Root>
            </div>

            <p className="text-xs text-ink/60">{bulkEntries.length} baris siap diimpor.</p>

            {bulkStatus === null ? null : (
              <p
                role={bulkStatus.tone === 'error' ? 'alert' : 'status'}
                className={
                  bulkStatus.tone === 'error'
                    ? 'text-sm text-[#9f3030]'
                    : 'text-sm text-champagne'
                }
              >
                {bulkStatus.text}
              </p>
            )}

            <div>
              <DashboardButton type="submit" variant="secondary">
                Impor tamu
              </DashboardButton>
            </div>
          </form>
        </Panel>
      </div>

      <Panel
        title="Template pesan WhatsApp"
        description="Variabel akan diganti per tamu saat Anda menekan Kirim ke WhatsApp."
      >
        <div className="grid gap-3">
          <Field.Root>
            <Field.Control
              render={
                <textarea
                  rows={5}
                  className={INPUT_CLASS}
                  ref={templateRef}
                  value={template}
                  onChange={(event) => setTemplate(event.target.value)}
                />
              }
            />
          </Field.Root>

          <div className="flex flex-wrap gap-2">
            {['{nama}', '{link}', '{mempelai}', '{tanggal}', '{sesi}'].map((variable) => (
              <button
                key={variable}
                type="button"
                onClick={() => insertVariable(variable)}
                className="cursor-pointer border border-line px-2.5 py-1 font-mono text-xs text-ink/70 hover:border-champagne"
              >
                {variable}
              </button>
            ))}
          </div>

          {templateStatus === null ? null : (
            <p
              role={templateStatus.tone === 'error' ? 'alert' : 'status'}
              className={
                templateStatus.tone === 'error'
                  ? 'text-sm text-[#9f3030]'
                  : 'text-sm text-champagne'
              }
            >
              {templateStatus.text}
            </p>
          )}

          <div>
            <DashboardButton type="button" variant="secondary" onClick={saveTemplate}>
              Simpan template
            </DashboardButton>
          </div>
        </div>
      </Panel>

      <div className="mt-8">
        {guests.length === 0 ? (
          <EmptyState
            title="Belum ada tamu"
            body="Tambahkan tamu satu per satu atau impor daftar dari teks."
          />
        ) : (
          <div className="overflow-x-auto border border-line">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[0.69rem] uppercase tracking-[0.12em] text-champagne">
                  <th className="px-4 py-3 font-semibold">Nama</th>
                  <th className="px-4 py-3 font-semibold">WhatsApp</th>
                  <th className="px-4 py-3 font-semibold">Kategori</th>
                  <th className="px-4 py-3 font-semibold">Maks</th>
                  <th className="px-4 py-3 font-semibold">Meja</th>
                  <th className="px-4 py-3 font-semibold">Sesi</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {guests.map((guest) => (
                  <tr key={guest.id}>
                    <td className="px-4 py-3 text-ink">{guest.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink/70">
                      {guest.phoneNormalized ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="border border-line bg-paper px-2 py-1 text-xs"
                        value={guest.category}
                        onChange={(event) =>
                          void saveGuest(guest, {
                            category: event.target.value as GuestCategory,
                          })
                        }
                        aria-label={`Kategori ${guest.name}`}
                      >
                        {GUEST_CATEGORIES.map((value) => (
                          <option key={value} value={value}>
                            {CATEGORY_LABELS[value]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={1}
                        max={20}
                        defaultValue={guest.maxPax}
                        aria-label={`Maksimal orang ${guest.name}`}
                        onBlur={(event) => {
                          const value = Math.min(20, Math.max(1, Number(event.target.value) || 1))
                          if (value !== guest.maxPax) void saveGuest(guest, { maxPax: value })
                        }}
                        className="w-16 border border-line bg-paper px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-ink/70">
                      {guest.tableNumber ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink/70">
                      {guest.sessionLabel ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {guest.waSentStatus === 'SENT' ? (
                        <span className="text-champagne">
                          Terkirim {guest.waSentAt === null ? '' : formatDate(guest.waSentAt)}
                        </span>
                      ) : (
                        <span className="text-ink/55">Belum dikirim</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <DashboardButton
                        type="button"
                        variant="secondary"
                        disabled={guest.phoneNormalized === null || sendingGuestId !== null}
                        onClick={() => void sendWhatsApp(guest)}
                        className="px-3 py-1.5 text-xs"
                      >
                        {sendingGuestId === guest.id ? 'Membuka…' : 'Kirim ke WhatsApp'}
                      </DashboardButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
