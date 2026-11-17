import type { InvitationTier } from '@kalamkala/contracts'

export type StoredCatalogTemplate = {
  id: string
  name: string
  tier: InvitationTier
  isVisible: boolean
  sortOrder: number
}

export type UpdateCatalogTemplateInput = Partial<{
  name: string
  tier: InvitationTier
  isVisible: boolean
  sortOrder: number
}>

export type CatalogTemplateRepository = {
  list: () => Promise<StoredCatalogTemplate[]>
  update: (id: string, input: UpdateCatalogTemplateInput) => Promise<StoredCatalogTemplate>
}
