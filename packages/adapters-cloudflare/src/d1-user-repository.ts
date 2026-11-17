import type { StoredUser, UserRepository } from '@kalamkala/app-core'
import { users } from '@kalamkala/db-schema'
import { eq } from 'drizzle-orm'

import type { AppDatabase } from './database.js'

export type D1UserRepositoryOptions = {
  db: AppDatabase
}

type UserRow = typeof users.$inferSelect

/** Read-only profile lookup; writes stay in the auth layer. */
export class D1UserRepository implements UserRepository {
  private readonly db: AppDatabase

  constructor(options: D1UserRepositoryOptions) {
    this.db = options.db
  }

  async findById(id: string): Promise<StoredUser | null> {
    const row = await this.db.query.users.findFirst({ where: eq(users.id, id) })
    return row === undefined ? null : this.toStoredUser(row)
  }

  private toStoredUser(row: UserRow): StoredUser {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      whatsappNumber: row.whatsappNumber,
    }
  }
}
