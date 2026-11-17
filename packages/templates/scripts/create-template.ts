/**
 * Creates a new template from a starter.
 *
 * Run `pnpm new:template` for the interactive flow, or pass every value as a
 * flag for scripts and tests:
 *
 *   pnpm new:template --id demo --name "Demo" --tier BASIC --framework react \
 *     --occasions pernikahan --dry-run
 */

import { INVITATION_TIERS } from '@kalamkala/contracts'
import type { InvitationTier } from '@kalamkala/contracts'
import { cpSync, existsSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { argv, stdout } from 'node:process'
import { createInterface } from 'node:readline/promises'
import type { Interface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

import { manifest as reactStarterManifest } from '../_starters/react/manifest.js'
import { manifest as vanillaStarterManifest } from '../_starters/vanilla/manifest.js'
import { TEMPLATE_OCCASIONS } from '../sdk/types.js'
import type {
  TemplateFeature,
  TemplateManifest,
  TemplateOccasion,
  TemplatePalette,
} from '../sdk/types.js'

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))
const STARTERS_DIR = join(PACKAGE_ROOT, '_starters')

const STARTER_FRAMEWORKS = ['react', 'vanilla'] as const
type StarterFramework = (typeof STARTER_FRAMEWORKS)[number]

const ID_PATTERN = /^[a-z][a-z0-9-]*$/
const RESERVED_IDS: Readonly<Record<string, true>> = {
  _starters: true,
  sdk: true,
  scripts: true,
  node_modules: true,
}

type Flags = {
  id?: string
  name?: string
  tier?: string
  framework?: string
  occasions?: string
  dryRun: boolean
  force: boolean
}

const parseFlags = (args: readonly string[]): Flags => {
  const flags: Flags = { dryRun: false, force: false }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === undefined) continue

    if (arg === '--dry-run') {
      flags.dryRun = true
      continue
    }
    if (arg === '--force') {
      flags.force = true
      continue
    }
    if (!arg.startsWith('--')) {
      throw new Error(`Argumen tidak dikenal: ${arg}`)
    }

    const separator = arg.indexOf('=')
    const name = separator === -1 ? arg.slice(2) : arg.slice(2, separator)
    const value = separator === -1 ? args[index + 1] : arg.slice(separator + 1)
    if (value === undefined) {
      throw new Error(`Flag --${name} membutuhkan nilai`)
    }
    if (separator === -1) index += 1

    switch (name) {
      case 'id':
        flags.id = value
        break
      case 'name':
        flags.name = value
        break
      case 'tier':
        flags.tier = value
        break
      case 'framework':
        flags.framework = value
        break
      case 'occasions':
        flags.occasions = value
        break
      default:
        throw new Error(`Flag tidak dikenal: --${name}`)
    }
  }

  return flags
}

const validateId = (value: string): string => {
  const id = value.trim()
  if (!ID_PATTERN.test(id)) {
    throw new Error(
      `id tidak valid: "${id}" (huruf kecil, angka, dan tanda hubung; diawali huruf)`,
    )
  }
  if (RESERVED_IDS[id] === true) {
    throw new Error(`id "${id}" dicadangkan`)
  }
  return id
}

const validateName = (value: string): string => {
  const name = value.trim()
  if (name.length === 0) throw new Error('Nama tampilan wajib diisi')
  return name
}

const validateTier = (value: string): InvitationTier => {
  const tier = value.trim().toUpperCase()
  if (!(INVITATION_TIERS as readonly string[]).includes(tier)) {
    throw new Error(`Tier harus salah satu dari: ${INVITATION_TIERS.join(', ')}`)
  }
  return tier as InvitationTier
}

const validateFramework = (value: string): StarterFramework => {
  const framework = value.trim().toLowerCase()
  if (!(STARTER_FRAMEWORKS as readonly string[]).includes(framework)) {
    throw new Error(`Framework harus salah satu dari: ${STARTER_FRAMEWORKS.join(', ')}`)
  }
  return framework as StarterFramework
}

const parseOccasions = (value: string): TemplateOccasion[] => {
  const occasions = value
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0)

  if (occasions.length === 0) {
    throw new Error('Minimal satu occasion')
  }

  const unknown = occasions.filter(
    (occasion) => !(TEMPLATE_OCCASIONS as readonly string[]).includes(occasion),
  )
  if (unknown.length > 0) {
    throw new Error(
      `Occasion tidak dikenal: ${unknown.join(', ')} (pilihan: ${TEMPLATE_OCCASIONS.join(', ')})`,
    )
  }

  return [...new Set(occasions)] as TemplateOccasion[]
}

const askValidated = async <T>(
  rl: Interface,
  question: string,
  validate: (value: string) => T,
  fallback?: string,
): Promise<T> => {
  for (;;) {
    const answer = (await rl.question(question)).trim()
    const value = answer.length === 0 ? fallback : answer
    if (value === undefined) {
      stdout.write('Nilai wajib diisi.\n')
      continue
    }
    try {
      return validate(value)
    } catch (error) {
      stdout.write(`${error instanceof Error ? error.message : String(error)}\n`)
    }
  }
}

