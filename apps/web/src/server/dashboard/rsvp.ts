import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import type { StoredRsvp } from '@kalamkala/app-core'
import type { InvitationStatus } from '@kalamkala/contracts'

import type { DashboardServices } from './context'
import {
  createDashboardServices,
  getDashboardSession,
  requireOwnedInvitation,
  resolveSiteUrl,
  sha256Hex,
} from './context'

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_COLLABORATOR_DAYS = 14
const COLLABORATOR_PERMISSIONS_JSON = '{"guests":true,"rsvps":true}'

export type RsvpPageData = {
  invitation: {
    id: string
    slug: string
    status: InvitationStatus
    publishedAt: Date | null
    expiresAt: Date | null
  }
  rsvps: StoredRsvp[]
  summary: { hadir: number; tidakHadir: number; ragu: number; totalPax: number }
  collaborators: Array<{
    id: string
    label: string
    accessToken: string
    expiresAt: Date | null
    createdAt: Date
  }>
  siteUrl: string
}

type OkResult = { ok: true } | { ok: false; error: string }

export type CreateCollaboratorResult =
  | {
      ok: true
      pin: string
      link: string
      collaborator: { id: string; label: string; expiresAt: Date | null }
    }
  | { ok: false; error: string }

const invitationIdSchema = z.string().trim().min(1).max(100)
const rsvpIdSchema = z.string().trim().min(1).max(100)

const findOwnedRsvp = async (
  services: DashboardServices,
  invitationId: string,
  rsvpId: string,
): Promise<StoredRsvp | null> => {
  const rows = await services.rsvps.listByInvitation(invitationId)
  return rows.find((row) => row.id === rsvpId) ?? null
}

const summarize = (
  rsvps: readonly StoredRsvp[],
): RsvpPageData['summary'] => {
  let hadir = 0
  let tidakHadir = 0
  let ragu = 0
  let totalPax = 0

  for (const rsvp of rsvps) {
    if (rsvp.attendance === 'HADIR') {
      hadir += 1
      totalPax += rsvp.guestCount
    } else if (rsvp.attendance === 'TIDAK_HADIR') {
      tidakHadir += 1
    } else {
      ragu += 1
    }
  }

  return { hadir, tidakHadir, ragu, totalPax }
}

export const getRsvpPageData = createServerFn({ method: 'GET' })
  .validator((input: unknown) => z.object({ invitationId: invitationIdSchema }).parse(input))
  .handler(async ({ data }): Promise<RsvpPageData | null> => {
    const services = createDashboardServices()
    try {
      const session = await getDashboardSession()
      if (session === null) return null

      const invitation = await requireOwnedInvitation(data.invitationId, session.id, services)
      if (invitation === null) return null

      const [rsvps, collaborators] = await Promise.all([
        services.rsvps.listByInvitation(invitation.id),
        services.collaborators.listByInvitation(invitation.id),
      ])

      return {
        invitation: {
          id: invitation.id,
          slug: invitation.slug,
          status: invitation.status,
          publishedAt: invitation.publishedAt,
          expiresAt: invitation.expiresAt,
        },
        rsvps,
        summary: summarize(rsvps),
        collaborators: collaborators.map((collaborator) => ({
          id: collaborator.id,
          label: collaborator.label,
          accessToken: collaborator.accessToken,
          expiresAt: collaborator.expiresAt,
          createdAt: collaborator.createdAt,
        })),
        siteUrl: resolveSiteUrl(),
      }
    } catch (error) {
      services.logger.error('dashboard.rsvp.page-failed', { err: error })
      return null
    }
  })

export const moderateRsvp = createServerFn({ method: 'POST' })
  .validator((input: unknown) =>
    z
      .object({
        invitationId: invitationIdSchema,
        rsvpId: rsvpIdSchema,
        isHidden: z.boolean(),
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

      const rsvp = await findOwnedRsvp(services, invitation.id, data.rsvpId)
      if (rsvp === null) return { ok: false, error: 'Ucapan tidak ditemukan.' }

      await services.rsvps.setHidden(rsvp.id, data.isHidden)
      return { ok: true }
    } catch (error) {
      services.logger.error('dashboard.rsvp.moderate-failed', { err: error })
      return { ok: false, error: 'Ucapan gagal diperbarui.' }
    }
  })

