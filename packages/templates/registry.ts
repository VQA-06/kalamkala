import { manifest as keratonHeritageManifest } from './keraton-heritage/manifest.js'
import type { TemplateManifest, TemplateModule, TemplatePalette } from './sdk/types.js'

/**
 * The registry holds real, loadable templates only. `manifest` is imported
 * statically because it is tiny metadata (catalog rows, previews); the theme
 * itself stays behind a literal dynamic import so Vite emits a separate chunk.
 */
export type TemplateRegistryEntry = {
  manifest: TemplateManifest
  palettes: readonly TemplatePalette[]
  load: () => Promise<TemplateModule>
  loadPreview: () => Promise<unknown>
}

export const templateRegistry: readonly TemplateRegistryEntry[] = [
  {
    manifest: keratonHeritageManifest,
    palettes: keratonHeritageManifest.palettes,
    load: () => import('./keraton-heritage/index.js').then((module) => module.default),
    loadPreview: () => import('./keraton-heritage/preview.json').then((module) => module.default),
  },
]

export const loadTemplate: (id: string) => Promise<TemplateModule> = async (id) => {
  const entry = templateRegistry.find((candidate) => candidate.manifest.id === id)
  if (entry === undefined) {
    throw new Error(`Template tidak dikenal: ${id}`)
  }
  return entry.load()
}

export const toCatalogTemplateRows: () => Array<
  Pick<TemplateManifest, 'id' | 'name' | 'tier' | 'isVisible' | 'sortOrder'>
> = () =>
  templateRegistry.map(({ manifest }) => ({
    id: manifest.id,
    name: manifest.name,
    tier: manifest.tier,
    isVisible: manifest.isVisible,
    sortOrder: manifest.sortOrder,
  }))
