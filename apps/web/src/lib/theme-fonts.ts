import type { TemplateFont } from '@kalamkala/templates/sdk'

const GOOGLE_FONTS_BASE = 'https://fonts.googleapis.com/css2'
const FONT_PRECONNECTS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'] as const

const buildFontHref = (fonts: readonly TemplateFont[]): string | null => {
  const families = new Map<
    string,
    { weights: Set<number>; styles: Set<'normal' | 'italic'> }
  >()
  for (const font of fonts) {
    const family = font.family.trim()
    if (family.length === 0) continue
    const axes = families.get(family) ?? {
      weights: new Set<number>(),
      styles: new Set<'normal' | 'italic'>(),
    }
    for (const weight of font.weights ?? []) axes.weights.add(weight)
    for (const style of font.styles ?? ['normal']) axes.styles.add(style)
    families.set(family, axes)
  }
  if (families.size === 0) return null

  const params = [...families.entries()].map(([family, axes]) => {
    const encoded = encodeURIComponent(family).replace(/%20/gu, '+')
    const weights = axes.weights.size > 0 ? [...axes.weights] : [400]

    if (axes.styles.has('italic')) {
      const tuples = weights.flatMap((weight) => [`0,${weight}`, `1,${weight}`])
      return `family=${encoded}:ital,wght@${tuples.join(';')}`
    }
    return axes.weights.size > 0
      ? `family=${encoded}:wght@${weights.join(';')}`
      : `family=${encoded}`
  })
  return `${GOOGLE_FONTS_BASE}?${params.join('&')}&display=swap`
}

/** Adds the theme's fonts to the document head and returns a remove-only cleanup. */
export const injectFonts = (fonts: readonly TemplateFont[]): (() => void) => {
  const href = buildFontHref(fonts)
  if (href === null) return () => {}

  const nodes: HTMLElement[] = []
  for (const origin of FONT_PRECONNECTS) {
    const link = document.createElement('link')
    link.rel = 'preconnect'
    link.href = origin
    if (origin === FONT_PRECONNECTS[1]) link.crossOrigin = 'anonymous'
    document.head.appendChild(link)
    nodes.push(link)
  }

  const stylesheet = document.createElement('link')
  stylesheet.rel = 'stylesheet'
  stylesheet.href = href
  stylesheet.dataset.themeFonts = 'true'
  document.head.appendChild(stylesheet)
  nodes.push(stylesheet)

  return () => {
    for (const node of nodes) node.remove()
  }
}
