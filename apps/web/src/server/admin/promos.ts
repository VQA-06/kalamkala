import type {
  CreatePromoInput,
  StoredPromo,
  UpdatePromoInput,
} from '@kalamkala/app-core'
import { discountTypeSchema } from '@kalamkala/contracts'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { requireAdminServices } from './context.js'

export type AdminPromoList = { promos: StoredPromo[] }
export type CreatePromoResult =
  | { ok: true; promo: StoredPromo }
  | { ok: false; error: string }
export type UpdatePromoResult =
  | { ok: true; promo: StoredPromo }
  | { ok: false; error: string }

const PROMO_CODE_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/

const dateInputSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Tanggal tidak valid',
  })

const createInputSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .transform((value) => value.toUpperCase()),
  discountType: discountTypeSchema,
  discountValue: z.number().int(),
  partnerName: z.string().trim().min(1).max(120).nullable(),
  commissionPercent: z.number().int().nullable(),
  maxUses: z.number().int().nullable(),
  expiresAt: dateInputSchema.nullable().optional(),
})

const updateInputSchema = z.object({
  id: z.string().trim().min(1),
  discountType: discountTypeSchema.optional(),
  discountValue: z.number().int().optional(),
  partnerName: z.string().trim().min(1).max(120).nullable().optional(),
  commissionPercent: z.number().int().nullable().optional(),
  maxUses: z.number().int().nullable().optional(),
  isActive: z.boolean().optional(),
  expiresAt: dateInputSchema.nullable().optional(),
})

const toExpiresAt = (
  value: string | null | undefined,
): Date | null | undefined => {
  if (value === undefined) return undefined
  if (value === null) return null
  return new Date(value)
}

const percentValueError = (
  discountType: 'PERCENT' | 'FIXED',
  discountValue: number,
): string | null => {
  if (discountValue <= 0) return 'Nilai diskon harus lebih dari nol.'
  if (discountType === 'PERCENT' && discountValue > 100) {
    return 'Diskon persen tidak boleh lebih dari 100.'
  }
  return null
}

const commissionError = (value: number | null): string | null =>
  value !== null && (value < 0 || value > 100)
    ? 'Komisi partner harus antara 0 dan 100 persen.'
    : null

const maxUsesError = (value: number | null): string | null =>
  value !== null && value < 1
    ? 'Batas pemakaian minimal satu kali.'
    : null

export const listAdminPromos = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AdminPromoList | null> => {
    const services = await requireAdminServices()
    if (services === null) return null

    const promos = await services.promoRepository.list()
    return { promos }
  },
)

export const createAdminPromo = createServerFn({ method: 'POST' })
  .validator((input: unknown) => createInputSchema.parse(input))
  .handler(async ({ data }): Promise<CreatePromoResult> => {
    const services = await requireAdminServices()
    if (services === null) {
      return { ok: false, error: 'Sesi admin tidak valid.' }
    }

    if (!PROMO_CODE_PATTERN.test(data.code)) {
      return {
        ok: false,
        error: 'Kode promo hanya boleh huruf, angka, dan tanda hubung.',
      }
    }

    const valueError = percentValueError(data.discountType, data.discountValue)
    if (valueError !== null) return { ok: false, error: valueError }

    const commissionMessage = commissionError(data.commissionPercent)
    if (commissionMessage !== null) {
      return { ok: false, error: commissionMessage }
    }
    const maxUsesMessage = maxUsesError(data.maxUses)
    if (maxUsesMessage !== null) {
      return { ok: false, error: maxUsesMessage }
    }

    const existing = await services.promoRepository.findByCode(data.code)
    if (existing !== null) {
      return { ok: false, error: 'Kode promo sudah digunakan.' }
    }

    const input: CreatePromoInput = {
      code: data.code,
      discountType: data.discountType,
      discountValue: data.discountValue,
      partnerName: data.partnerName,
      commissionPercent: data.commissionPercent,
      maxUses: data.maxUses,
      isActive: true,
      expiresAt: toExpiresAt(data.expiresAt) ?? null,
    }

    try {
      const promo = await services.promoRepository.create(input)
      return { ok: true, promo }
    } catch (error) {
      services.logger.error('admin.promo_create_failed', {
        code: data.code,
        error: error instanceof Error ? error.message : String(error),
      })
      return { ok: false, error: 'Promo tidak dapat dibuat.' }
    }
  })

export const updateAdminPromo = createServerFn({ method: 'POST' })
  .validator((input: unknown) => updateInputSchema.parse(input))
  .handler(async ({ data }): Promise<UpdatePromoResult> => {
    const services = await requireAdminServices()
    if (services === null) {
      return { ok: false, error: 'Sesi admin tidak valid.' }
    }

    const promos = await services.promoRepository.list()
    const existing = promos.find((promo) => promo.id === data.id)
    if (existing === undefined) {
      return { ok: false, error: 'Promo tidak ditemukan.' }
    }

    const effectiveType = data.discountType ?? existing.discountType
    const effectiveValue = data.discountValue ?? existing.discountValue
    const valueError = percentValueError(effectiveType, effectiveValue)
    if (valueError !== null) return { ok: false, error: valueError }

    if (data.commissionPercent !== undefined) {
      const commissionMessage = commissionError(data.commissionPercent)
      if (commissionMessage !== null) {
        return { ok: false, error: commissionMessage }
      }
    }
    if (data.maxUses !== undefined) {
      const maxUsesMessage = maxUsesError(data.maxUses)
      if (maxUsesMessage !== null) {
        return { ok: false, error: maxUsesMessage }
      }
    }

    const patch: UpdatePromoInput = {}
    if (data.discountType !== undefined) patch.discountType = data.discountType
    if (data.discountValue !== undefined) patch.discountValue = data.discountValue
    if (data.partnerName !== undefined) patch.partnerName = data.partnerName
    if (data.commissionPercent !== undefined) {
      patch.commissionPercent = data.commissionPercent
    }
    if (data.maxUses !== undefined) patch.maxUses = data.maxUses
    if (data.isActive !== undefined) patch.isActive = data.isActive
    if (data.expiresAt !== undefined) {
      patch.expiresAt = toExpiresAt(data.expiresAt)
    }

    try {
      const promo = await services.promoRepository.update(data.id, patch)
      return { ok: true, promo }
    } catch (error) {
      services.logger.error('admin.promo_update_failed', {
        promoId: data.id,
        error: error instanceof Error ? error.message : String(error),
      })
      return { ok: false, error: 'Promo tidak dapat disimpan.' }
    }
  })
