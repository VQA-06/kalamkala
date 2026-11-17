import type { InvitationReportReason } from '@kalamkala/contracts'

export type StoredInvitationReport = {
  id: string
  invitationId: string
  reason: InvitationReportReason
  note: string | null
  /** Hash of the reporter's address, never the address itself. */
  reporterHash: string | null
  createdAt: Date
}

export type CreateInvitationReportInput = {
  id: string
  invitationId: string
  reason: InvitationReportReason
  note: string | null
  reporterHash: string | null
}

export type InvitationReportRepository = {
  create: (input: CreateInvitationReportInput) => Promise<StoredInvitationReport>
}
