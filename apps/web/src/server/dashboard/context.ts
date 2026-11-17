import { env } from 'cloudflare:workers'
import { getRequest, getRequestHeaders } from '@tanstack/react-start/server'

import {
  ConsoleJsonLogger,
  D1CollaboratorRepository,
  D1GuestRepository,
  D1KVInvitationRepository,
  D1PromoRepository,
  D1RsvpRepository,
  D1TransactionRepository,
  D1UserRepository,
  KvCacheAdapter,
  createAppDatabase,
  requestIdFromHeaders,
} from '@kalamkala/adapters-cloudflare'
import {
  InvitationLifecycleService,
  PaymentActivationService,
  RsvpModerationService,
  systemClock,
} from '@kalamkala/app-core'
import type { CachePort, LoggerPort, StoredInvitation, UserRepository } from '@kalamkala/app-core'
import type { UserRole } from '@kalamkala/contracts'

import { getAuth } from '../../lib/auth'

export type DashboardSessionUser = {
  id: string
  name: string
  email: string
  role: UserRole
}

export type DashboardServices = {
  requestId: string
  logger: LoggerPort
  cache: CachePort
  users: UserRepository
  invitations: D1KVInvitationRepository
  guests: D1GuestRepository
  rsvps: D1RsvpRepository
  transactions: D1TransactionRepository
  promos: D1PromoRepository
  collaborators: D1CollaboratorRepository
  lifecycle: InvitationLifecycleService
  moderation: RsvpModerationService
  activation: PaymentActivationService
}

const textEncoder = new TextEncoder()

export const readRequestId = (): string =>
  requestIdFromHeaders(Object.fromEntries(getRequest().headers.entries()))

export const resolveSiteUrl = (): string => {
  const configured = env.BETTER_AUTH_URL.trim()
  if (configured.length > 0) return configured.replace(/\/+$/u, '')
  return new URL(getRequest().url).origin
}

export const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(value))
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/** Session read through Better Auth plus the typed user profile port. */
export const getDashboardSession = async (): Promise<DashboardSessionUser | null> => {
  const session = await getAuth().api.getSession({ headers: getRequestHeaders() })
  if (session === null) return null

  const user = await new D1UserRepository({ db: createAppDatabase(env.DB) }).findById(
    session.user.id,
  )
  if (user === null) return null

  return { id: user.id, name: user.name, email: user.email, role: user.role }
}

export const createDashboardServices = (): DashboardServices => {
  const requestId = readRequestId()
  const logger = new ConsoleJsonLogger().withRequestId(requestId)
  const db = createAppDatabase(env.DB)
  const cache = new KvCacheAdapter(env.INVITE_KV)
  const invitations = new D1KVInvitationRepository({ db, cache, logger })
  const rsvps = new D1RsvpRepository({ db, logger })
  const transactions = new D1TransactionRepository({ db, logger })

  return {
    requestId,
    logger,
    cache,
    users: new D1UserRepository({ db }),
    invitations,
    guests: new D1GuestRepository({ db, logger }),
    rsvps,
    transactions,
    promos: new D1PromoRepository({ db }),
    collaborators: new D1CollaboratorRepository({ db }),
    lifecycle: new InvitationLifecycleService({ clock: systemClock }),
    moderation: new RsvpModerationService({ rsvpRepository: rsvps, clock: systemClock }),
    activation: new PaymentActivationService({
      transactionRepository: transactions,
      invitationRepository: invitations,
      clock: systemClock,
      logger,
    }),
  }
}

/** Owner gate for every dashboard action; null means "not found or not yours". */
export const requireOwnedInvitation = async (
  invitationId: string,
  userId: string,
  services: DashboardServices = createDashboardServices(),
): Promise<StoredInvitation | null> => {
  const invitation = await services.invitations.findById(invitationId)
  if (invitation === null || invitation.userId !== userId) return null
  return invitation
}

export type R2UploadConfig = {
  accountId: string
  bucketName: string
  accessKeyId: string
  secretAccessKey: string
  cdnBaseUrl: string
}

const DEFAULT_R2_BUCKET = 'kalamkala-media'

/**
 * R2 S3 credentials are Worker secrets, not bindings, so they are absent from
 * the generated Env type. Read them narrowly and treat missing values as
 * "uploads not configured" instead of failing the editor page.
 */
export const readR2UploadConfig = (): R2UploadConfig | null => {
  const source = env as unknown as Readonly<Record<string, unknown>>
  const read = (key: string): string | null => {
    const value = source[key]
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
  }

  const accountId = read('R2_ACCOUNT_ID')
  const accessKeyId = read('R2_ACCESS_KEY_ID')
  const secretAccessKey = read('R2_SECRET_ACCESS_KEY')
  const cdnBaseUrl = read('CDN_BASE_URL')
  if (accountId === null || accessKeyId === null || secretAccessKey === null || cdnBaseUrl === null) {
    return null
  }

  return {
    accountId,
    bucketName: read('R2_BUCKET_NAME') ?? DEFAULT_R2_BUCKET,
    accessKeyId,
    secretAccessKey,
    cdnBaseUrl,
  }
}
