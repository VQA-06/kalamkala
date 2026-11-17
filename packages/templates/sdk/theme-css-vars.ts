import type { ThemeTokens } from '@kalamkala/contracts'

/**
 * Theme tokens are published as CSS custom properties on the template root so a
 * theme's stylesheet never reads application state directly. Order is fixed to
 * keep the cleanup deterministic.
 */
const TOKEN_CSS_VARS: ReadonlyArray<readonly [keyof ThemeTokens, string]> = [
  ['bgPrimary', '--tpl-bg-primary'],
  ['bgSecondary', '--tpl-bg-secondary'],
  ['textPrimary', '--tpl-text-primary'],
  ['textMuted', '--tpl-text-muted'],
  ['accent', '--tpl-accent'],
  ['accentContrast', '--tpl-accent-contrast'],
  ['border', '--tpl-border'],
]

/**
 * Applies the appearance tokens as inline custom properties on `container`.
 * Returns a cleanup that restores exactly what was there before: values that
 * existed inline are put back, values that did not are removed.
 */
export const resolveThemeCssVars = (
  container: HTMLElement,
  tokens: ThemeTokens,
): (() => void) => {
  const previousValues = new Map<string, string>()

  for (const [token, cssVar] of TOKEN_CSS_VARS) {
    previousValues.set(cssVar, container.style.getPropertyValue(cssVar))
    container.style.setProperty(cssVar, tokens[token])
  }

  return () => {
    for (const [cssVar, previousValue] of previousValues) {
      if (previousValue === '') {
        container.style.removeProperty(cssVar)
        continue
      }
      container.style.setProperty(cssVar, previousValue)
    }
  }
}
