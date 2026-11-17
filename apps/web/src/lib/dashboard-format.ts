import type {
  EventCategory,
  InvitationStatus,
  InvitationTier,
} from '@kalamkala/contracts'

export const STATUS_LABELS: Record<InvitationStatus, string> = {
  DRAFT: 'Draf',
  ACTIVE: 'Aktif',
  EXPIRED: 'Kedaluwarsa',
}

export const TIER_LABELS: Record<InvitationTier, string> = {
  BASIC: 'Basic',
  PREMIUM: 'Premium',
}

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  WEDDING: 'Pernikahan',
  ENGAGEMENT: 'Lamaran',
  KHITANAN: 'Khitanan',
  AQIQAH: 'Aqiqah',
  BIRTHDAY: 'Ulang tahun',
  OTHER: 'Lainnya',
}

const dateFormatter = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' })
const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

export const formatDate = (value: Date | string | null): string => {
  if (value === null) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return dateFormatter.format(date)
}

export const formatCurrency = (amount: number): string => currencyFormatter.format(amount)

/** Status line for invitation cards; EXPIRED wins over the stored status. */
export const invitationStatusLabel = (
  status: InvitationStatus,
  remainingDays: number | null,
): string => {
  if (status === 'DRAFT') return STATUS_LABELS.DRAFT
  if (status === 'EXPIRED' || (remainingDays !== null && remainingDays <= 0)) {
    return STATUS_LABELS.EXPIRED
  }
  if (remainingDays === null) return STATUS_LABELS.ACTIVE
  return `${STATUS_LABELS.ACTIVE} · ${remainingDays} hari lagi`
}

export const statusTone = (
  status: InvitationStatus,
  remainingDays: number | null,
): 'draft' | 'active' | 'expired' => {
  if (status === 'DRAFT') return 'draft'
  if (status === 'EXPIRED' || (remainingDays !== null && remainingDays <= 0)) return 'expired'
  return 'active'
}
