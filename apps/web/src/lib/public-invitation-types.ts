import type { AppearanceConfig, MasterInvitation } from '@kalamkala/contracts'
import type { GuestContext, PublicWish, TemplateFont } from '@kalamkala/templates/sdk'

/**
 * Client-safe view of one public invitation page.
 * Nothing here imports the database, adapters, or Worker environment, so route
 * components can consume it without pulling server code into the bundle.
 */
export type PublicInvitationStatus =
  | 'LIVE'
  | 'POST_EVENT'
  | 'EXPIRED'
  | 'NOT_FOUND'
  | 'PIN_REQUIRED'

export type PublicInvitationSeo = {
  title: string
  description: string
  imageUrl: string | null
}

export type PublicInvitationTheme = {
  templateId: string
  fonts: readonly TemplateFont[]
  appearance: AppearanceConfig
}

export type PublicInvitationContent = {
  content: MasterInvitation
  guest: GuestContext | null
  pinEnabled: boolean
}

export type PublicWishPage = {
  items: readonly PublicWish[]
  nextCursor: string | null
}

export type PublicInvitationBrowser = {
  turnstileSiteKey: string
  cdnBaseUrl: string
  siteUrl: string
}

export type PublicInvitationPayload = {
  status: PublicInvitationStatus
  slug: string
  seo: PublicInvitationSeo
  theme: PublicInvitationTheme
  /** Null for EXPIRED, PIN_REQUIRED, and NOT_FOUND responses. */
  invitation: PublicInvitationContent | null
  wishes: PublicWishPage
  browser: PublicInvitationBrowser
}