export const replyToRsvp = createServerFn({ method: 'POST' })
  .validator((input: unknown) =>
    z
      .object({
        invitationId: invitationIdSchema,
        rsvpId: rsvpIdSchema,
        hostReply: z.string().max(1000),
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

      const hostReply = data.hostReply.trim()
      if (hostReply.length === 0) return { ok: false, error: 'Balasan tidak boleh kosong.' }

      const rsvp = await findOwnedRsvp(services, invitation.id, data.rsvpId)
      if (rsvp === null) return { ok: false, error: 'Ucapan tidak ditemukan.' }

      await services.rsvps.setReply(rsvp.id, hostReply)
      return { ok: true }
    } catch (error) {
      services.logger.error('dashboard.rsvp.reply-failed', { err: error })
      return { ok: false, error: 'Balasan gagal disimpan.' }
    }
  })

export const createCollaborator = createServerFn({ method: 'POST' })
  .validator((input: unknown) =>
    z
      .object({
        invitationId: invitationIdSchema,
        label: z.string().trim().min(1).max(100),
        expiresInDays: z.number().int().min(1).max(90).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<CreateCollaboratorResult> => {
    const services = createDashboardServices()
    try {
      const session = await getDashboardSession()
      if (session === null) return { ok: false, error: 'Sesi berakhir. Silakan masuk kembali.' }

      const invitation = await requireOwnedInvitation(data.invitationId, session.id, services)
      if (invitation === null) return { ok: false, error: 'Undangan tidak ditemukan.' }

      const accessToken = crypto.randomUUID()
      const pin = String(
        (crypto.getRandomValues(new Uint32Array(1))[0] ?? 0) % 1_000_000,
      ).padStart(6, '0')
      const pinHash = await sha256Hex(`${accessToken}:${pin}`)
      const days = data.expiresInDays ?? DEFAULT_COLLABORATOR_DAYS
      const expiresAt = new Date(Date.now() + days * DAY_MS)

      const collaborator = await services.collaborators.create({
        id: crypto.randomUUID(),
        invitationId: invitation.id,
        label: data.label,
        accessToken,
        pinHash,
        permissionsJson: COLLABORATOR_PERMISSIONS_JSON,
        expiresAt,
      })

      // The link and PIN are generator output for the read-only collaborator
      // portal; the PIN is verified there and never stored in plain text.
      const link = `${resolveSiteUrl()}/kolaborator/${encodeURIComponent(accessToken)}`

      services.logger.info('dashboard.rsvp.collaborator-created', {
        invitationId: invitation.id,
        collaboratorId: collaborator.id,
      })

      return {
        ok: true,
        pin,
        link,
        collaborator: {
          id: collaborator.id,
          label: collaborator.label,
          expiresAt: collaborator.expiresAt,
        },
      }
    } catch (error) {
      services.logger.error('dashboard.rsvp.collaborator-failed', { err: error })
      return { ok: false, error: 'Akses kolaborator gagal dibuat.' }
    }
  })

export const revokeCollaborator = createServerFn({ method: 'POST' })
  .validator((input: unknown) =>
    z
      .object({
        invitationId: invitationIdSchema,
        collaboratorId: z.string().trim().min(1).max(100),
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

      const collaborator = await services.collaborators.findById(data.collaboratorId)
      if (collaborator === null || collaborator.invitationId !== invitation.id) {
        return { ok: false, error: 'Kolaborator tidak ditemukan.' }
      }

      await services.collaborators.delete(collaborator.id)
      return { ok: true }
    } catch (error) {
      services.logger.error('dashboard.rsvp.revoke-failed', { err: error })
      return { ok: false, error: 'Akses kolaborator gagal dicabut.' }
    }
  })
