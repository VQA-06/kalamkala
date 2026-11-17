import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import {
  INVITATION_TIER_PRICES,
  invitationTierSchema,
} from '@kalamkala/contracts'
import type { InvitationStatus } from '@kalamkala/contracts'
import {
  CheckoutError,
  CheckoutService,
  PaymentActivationError,
  calculatePromoDiscount,
  systemClock,
} from '@kalamkala/app-core'
import type { PromoRule, StoredPromo } from '@kalamkala/app-core'
import { SimulatedPaymentAdapter } from '@kalamkala/adapters-cloudflare'

import type { DashboardServices } from './context'
import {
  createDashboardServices,
  getDashboardSession,
  requireOwnedInvitation,
  resolveSiteUrl,
} from './context'

export type CheckoutPageData = {
  invitation: {
    id: string
    slug: string
    status: InvitationStatus
    tier: 'BASIC' | 'PREMIUM'
  }
  prices: typeof INVITATION_TIER_PRICES
}

export type PromoValidationResult =
  | { ok: true; promoCode: string; discountAmount: number; totalAmount: number }
  | { ok: false; error: string }

export type StartCheckoutResult =
  | { ok: true; merchantOrderId: string; redirectUrl: string; totalAmount: number }
  | { ok: false; error: string }

export type CompleteSimulatedPaymentResult =
  | { ok: true; status: 'ACTIVE' }
  | { ok: false; error: string }

const invitationIdSchema = z.string().trim().min(1).max(100)

const toPromoRule = (promo: StoredPromo): PromoRule => ({
  discountType: promo.discountType,
  discountValue: promo.discountValue,
  isActive: promo.isActive,
  expiresAt: promo.expiresAt,
  maxUses: promo.maxUses,
  usedCount: promo.usedCount,
})

const promoErrorMessage = (error: unknown): string =>
  error instanceof CheckoutError && error.code === 'PROMO_INVALID'
    ? 'Kode promo tidak dapat digunakan.'
    : 'Kode promo tidak dapat digunakan.'

const findPromo = async (
  services: DashboardServices,
  code: string,
): Promise<StoredPromo | null> => {
  const normalized = code.trim().toUpperCase()
  if (normalized.length === 0) return null
  return services.promos.findByCode(normalized)
}

export const getCheckoutPageData = createServerFn({ method: 'GET' })
  .validator((input: unknown) => z.object({ invitationId: invitationIdSchema }).parse(input))
  .handler(async ({ data }): Promise<CheckoutPageData | null> => {
    const services = createDashboardServices()
    try {
      const session = await getDashboardSession()
      if (session === null) return null

      const invitation = await requireOwnedInvitation(data.invitationId, session.id, services)
      if (invitation === null) return null

      return {
        invitation: {
          id: invitation.id,
          slug: invitation.slug,
          status: invitation.status,
          tier: invitation.tier,
        },
        prices: INVITATION_TIER_PRICES,
      }
    } catch (error) {
      services.logger.error('dashboard.checkout.page-failed', { err: error })
      return null
    }
  })

