import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { guestCategorySchema, normalizeIndonesianPhone } from '@kalamkala/contracts'
import type { GuestCategory, InvitationStatus, MasterInvitation } from '@kalamkala/contracts'
import type { StoredGuest } from '@kalamkala/app-core'

import {
  createDashboardServices,
  getDashboardSession,
  requireOwnedInvitation,
  resolveSiteUrl,
} from './context'

export type GuestsPageData = {
  invitation: {
    id: string
    slug: string
    status: InvitationStatus
    templateId: string
    content: MasterInvitation
    whatsappTemplate: string | null
  }
  guests: StoredGuest[]
  siteUrl: string
}

type GuestResult = { ok: true; guest: StoredGuest } | { ok: false; error: string }
type OkResult = { ok: true } | { ok: false; error: string }

const invitationIdSchema = z.string().trim().min(1).max(100)

const guestFieldsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: guestCategorySchema,
  maxPax: z.number().int().min(1).max(20),
  tableNumber: z.string().trim().max(50).nullable().optional(),
  sessionLabel: z.string().trim().max(100).nullable().optional(),
})

const addGuestInputSchema = guestFieldsSchema.extend({
  invitationId: invitationIdSchema,
  phone: z.string().trim().max(30),
})

const normalizePhone = (
  raw: string,
): { ok: true; value: string | null } | { ok: false } => {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return { ok: true, value: null }
  const normalized = normalizeIndonesianPhone(trimmed)
  return normalized === null ? { ok: false } : { ok: true, value: normalized }
}

const newGuestInput = (
  invitationId: string,
  name: string,
  phoneNormalized: string | null,
  category: GuestCategory,
  maxPax: number,
  tableNumber: string | null,
  sessionLabel: string | null,
) => ({
  invitationId,
  name,
  phoneNormalized,
  category,
  allowedEventIdsJson: '[]',
  maxPax,
  tableNumber,
  sessionLabel,
  qrToken: crypto.randomUUID(),
  waSentStatus: 'PENDING' as const,
})

export const getGuestsPageData = createServerFn({ method: 'GET' })
  .validator((input: unknown) => z.object({ invitationId: invitationIdSchema }).parse(input))
  .handler(async ({ data }): Promise<GuestsPageData | null> => {
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
          templateId: invitation.templateId,
          content: invitation.content,
          whatsappTemplate: invitation.whatsappTemplate,
        },
        guests: await services.guests.listByInvitation(invitation.id),
        siteUrl: resolveSiteUrl(),
      }
    } catch (error) {
      services.logger.error('dashboard.guests.page-failed', { err: error })
      return null
    }
  })

export const addGuest = createServerFn({ method: 'POST' })
  .validator((input: unknown) => addGuestInputSchema.parse(input))
  .handler(async ({ data }): Promise<GuestResult> => {
    const services = createDashboardServices()
    try {
      const session = await getDashboardSession()
      if (session === null) return { ok: false, error: 'Sesi berakhir. Silakan masuk kembali.' }

      const invitation = await requireOwnedInvitation(data.invitationId, session.id, services)
      if (invitation === null) return { ok: false, error: 'Undangan tidak ditemukan.' }

      const phone = normalizePhone(data.phone)
      if (!phone.ok) return { ok: false, error: 'Nomor WhatsApp tidak valid.' }

      const guest = await services.guests.create(
        newGuestInput(
          invitation.id,
          data.name,
          phone.value,
          data.category,
          data.maxPax,
          data.tableNumber ?? null,
          data.sessionLabel ?? null,
        ),
      )
      return { ok: true, guest }
    } catch (error) {
      services.logger.error('dashboard.guests.add-failed', { err: error })
      return { ok: false, error: 'Tamu gagal disimpan. Silakan coba lagi.' }
    }
  })

