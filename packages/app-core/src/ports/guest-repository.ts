import type { GuestCategory, WaSentStatus } from '@kalamkala/contracts'

export type StoredGuest = {
  id: string
  invitationId: string
  name: string
  /** Digits-only phone, or null when the guest has no number on file. */
  phoneNormalized: string | null
  category: GuestCategory
  /** JSON array of event ids this guest may attend. */
  allowedEventIdsJson: string
  maxPax: number
  tableNumber: string | null
  sessionLabel: string | null
  qrToken: string
  waSentStatus: WaSentStatus
  waSentAt: Date | null
}

export type CreateGuestInput = Omit<StoredGuest, 'id' | 'waSentAt'>

/**
 * Only the supplied fields change; the adapter always refreshes `updatedAt`.
 * Callers should provide at least one field.
 */
export type UpdateGuestInput = Partial<
  Pick<
    StoredGuest,
    'name' | 'phoneNormalized' | 'category' | 'maxPax' | 'tableNumber' | 'sessionLabel'
  >
>

export type GuestRepository = {
  findById: (id: string) => Promise<StoredGuest | null>
  findByQrToken: (qrToken: string) => Promise<StoredGuest | null>
  listByInvitation: (invitationId: string) => Promise<StoredGuest[]>
  create: (input: CreateGuestInput) => Promise<StoredGuest>
  update: (id: string, input: UpdateGuestInput) => Promise<StoredGuest>
  markWaSent: (id: string, sentAt: Date) => Promise<void>
}
