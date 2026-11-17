import { defineConfig } from 'drizzle-kit'

/**
 * Migration generation only. No D1 credentials are needed here: the SQLite
 * dialect emits plain SQL files into `./drizzle` and `wrangler d1 migrations
 * apply` runs them against D1.
 */
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/schema.ts',
  out: './drizzle',
})
