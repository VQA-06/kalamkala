import type { RsvpAttendance } from '@kalamkala/contracts'

export type StoredRsvp = {
  id: string
  invitationId: string
  /** Null for guests who RSVP through the public form without a personal link. */
  guestId: string | null
  guestName: string
  attendance: RsvpAttendance
  guestCount: number
  message: string | null
  hostReply: string | null
  isHidden: boolean
  createdAt: Date
}

export type CreateRsvpInput = {
  invitationId: string
  guestId: string | null
  guestName: string
  attendance: RsvpAttendance
  guestCount: number
  message: string | null
  isHidden: boolean
}

export type RsvpPageOptions = {
  /** Opaque cursor returned by the previous page, or null for the first page. */
  cursor: string | null
  limit: number
}

export type RsvpPage = {
  items: StoredRsvp[]
  nextCursor: string | null
}

export type RsvpRepository = {
  create: (input: CreateRsvpInput) => Promise<StoredRsvp>
  listByInvitation: (invitationId: string) => Promise<StoredRsvp[]>
  /** Public wall: visible rows only, newest first, cursor-paginated. */
  listPublicPage: (invitationId: string, options: RsvpPageOptions) => Promise<RsvpPage>
  setReply: (id: string, hostReply: string) => Promise<void>
  setHidden: (id: string, isHidden: boolean) => Promise<void>
}
