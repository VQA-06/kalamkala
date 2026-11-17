/**
 * The template SDK contract. Every theme — starter or production — implements
 * `TemplateModule` and receives exactly one `TemplateContext`, so themes stay
 * free of Cloudflare, D1, and React-only assumptions.
 */

import type {
  AppearanceConfig,
  GuestCategory,
  InvitationTier,
  Locale,
  MasterInvitation,
  RsvpAttendance,
  ThemeTokens,
} from '@kalamkala/contracts'

export const TEMPLATE_FRAMEWORKS = ['react', 'vue', 'vanilla'] as const
export type TemplateFramework = (typeof TEMPLATE_FRAMEWORKS)[number]

export const TEMPLATE_OCCASIONS = [
  'pernikahan',
  'lamaran',
  'khitanan',
  'aqiqah',
  'ulang-tahun',
] as const
export type TemplateOccasion = (typeof TEMPLATE_OCCASIONS)[number]

/**
 * Capabilities a template can render. The editor reads `supportedFeatures` from
 * the manifest and hides form tabs for anything the chosen theme ignores.
 */
export const TEMPLATE_FEATURES = [
  'opening',
  'hosts',
  'events',
  'loveStory',
  'media',
  'gallery',
  'audio',
  'video',
  'gifts',
  'rsvp',
  'wishes',
  'liveStream',
  'socialKit',
  'travelInfo',
  'entourage',
  'coHosts',
  'additionalNotes',
  'closing',
  'qrCheckin',
  'privatePin',
] as const
export type TemplateFeature = (typeof TEMPLATE_FEATURES)[number]

export type TemplatePalette = {
  id: string
  name: string
  tokens: ThemeTokens
}

/** A webfont a theme expects the host to load. */
export type TemplateFont = {
  family: string
  weights?: readonly number[]
  styles?: readonly ('normal' | 'italic')[]
}

export type TemplateManifest = {
  id: string
  name: string
  tier: InvitationTier
  framework: TemplateFramework
  sortOrder: number
  isVisible: boolean
  occasions: readonly TemplateOccasion[]
  /** Capabilities the theme actually renders; the editor filters tabs by this. */
  supportedFeatures: readonly TemplateFeature[]
  /** Production themes ship at least three palettes. */
  palettes: readonly TemplatePalette[]
  /** Fonts the host should load before mounting the theme. */
  fonts?: readonly TemplateFont[]
}

export type GuestContext = {
  id: string | null
  name: string
  category: GuestCategory
  maxPax: number
  tableNumber: string | null
  sessionLabel: string | null
  qrToken?: string | null
}

export type PublicWish = {
  id: string
  guestName: string
  message: string
  createdAt: string
  hostReply: string | null
}

export type RsvpSummary = {
  hadir: number
  tidakHadir: number
  ragu: number
}

export type SubmitRsvpInput = {
  guestName: string
  attendance: RsvpAttendance
  guestCount: number
  message: string
}

export type RsvpSubmitResult = { ok: true } | { ok: false; error: string }

export type TemplateActions = {
  submitRsvp: (input: SubmitRsvpInput) => Promise<RsvpSubmitResult>
  openInvitation: () => void
}

export type TemplateUtils = {
  resolveMediaUrl: (key: string | null) => string | null
  formatDate: (iso: string, timezone: 'WIB' | 'WITA' | 'WIT') => string
  formatCurrency: (amount: number) => string
}

export type TemplateRuntimeState = {
  isPreview: boolean
  isOpened: boolean
  locale: Locale
  reducedMotion: boolean
}

/** Every user-facing string a theme may render. */
export const TEMPLATE_COPY_KEYS = [
  'openInvitation',
  'openHint',
  'pinTitle',
  'pinLabel',
  'pinSubmit',
  'pinWrong',
  'rsvpTitle',
  'rsvpSubtitle',
  'rsvpName',
  'rsvpAttendance',
  'attendanceHadir',
  'attendanceTidakHadir',
  'attendanceRagu',
  'rsvpGuestCount',
  'rsvpMessage',
  'rsvpSubmit',
  'rsvpSubmitting',
  'rsvpSuccess',
  'rsvpError',
  'rsvpMaxPax',
  'wishesTitle',
  'wishesEmpty',
  'hostReply',
  'rsvpStatsTitle',
  'hadirCount',
  'notAttendingCount',
  'maybeCount',
  'eventsTitle',
  'dressCodeLabel',
  'viewMap',
  'hostsTitle',
  'loveStoryTitle',
  'galleryTitle',
  'giftTitle',
  'giftAccountHolderLabel',
  'giftCopy',
  'giftCopied',
  'giftQrisTitle',
  'giftAddressTitle',
  'travelTitle',
  'hotelsTitle',
  'bookHotel',
  'entourageTitle',
  'coHostsTitle',
  'notesTitle',
  'liveStreamTitle',
  'watchLive',
  'socialKitTitle',
  'hashtagLabel',
  'filterLabel',
  'captionLabel',
  'closingTitle',
  'happyFamiliesTitle',
  'qrCheckinTitle',
  'qrCheckinNote',
  'privateLabel',
  'previewBadge',
  'poweredBy',
] as const

export type TemplateCopyKey = (typeof TEMPLATE_COPY_KEYS)[number]

export type TemplateTranslations = Record<
  Locale,
  Readonly<Record<TemplateCopyKey, string>>
>

export type TemplateContext = {
  data: MasterInvitation
  guest: GuestContext | null
  appearance: AppearanceConfig
  t: (key: TemplateCopyKey, vars?: Readonly<Record<string, string | number>>) => string
  state: TemplateRuntimeState
  actions: TemplateActions
  utils: TemplateUtils
  wishes: readonly PublicWish[]
  rsvpSummary: RsvpSummary | null
}

export type TemplateMountFn = (container: HTMLElement, ctx: TemplateContext) => () => void

export type TemplateModule = {
  manifest: TemplateManifest
  mount: TemplateMountFn
}
