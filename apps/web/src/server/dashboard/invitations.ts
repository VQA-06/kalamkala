import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import {
  DEFAULT_WHATSAPP_TEMPLATE,
  SECTION_IDS,
  createDefaultInvitationContent,
  eventCategorySchema,
  generateCoupleSlug,
  invitationTierSchema,
} from '@kalamkala/contracts'
import type { AppearanceConfig, MasterInvitation } from '@kalamkala/contracts'
import { systemClock } from '@kalamkala/app-core'
import { templateRegistry } from '@kalamkala/templates/registry'

import {
  createDashboardServices,
  getDashboardSession,
} from './context'

const DAY_MS = 24 * 60 * 60 * 1000

export type OwnedInvitationSummary = {
  id: string
  slug: string
  status: 'DRAFT' | 'ACTIVE' | 'EXPIRED'
  tier: 'BASIC' | 'PREMIUM'
  templateId: string
  createdAt: Date
  publishedAt: Date | null
  expiresAt: Date | null
  remainingDays: number | null
}

export type CreateInvitationResult =
  | { id: string; slug: string }
  | { ok: false; error: string }
  | null

const createInvitationInputSchema = z.object({
  templateId: z.string().trim().min(1).max(100),
  tier: invitationTierSchema.optional(),
  eventCategory: eventCategorySchema.optional(),
})

const defaultAppearanceFor = (tokens: AppearanceConfig['themeTokens'], templateId: string): AppearanceConfig => ({
  themeTokens: tokens,
  fontPairingId: templateId,
  sectionOrder: [...SECTION_IDS],
  hiddenSections: [],
  sectionTitles: {},
})

export const listOwnedInvitations = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{ invitations: OwnedInvitationSummary[] } | null> => {
    const services = createDashboardServices()
    try {
      const session = await getDashboardSession()
      if (session === null) return null

      const invitations = await services.invitations.listByUserId(session.id)
      const now = systemClock.now().getTime()
      return {
        invitations: invitations.map((invitation) => ({
          id: invitation.id,
          slug: invitation.slug,
          status: invitation.status,
          tier: invitation.tier,
          templateId: invitation.templateId,
          createdAt: invitation.createdAt,
          publishedAt: invitation.publishedAt,
          expiresAt: invitation.expiresAt,
          remainingDays:
            invitation.expiresAt === null
              ? null
              : Math.max(0, Math.ceil((invitation.expiresAt.getTime() - now) / DAY_MS)),
        })),
      }
    } catch (error) {
      services.logger.error('dashboard.invitations.list-failed', { err: error })
      return null
    }
  },
)

export const createInvitation = createServerFn({ method: 'POST' })
  .validator((input: unknown) => createInvitationInputSchema.parse(input))
  .handler(async ({ data }): Promise<CreateInvitationResult> => {
    const services = createDashboardServices()
    try {
      const session = await getDashboardSession()
      if (session === null) return null

      const entry = templateRegistry.find(
        (candidate) => candidate.manifest.id === data.templateId,
      )
      if (entry === undefined || !entry.manifest.isVisible) {
        return { ok: false, error: 'Tema tidak tersedia.' }
      }

      const palette = entry.manifest.palettes[0]
      if (palette === undefined) {
        return { ok: false, error: 'Tema tidak memiliki palet warna.' }
      }

      const baseContent = createDefaultInvitationContent({ now: systemClock.now() })
      const content: MasterInvitation =
        data.eventCategory === undefined
          ? baseContent
          : { ...baseContent, eventCategory: data.eventCategory }

      const primaryName = content.hosts.primary.fullName
      const secondaryName = content.hosts.secondary?.fullName
      const appearance = defaultAppearanceFor(palette.tokens, entry.manifest.id)
      const tier = data.tier ?? 'BASIC'

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const slug = generateCoupleSlug(primaryName, secondaryName)
        const existing = await services.invitations.findBySlug(slug)
        if (existing !== null) continue

        try {
          const invitation = await services.invitations.create({
            id: crypto.randomUUID(),
            userId: session.id,
            slug,
            templateId: entry.manifest.id,
            tier,
            status: 'DRAFT',
            content,
            appearance,
            whatsappTemplate: DEFAULT_WHATSAPP_TEMPLATE,
            publishedAt: null,
            expiresAt: null,
          })
          services.logger.info('dashboard.invitations.created', {
            invitationId: invitation.id,
            templateId: entry.manifest.id,
          })
          return { id: invitation.id, slug: invitation.slug }
        } catch (error) {
          // A concurrent insert may have taken the slug; retry with a new one.
          services.logger.warn('dashboard.invitations.slug-retry', { attempt, err: error })
        }
      }

      return { ok: false, error: 'Gagal menyiapkan tautan undangan. Silakan coba lagi.' }
    } catch (error) {
      services.logger.error('dashboard.invitations.create-failed', { err: error })
      return { ok: false, error: 'Undangan gagal dibuat. Silakan coba lagi.' }
    }
  })
