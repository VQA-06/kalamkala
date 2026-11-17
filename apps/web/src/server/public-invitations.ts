import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { getCookie, getRequest, getRequestIP, setCookie } from '@tanstack/react-start/server'
import { z } from 'zod'

import {
  ConsoleJsonLogger,
  D1GuestRepository,
  D1InvitationReportRepository,
  D1KVInvitationRepository,
  D1RsvpRepository,
  KvCacheAdapter,
  createAppDatabase,
  requestIdFromHeaders,
} from '@kalamkala/adapters-cloudflare'
import {
  InvitationLifecycleService,
  RsvpModerationService,
  RsvpValidationError,
  systemClock,
} from '@kalamkala/app-core'
import type { LoggerPort, StoredGuest, StoredInvitation, StoredRsvp } from '@kalamkala/app-core'
import {
  SECTION_IDS,
  invitationReportReasonSchema,
  rsvpAttendanceSchema,
} from '@kalamkala/contracts'
import type {
  AppearanceConfig,
  MasterInvitation,
  ThemeTokens,
} from '@kalamkala/contracts'
import { templateRegistry } from '@kalamkala/templates/registry'
import type { TemplateRegistryEntry } from '@kalamkala/templates/registry'
import type { GuestContext, PublicWish, TemplateManifest } from '@kalamkala/templates/sdk'

import { resolveMediaUrl } from '../lib/media-url'
import type {
  PublicInvitationPayload,
  PublicInvitationSeo,
  PublicInvitationTheme,
  PublicWishPage,
} from '../lib/public-invitation-types'

const PUBLIC_WISH_PAGE_SIZE = 10
const PIN_GRANT_COOKIE = 'kalamkala_pin_grant'
const PIN_GRANT_TTL_SECONDS = 2 * 60 * 60
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/** Used only when the registry has no template at all; production never hits it. */
const FALLBACK_THEME_TOKENS: ThemeTokens = {
  bgPrimary: '#faf6ee',
  bgSecondary: '#f1e7d4',
  textPrimary: '#2b241c',
  textMuted: '#786650',
  accent: '#7c5a26',
  accentContrast: '#fffaf0',
  border: '#d9c8a6',
}

type Services = {
  logger: LoggerPort
  invitations: D1KVInvitationRepository
  guests: D1GuestRepository
  rsvps: D1RsvpRepository
  reports: D1InvitationReportRepository
  lifecycle: InvitationLifecycleService
  moderation: RsvpModerationService
}

export type PinVerificationResponse = { ok: true } | { ok: false; error: string }
export type RsvpSubmissionResponse = { ok: true } | { ok: false; error: string }
export type ReportInvitationResponse = { ok: true } | { ok: false; error: string }

/* Request plumbing ------------------------------------------------------- */

const currentRequestId = (): string =>
  requestIdFromHeaders(Object.fromEntries(getRequest().headers.entries()))

const resolveSiteUrl = (): string => {
  const configured = env.BETTER_AUTH_URL.trim()
  if (configured.length > 0) return configured.replace(/\/+$/u, '')
  return new URL(getRequest().url).origin
}

const createServices = (requestId: string): Services => {
  const logger = new ConsoleJsonLogger().withRequestId(requestId)
  const db = createAppDatabase(env.DB)
  const cache = new KvCacheAdapter(env.INVITE_KV)
  const rsvps = new D1RsvpRepository({ db, logger })

  return {
    logger,
    invitations: new D1KVInvitationRepository({ db, cache, logger }),
    guests: new D1GuestRepository({ db, logger }),
    rsvps,
    reports: new D1InvitationReportRepository({ db, logger }),
    lifecycle: new InvitationLifecycleService({ clock: systemClock }),
    moderation: new RsvpModerationService({ rsvpRepository: rsvps, clock: systemClock }),
  }
}

/* Payload assembly ------------------------------------------------------- */

const browserPayload = (): PublicInvitationPayload['browser'] => ({
  turnstileSiteKey: env.TURNSTILE_SITE_KEY,
  cdnBaseUrl: env.CDN_BASE_URL,
  siteUrl: resolveSiteUrl(),
})