export const addGuestsBulk = createServerFn({ method: 'POST' })
  .validator((input: unknown) =>
    z
      .object({
        invitationId: invitationIdSchema,
        entries: z
          .array(z.object({ name: z.string().max(120), phone: z.string().max(30) }))
          .min(1)
          .max(300),
        category: guestCategorySchema,
        maxPax: z.number().int().min(1).max(20),
      })
      .parse(input),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      ok: true
      created: StoredGuest[]
      skipped: Array<{ name: string; reason: string }>
    }> => {
      const services = createDashboardServices()
      const created: StoredGuest[] = []
      const skipped: Array<{ name: string; reason: string }> = []

      try {
        const session = await getDashboardSession()
        if (session === null) {
          return { ok: true, created, skipped: [{ name: '', reason: 'Sesi berakhir.' }] }
        }

        const invitation = await requireOwnedInvitation(data.invitationId, session.id, services)
        if (invitation === null) {
          return { ok: true, created, skipped: [{ name: '', reason: 'Undangan tidak ditemukan.' }] }
        }

        for (const entry of data.entries) {
          const name = entry.name.trim()
          if (name.length === 0) {
            skipped.push({ name: entry.name, reason: 'Nama kosong' })
            continue
          }

          const phone = normalizePhone(entry.phone)
          if (!phone.ok) {
            skipped.push({ name, reason: 'Nomor WhatsApp tidak valid' })
            continue
          }

          try {
            created.push(
              await services.guests.create(
                newGuestInput(
                  invitation.id,
                  name,
                  phone.value,
                  data.category,
                  data.maxPax,
                  null,
                  null,
                ),
              ),
            )
          } catch (error) {
            services.logger.warn('dashboard.guests.bulk-row-failed', { err: error })
            skipped.push({ name, reason: 'Gagal menyimpan' })
          }
        }

        services.logger.info('dashboard.guests.bulk-finished', {
          invitationId: invitation.id,
          created: created.length,
          skipped: skipped.length,
        })
        return { ok: true, created, skipped }
      } catch (error) {
        services.logger.error('dashboard.guests.bulk-failed', { err: error })
        return {
          ok: true,
          created,
          skipped: [...skipped, { name: '', reason: 'Impor gagal diproses.' }],
        }
      }
    },
  )

export const updateGuestSettings = createServerFn({ method: 'POST' })
  .validator((input: unknown) =>
    z
      .object({
        invitationId: invitationIdSchema,
        guestId: z.string().trim().min(1).max(100),
        category: guestCategorySchema,
        maxPax: z.number().int().min(1).max(20),
        tableNumber: z.string().trim().max(50).nullable().optional(),
        sessionLabel: z.string().trim().max(100).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<GuestResult> => {
    const services = createDashboardServices()
    try {
      const session = await getDashboardSession()
      if (session === null) return { ok: false, error: 'Sesi berakhir. Silakan masuk kembali.' }

      const invitation = await requireOwnedInvitation(data.invitationId, session.id, services)
      if (invitation === null) return { ok: false, error: 'Undangan tidak ditemukan.' }

      const existing = await services.guests.findById(data.guestId)
      if (existing === null || existing.invitationId !== invitation.id) {
        return { ok: false, error: 'Tamu tidak ditemukan.' }
      }

      const guest = await services.guests.update(data.guestId, {
        category: data.category,
        maxPax: data.maxPax,
        tableNumber: data.tableNumber ?? null,
        sessionLabel: data.sessionLabel ?? null,
      })
      return { ok: true, guest }
    } catch (error) {
      services.logger.error('dashboard.guests.update-failed', { err: error })
      return { ok: false, error: 'Pengaturan tamu gagal disimpan.' }
    }
  })

export const markGuestWhatsappSent = createServerFn({ method: 'POST' })
  .validator((input: unknown) =>
    z
      .object({
        invitationId: invitationIdSchema,
        guestId: z.string().trim().min(1).max(100),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<OkResult> => {
    const services = createDashboardServices()
    try {
      const session = await getDashboardSession()
      if (session === null) return { ok: false, error: 'Sesi berakhir. Silakan masuk kembali.' }

      const invitation = await requireOwnedInvitation(data.invitationId, session.id, services)
      if (invitation === null) return { ok: false, error: 'Undangan tidak ditemukan.' }

      const guest = await services.guests.findById(data.guestId)
      if (guest === null || guest.invitationId !== invitation.id) {
        return { ok: false, error: 'Tamu tidak ditemukan.' }
      }

      await services.guests.markWaSent(guest.id, new Date())
      return { ok: true }
    } catch (error) {
      services.logger.error('dashboard.guests.mark-sent-failed', { err: error })
      return { ok: false, error: 'Status WhatsApp gagal diperbarui.' }
    }
  })

export const saveWhatsappTemplate = createServerFn({ method: 'POST' })
  .validator((input: unknown) =>
    z
      .object({
        invitationId: invitationIdSchema,
        template: z.string().max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<OkResult> => {
    const services = createDashboardServices()
    try {
      const session = await getDashboardSession()
      if (session === null) return { ok: false, error: 'Sesi berakhir. Silakan masuk kembali.' }

      const invitation = await requireOwnedInvitation(data.invitationId, session.id, services)
      if (invitation === null) return { ok: false, error: 'Undangan tidak ditemukan.' }

      const template = data.template.trim()
      if (template.length === 0) return { ok: false, error: 'Template tidak boleh kosong.' }

      await services.invitations.setWhatsappTemplate(invitation.id, template)
      return { ok: true }
    } catch (error) {
      services.logger.error('dashboard.guests.template-failed', { err: error })
      return { ok: false, error: 'Template WhatsApp gagal disimpan.' }
    }
  })
