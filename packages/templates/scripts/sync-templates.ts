/**
 * Mirrors `registry.ts` into the `catalog_templates` table.
 *
 *   pnpm sync:templates --dry-run
 *   pnpm sync:templates --local    (default)
 *   pnpm sync:templates --remote
 *
 * The SQL is idempotent, so running it twice leaves the catalog unchanged.
 */

import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { argv, stdout } from 'node:process'
import { fileURLToPath } from 'node:url'

import { templateRegistry } from '../registry.js'

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const WEB_APP_DIR = join(REPO_ROOT, 'apps/web')

const KNOWN_FLAGS: Readonly<Record<string, true>> = {
  '--dry-run': true,
  '--local': true,
  '--remote': true,
}

const sqlString = (value: string): string => `'${value.replace(/'/g, "''")}'`

const buildStatements = (): string[] =>
  [...templateRegistry]
    .sort((left, right) => left.manifest.sortOrder - right.manifest.sortOrder)
    .map(
      ({ manifest }) =>
        `INSERT INTO catalog_templates (id, name, tier, is_visible, sort_order) VALUES (${sqlString(manifest.id)}, ${sqlString(manifest.name)}, ${sqlString(manifest.tier)}, ${manifest.isVisible ? 1 : 0}, ${manifest.sortOrder}) ON CONFLICT(id) DO NOTHING;`,
    )

const main = (): void => {
  const args = argv.slice(2)
  for (const arg of args) {
    if (KNOWN_FLAGS[arg] !== true) {
      throw new Error(`Flag tidak dikenal: ${arg} (pakai --dry-run, --local, atau --remote)`)
    }
  }

  const dryRun = args.includes('--dry-run')
  const target = args.includes('--remote') ? '--remote' : '--local'
  const statements = buildStatements()

  if (statements.length === 0) {
    stdout.write('Registry kosong, tidak ada yang disinkronkan.\n')
    return
  }

  const ids = templateRegistry.map(({ manifest }) => manifest.id)

  if (dryRun) {
    stdout.write(`[dry-run] ${statements.length} template -> D1 (${target})\n`)
    stdout.write(`${statements.join('\n')}\n`)
    return
  }

  stdout.write(
    `Menyinkronkan ${statements.length} template ke D1 (${target}) dari ${WEB_APP_DIR}\n`,
  )
  execFileSync(
    'pnpm',
    ['exec', 'wrangler', 'd1', 'execute', 'DB', target, '--command', statements.join('\n')],
    { cwd: WEB_APP_DIR, stdio: 'inherit' },
  )
  stdout.write(`Selesai: ${ids.join(', ')}\n`)
}

try {
  main()
} catch (error) {
  stdout.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
