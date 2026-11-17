import type {
  CachePort,
  CreateInvitationInput,
  InvitationRepository,
  LoggerPort,
  StoredInvitation,
} from '@kalamkala/app-core'
import {
  AppearanceConfigSchema,
  MasterInvitationSchema,
  invitationStatusSchema,
  invitationTierSchema,
} from '@kalamkala/contracts'
import type { AppearanceConfig, InvitationStatus, MasterInvitation } from '@kalamkala/contracts'
import { invitations } from '@kalamkala/db-schema'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'

import type { AppDatabase } from './database.js'

export type D1InvitationRepositoryOptions = {
  db: AppDatabase
  cache: CachePort
  logger?: LoggerPort
  /** Cache lifetime for published invitations. Defaults to one hour. */
  cacheTtlSeconds?: number
}

const DEFAULT_CACHE_TTL_SECONDS = 3600

const cacheKeyForSlug = (slug: string): string => `invitation:slug:${slug}`

/**
 * Cache wire format: dates are ISO strings and the content document is carried
 * as-is. Parsed back through the same contract schemas as the database path, so
 * a cache hit cannot introduce a shape the rest of the app does not expect.
 */
const CachedInvitationSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  slug: z.string().min(1),
  templateId: z.string().min(1),
  tier: invitationTierSchema,
  status: invitationStatusSchema,
  content: MasterInvitationSchema,
  appearance: AppearanceConfigSchema.nullable(),
  whatsappTemplate: z.string().nullable(),
  publishedAt: z.iso.datetime().nullable(),
  expiresAt: z.iso.datetime().nullable(),
})

type InvitationRow = typeof invitations.$inferSelect

const toCachedInvitation = (invitation: StoredInvitation) => ({
  id: invitation.id,
  userId: invitation.userId,
  slug: invitation.slug,
  templateId: invitation.templateId,
  tier: invitation.tier,
  status: invitation.status,
  content: invitation.content,
  appearance: invitation.appearance,
  whatsappTemplate: invitation.whatsappTemplate,
  publishedAt: invitation.publishedAt?.toISOString() ?? null,
  expiresAt: invitation.expiresAt?.toISOString() ?? null,
})

const readCachedInvitation = (raw: unknown): StoredInvitation => {
  const parsed = CachedInvitationSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`cached invitation is invalid: ${parsed.error.message}`)
  }

  const { publishedAt, expiresAt, ...rest } = parsed.data
  return {
    ...rest,
    publishedAt: publishedAt === null ? null : new Date(publishedAt),
    expiresAt: expiresAt === null ? null : new Date(expiresAt),
  }
}

const parseContentJson = (contentJson: string, invitationId: string): MasterInvitation => {
  let raw: unknown
  try {
    raw = JSON.parse(contentJson)
  } catch (error) {
    throw new Error(`Invitation ${invitationId} has unreadable content_json`, { cause: error })
  }

  const parsed = MasterInvitationSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(
      `Invitation ${invitationId} has invalid content_json: ${parsed.error.message}`,
    )
  }
  return parsed.data
}

const parseAppearanceJson = (
  appearanceJson: string | null,
  invitationId: string,
): AppearanceConfig | null => {
  if (appearanceJson === null) return null

  let raw: unknown
  try {
    raw = JSON.parse(appearanceJson)
  } catch (error) {
    throw new Error(`Invitation ${invitationId} has unreadable appearance_json`, { cause: error })
  }

  const parsed = AppearanceConfigSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(
      `Invitation ${invitationId} has invalid appearance_json: ${parsed.error.message}`,
    )
  }
  return parsed.data
}

/**
 * D1-backed invitations with a KV cache-aside layer for the public page.
 *
 * Only published (`ACTIVE`) rows are cached, and every write invalidates the
 * slug key so a draft or a take-down cannot be served from stale cache.
 */
export class D1KVInvitationRepository implements InvitationRepository {
  private readonly db: AppDatabase
  private readonly cache: CachePort
  private readonly logger: LoggerPort | undefined
  private readonly cacheTtlSeconds: number

  constructor(options: D1InvitationRepositoryOptions) {
    this.db = options.db
    this.cache = options.cache
    this.logger = options.logger
    this.cacheTtlSeconds = options.cacheTtlSeconds ?? DEFAULT_CACHE_TTL_SECONDS
  }

  async findById(id: string): Promise<StoredInvitation | null> {
    const row = await this.db.query.invitations.findFirst({
      where: eq(invitations.id, id),
    })
    return row === undefined ? null : this.toStoredInvitation(row)
  }

  async findBySlug(slug: string): Promise<StoredInvitation | null> {
    const cached = await this.readCache(cacheKeyForSlug(slug))
    if (cached !== null) return cached

    const row = await this.db.query.invitations.findFirst({
      where: eq(invitations.slug, slug),
    })
    if (row === undefined) return null

    const invitation = this.toStoredInvitation(row)
    if (invitation.status === 'ACTIVE') {
      await this.writeCache(invitation)
    }
    return invitation
  }

  /** Owner dashboard list: D1 only, deliberately not cached. */
  async listByUserId(userId: string): Promise<StoredInvitation[]> {
    const rows = await this.db
      .select()
      .from(invitations)
      .where(eq(invitations.userId, userId))
      .orderBy(desc(invitations.createdAt), desc(invitations.id))
    return rows.map((row) => this.toStoredInvitation(row))
  }