const defaultAppearance = (manifest: TemplateManifest): AppearanceConfig => {
  const palette = manifest.palettes[0]
  return {
    themeTokens: palette?.tokens ?? FALLBACK_THEME_TOKENS,
    fontPairingId: manifest.id,
    sectionOrder: [...SECTION_IDS],
    hiddenSections: [],
    sectionTitles: {},
  }
}

const buildTheme = (
  entry: TemplateRegistryEntry,
  invitation: StoredInvitation | null,
): PublicInvitationTheme => ({
  templateId: entry.manifest.id,
  fonts: entry.manifest.fonts ?? [],
  appearance: invitation?.appearance ?? defaultAppearance(entry.manifest),
})

const fallbackTheme = (): PublicInvitationTheme => {
  const entry = templateRegistry[0]
  if (entry !== undefined) return buildTheme(entry, null)
  return {
    templateId: '',
    fonts: [],
    appearance: {
      themeTokens: FALLBACK_THEME_TOKENS,
      fontPairingId: 'fallback',
      sectionOrder: [...SECTION_IDS],
      hiddenSections: [],
      sectionTitles: {},
    },
  }
}

const coverImageUrl = (content: MasterInvitation, cdnBaseUrl: string): string | null =>
  resolveMediaUrl(
    cdnBaseUrl,
    content.seoMeta.ogLandscapePhotoKey ?? content.media.gallery[0]?.key ?? null,
  )

const buildSeo = (content: MasterInvitation, cdnBaseUrl: string): PublicInvitationSeo => ({
  title: content.seoMeta.title,
  description: content.seoMeta.description,
  imageUrl: coverImageUrl(content, cdnBaseUrl),
})

/** Private invitations expose only the couple and a cover image before unlock. */
const buildTeaserSeo = (content: MasterInvitation, cdnBaseUrl: string): PublicInvitationSeo => {
  const secondary = content.hosts.secondary?.fullName ?? null
  const couple =
    secondary === null
      ? content.hosts.primary.fullName
      : `${content.hosts.primary.fullName} & ${secondary}`
  return {
    title: `Undangan ${couple}`,
    description: 'Undangan privat. Masukkan PIN untuk membuka undangan ini.',
    imageUrl: coverImageUrl(content, cdnBaseUrl),
  }
}

const toPublicWish = (row: StoredRsvp): PublicWish => ({
  id: row.id,
  guestName: row.guestName,
  message: row.message ?? '',
  createdAt: row.createdAt.toISOString(),
  hostReply: row.hostReply,
})

const loadWishPage = async (
  services: Services,
  invitationId: string,
  cursor: string | null,
  limit: number = PUBLIC_WISH_PAGE_SIZE,
): Promise<PublicWishPage> => {
  const page = await services.rsvps.listPublicPage(invitationId, { cursor, limit })
  return {
    items: page.items.map(toPublicWish).filter((wish) => wish.message.length > 0),
    nextCursor: page.nextCursor,
  }
}

const notFoundPayload = (slug: string): PublicInvitationPayload => ({
  status: 'NOT_FOUND',
  slug,
  seo: {
    title: 'Undangan tidak ditemukan — Kalamkala',
    description: 'Undangan yang Anda cari tidak tersedia atau sudah tidak dipublikasikan.',
    imageUrl: null,
  },
  theme: fallbackTheme(),
  invitation: null,
  wishes: { items: [], nextCursor: null },
  browser: browserPayload(),
})

const expiredPayload = (
  invitation: StoredInvitation,
  entry: TemplateRegistryEntry,
): PublicInvitationPayload => {
  const browser = browserPayload()
  return {
    status: 'EXPIRED',
    slug: invitation.slug,
    seo: buildSeo(invitation.content, browser.cdnBaseUrl),
    theme: buildTheme(entry, invitation),
    invitation: null,
    wishes: { items: [], nextCursor: null },
    browser,
  }
}

const pinRequiredPayload = (
  invitation: StoredInvitation,
  entry: TemplateRegistryEntry,
): PublicInvitationPayload => {
  const browser = browserPayload()
  return {
    status: 'PIN_REQUIRED',
    slug: invitation.slug,
    seo: buildTeaserSeo(invitation.content, browser.cdnBaseUrl),
    theme: buildTheme(entry, invitation),
    invitation: null,
    wishes: { items: [], nextCursor: null },
    browser,
  }
}

const pinEnabled = (content: MasterInvitation): boolean =>
  content.accessControl.isPrivatePinEnabled &&
  content.accessControl.pinCode !== null &&
  content.accessControl.pinCode.length > 0

