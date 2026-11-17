import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import {
  getCookie,
  getRequest,
  getRequestIP,
  setCookie,
} from '@tanstack/react-start/server'
import { z } from 'zod'

import {
  ConsoleJsonLogger,
  D1CollaboratorRepository,
  D1GuestRepository,
  D1KVInvitationRepository,
  D1RsvpRepository,
  KvCacheAdapter,
  createAppDatabase,
  requestIdFromHeaders,
} from '@kalamkala/adapters-cloudflare'
import type { CachePort, LoggerPort, StoredCollaborator, StoredRsvp } from '@kalamkala/app-core'
import type { RsvpAttendance, WaSentStatus } from '@kalamkala/contracts'

export type CollaboratorEntry =
  | { ok: true; label: string; invitationTitle: string; expired: boolean }
  | { ok: false; error: string }

export type CollaboratorPinResult = { ok: true } | { ok: false; error: string }

export type CollaboratorPortalGuest = {
  id: string
  name: string
  category: string
  maxPax: number
  waSentStatus: WaSentStatus
}

export type CollaboratorPortalRsvp = {
  id: string
  guestName: string
  attendance: RsvpAttendance
  guestCount: number
  message: string | null
  createdAt: Date
}

export type CollaboratorPortalData = {
  label: string
  invitation: { id: string; slug: string; title: string }
  guests: CollaboratorPortalGuest[]
  rsvps: CollaboratorPortalRsvp[]
  summary: { hadir: number; tidakHadir: number; ragu: number; totalPax: number }
}

const COLLABORATOR_COOKIE = 'kalamkala_collab'
const COLLABORATOR_TTL_SECONDS = 2 * 60 * 60
const PIN_ATTEMPT_LIMIT = 5
const PIN_ATTEMPT_TTL_SECONDS = 600

const textEncoder = new TextEncoder()

type PortalServices = {
  requestId: string
  logger: LoggerPort
  cache: CachePort
  collaborators: D1CollaboratorRepository
  invitations: D1KVInvitationRepository
  guests: D1GuestRepository
  rsvps: D1RsvpRepository
}

const readRequestId = (): string =>
  requestIdFromHeaders(Object.fromEntries(getRequest().headers.entries()))

const resolveSiteUrl = (): string => {
  const configured = env.BETTER_AUTH_URL.trim()
  if (configured.length > 0) return configured.replace(/\/+$/u, '')
  return new URL(getRequest().url).origin
}

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(value))
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

const hmacBase64Url = async (value: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(env.BETTER_AUTH_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(value))
  let binary = ''
  for (const byte of new Uint8Array(signature)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '')
}

const timingSafeEqual = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

const isExpired = (collaborator: StoredCollaborator): boolean =>
  collaborator.expiresAt !== null && collaborator.expiresAt.getTime() <= Date.now()

const clientIp = (): string | null => {
  try {
    const cfIp = getRequest().headers.get('cf-connecting-ip')
    if (cfIp !== null && cfIp.length > 0) return cfIp
    const forwarded = getRequestIP({ xForwardedFor: true })
    return forwarded !== undefined && forwarded.length > 0 ? forwarded : null
  } catch {
    return null
  }
}

const createPortalServices = (): PortalServices => {
  const requestId = readRequestId()
  const logger = new ConsoleJsonLogger().withRequestId(requestId)
  const db = createAppDatabase(env.DB)
  const cache = new KvCacheAdapter(env.INVITE_KV)

  return {
    requestId,
    logger,
    cache,
    collaborators: new D1CollaboratorRepository({ db }),
    invitations: new D1KVInvitationRepository({ db, cache, logger }),
    guests: new D1GuestRepository({ db, logger }),
    rsvps: new D1RsvpRepository({ db, logger }),
  }
}

/* Signed cookie --------------------------------------------------------- */

const createGrant = async (token: string): Promise<{ value: string; maxAge: number }> => {
  const expiresAt = Math.floor(Date.now() / 1000) + COLLABORATOR_TTL_SECONDS
  const signature = await hmacBase64Url(`${token}:${expiresAt}`)
  return { value: `${expiresAt}.${signature}`, maxAge: COLLABORATOR_TTL_SECONDS }
}

const hasValidGrant = async (token: string): Promise<boolean> => {
  const raw = getCookie(COLLABORATOR_COOKIE)
  if (raw === undefined) return false

  const separator = raw.indexOf('.')
  if (separator <= 0) return false

  const expiresAtText = raw.slice(0, separator)
  const expiresAt = Number(expiresAtText)
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    return false
  }

  const expected = await hmacBase64Url(`${token}:${expiresAtText}`)
  return timingSafeEqual(expected, raw.slice(separator + 1))
}

const writeGrant = (token: string, grant: { value: string; maxAge: number }): void => {
  setCookie(COLLABORATOR_COOKIE, grant.value, {
    httpOnly: true,
    sameSite: 'lax',
    path: `/kolaborator/${token}`,
    maxAge: grant.maxAge,
    secure: resolveSiteUrl().startsWith('https:'),
  })
}

/* PIN throttling -------------------------------------------------------- */

const pinAttemptKey = async (token: string): Promise<string> => {
  const fingerprint = (
    await sha256Hex(`${clientIp() ?? 'unknown'}:${env.BETTER_AUTH_SECRET}`)
  ).slice(0, 16)
  return `collab-pin-attempts:${token}:${fingerprint}`
}