  async create(input: CreateInvitationInput): Promise<StoredInvitation> {
    const rows = await this.db
      .insert(invitations)
      .values({
        id: input.id,
        userId: input.userId,
        slug: input.slug,
        templateId: input.templateId,
        tier: input.tier,
        status: input.status,
        contentJson: JSON.stringify(input.content),
        appearanceJson: input.appearance === null ? null : JSON.stringify(input.appearance),
        whatsappTemplate: input.whatsappTemplate,
        publishedAt: input.publishedAt,
        expiresAt: input.expiresAt,
      })
      .returning()

    const row = rows[0]
    if (row === undefined) {
      throw new Error(`Failed to create invitation ${input.id}`)
    }
    return this.toStoredInvitation(row)
  }

  async updateContent(id: string, content: MasterInvitation): Promise<void> {
    const rows = await this.db
      .update(invitations)
      .set({ contentJson: JSON.stringify(content), updatedAt: new Date() })
      .where(eq(invitations.id, id))
      .returning()

    const row = rows[0]
    if (row === undefined) {
      throw new Error(`Invitation ${id} not found`)
    }
    await this.cache.delete(cacheKeyForSlug(row.slug))
  }

  async updateAppearance(id: string, appearance: AppearanceConfig | null): Promise<void> {
    const rows = await this.db
      .update(invitations)
      .set({
        appearanceJson: appearance === null ? null : JSON.stringify(appearance),
        updatedAt: new Date(),
      })
      .where(eq(invitations.id, id))
      .returning({ slug: invitations.slug })

    const row = rows[0]
    if (row === undefined) {
      throw new Error(`Invitation ${id} not found`)
    }
    await this.cache.delete(cacheKeyForSlug(row.slug))
  }

  async setWhatsappTemplate(id: string, template: string | null): Promise<void> {
    const rows = await this.db
      .update(invitations)
      .set({ whatsappTemplate: template, updatedAt: new Date() })
      .where(eq(invitations.id, id))
      .returning({ slug: invitations.slug })

    const row = rows[0]
    if (row === undefined) {
      throw new Error(`Invitation ${id} not found`)
    }
    await this.cache.delete(cacheKeyForSlug(row.slug))
  }

  async updateTier(id: string, tier: StoredInvitation['tier']): Promise<void> {
    const rows = await this.db
      .update(invitations)
      .set({ tier, updatedAt: new Date() })
      .where(eq(invitations.id, id))
      .returning({ slug: invitations.slug })

    const row = rows[0]
    if (row === undefined) {
      throw new Error(`Invitation ${id} not found`)
    }
    await this.cache.delete(cacheKeyForSlug(row.slug))
  }

  async setStatus(
    id: string,
    status: InvitationStatus,
    publishedAt: Date | null,
  ): Promise<void> {
    const rows = await this.db
      .update(invitations)
      .set({ status, publishedAt, updatedAt: new Date() })
      .where(eq(invitations.id, id))
      .returning()

    const row = rows[0]
    if (row === undefined) {
      throw new Error(`Invitation ${id} not found`)
    }
    await this.cache.delete(cacheKeyForSlug(row.slug))
  }

  async refreshCache(id: string): Promise<void> {
    const row = await this.db.query.invitations.findFirst({
      where: eq(invitations.id, id),
    })
    if (row === undefined) return

    const invitation = this.toStoredInvitation(row)
    if (invitation.status !== 'ACTIVE') {
      await this.cache.delete(cacheKeyForSlug(invitation.slug))
      return
    }
    await this.writeCache(invitation)
  }

  async invalidateCache(id: string): Promise<void> {
    const rows = await this.db
      .select({ slug: invitations.slug })
      .from(invitations)
      .where(eq(invitations.id, id))
      .limit(1)

    const row = rows[0]
    if (row === undefined) return
    await this.cache.delete(cacheKeyForSlug(row.slug))
  }

  private toStoredInvitation(row: InvitationRow): StoredInvitation {
    return {
      id: row.id,
      userId: row.userId,
      slug: row.slug,
      templateId: row.templateId,
      tier: row.tier,
      status: row.status,
      content: parseContentJson(row.contentJson, row.id),
      appearance: parseAppearanceJson(row.appearanceJson, row.id),
      whatsappTemplate: row.whatsappTemplate,
      publishedAt: row.publishedAt,
      expiresAt: row.expiresAt,
    }
  }

  private async readCache(key: string): Promise<StoredInvitation | null> {
    let payload: string | null
    try {
      payload = await this.cache.get(key)
    } catch (error) {
      this.logger?.warn('Invitation cache read failed', { cacheKey: key, err: error })
      return null
    }

    if (payload === null) return null

    try {
      return readCachedInvitation(JSON.parse(payload) as unknown)
    } catch (error) {
      this.logger?.warn('Discarding invalid invitation cache entry', {
        cacheKey: key,
        err: error,
      })
      return null
    }
  }

  private async writeCache(invitation: StoredInvitation): Promise<void> {
    if (invitation.status !== 'ACTIVE') return

    const key = cacheKeyForSlug(invitation.slug)
    let payload: string
    try {
      payload = JSON.stringify(toCachedInvitation(invitation))
    } catch (error) {
      this.logger?.warn('Invitation cache serialization failed', { cacheKey: key, err: error })
      return
    }

    try {
      await this.cache.put(key, payload, this.cacheTtlSeconds)
    } catch (error) {
      this.logger?.warn('Invitation cache write failed', { cacheKey: key, err: error })
    }
  }
}