export const validatePromoCode = createServerFn({ method: 'POST' })
  .validator((input: unknown) =>
    z
      .object({
        invitationId: invitationIdSchema,
        code: z.string().max(100),
        tier: invitationTierSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<PromoValidationResult> => {
    const services = createDashboardServices()
    try {
      const session = await getDashboardSession()
      if (session === null) return { ok: false, error: 'Sesi berakhir. Silakan masuk kembali.' }

      const invitation = await requireOwnedInvitation(data.invitationId, session.id, services)
      if (invitation === null) return { ok: false, error: 'Undangan tidak ditemukan.' }

      const promo = await findPromo(services, data.code)
      if (promo === null) return { ok: false, error: 'Kode promo tidak ditemukan.' }

      const amount = INVITATION_TIER_PRICES[data.tier]
      try {
        const discountAmount = calculatePromoDiscount(
          amount,
          toPromoRule(promo),
          systemClock.now(),
        )
        return {
          ok: true,
          promoCode: promo.code,
          discountAmount,
          totalAmount: amount - discountAmount,
        }
      } catch (error) {
        return { ok: false, error: promoErrorMessage(error) }
      }
    } catch (error) {
      services.logger.error('dashboard.checkout.promo-failed', { err: error })
      return { ok: false, error: 'Kode promo tidak dapat diperiksa.' }
    }
  })

export const startCheckout = createServerFn({ method: 'POST' })
  .validator((input: unknown) =>
    z
      .object({
        invitationId: invitationIdSchema,
        tier: invitationTierSchema,
        promoCode: z.string().max(100).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<StartCheckoutResult> => {
    const services = createDashboardServices()
    try {
      const session = await getDashboardSession()
      if (session === null) return { ok: false, error: 'Sesi berakhir. Silakan masuk kembali.' }

      const invitation = await requireOwnedInvitation(data.invitationId, session.id, services)
      if (invitation === null) return { ok: false, error: 'Undangan tidak ditemukan.' }

      const promoCode = data.promoCode?.trim() ?? ''
      const promo = promoCode.length > 0 ? await findPromo(services, promoCode) : null
      if (promoCode.length > 0 && promo === null) {
        return { ok: false, error: 'Kode promo tidak ditemukan.' }
      }

      await services.invitations.updateTier(invitation.id, data.tier)

      const gateway = new SimulatedPaymentAdapter({ secret: env.BETTER_AUTH_SECRET })
      const checkout = new CheckoutService({
        transactionRepository: services.transactions,
        paymentGateway: gateway,
        clock: systemClock,
      })

      const merchantOrderId = `INV-${invitation.id}-${crypto.randomUUID()}`
      const result = await checkout.checkout({
        invitationId: invitation.id,
        userId: session.id,
        merchantOrderId,
        amount: INVITATION_TIER_PRICES[data.tier],
        promo: promo === null ? null : toPromoRule(promo),
        promoCode: promo?.code ?? null,
        returnUrl: `${resolveSiteUrl()}/dashboard/invitations/${invitation.id}/checkout`,
      })

      services.logger.info('dashboard.checkout.started', {
        invitationId: invitation.id,
        merchantOrderId: result.transaction.merchantOrderId,
        tier: data.tier,
      })

      return {
        ok: true,
        merchantOrderId: result.transaction.merchantOrderId,
        redirectUrl: result.session.redirectUrl,
        totalAmount: result.totalAmount,
      }
    } catch (error) {
      if (error instanceof CheckoutError) {
        return { ok: false, error: promoErrorMessage(error) }
      }
      services.logger.error('dashboard.checkout.start-failed', { err: error })
      return { ok: false, error: 'Pembayaran gagal dimulai. Silakan coba lagi.' }
    }
  })

export const completeSimulatedPayment = createServerFn({ method: 'POST' })
  .validator((input: unknown) =>
    z
      .object({
        invitationId: invitationIdSchema,
        merchantOrderId: z.string().trim().min(1).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<CompleteSimulatedPaymentResult> => {
    const services = createDashboardServices()
    try {
      const session = await getDashboardSession()
      if (session === null) return { ok: false, error: 'Sesi berakhir. Silakan masuk kembali.' }

      const invitation = await requireOwnedInvitation(data.invitationId, session.id, services)
      if (invitation === null) return { ok: false, error: 'Undangan tidak ditemukan.' }

      const transaction = await services.transactions.findByMerchantOrderId(data.merchantOrderId)
      if (transaction === null || transaction.invitationId !== invitation.id) {
        return { ok: false, error: 'Transaksi tidak ditemukan.' }
      }
      if (transaction.status === 'PAID') return { ok: true, status: 'ACTIVE' }

      const gateway = new SimulatedPaymentAdapter({ secret: env.BETTER_AUTH_SECRET })
      const callback = await gateway.createSignedCallback({
        merchantOrderId: transaction.merchantOrderId,
        amount: transaction.amount,
        status: 'PAID',
        paidAt: systemClock.now(),
        gatewayReference: `sim_manual_${crypto.randomUUID()}`,
      })
      const verified = await gateway.verifyCallback(callback)
      await services.activation.activateFromCallback(verified)

      if (transaction.promoCode !== null) {
        try {
          await services.promos.incrementUsedCount(transaction.promoCode)
        } catch (error) {
          // The payment already succeeded; promo accounting must not undo it.
          services.logger.warn('dashboard.checkout.promo-increment-failed', { err: error })
        }
      }

      services.logger.info('dashboard.checkout.completed', {
        invitationId: invitation.id,
        merchantOrderId: transaction.merchantOrderId,
      })
      return { ok: true, status: 'ACTIVE' }
    } catch (error) {
      if (error instanceof PaymentActivationError) {
        return { ok: false, error: 'Pembayaran tidak dapat diaktifkan.' }
      }
      services.logger.error('dashboard.checkout.complete-failed', { err: error })
      return { ok: false, error: 'Pembayaran gagal diselesaikan. Silakan coba lagi.' }
    }
  })
