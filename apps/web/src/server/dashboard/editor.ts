import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import {
  AppearanceConfigSchema,
  MasterInvitationSchema,
} from '@kalamkala/contracts'
import type { AppearanceConfig, InvitationStatus, MasterInvitation } from '@kalamkala/contracts'
import { R2S3MediaAdapter } from '@kalamkala/adapters-cloudflare'
import type { TemplateManifest } from '@kalamkala/templates/sdk'
import { templateRegistry } from '@kalamkala/templates/registry'

import {
  createDashboardServices,
  getDashboardSession,
  readR2UploadConfig,
  requireOwnedInvitation,
  resolveSiteUrl,
} from './context'

export type EditorPageData = {
  invitation: {
    id: string
    slug: string
    status: InvitationStatus
    tier: 'BASIC' | 'PREMIUM'
    templateId: string
    content: MasterInvitation
    appearance: AppearanceConfig | null
    whatsappTemplate: string | null
    publishedAt: Date | null
    expiresAt: Date | null
  }
  manifest: TemplateManifest
  siteUrl: string
}

export type PublishInvitationResult =
  | { ok: true; status: InvitationStatus; refreshed: boolean }
  | { ok: false; error: string }

export type PresignedUploadResult =
  | {
      ok: true
      uploadUrl: string
      key: string
      publicUrl: string
      expiresAt: Date
    }
  | { ok: false; error: string }

const invitationIdSchema = z.string().trim().min(1).max(100)

export const getEditorPageData = createServerFn({ method: 'GET' })
  .validator((input: unknown) => z.object({ invitationId: invitationIdSchema }).parse(input))
  .handler(async ({ data }): Promise<EditorPageData | null> => {
    const services = createDashboardServices()
    try {
      const session = await getDashboardSession()
      if (session === null) return null

      const invitation = await requireOwnedInvitation(data.invitationId, session.id, services)
      if (invitation === null) return null

      const entry = templateRegistry.find(
        (candidate) => candidate.manifest.id === invitation.templateId,
      )
      if (entry === undefined) {
        services.logger.warn('dashboard.editor.template-missing', {
          invitationId: invitation.id,
          templateId: invitation.templateId,
        })
        return null
      }

      return {
        invitation: {
          id: invitation.id,
          slug: invitation.slug,
          status: invitation.status,
          tier: invitation.tier,
          templateId: invitation.templateId,
          content: invitation.content,
          appearance: invitation.appearance,
          whatsappTemplate: invitation.whatsappTemplate,
          publishedAt: invitation.publishedAt,
          expiresAt: invitation.expiresAt,
        },
        manifest: entry.manifest,
        siteUrl: resolveSiteUrl(),
      }
    } catch (error) {
      services.logger.error('dashboard.editor.page-failed', { err: error })
      return null
    }
  })

export const publishInvitationChanges = createServerFn({ method: 'POST' })
  .validator((input: unknown) =>
    z
      .object({
        invitationId: invitationIdSchema,
        content: z.unknown(),
        appearance: z.unknown(),
        whatsappTemplate: z.string().max(2000).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<PublishInvitationResult> => {
    const services = createDashboardServices()
    try {
      const session = await getDashboardSession()
      if (session === null) return { ok: false, error: 'Sesi berakhir. Silakan masuk kembali.' }

      const invitation = await requireOwnedInvitation(data.invitationId, session.id, services)
      if (invitation === null) return { ok: false, error: 'Undangan tidak ditemukan.' }

      const content = MasterInvitationSchema.safeParse(data.content)
      if (!content.success) {
        return { ok: false, error: 'Isi undangan tidak valid.' }
      }

      let appearance: AppearanceConfig | null = null
      if (data.appearance !== null) {
        const parsedAppearance = AppearanceConfigSchema.safeParse(data.appearance)
        if (!parsedAppearance.success) {
          return { ok: false, error: 'Tampilan undangan tidak valid.' }
        }
        appearance = parsedAppearance.data
      }

      await services.invitations.updateContent(invitation.id, content.data)
      await services.invitations.updateAppearance(invitation.id, appearance)
      await services.invitations.setWhatsappTemplate(
        invitation.id,
        data.whatsappTemplate === null ? null : data.whatsappTemplate.trim() || null,
      )

      const refreshed = invitation.status === 'ACTIVE'
      if (refreshed) {
        await services.invitations.refreshCache(invitation.id)
      } else {
        await services.invitations.invalidateCache(invitation.id)
      }

      services.logger.info('dashboard.editor.published', {
        invitationId: invitation.id,
        status: invitation.status,
        refreshed,
      })
      return { ok: true, status: invitation.status, refreshed }
    } catch (error) {
      services.logger.error('dashboard.editor.publish-failed', { err: error })
      return { ok: false, error: 'Perubahan gagal disimpan. Silakan coba lagi.' }
    }
  })

export const createPresignedUpload = createServerFn({ method: 'POST' })
  .validator((input: unknown) =>
    z
      .object({
        invitationId: invitationIdSchema,
        filename: z.string().trim().min(1).max(200),
        contentType: z.string().trim().min(1).max(100),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<PresignedUploadResult> => {
    const services = createDashboardServices()
    try {
      const session = await getDashboardSession()
      if (session === null) return { ok: false, error: 'Sesi berakhir. Silakan masuk kembali.' }

      const invitation = await requireOwnedInvitation(data.invitationId, session.id, services)
      if (invitation === null) return { ok: false, error: 'Undangan tidak ditemukan.' }

      if (data.contentType !== 'image/webp') {
        return { ok: false, error: 'Hanya gambar WebP yang didukung.' }
      }

      const config = readR2UploadConfig()
      if (config === null) {
        return { ok: false, error: 'Unggah belum dikonfigurasi.' }
      }

      const key = `invitations/${invitation.id}/${crypto.randomUUID()}.webp`
      const media = new R2S3MediaAdapter({
        accountId: config.accountId,
        bucketName: config.bucketName,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        cdnBaseUrl: config.cdnBaseUrl,
      })

      const upload = await media.createPresignedUpload({
        key,
        contentType: 'image/webp',
        expiresInSeconds: 600,
      })

      return {
        ok: true,
        uploadUrl: upload.uploadUrl,
        key: upload.objectKey,
        publicUrl: upload.publicUrl,
        expiresAt: upload.expiresAt,
      }
    } catch (error) {
      services.logger.error('dashboard.editor.upload-failed', { err: error })
      return { ok: false, error: 'Unggah gagal disiapkan. Silakan coba lagi.' }
    }
  })
