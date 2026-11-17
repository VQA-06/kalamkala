import type { DiscountType } from '@kalamkala/contracts'

export type StoredPromo = {
  id: string
  code: string
  discountType: DiscountType
  discountValue: number
  partnerName: string | null
  /** Partner commission as a percentage, or null when there is no partner. */
  commissionPercent: number | null
  maxUses: number | null
  usedCount: number
  isActive: boolean
  expiresAt: Date | null
  createdAt: Date
}

export type CreatePromoInput = {
  code: string
  discountType: DiscountType
  discountValue: number
  partnerName: string | null
  commissionPercent: number | null
  maxUses: number | null
  isActive: boolean
  expiresAt: Date | null
  /** Optional starting counter, mostly for imports and tests. Defaults to 0. */
  usedCount?: number
}

export type UpdatePromoInput = Partial<{
  discountType: DiscountType
  discountValue: number
  partnerName: string | null
  commissionPercent: number | null
  maxUses: number | null
  isActive: boolean
  expiresAt: Date | null
}>

export type PromoRepository = {
  findByCode: (code: string) => Promise<StoredPromo | null>
  list: () => Promise<StoredPromo[]>
  create: (input: CreatePromoInput) => Promise<StoredPromo>
  update: (id: string, input: UpdatePromoInput) => Promise<StoredPromo>
  /** Atomically increments `used_count`; a missing code is ignored by the DB. */
  incrementUsedCount: (code: string) => Promise<void>
}
