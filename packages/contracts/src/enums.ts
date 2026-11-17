/**
 * Domain enums for Undangan Digital.
 *
 * Every enum lives here as a `const` tuple. The tuple is the single source of
 * truth: the TypeScript union and the Zod schema are both derived from it, and
 * the Drizzle schema in `@kalamkala/db-schema` uses the same tuple for DB-level
 * CHECK constraints. Add a value here and every layer follows.
 */

export const USER_ROLES = ['USER', 'ADMIN'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const INVITATION_TIERS = ['BASIC', 'PREMIUM'] as const
export type InvitationTier = (typeof INVITATION_TIERS)[number]

export const INVITATION_STATUSES = ['DRAFT', 'ACTIVE', 'EXPIRED'] as const
export type InvitationStatus = (typeof INVITATION_STATUSES)[number]

export const GUEST_CATEGORIES = ['VIP', 'KELUARGA', 'REGULER'] as const
export type GuestCategory = (typeof GUEST_CATEGORIES)[number]

export const RSVP_ATTENDANCES = ['HADIR', 'TIDAK_HADIR', 'RAGU'] as const
export type RsvpAttendance = (typeof RSVP_ATTENDANCES)[number]

export const TRANSACTION_STATUSES = ['PENDING', 'PAID', 'FAILED', 'EXPIRED'] as const
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number]

export const DISCOUNT_TYPES = ['PERCENT', 'FIXED'] as const
export type DiscountType = (typeof DISCOUNT_TYPES)[number]

export const WA_SENT_STATUSES = ['PENDING', 'SENT'] as const
export type WaSentStatus = (typeof WA_SENT_STATUSES)[number]

export const PAYMENT_PROVIDERS = ['SIMULATED', 'DUITKU'] as const
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number]