const readPinAttempts = async (services: PortalServices, key: string): Promise<number> => {
  try {
    const raw = await services.cache.get(key)
    if (raw === null) return 0
    const failures = Number.parseInt(raw, 10)
    return Number.isFinite(failures) && failures > 0 ? failures : 0
  } catch (error) {
    services.logger.warn('collaborator.portal.throttle-read-failed', { err: error })
    return 0
  }
}

const recordPinFailure = async (
  services: PortalServices,
  key: string,
  failures: number,
): Promise<void> => {
  try {
    await services.cache.put(key, String(failures + 1), PIN_ATTEMPT_TTL_SECONDS)
  } catch (error) {
    services.logger.warn('collaborator.portal.throttle-write-failed', { err: error })
  }
}

const clearPinFailures = async (services: PortalServices, key: string): Promise<void> => {
  try {
    await services.cache.delete(key)
  } catch (error) {
    services.logger.warn('collaborator.portal.throttle-clear-failed', { err: error })
  }
}

const summarize = (
  rsvps: readonly StoredRsvp[],
): CollaboratorPortalData['summary'] => {
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

/* Server functions ------------------------------------------------------ */

const tokenSchema = z.object({ token: z.string().trim().min(1).max(200) })

export const getCollaboratorEntry = createServerFn({ method: 'GET' })
  .validator((input: unknown) => tokenSchema.parse(input))
  .handler(async ({ data }): Promise<CollaboratorEntry> => {
    const services = createPortalServices()
    try {
      const collaborator = await services.collaborators.findByAccessToken(data.token)
      if (collaborator === null) {
        return { ok: false, error: 'Akses kolaborator tidak ditemukan.' }
      }

      const invitation = await services.invitations.findById(collaborator.invitationId)
      if (invitation === null) {
        return { ok: false, error: 'Undangan tidak ditemukan.' }
      }

      return {
        ok: true,
        label: collaborator.label,
        invitationTitle: invitation.content.seoMeta.title,
        expired: isExpired(collaborator),
      }
    } catch (error) {
      services.logger.error('collaborator.portal.entry-failed', { err: error })
      return { ok: false, error: 'Akses kolaborator tidak dapat dibuka.' }
    }
  })

export const verifyCollaboratorPin = createServerFn({ method: 'POST' })
  .validator((input: unknown) =>
    z
      .object({
        token: z.string().trim().min(1).max(200),
        pin: z.string().trim().min(4).max(6),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<CollaboratorPinResult> => {
    const services = createPortalServices()
    try {
      const collaborator = await services.collaborators.findByAccessToken(data.token)
      if (collaborator === null) {
        return { ok: false, error: 'Akses kolaborator tidak ditemukan.' }
      }
      if (isExpired(collaborator)) {
        return { ok: false, error: 'Akses kolaborator sudah berakhir.' }
      }
      if (collaborator.pinHash === null) {
        return { ok: false, error: 'Akses kolaborator tidak valid.' }
      }

      const attemptKey = await pinAttemptKey(data.token)
      const failures = await readPinAttempts(services, attemptKey)
      if (failures >= PIN_ATTEMPT_LIMIT) {
        services.logger.warn('collaborator.portal.pin-throttled', {
          collaboratorId: collaborator.id,
        })
        return { ok: false, error: 'Terlalu banyak percobaan PIN. Coba lagi nanti.' }
      }

      const expected = await sha256Hex(`${data.token}:${data.pin}`)
      if (!timingSafeEqual(expected, collaborator.pinHash)) {
        await recordPinFailure(services, attemptKey, failures)
        services.logger.warn('collaborator.portal.pin-rejected', {
          collaboratorId: collaborator.id,
        })
        return { ok: false, error: 'PIN salah, silakan coba lagi.' }
      }

      await clearPinFailures(services, attemptKey)
      writeGrant(data.token, await createGrant(data.token))
      services.logger.info('collaborator.portal.unlocked', { collaboratorId: collaborator.id })
      return { ok: true }
    } catch (error) {
      services.logger.error('collaborator.portal.pin-failed', { err: error })
      return { ok: false, error: 'PIN tidak dapat diverifikasi. Silakan coba lagi.' }
    }
  })

export const getCollaboratorPortalData = createServerFn({ method: 'GET' })
  .validator((input: unknown) => tokenSchema.parse(input))
  .handler(async ({ data }): Promise<CollaboratorPortalData | null> => {
    const services = createPortalServices()
    try {
      const collaborator = await services.collaborators.findByAccessToken(data.token)
      if (collaborator === null || isExpired(collaborator)) return null
      if (!(await hasValidGrant(data.token))) return null

      const invitation = await services.invitations.findById(collaborator.invitationId)
      if (invitation === null) return null

      const [guests, rsvps] = await Promise.all([
        services.guests.listByInvitation(invitation.id),
        services.rsvps.listByInvitation(invitation.id),
      ])

      return {
        label: collaborator.label,
        invitation: {
          id: invitation.id,
          slug: invitation.slug,
          title: invitation.content.seoMeta.title,
        },
        guests: guests.map((guest) => ({
          id: guest.id,
          name: guest.name,
          category: guest.category,
          maxPax: guest.maxPax,
          waSentStatus: guest.waSentStatus,
        })),
        rsvps: rsvps.map((rsvp) => ({
          id: rsvp.id,
          guestName: rsvp.guestName,
          attendance: rsvp.attendance,
          guestCount: rsvp.guestCount,
          message: rsvp.message,
          createdAt: rsvp.createdAt,
        })),
        summary: summarize(rsvps),
      }
    } catch (error) {
      services.logger.error('collaborator.portal.data-failed', { err: error })
      return null
    }
  })