const resolveGuest = async (
  services: Services,
  invitation: StoredInvitation,
  guestToken: string | undefined,
  recipient: string | undefined,
): Promise<GuestContext | null> => {
  if (guestToken !== undefined && guestToken.length > 0) {
    const stored = await services.guests.findByQrToken(guestToken)
    if (stored !== null && stored.invitationId === invitation.id) {
      return {
        id: stored.id,
        name: recipient !== undefined && recipient.length > 0 ? recipient : stored.name,
        category: stored.category,
        maxPax: stored.maxPax,
        tableNumber: stored.tableNumber,
        sessionLabel: stored.sessionLabel,
        qrToken: stored.qrToken,
      }
    }
  }

  if (recipient !== undefined && recipient.length > 0) {
    return {
      id: null,
      name: recipient,
      category: 'REGULER',
      maxPax: invitation.content.accessControl.defaultMaxPaxPerGuest,
      tableNumber: null,
      sessionLabel: null,
    }
  }

  return null
}

/* PIN grant cookie ------------------------------------------------------- */

const textEncoder = new TextEncoder()

const bytesToBase64Url = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '')
}

const signGrant = async (value: string, secret: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(value))
  return bytesToBase64Url(new Uint8Array(signature))
}

const timingSafeEqual = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

const createPinGrant = async (
  slug: string,
  secret: string,
): Promise<{ value: string; maxAge: number }> => {
  const expiresAt = Math.floor(Date.now() / 1000) + PIN_GRANT_TTL_SECONDS
  const signature = await signGrant(`${slug}:${expiresAt}`, secret)
  return { value: `${expiresAt}.${signature}`, maxAge: PIN_GRANT_TTL_SECONDS }
}

const hasPinGrant = async (slug: string, secret: string): Promise<boolean> => {
  const raw = getCookie(PIN_GRANT_COOKIE)
  if (raw === undefined) return false

  const separator = raw.indexOf('.')
  if (separator <= 0) return false

  const expiresAtText = raw.slice(0, separator)
  const expiresAt = Number(expiresAtText)
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false

  const expected = await signGrant(`${slug}:${expiresAtText}`, secret)
  return timingSafeEqual(expected, raw.slice(separator + 1))
}

const writePinGrant = (slug: string, grant: { value: string; maxAge: number }): void => {
  setCookie(PIN_GRANT_COOKIE, grant.value, {
    httpOnly: true,
    sameSite: 'lax',
    path: `/u/${slug}`,
    maxAge: grant.maxAge,
    secure: resolveSiteUrl().startsWith('https:'),
  })
}

/* Turnstile and reporter hashing ---------------------------------------- */

const turnstileResponseSchema = z.object({ success: z.boolean() })

const clientIp = (): string | null => {
  try {
    const forwarded = getRequestIP({ xForwardedFor: true })
    if (forwarded !== undefined && forwarded.length > 0) return forwarded
    return getRequest().headers.get('cf-connecting-ip')
  } catch {
    return null
  }
}

const verifyTurnstile = async (token: string, remoteIp: string | null): Promise<boolean> => {
  const body = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: token,
  })
  if (remoteIp !== null) body.set('remoteip', remoteIp)

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, { method: 'POST', body })
    if (!response.ok) return false
    const parsed = turnstileResponseSchema.safeParse(await response.json())
    return parsed.success && parsed.data.success
  } catch {
    return false
  }
}

