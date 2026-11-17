import { templateRegistry } from '@kalamkala/templates/registry'
import { Link } from '@tanstack/react-router'

import {
  TIER_LABELS,
  formatDate,
  invitationStatusLabel,
  statusTone,
} from '../../lib/dashboard-format'
import type { OwnedInvitationSummary } from '../../server/dashboard/invitations'
import { StatusBadge } from './ui'

const ACTION_CLASS =
  'border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-champagne'

export function InvitationCard({ invitation }: { invitation: OwnedInvitationSummary }) {
  const template = templateRegistry.find(
    (entry) => entry.manifest.id === invitation.templateId,
  )
  const tone = statusTone(invitation.status, invitation.remainingDays)

  return (
    <article className="border border-line bg-paper p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl text-ink">
            {template?.manifest.name ?? invitation.templateId}
          </p>
          <p className="mt-1 font-mono text-xs text-ink/60">/u/{invitation.slug}</p>
        </div>
        <StatusBadge tone={tone}>
          {invitationStatusLabel(invitation.status, invitation.remainingDays)}
        </StatusBadge>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-xs text-ink/60">
        <div>
          <dt className="uppercase tracking-[0.12em] text-champagne">Paket</dt>
          <dd className="mt-1 text-ink/80">{TIER_LABELS[invitation.tier]}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-[0.12em] text-champagne">Terbit</dt>
          <dd className="mt-1 text-ink/80">{formatDate(invitation.publishedAt)}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-[0.12em] text-champagne">Kedaluwarsa</dt>
          <dd className="mt-1 text-ink/80">{formatDate(invitation.expiresAt)}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-[0.12em] text-champagne">Dibuat</dt>
          <dd className="mt-1 text-ink/80">{formatDate(invitation.createdAt)}</dd>
        </div>
      </dl>

      <nav className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
        <Link
          to="/dashboard/invitations/$id/editor"
          params={{ id: invitation.id }}
          className={ACTION_CLASS}
        >
          Editor
        </Link>
        <Link
          to="/dashboard/invitations/$id/guests"
          params={{ id: invitation.id }}
          className={ACTION_CLASS}
        >
          Tamu
        </Link>
        <Link
          to="/dashboard/invitations/$id/rsvp"
          params={{ id: invitation.id }}
          className={ACTION_CLASS}
        >
          RSVP
        </Link>
        <Link
          to="/dashboard/invitations/$id/checkout"
          params={{ id: invitation.id }}
          className={ACTION_CLASS}
        >
          Checkout
        </Link>
        {invitation.status === 'ACTIVE' ? (
          <Link
            to="/u/$slug"
            params={{ slug: invitation.slug }}
            search={{ to: undefined, g: undefined }}
            target="_blank"
            rel="noreferrer"
            className={ACTION_CLASS}
          >
            Lihat publik
          </Link>
        ) : null}
      </nav>
    </article>
  )
}
