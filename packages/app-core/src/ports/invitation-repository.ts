import type {
  AppearanceConfig,
  InvitationStatus,
  InvitationTier,
  MasterInvitation,
} from '@kalamkala/contracts'

/**
 * Persistence shape of an invitation.
 * `content` is the editable JSON document; ids and lifecycle columns live
 * beside it so they can be indexed and queried.
 */
export type StoredInvitation = {
  id: string
  userId: string
  slug: string
  templateId: string
  tier: InvitationTier
  status: InvitationStatus
  content: MasterInvitation
  /** Theme overrides; null means the template's default appearance applies. */
  appearance: AppearanceConfig | null
  /** WhatsApp message template chosen by the owner, or null for the default. */
  whatsappTemplate: string | null
  publishedAt: Date | null
  expiresAt: Date | null
}

export type CreateInvitationInput = {
  id: string
  userId: string
  slug: string
  templateId: string
  tier: InvitationTier
  status: InvitationStatus
  content: MasterInvitation
  appearance: AppearanceConfig | null
  whatsappTemplate: string | null
  publishedAt: Date | null
  expiresAt: Date | null
}

export type InvitationRepository = {
  findById: (id: string) => Promise<StoredInvitation | null>
  findBySlug: (slug: string) => Promise<StoredInvitation | null>
  /** Owner dashboard list, newest first. */
  listByUserId: (userId: string) => Promise<StoredInvitation[]>
  create: (input: CreateInvitationInput) => Promise<StoredInvitation>
  updateContent: (id: string, content: MasterInvitation) => Promise<void>
  updateAppearance: (id: string, appearance: AppearanceConfig | null) => Promise<void>
  setWhatsappTemplate: (id: string, template: string | null) => Promise<void>
  updateTier: (id: string, tier: InvitationTier) => Promise<void>
  setStatus: (id: string, status: InvitationStatus, publishedAt: Date | null) => Promise<void>
  /** Warms any read-through cache after publication. */
  refreshCache: (id: string) => Promise<void>
  invalidateCache: (id: string) => Promise<void>
}
