import type {
  CreateRsvpInput,
  LoggerPort,
  RsvpRepository,
  StoredRsvp,
} from '@kalamkala/app-core'
import { rsvps } from '@kalamkala/db-schema'
import { desc, eq } from 'drizzle-orm'

import type { AppDatabase } from './database.js'

export type D1RsvpRepositoryOptions = {
  db: AppDatabase
  logger?: LoggerPort
}

type RsvpRow = typeof rsvps.$inferSelect

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
