import { Dialog } from '@base-ui/react/dialog'
import { Field } from '@base-ui/react/field'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'

import { DashboardButton, EmptyState, PageHeading, Panel } from '../components/dashboard/ui'
import { formatDate } from '../lib/dashboard-format'
import {
  createCollaborator,
  getRsvpPageData,
  moderateRsvp,
  replyToRsvp,
  revokeCollaborator,
} from '../server/dashboard/rsvp'

export const Route = createFileRoute('/dashboard/invitations/$id/rsvp')({
  loader: async ({ params }) => {
    const data = await getRsvpPageData({ data: { invitationId: params.id } })
    if (data === null) {
      throw redirect({ to: '/login', search: { redirect: '/dashboard' } })
    }
    return data
  },
  component: RsvpPage,
})

const ATTENDANCE_LABELS = {
  HADIR: 'Hadir',
  TIDAK_HADIR: 'Tidak hadir',
  RAGU: 'Masih ragu',
} as const

const INPUT_CLASS =
  'w-full border border-line bg-paper px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne'
const LABEL_CLASS = 'text-xs font-semibold uppercase tracking-[0.14em] text-champagne'

type StatusMessage = { tone: 'ok' | 'error'; text: string } | null

function RsvpPage() {
  const data = Route.useLoaderData()
  const { invitation, siteUrl } = data
  const [rsvps, setRsvps] = useState(data.rsvps)
  const [collaborators, setCollaborators] = useState(data.collaborators)

  const [replyTarget, setReplyTarget] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replyStatus, setReplyStatus] = useState<StatusMessage>(null)

  const [collaboratorLabel, setCollaboratorLabel] = useState('')
  const [collaboratorDays, setCollaboratorDays] = useState(14)
  const [collaboratorStatus, setCollaboratorStatus] = useState<StatusMessage>(null)
  const [issuedAccess, setIssuedAccess] = useState<{ label: string; link: string; pin: string } | null>(
    null,
  )
  const [copied, setCopied] = useState<'link' | 'pin' | null>(null)

  const stats = [
    { label: 'Hadir', value: data.summary.hadir },
    { label: 'Tidak hadir', value: data.summary.tidakHadir },
    { label: 'Masih ragu', value: data.summary.ragu },
    { label: 'Total orang', value: data.summary.totalPax },
  ]

  const toggleHidden = async (rsvpId: string, isHidden: boolean) => {
    const result = await moderateRsvp({
      data: { invitationId: invitation.id, rsvpId, isHidden },
    })
    if (result.ok) {
      setRsvps((current) =>
        current.map((row) => (row.id === rsvpId ? { ...row, isHidden } : row)),
      )
    }
  }

  const openReply = (rsvpId: string, current: string | null) => {
    setReplyTarget(rsvpId)
    setReplyText(current ?? '')
    setReplyStatus(null)
  }

  const submitReply = async () => {
    if (replyTarget === null) return
    const result = await replyToRsvp({
      data: { invitationId: invitation.id, rsvpId: replyTarget, hostReply: replyText },
    })
    if (result.ok) {
      setRsvps((current) =>
        current.map((row) =>
          row.id === replyTarget ? { ...row, hostReply: replyText.trim() } : row,
        ),
      )
      setReplyTarget(null)
      return
    }
    setReplyStatus({ tone: 'error', text: result.error })
  }

  const issueCollaborator = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCollaboratorStatus(null)
    setIssuedAccess(null)

    const result = await createCollaborator({
      data: {
        invitationId: invitation.id,
        label: collaboratorLabel,
        expiresInDays: collaboratorDays,
      },
    })
    if (!result.ok) {
      setCollaboratorStatus({ tone: 'error', text: result.error })
      return
    }

    setCollaborators((current) => [
      ...current,
      {
        id: result.collaborator.id,
        label: result.collaborator.label,
        accessToken: result.link,
        expiresAt: result.collaborator.expiresAt,
        createdAt: new Date(),
      },
    ])
    setIssuedAccess({ label: result.collaborator.label, link: result.link, pin: result.pin })
    setCollaboratorLabel('')
    setCollaboratorStatus({ tone: 'ok', text: 'Akses kolaborator dibuat.' })
  }

  const revoke = async (collaboratorId: string) => {
    const result = await revokeCollaborator({
      data: { invitationId: invitation.id, collaboratorId },
    })
    if (result.ok) {
      setCollaborators((current) => current.filter((row) => row.id !== collaboratorId))
    }
  }

  const copy = async (value: string, kind: 'link' | 'pin') => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(kind)
    } catch {
      setCopied(null)
    }
  }

  return (
    <div>
      <PageHeading
        eyebrow="RSVP"
        title={`/u/${invitation.slug}`}
        description="Pantau konfirmasi kehadiran, balas ucapan, dan beri akses terbatas untuk WO."
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

      <dl className="mt-8 grid gap-px border-y border-line bg-line sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-paper px-4 py-4">
            <dt className="text-[0.69rem] font-semibold uppercase tracking-[0.14em] text-champagne">
              {stat.label}
            </dt>
            <dd className="mt-1 font-display text-3xl text-ink">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8">
        {rsvps.length === 0 ? (
          <EmptyState
            title="Belum ada konfirmasi"
            body="RSVP dari tamu akan muncul di sini setelah undangan dibagikan."
          />
        ) : (
          <div className="overflow-x-auto border border-line">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[0.69rem] uppercase tracking-[0.12em] text-champagne">
                  <th className="px-4 py-3 font-semibold">Tamu</th>
                  <th className="px-4 py-3 font-semibold">Kehadiran</th>
                  <th className="px-4 py-3 font-semibold">Orang</th>
                  <th className="px-4 py-3 font-semibold">Ucapan</th>
                  <th className="px-4 py-3 font-semibold">Balasan</th>
                  <th className="px-4 py-3 font-semibold">Tanggal</th>
                  <th className="px-4 py-3 font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rsvps.map((rsvp) => (
                  <tr key={rsvp.id} className={rsvp.isHidden ? 'text-ink/45' : undefined}>
                    <td className="px-4 py-3 text-ink">{rsvp.guestName}</td>
                    <td className="px-4 py-3 text-ink/70">
                      {ATTENDANCE_LABELS[rsvp.attendance]}
                    </td>
                    <td className="px-4 py-3 text-ink/70">{rsvp.guestCount}</td>
                    <td className="max-w-xs px-4 py-3 text-ink/70">
                      {rsvp.message === null || rsvp.message.length === 0 ? '—' : rsvp.message}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-ink/70">
                      {rsvp.hostReply ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink/60">{formatDate(rsvp.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <DashboardButton
                          type="button"
                          variant="secondary"
                          className="px-3 py-1.5 text-xs"
                          onClick={() => openReply(rsvp.id, rsvp.hostReply)}
                        >
                          Balas
                        </DashboardButton>
                        <DashboardButton
                          type="button"
                          variant="secondary"
                          className="px-3 py-1.5 text-xs"
                          onClick={() => void toggleHidden(rsvp.id, !rsvp.isHidden)}
                        >
                          {rsvp.isHidden ? 'Tampilkan' : 'Sembunyikan'}
                        </DashboardButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-4 xl:grid-cols-2">
        <Panel
          title="Akses kolaborator"
          description="Tautan dan PIN ini membuka daftar tamu serta RSVP untuk wedding organizer. Bagikan sekali, lalu cabut bila selesai."
        >
          <form className="grid gap-4" onSubmit={issueCollaborator}>
            <Field.Root>
              <Field.Label className={LABEL_CLASS}>Label</Field.Label>
              <Field.Control
                className={INPUT_CLASS}
                value={collaboratorLabel}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setCollaboratorLabel(event.target.value)
                }
                placeholder="WO Sinar Jaya"
                required
              />
            </Field.Root>

            <Field.Root>
              <Field.Label className={LABEL_CLASS}>Berlaku (hari)</Field.Label>
              <Field.Control
                type="number"
                min={1}
                max={90}
                className={INPUT_CLASS}
                value={collaboratorDays}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setCollaboratorDays(Number(event.target.value) || 14)
                }
              />
            </Field.Root>

            {collaboratorStatus === null ? null : (
              <p
                role={collaboratorStatus.tone === 'error' ? 'alert' : 'status'}
                className={
                  collaboratorStatus.tone === 'error'
                    ? 'text-sm text-[#9f3030]'
                    : 'text-sm text-champagne'
                }
              >
                {collaboratorStatus.text}
              </p>
            )}

            <div>
              <DashboardButton type="submit" variant="primary">
                Buat akses
              </DashboardButton>
            </div>
          </form>

          {issuedAccess === null ? null : (
            <div className="mt-5 border border-champagne/50 bg-paper px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-champagne">
                Akses untuk {issuedAccess.label}
              </p>
              <p className="mt-2 break-all font-mono text-xs text-ink/80">{issuedAccess.link}</p>
              <p className="mt-1 font-mono text-sm text-ink">PIN {issuedAccess.pin}</p>
              <div className="mt-3 flex gap-2">
                <DashboardButton
                  type="button"
                  variant="secondary"
                  className="px-3 py-1.5 text-xs"
                  onClick={() => void copy(issuedAccess.link, 'link')}
                >
                  {copied === 'link' ? 'Tautan disalin' : 'Salin tautan'}
                </DashboardButton>
                <DashboardButton
                  type="button"
                  variant="secondary"
                  className="px-3 py-1.5 text-xs"
                  onClick={() => void copy(issuedAccess.pin, 'pin')}
                >
                  {copied === 'pin' ? 'PIN disalin' : 'Salin PIN'}
                </DashboardButton>
              </div>
              <p className="mt-2 text-xs leading-5 text-ink/55">
                PIN hanya ditampilkan sekali di layar ini.
              </p>
            </div>
          )}
        </Panel>

        <Panel title="Kolaborator aktif" description="Cabut akses yang tidak dipakai lagi.">
          {collaborators.length === 0 ? (
            <p className="text-sm leading-6 text-ink/65">Belum ada akses kolaborator.</p>
          ) : (
            <ul className="divide-y divide-line">
              {collaborators.map((collaborator) => (
                <li
                  key={collaborator.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="text-sm text-ink">{collaborator.label}</p>
                    <p className="text-xs text-ink/60">
                      Aktif sampai {formatDate(collaborator.expiresAt)}
                    </p>
                  </div>
                  <DashboardButton
                    type="button"
                    variant="danger"
                    className="px-3 py-1.5 text-xs"
                    onClick={() => void revoke(collaborator.id)}
                  >
                    Cabut
                  </DashboardButton>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Dialog.Root
        open={replyTarget !== null}
        onOpenChange={(open) => {
          if (!open) setReplyTarget(null)
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 bg-ink/40" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 border border-line bg-paper p-6">
            <Dialog.Title className="font-display text-2xl text-ink">Balas ucapan</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 text-ink/65">
              Balasan tampil di halaman undangan bersama ucapan tamu.
            </Dialog.Description>

            <div className="mt-4">
              <Field.Root>
                <Field.Label className={LABEL_CLASS}>Balasan tuan rumah</Field.Label>
                <Field.Control
                  render={
                    <textarea
                      rows={4}
                      className={INPUT_CLASS}
                      value={replyText}
                      onChange={(event) => setReplyText(event.target.value)}
                    />
                  }
                />
              </Field.Root>
            </div>

            {replyStatus === null ? null : (
              <p role="alert" className="mt-3 text-sm text-[#9f3030]">
                {replyStatus.text}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <Dialog.Close render={<DashboardButton variant="secondary" />}>Batal</Dialog.Close>
              <DashboardButton type="button" variant="primary" onClick={() => void submitReply()}>
                Simpan balasan
              </DashboardButton>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      <p className="mt-6 text-xs leading-5 text-ink/55">
        Tautan publik: {siteUrl}/u/{invitation.slug}
      </p>
    </div>
  )
}
