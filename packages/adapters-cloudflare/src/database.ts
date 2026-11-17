import { schema } from '@kalamkala/db-schema'
import { drizzle } from 'drizzle-orm/d1'
import type { DrizzleD1Database } from 'drizzle-orm/d1'

/** Drizzle client bound to a D1 database and the full application schema. */
export type AppDatabase = DrizzleD1Database<typeof schema>

/** One client per request: `d1` is the `DB` binding from the Worker env. */
export const createAppDatabase = (d1: D1Database): AppDatabase => drizzle(d1, { schema })
