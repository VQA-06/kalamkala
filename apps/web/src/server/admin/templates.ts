import type {
  StoredCatalogTemplate,
  UpdateCatalogTemplateInput,
} from '@kalamkala/app-core'
import { invitationTierSchema } from '@kalamkala/contracts'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { requireAdminServices } from './context.js'

export type AdminCatalogTemplateList = {
  templates: StoredCatalogTemplate[]
}

export type UpdateCatalogTemplateResult =
  | { ok: true; template: StoredCatalogTemplate }
  | { ok: false; error: string }

const updateInputSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1).optional(),
  tier: invitationTierSchema.optional(),
  isVisible: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

export const listAdminCatalogTemplates = createServerFn({
  method: 'GET',
}).handler(async (): Promise<AdminCatalogTemplateList | null> => {
  const services = await requireAdminServices()
  if (services === null) return null

  const templates = await services.catalogTemplateRepository.list()
  return { templates }
})

export const updateAdminCatalogTemplate = createServerFn({ method: 'POST' })
  .validator((input: unknown) => updateInputSchema.parse(input))
  .handler(
    async ({ data }): Promise<UpdateCatalogTemplateResult> => {
      const services = await requireAdminServices()
      if (services === null) {
        return { ok: false, error: 'Sesi admin tidak valid.' }
      }

      const patch: UpdateCatalogTemplateInput = {}
      if (data.name !== undefined) patch.name = data.name
      if (data.tier !== undefined) patch.tier = data.tier
      if (data.isVisible !== undefined) patch.isVisible = data.isVisible
      if (data.sortOrder !== undefined) patch.sortOrder = data.sortOrder

      try {
        const template = await services.catalogTemplateRepository.update(
          data.id,
          patch,
        )
        return { ok: true, template }
      } catch (error) {
        services.logger.error('admin.catalog_template_update_failed', {
          templateId: data.id,
          error: error instanceof Error ? error.message : String(error),
        })
        return { ok: false, error: 'Template katalog tidak dapat disimpan.' }
      }
    },
  )
