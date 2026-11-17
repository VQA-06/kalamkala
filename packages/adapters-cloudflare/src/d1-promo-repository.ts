import type {
  CreatePromoInput,
  PromoRepository,
  StoredPromo,
  UpdatePromoInput,
} from '@kalamkala/app-core'
import { promos } from '@kalamkala/db-schema'
import { desc, eq, sql } from 'drizzle-orm'

import type { AppDatabase } from './database.js'

export type D1PromoRepositoryOptions = {
  db: AppDatabase
}

type PromoRow = typeof promos.$inferSelect

/** Discount codes and partner attribution. Codes are unique in the schema. */
export class D1PromoRepository implements PromoRepository {
  private readonly db: AppDatabase

  constructor(options: D1PromoRepositoryOptions) {
    this.db = options.db
  }

  async findByCode(code: string): Promise<StoredPromo | null> {
    const row = await this.db.query.promos.findFirst({ where: eq(promos.code, code) })
    return row === undefined ? null : this.toStoredPromo(row)
  }

  async list(): Promise<StoredPromo[]> {
    const rows = await this.db
      .select()
      .from(promos)
      .orderBy(desc(promos.createdAt), desc(promos.id))
    return rows.map((row) => this.toStoredPromo(row))
  }

  async create(input: CreatePromoInput): Promise<StoredPromo> {
    const rows = await this.db
      .insert(promos)
      .values({
        id: crypto.randomUUID(),
        code: input.code,
        discountType: input.discountType,
        discountValue: input.discountValue,
        partnerName: input.partnerName,
        commissionPercent: input.commissionPercent,
        maxUses: input.maxUses,
        usedCount: input.usedCount ?? 0,
        isActive: input.isActive,
        expiresAt: input.expiresAt,
      })
      .returning()

    const row = rows[0]
    if (row === undefined) {
      throw new Error(`Failed to create promo ${input.code}`)
    }
    return this.toStoredPromo(row)
  }

  async update(id: string, input: UpdatePromoInput): Promise<StoredPromo> {
    const patch: Partial<typeof promos.$inferInsert> = { updatedAt: new Date() }
    if (input.discountType !== undefined) patch.discountType = input.discountType
    if (input.discountValue !== undefined) patch.discountValue = input.discountValue
    if (input.partnerName !== undefined) patch.partnerName = input.partnerName
    if (input.commissionPercent !== undefined) patch.commissionPercent = input.commissionPercent
    if (input.maxUses !== undefined) patch.maxUses = input.maxUses
    if (input.isActive !== undefined) patch.isActive = input.isActive
    if (input.expiresAt !== undefined) patch.expiresAt = input.expiresAt

    const rows = await this.db.update(promos).set(patch).where(eq(promos.id, id)).returning()

    const row = rows[0]
    if (row === undefined) {
      throw new Error(`Promo ${id} not found`)
    }
    return this.toStoredPromo(row)
  }

  async incrementUsedCount(code: string): Promise<void> {
    // A single UPDATE keeps concurrent callbacks from losing increments.
    await this.db
      .update(promos)
      .set({ usedCount: sql`${promos.usedCount} + 1`, updatedAt: new Date() })
      .where(eq(promos.code, code))
  }

  private toStoredPromo(row: PromoRow): StoredPromo {
    return {
      id: row.id,
      code: row.code,
      discountType: row.discountType,
      discountValue: row.discountValue,
      partnerName: row.partnerName,
      commissionPercent: row.commissionPercent,
      maxUses: row.maxUses,
      usedCount: row.usedCount,
      isActive: row.isActive,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    }
  }
}
