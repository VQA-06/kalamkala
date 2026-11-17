import type {
  CollaboratorRepository,
  CreateCollaboratorInput,
  StoredCollaborator,
} from '@kalamkala/app-core'
import { collaborators } from '@kalamkala/db-schema'
import { desc, eq } from 'drizzle-orm'

import type { AppDatabase } from './database.js'

export type D1CollaboratorRepositoryOptions = {
  db: AppDatabase
}

type CollaboratorRow = typeof collaborators.$inferSelect

/** Access tokens are stored as issued; only the raw PIN is hashed. */
export class D1CollaboratorRepository implements CollaboratorRepository {
  private readonly db: AppDatabase

  constructor(options: D1CollaboratorRepositoryOptions) {
    this.db = options.db
  }

  async create(input: CreateCollaboratorInput): Promise<StoredCollaborator> {
    const rows = await this.db
      .insert(collaborators)
      .values({
        id: input.id,
        invitationId: input.invitationId,
        label: input.label,
        accessToken: input.accessToken,
        pinHash: input.pinHash,
        permissionsJson: input.permissionsJson,
        expiresAt: input.expiresAt,
      })
      .returning()

    const row = rows[0]
    if (row === undefined) {
      throw new Error(`Failed to create collaborator ${input.id}`)
    }
    return this.toStoredCollaborator(row)
  }

  async listByInvitation(invitationId: string): Promise<StoredCollaborator[]> {
    const rows = await this.db
      .select()
      .from(collaborators)
      .where(eq(collaborators.invitationId, invitationId))
      .orderBy(desc(collaborators.createdAt), desc(collaborators.id))
    return rows.map((row) => this.toStoredCollaborator(row))
  }

  async findById(id: string): Promise<StoredCollaborator | null> {
    const row = await this.db.query.collaborators.findFirst({
      where: eq(collaborators.id, id),
    })
    return row === undefined ? null : this.toStoredCollaborator(row)
  }

  async delete(id: string): Promise<void> {
    const rows = await this.db
      .delete(collaborators)
      .where(eq(collaborators.id, id))
      .returning({ id: collaborators.id })

    if (rows[0] === undefined) {
      throw new Error(`Collaborator ${id} not found`)
    }
  }

  private toStoredCollaborator(row: CollaboratorRow): StoredCollaborator {
    return {
      id: row.id,
      invitationId: row.invitationId,
      label: row.label,
      accessToken: row.accessToken,
      pinHash: row.pinHash,
      permissionsJson: row.permissionsJson,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    }
  }
}
