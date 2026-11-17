import type {
  CatalogTemplateRepository,
  StoredCatalogTemplate,
  UpdateCatalogTemplateInput,
} from '@kalamkala/app-core'
import { catalogTemplates } from '@kalamkala/db-schema'
import { asc, eq } from 'drizzle-orm'

import type { AppDatabase } from './database.js'

export type D1CatalogTemplateRepositoryOptions = {
  db: AppDatabase
}

type CatalogTemplateRow = typeof catalogTemplates.$inferSelect

/** Catalog rows are seeded from the template registry, then edited by admins. */
export class D1CatalogTemplateRepository implements CatalogTemplateRepository {
  private readonly db: AppDatabase

  constructor(options: D1CatalogTemplateRepositoryOptions) {
    this.db = options.db
  }

  async list(): Promise<StoredCatalogTemplate[]> {
    const rows = await this.db
      .select()
      .from(catalogTemplates)
      .orderBy(asc(catalogTemplates.sortOrder), asc(catalogTemplates.id))
    return rows.map((row) => this.toStoredCatalogTemplate(row))
  }

  async update(
    id: string,
    input: UpdateCatalogTemplateInput,
  ): Promise<StoredCatalogTemplate> {
    const patch: Partial<typeof catalogTemplates.$inferInsert> = { updatedAt: new Date() }
    if (input.name !== undefined) patch.name = input.name
    if (input.tier !== undefined) patch.tier = input.tier
    if (input.isVisible !== undefined) patch.isVisible = input.isVisible
    if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder

    const rows = await this.db
      .update(catalogTemplates)
      .set(patch)
      .where(eq(catalogTemplates.id, id))
      .returning()

    const row = rows[0]
    if (row === undefined) {
      throw new Error(`Catalog template ${id} not found`)
    }
    return this.toStoredCatalogTemplate(row)
  }

  private toStoredCatalogTemplate(row: CatalogTemplateRow): StoredCatalogTemplate {
    return {
      id: row.id,
      name: row.name,
      tier: row.tier,
      isVisible: row.isVisible,
      sortOrder: row.sortOrder,
    }
  }
}
