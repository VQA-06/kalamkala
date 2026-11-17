import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import type { FormEvent } from 'react'

import type { RsvpAttendance, WaSentStatus } from '@kalamkala/contracts'

import type { CollaboratorPortalData } from '../server/collaborator/portal'
import {
  getCollaboratorEntry,
  getCollaboratorPortalData,
  verifyCollaboratorPin,
} from '../server/collaborator/portal'

const WA_STATUS_LABELS: Record<WaSentStatus, string> = {
  PENDING: 'Belum terkirim',
  SENT: 'Terkirim',
}

const ATTENDANCE_LABELS: Record<RsvpAttendance, string> = {
  HADIR: 'Hadir',
  TIDAK_HADIR: 'Tidak hadir',
  RAGU: 'Masih ragu',
}

const formatDate = (value: Date | string): string => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeZone: 'Asia/Jakarta',
  }).format(date)
}

export const Route = createFileRoute('/kolaborator/$token')({
  loader: async ({ params }) => {
    const entry = await getCollaboratorEntry({ data: { token: params.token } })
    const portal = entry.ok
      ? await getCollaboratorPortalData({ data: { token: params.token } })
      : null
    return { entry, portal }
  },
  head: () => ({
    meta: [
      { title: 'Akses Kolaborator — Kalamkala' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: CollaboratorPortalPage,
})

function CollaboratorPortalPage() {
  const { entry, portal } = Route.useLoaderData()
  const { token } = Route.useParams()

  if (!entry.ok) {
    return <PlainPanel title="Akses tidak ditemukan" message={entry.error} />
  }
  if (entry.expired) {
    return (
      <PlainPanel
        title="Akses kolaborator berakhir"
        message="Tautan ini sudah kedaluwarsa. Minta tautan baru kepada pemilik undangan."
      />
    )
  }
  if (portal === null) {
    return (
      <PinScreen
        token={token}
        label={entry.label}
        invitationTitle={entry.invitationTitle}
      />
    )
  }
  return <PortalView portal={portal} />
}

function PlainPanel({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6 py-16">
      <div className="w-full max-w-md border border-line bg-paper p-8 text-center">
        <p className="text-[0.69rem] font-semibold uppercase tracking-[0.22em] text-champagne">
          Kolaborator
        </p>
        <h1 className="mt-4 font-serif text-3xl leading-tight text-ink">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-ink/70">{message}</p>
        <Link
          to="/"
          className="mt-6 inline-block text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-champagne underline-offset-4 hover:underline"
        >
          Kembali ke Kalamkala
        </Link>
      </div>
    </div>
  )
}

function PinScreen({
  token,
  label,
  invitationTitle,
}: {
  token: string
  label: string
  invitationTitle: string
}) {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (submitting) return
    if (!/^\d{4,6}$/u.test(pin)) {
      setError('PIN terdiri dari 4 sampai 6 digit.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const result = await verifyCollaboratorPin({ data: { token, pin } })
      if (!result.ok) {
        setError(result.error)
        return
      }
      await router.invalidate()
    } catch {
      setError('PIN tidak dapat diverifikasi. Silakan coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6 py-16">
      <div className="w-full max-w-sm border border-line bg-paper p-8 text-center">
        <p className="text-[0.69rem] font-semibold uppercase tracking-[0.22em] text-champagne">
          Akses Kolaborator
        </p>
        <h1 className="mt-4 font-serif text-2xl leading-tight text-ink">{invitationTitle}</h1>
        <p className="mt-2 text-sm text-ink/70">Untuk {label}</p>
        <form className="mt-6 text-left" onSubmit={(event) => void onSubmit(event)}>
          <label
            className="block text-[0.69rem] font-semibold uppercase tracking-[0.18em] text-champagne"
            htmlFor="collaborator-pin"
          >
            PIN
          </label>
          <input
            id="collaborator-pin"
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            minLength={4}
            maxLength={6}
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            className="mt-2 w-full border border-line bg-white/70 px-3 py-3 text-center text-lg tracking-[0.4em] text-ink outline-none focus:border-champagne"
          />
          {error !== null ? (
            <p className="mt-3 text-sm leading-6 text-champagne" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="mt-5 inline-flex w-full items-center justify-center border border-ink bg-ink px-5 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-paper transition-colors hover:bg-ink/90 disabled:cursor-wait disabled:opacity-70"
          >
            {submitting ? 'Memeriksa…' : 'Buka Akses'}
          </button>
        </form>
      </div>
    </div>
  )
}

function PortalView({ portal }: { portal: CollaboratorPortalData }) {
  return (
    <div className="min-h-screen bg-paper px-4 py-10 sm:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <header className="border-b border-line pb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[0.69rem] font-semibold uppercase tracking-[0.22em] text-champagne">
                Akses Kolaborator
              </p>
              <h1 className="mt-2 font-serif text-3xl leading-tight text-ink">
                {portal.invitation.title}
              </h1>
              <p className="mt-2 text-sm text-ink/70">{portal.label}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="border border-line px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-ink/60">
                Hanya baca
              </span>
              <Link
                to="/u/$slug"
                params={{ slug: portal.invitation.slug }}
                search={{ to: undefined, g: undefined }}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-line px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink/70 transition-colors hover:border-champagne hover:text-ink"
              >
                Lihat undangan
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Hadir" value={portal.summary.hadir} />
          <Stat label="Tidak hadir" value={portal.summary.tidakHadir} />
          <Stat label="Masih ragu" value={portal.summary.ragu} />
          <Stat label="Total tamu" value={portal.summary.totalPax} />
        </section>

        <section className="mt-10">
          <h2 className="font-serif text-xl text-ink">Daftar Tamu</h2>
          <div className="mt-3 overflow-x-auto border border-line">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[0.65rem] uppercase tracking-[0.14em] text-champagne">
                  <th className="px-4 py-3 font-semibold">Nama</th>
                  <th className="px-4 py-3 font-semibold">Kategori</th>
                  <th className="px-4 py-3 font-semibold">Max pax</th>
                  <th className="px-4 py-3 font-semibold">Status WA</th>
                </tr>
              </thead>
              <tbody>
                {portal.guests.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-ink/60">
                      Belum ada tamu.
                    </td>
                  </tr>
                ) : (
                  portal.guests.map((guest) => (
                    <tr key={guest.id} className="border-b border-line/60 last:border-b-0">
                      <td className="px-4 py-3 text-ink">{guest.name}</td>
                      <td className="px-4 py-3 text-ink/70">{guest.category}</td>
                      <td className="px-4 py-3 text-ink/70">{guest.maxPax}</td>
                      <td className="px-4 py-3 text-ink/70">
                        {WA_STATUS_LABELS[guest.waSentStatus]}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10 pb-16">
          <h2 className="font-serif text-xl text-ink">Konfirmasi Kehadiran</h2>
          <div className="mt-3 overflow-x-auto border border-line">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[0.65rem] uppercase tracking-[0.14em] text-champagne">
                  <th className="px-4 py-3 font-semibold">Nama</th>
                  <th className="px-4 py-3 font-semibold">Kehadiran</th>
                  <th className="px-4 py-3 font-semibold">Jumlah</th>
                  <th className="px-4 py-3 font-semibold">Ucapan</th>
                  <th className="px-4 py-3 font-semibold">Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {portal.rsvps.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-ink/60">
                      Belum ada konfirmasi.
                    </td>
                  </tr>
                ) : (
                  portal.rsvps.map((rsvp) => (
                    <tr key={rsvp.id} className="border-b border-line/60 last:border-b-0">
                      <td className="px-4 py-3 text-ink">{rsvp.guestName}</td>
                      <td className="px-4 py-3 text-ink/70">
                        {ATTENDANCE_LABELS[rsvp.attendance]}
                      </td>
                      <td className="px-4 py-3 text-ink/70">{rsvp.guestCount}</td>
                      <td className="max-w-[24rem] px-4 py-3 text-ink/70">
                        {rsvp.message === null || rsvp.message.length === 0 ? '—' : rsvp.message}
                      </td>
                      <td className="px-4 py-3 text-ink/60">{formatDate(rsvp.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-line px-4 py-4">
      <p className="font-serif text-2xl text-ink">{value}</p>
      <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-champagne">
        {label}
      </p>
    </div>
  )
}