const starterManifestFor = (framework: StarterFramework): TemplateManifest =>
  framework === 'react' ? reactStarterManifest : vanillaStarterManifest

const starterPalette = (framework: StarterFramework): TemplatePalette => {
  const palette = starterManifestFor(framework).palettes[0]
  if (palette === undefined) {
    throw new Error(`Starter ${framework} tidak memiliki palette bawaan`)
  }
  return palette
}

const renderManifest = (input: {
  id: string
  name: string
  tier: InvitationTier
  framework: StarterFramework
  occasions: readonly TemplateOccasion[]
  supportedFeatures: readonly TemplateFeature[]
  palette: TemplatePalette
}): string => {
  const paletteLines = Object.entries(input.palette.tokens)
    .map(([token, value]) => `        ${token}: ${JSON.stringify(value)},`)
    .join('\n')

  return `import type { TemplateManifest } from '@kalamkala/templates/sdk'

export const manifest: TemplateManifest = {
  id: ${JSON.stringify(input.id)},
  name: ${JSON.stringify(input.name)},
  tier: ${JSON.stringify(input.tier)},
  framework: ${JSON.stringify(input.framework)},
  sortOrder: 100,
  isVisible: true,
  occasions: [${input.occasions.map((occasion) => JSON.stringify(occasion)).join(', ')}],
  supportedFeatures: [${input.supportedFeatures.map((feature) => JSON.stringify(feature)).join(', ')}],
  palettes: [
    {
      id: ${JSON.stringify(input.palette.id)},
      name: ${JSON.stringify(input.palette.name)},
      tokens: {
${paletteLines}
      },
    },
  ],
}

export default manifest
`
}

const main = async (): Promise<void> => {
  const flags = parseFlags(argv.slice(2))
  const rl = createInterface({ input: process.stdin, output: stdout })

  try {
    const id =
      flags.id === undefined
        ? await askValidated(rl, 'Template id (mis. keraton-heritage): ', validateId)
        : validateId(flags.id)

    const name =
      flags.name === undefined
        ? await askValidated(rl, 'Nama tampilan: ', validateName)
        : validateName(flags.name)

    const tier =
      flags.tier === undefined
        ? await askValidated(
            rl,
            `Tier (${INVITATION_TIERS.join('/')}) [BASIC]: `,
            validateTier,
            'BASIC',
          )
        : validateTier(flags.tier)

    const framework =
      flags.framework === undefined
        ? await askValidated(
            rl,
            `Framework (${STARTER_FRAMEWORKS.join('/')}) [react]: `,
            validateFramework,
            'react',
          )
        : validateFramework(flags.framework)

    const occasions =
      flags.occasions === undefined
        ? await askValidated(
            rl,
            `Occasions (${TEMPLATE_OCCASIONS.join(', ')}) [pernikahan]: `,
            parseOccasions,
            'pernikahan',
          )
        : parseOccasions(flags.occasions)

    const targetDir = join(PACKAGE_ROOT, id)
    const targetExists = existsSync(targetDir)
    if (targetExists && !flags.force) {
      throw new Error(`Folder ${id} sudah ada. Gunakan --force untuk menimpanya.`)
    }

    const manifestSource = renderManifest({
      id,
      name,
      tier,
      framework,
      occasions,
      palette: starterPalette(framework),
      supportedFeatures: starterManifestFor(framework).supportedFeatures,
    })

    if (flags.dryRun) {
      stdout.write(`[dry-run] target: ${targetDir}\n`)
      stdout.write(
        `[dry-run] salin _starters/${framework} -> ${id}, tulis manifest.ts\n`,
      )
      stdout.write(`[dry-run] manifest.ts:\n${manifestSource}\n`)
      return
    }

    if (targetExists) {
      rmSync(targetDir, { recursive: true, force: true })
    }
    cpSync(join(STARTERS_DIR, framework), targetDir, { recursive: true })
    writeFileSync(join(targetDir, 'manifest.ts'), manifestSource)

    stdout.write(`Template ${id} dibuat di ${targetDir}\n\n`)
    stdout.write('Langkah berikutnya:\n')
    stdout.write(
      `1. Daftarkan di registry.ts: import { manifest } from './${id}/manifest.js' lalu tambahkan entri load/loadPreview.\n`,
    )
    stdout.write(
      `2. Ganti ${id}/preview.json dengan konten undangan yang sebenarnya.\n`,
    )
    stdout.write(
      `3. Jalankan pnpm --filter @kalamkala/templates typecheck lalu pnpm sync:templates.\n`,
    )
  } finally {
    rl.close()
  }
}

main().catch((error: unknown) => {
  stdout.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