const hashReporter = async (remoteIp: string | null): Promise<string> => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    textEncoder.encode(`${remoteIp ?? 'unknown'}:${env.BETTER_AUTH_SECRET}`),
  )
  return [...new Uint8Array(digest).slice(0, 8)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/* Validators ------------------------------------------------------------- */

const publicInvitationInputSchema = z.object({
  slug: z.string().trim().min(1).max(200),
  to: z.string().max(200).optional(),
  g: z.string().max(200).optional(),
})

const verifyPinInputSchema = z.object({
  slug: z.string().trim().min(1).max(200),
  pin: z.string().trim().min(4).max(6),
})

const submitRsvpInputSchema = z.object({
  slug: z.string().trim().min(1).max(200),
  guestName: z.string().trim().min(1).max(120),
  attendance: rsvpAttendanceSchema,
  guestCount: z.number().int().min(1).max(20),
  message: z.string().max(1000),
  turnstileToken: z.string().min(1).max(4096),
  guestToken: z.string().min(1).max(200).optional(),
})

const loadMoreWishesInputSchema = z.object({
  slug: z.string().trim().min(1).max(200),
  cursor: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(20).optional(),
})

const reportInvitationInputSchema = z.object({
  slug: z.string().trim().min(1).max(200),
  reason: invitationReportReasonSchema,
  note: z.string().max(1000).optional(),
  turnstileToken: z.string().min(1).max(4096),
})

/* Server functions ------------------------------------------------------- */

/** Public page payload. Never includes the invitation PIN. */
export const getPublicInvitation = createServerFn({ method: 'GET' })
  .validator((input: unknown) => publicInvitationInputSchema.parse(input))
  .handler(async ({ data }): Promise<PublicInvitationPayload> => {
    const services = createServices(currentRequestId())

    try {
      const invitation = await services.invitations.findBySlug(data.slug)
      if (invitation === null) return notFoundPayload(data.slug)

      const entry = templateRegistry.find(
        (candidate) => candidate.manifest.id === invitation.templateId,
      )
      if (entry === undefined) {
        services.logger.warn('public-invitation.template-missing', {
          slug: data.slug,
          templateId: invitation.templateId,
        })
        return notFoundPayload(data.slug)
      }

      const lifecycle = services.lifecycle.resolve(invitation)
      if (lifecycle === 'PREVIEW') return notFoundPayload(data.slug)
      if (lifecycle === 'EXPIRED') return expiredPayload(invitation, entry)

      if (pinEnabled(invitation.content)) {
        const granted = await hasPinGrant(invitation.slug, env.BETTER_AUTH_SECRET)
        if (!granted) return pinRequiredPayload(invitation, entry)
      }

      const browser = browserPayload()
      const guest = await resolveGuest(services, invitation, data.g, data.to)
      const wishes = invitation.content.settings.showPublicWishes
        ? await loadWishPage(services, invitation.id, null)
        : { items: [], nextCursor: null }

      return {
        status: lifecycle,
        slug: invitation.slug,
        seo: buildSeo(invitation.content, browser.cdnBaseUrl),
        theme: buildTheme(entry, invitation),
        invitation: {
          content: invitation.content,
          guest,
          pinEnabled: pinEnabled(invitation.content),
        },
        wishes,
        browser,
      }
    } catch (error) {
      services.logger.error('public-invitation.load-failed', { slug: data.slug, err: error })
      return notFoundPayload(data.slug)
    }
  })

/** Checks the invitation PIN and, on success, writes a short-lived signed grant. */
export const verifyPin = createServerFn({ method: 'POST' })
  .validator((input: unknown) => verifyPinInputSchema.parse(input))
  .handler(async ({ data }): Promise<PinVerificationResponse> => {
    const services = createServices(currentRequestId())

    try {
      const invitation = await services.invitations.findBySlug(data.slug)
      if (invitation === null) return { ok: false, error: 'Undangan tidak ditemukan.' }

      const access = invitation.content.accessControl
      if (!pinEnabled(invitation.content) || access.pinCode === null) {
        return { ok: false, error: 'Undangan ini tidak memerlukan PIN.' }
      }
      if (!timingSafeEqual(access.pinCode, data.pin)) {
        services.logger.warn('public-invitation.pin-rejected', { slug: data.slug })
        return { ok: false, error: 'PIN salah, silakan coba lagi.' }
      }

      writePinGrant(
        invitation.slug,
        await createPinGrant(invitation.slug, env.BETTER_AUTH_SECRET),
      )
      return { ok: true }
    } catch (error) {
      services.logger.error('public-invitation.pin-failed', { slug: data.slug, err: error })
      return { ok: false, error: 'PIN tidak dapat diverifikasi. Silakan coba lagi.' }
    }
  })

/** Turnstile-gated RSVP submission. Moderation and limits live in app-core. */
export const submitRsvp = createServerFn({ method: 'POST' })
  .validator((input: unknown) => submitRsvpInputSchema.parse(input))
  .handler(async ({ data }): Promise<RsvpSubmissionResponse> => {
    const services = createServices(currentRequestId())

    try {
      const remoteIp = clientIp()
      const captchaOk = await verifyTurnstile(data.turnstileToken, remoteIp)
      if (!captchaOk) {
        return { ok: false, error: 'Verifikasi keamanan gagal. Silakan coba lagi.' }
      }

      const invitation = await services.invitations.findBySlug(data.slug)
      if (invitation === null) return { ok: false, error: 'Undangan tidak ditemukan.' }

      const lifecycle = services.lifecycle.resolve(invitation)
      if (invitation.status !== 'ACTIVE' || lifecycle === 'EXPIRED') {
        return { ok: false, error: 'Undangan belum aktif atau sudah berakhir.' }
      }

      let guest: StoredGuest | null = null
      if (data.guestToken !== undefined) {
        const candidate = await services.guests.findByQrToken(data.guestToken)
        if (candidate !== null && candidate.invitationId === invitation.id) guest = candidate
      }
      const maxPax = guest?.maxPax ?? invitation.content.accessControl.defaultMaxPaxPerGuest

      await services.moderation.submit({
        invitationId: invitation.id,
        guestId: guest?.id ?? null,
        guestName: data.guestName,
        attendance: data.attendance,
        guestCount: data.guestCount,
        message: data.message,
        maxPax,
      })

      services.logger.info('public-invitation.rsvp-created', {
        slug: invitation.slug,
        guestId: guest?.id ?? null,
      })
      return { ok: true }
    } catch (error) {
      if (error instanceof RsvpValidationError) {
        return {
          ok: false,
          error:
            error.code === 'MAX_PAX_EXCEEDED'
              ? 'Jumlah tamu melebihi batas yang diperbolehkan.'
              : 'Jumlah tamu tidak valid.',
        }
      }
      services.logger.error('public-invitation.rsvp-failed', { slug: data.slug, err: error })
      return { ok: false, error: 'Konfirmasi gagal dikirim. Silakan coba lagi.' }
    }
  })

/** Public wishes wall pagination; hidden rows never leave the repository. */
export const loadMoreWishes = createServerFn({ method: 'GET' })
  .validator((input: unknown) => loadMoreWishesInputSchema.parse(input))
  .handler(async ({ data }): Promise<PublicWishPage> => {
    const services = createServices(currentRequestId())

    try {
      const invitation = await services.invitations.findBySlug(data.slug)
      if (invitation === null) return { items: [], nextCursor: null }
      if (invitation.status !== 'ACTIVE') return { items: [], nextCursor: null }
      if (services.lifecycle.resolve(invitation) === 'EXPIRED') {
        return { items: [], nextCursor: null }
      }
      if (!invitation.content.settings.showPublicWishes) {
        return { items: [], nextCursor: null }
      }
      return await loadWishPage(
        services,
        invitation.id,
        data.cursor ?? null,
        data.limit ?? PUBLIC_WISH_PAGE_SIZE,
      )
    } catch (error) {
      services.logger.error('public-invitation.wishes-failed', { slug: data.slug, err: error })
      return { items: [], nextCursor: null }
    }
  })

/** Abuse reports are rate-limited by Turnstile and identified only by a hash. */
export const reportInvitation = createServerFn({ method: 'POST' })
  .validator((input: unknown) => reportInvitationInputSchema.parse(input))
  .handler(async ({ data }): Promise<ReportInvitationResponse> => {
    const services = createServices(currentRequestId())

    try {
      const remoteIp = clientIp()
      const captchaOk = await verifyTurnstile(data.turnstileToken, remoteIp)
      if (!captchaOk) {
        return { ok: false, error: 'Verifikasi keamanan gagal. Silakan coba lagi.' }
      }

      const invitation = await services.invitations.findBySlug(data.slug)
      if (invitation === null) return { ok: false, error: 'Undangan tidak ditemukan.' }

      await services.reports.create({
        id: crypto.randomUUID(),
        invitationId: invitation.id,
        reason: data.reason,
        note: data.note ?? null,
        reporterHash: await hashReporter(remoteIp),
      })

      services.logger.info('public-invitation.reported', {
        slug: invitation.slug,
        reason: data.reason,
      })
      return { ok: true }
    } catch (error) {
      services.logger.error('public-invitation.report-failed', { slug: data.slug, err: error })
      return { ok: false, error: 'Laporan gagal dikirim. Silakan coba lagi.' }
    }
  })
