import type { InvitationTier } from '@kalamkala/contracts'

export type TemplateOccasion = 'pernikahan' | 'lamaran' | 'khitanan' | 'aqiqah' | 'ulang-tahun'
export type TemplateFramework = 'react' | 'vue' | 'vanilla'

/**
 * Describes one theme in the catalog. Components are rendered elsewhere;
 * this manifest only decides what the admin and buyer see.
 */
export type TemplateManifest = {
  /** Stable slug used in URLs and the database; never reuse an id. */
  id: string
  name: string
  tier: InvitationTier
  framework: TemplateFramework
  sortOrder: number
  isVisible: boolean
  occasions: ReadonlyArray<TemplateOccasion>
}

export const templateRegistry = [
  {
    id: 'senja-ungu',
    name: 'Senja Ungu',
    tier: 'BASIC',
    framework: 'react',
    sortOrder: 1,
    isVisible: true,
    occasions: ['pernikahan', 'lamaran'],
  },
  {
    id: 'melati-putih',
    name: 'Melati Putih',
    tier: 'BASIC',
    framework: 'vanilla',
    sortOrder: 2,
    isVisible: true,
    occasions: ['pernikahan', 'khitanan'],
  },
  {
    id: 'daun-pisang',
    name: 'Daun Pisang',
    tier: 'BASIC',
    framework: 'vue',
    sortOrder: 3,
    isVisible: true,
    occasions: ['pernikahan', 'aqiqah'],
  },
  {
    id: 'aksara-jawa',
    name: 'Aksara Jawa',
    tier: 'PREMIUM',
    framework: 'vue',
    sortOrder: 4,
    isVisible: true,
    occasions: ['pernikahan', 'lamaran'],
  },
  {
    id: 'batik-sogan',
    name: 'Batik Sogan',
    tier: 'PREMIUM',
    framework: 'react',
    sortOrder: 5,
    isVisible: true,
    occasions: ['pernikahan', 'khitanan', 'aqiqah'],
  },
  {
    id: 'pura-bali',
    name: 'Pura Bali',
    tier: 'PREMIUM',
    framework: 'vanilla',
    sortOrder: 6,
    isVisible: true,
    occasions: ['pernikahan', 'ulang-tahun'],
  },
] as const satisfies readonly TemplateManifest[]

export type CatalogTemplateRow = Pick<
  TemplateManifest,
  'id' | 'name' | 'tier' | 'isVisible' | 'sortOrder'
>

/**
 * Database projection for the `catalogTemplates` seed.
 * Pure mapping on purpose: the seed script writes the rows.
 */
export const toCatalogTemplateRows = (): CatalogTemplateRow[] =>
  templateRegistry.map(({ id, name, tier, isVisible, sortOrder }) => ({
    id,
    name,
    tier,
    isVisible,
    sortOrder,
  }))
