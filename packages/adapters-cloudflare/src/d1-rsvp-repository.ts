import type {
  CreateRsvpInput,
  LoggerPort,
  RsvpPage,
  RsvpPageOptions,
  RsvpRepository,
  StoredRsvp,
} from '@kalamkala/app-core'
import { rsvps } from '@kalamkala/db-schema'
import { and, desc, eq, lt, or } from 'drizzle-orm'

import type { AppDatabase } from './database.js'

export type D1RsvpRepositoryOptions = {
  db: AppDatabase
  logger?: LoggerPort
}

type RsvpRow = typeof rsvps.$inferSelect

const PUBLIC_PAGE_MAX_LIMIT = 20
const PUBLIC_PAGE_DEFAULT_LIMIT = 20

type PublicCursor = { createdAt: Date; id: string }

/** Internal cursor: epoch milliseconds plus the row id, so ties stay stable. */
const encodeCursor = (row: RsvpRow): string => `${row.createdAt.getTime()}:${row.id}`

/** Malformed cursors fall back to the first page rather than failing the wall. */
const decodeCursor = (cursor: string): PublicCursor | null => {
  const separator = cursor.indexOf(':')
  if (separator <= 0) return null
  const milliseconds = Number(cursor.slice(0, separator))
  const id = cursor.slice(separator + 1)
  if (!Number.isSafeInteger(milliseconds) || id.length === 0) return null
  return { createdAt: new Date(milliseconds), id }
}

const toPageLimit = (requested: number): number => {
  const value = Number.isFinite(requested) ? Math.trunc(requested) : PUBLIC_PAGE_DEFAULT_LIMIT
  return Math.min(PUBLIC_PAGE_MAX_LIMIT, Math.max(1, value))
}

/** RSVP messages for an invitation; the public wall reads newest first. */
export class D1RsvpRepository implements RsvpRepository {
  private readonly db: AppDatabase
  private readonly logger: LoggerPort | undefined

  constructor(options: D1RsvpRepositoryOptions) {
    this.db = options.db
    this.logger = options.logger
  }

  async create(input: CreateRsvpInput): Promise<StoredRsvp> {
    const rows = await this.db
      .insert(rsvps)
      .values({
        id: crypto.randomUUID(),
        invitationId: input.invitationId,
        guestId: input.guestId,
        guestName: input.guestName,
        attendance: input.attendance,
        guestCount: input.guestCount,
        message: input.message,
        isHidden: input.isHidden,
      })
      .returning()

    const row = rows[0]
    if (row === undefined) {
      throw new Error(`Failed to create RSVP for invitation ${input.invitationId}`)
    }
    return this.toStoredRsvp(row)
  }

  async listByInvitation(invitationId: string): Promise<StoredRsvp[]> {
    const rows = await this.db
      .select()
      .from(rsvps)
      .where(eq(rsvps.invitationId, invitationId))
      .orderBy(desc(rsvps.createdAt))
    return rows.map((row) => this.toStoredRsvp(row))
  }

  async listPublicPage(
    invitationId: string,
    options: RsvpPageOptions,
  ): Promise<RsvpPage> {
    const limit = toPageLimit(options.limit)
    const cursor = options.cursor === null ? null : decodeCursor(options.cursor)

    const cursorCondition =
      cursor === null
        ? undefined
        : or(
            lt(rsvps.createdAt, cursor.createdAt),
            and(eq(rsvps.createdAt, cursor.createdAt), lt(rsvps.id, cursor.id)),
          )

    const rows = await this.db
      .select()
      .from(rsvps)
      .where(
        and(
          eq(rsvps.invitationId, invitationId),
          eq(rsvps.isHidden, false),
          cursorCondition,
        ),
      )
      .orderBy(desc(rsvps.createdAt), desc(rsvps.id))
      .limit(limit + 1)

    const pageRows = rows.slice(0, limit)
    const lastRow = pageRows[pageRows.length - 1]
    return {
      items: pageRows.map((row) => this.toStoredRsvp(row)),
      nextCursor: rows.length > limit && lastRow !== undefined ? encodeCursor(lastRow) : null,
    }
  }

  async setReply(id: string, hostReply: string): Promise<void> {
    const rows = await this.db
      .update(rsvps)
      .set({ hostReply })
      .where(eq(rsvps.id, id))
      .returning({ id: rsvps.id })

    if (rows[0] === undefined) {
      this.logger?.error('RSVP not found while setting host reply', { rsvpId: id })
      throw new Error(`RSVP ${id} not found`)
    }
  }

  async setHidden(id: string, isHidden: boolean): Promise<void> {
    const rows = await this.db
      .update(rsvps)
      .set({ isHidden })
      .where(eq(rsvps.id, id))
      .returning({ id: rsvps.id })

    if (rows[0] === undefined) {
      this.logger?.error('RSVP not found while changing visibility', { rsvpId: id })
      throw new Error(`RSVP ${id} not found`)
    }
  }

  private toStoredRsvp(row: RsvpRow): StoredRsvp {
    return {
      id: row.id,
      invitationId: row.invitationId,
      guestId: row.guestId,
      guestName: row.guestName,
      attendance: row.attendance,
      guestCount: row.guestCount,
      message: row.message,
      hostReply: row.hostReply,
      isHidden: row.isHidden,
      createdAt: row.createdAt,
    }
  }
}
