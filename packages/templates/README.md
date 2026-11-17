# @kalamkala/templates

The invitation template SDK, the template registry, and the authoring tools.

A template is a self-contained folder that exports a `TemplateModule`:

```ts
type TemplateModule = {
  manifest: TemplateManifest
  mount: (container: HTMLElement, ctx: TemplateContext) => () => void
}
```

`mount` renders into the container and returns a cleanup. The host calls it once
per view, then calls the cleanup when the view unmounts. Cleanup must be
idempotent and leave the container empty.

## SDK

`@kalamkala/templates/sdk` is framework-agnostic. It exports:

| Export | Purpose |
| --- | --- |
| `TemplateManifest`, `TemplatePalette`, `TemplateFramework`, `TemplateOccasion` | Catalog metadata: id, name, tier, occasions, palettes |
| `TEMPLATE_FEATURES`, `TemplateFeature` | Capability names a theme declares in the required `supportedFeatures`; the editor hides form tabs for anything unsupported |
| `TemplateContext`, `GuestContext`, `PublicWish`, `RsvpSummary` | What a theme receives |
| `TemplateActions`, `TemplateUtils`, `TemplateRuntimeState` | Injected behaviour: RSVP submit, media URLs, date/currency formatting |
| `createTemplateContext(input)` | Builds the context with defaults; used by hosts, previews, and tests |
| `resolveThemeCssVars(container, tokens)` | Publishes appearance tokens as CSS variables |
| `DEFAULT_TRANSLATIONS`, `TEMPLATE_COPY_KEYS`, `TemplateCopyKey` | The copy contract for `id`, `en`, `jv`, and `su` |

Themes never fetch, never read global state, and never import Cloudflare or
database code. Everything external arrives through `TemplateContext`.

`createTemplateContext` defaults:

- `t` interpolates `{name}`, `{count}`, `{date}` from the locale dictionary.
- `submitRsvp` resolves to `{ ok: false, error: 'HOST_ACTION_MISSING' }` until a
  host injects the real action.
- `resolveMediaUrl` prefixes `/media/`, `formatDate` uses `Intl` with
  `WIB`/`WITA`/`WIT` mapped to IANA zones, `formatCurrency` formats IDR.

## Theme tokens

`resolveThemeCssVars(container, ctx.appearance.themeTokens)` sets seven inline
custom properties on the template root:

| Token | CSS variable |
| --- | --- |
| `bgPrimary` | `--tpl-bg-primary` |
| `bgSecondary` | `--tpl-bg-secondary` |
| `textPrimary` | `--tpl-text-primary` |
| `textMuted` | `--tpl-text-muted` |
| `accent` | `--tpl-accent` |
| `accentContrast` | `--tpl-accent-contrast` |
| `border` | `--tpl-border` |

The returned cleanup restores the exact previous inline values, removing the
properties that were not set before. A theme's stylesheet should read
`var(--tpl-accent, #9a7b56)` so it still renders without the host.

## CSS Modules

Each template owns a `styles.module.css` imported as `import styles from
'./styles.module.css'`. Class names stay local to the template, so two themes
cannot collide even in the same document. Vitest is configured with
`css: { modules: { classNameStrategy: 'non-scoped' } }`, which keeps the
authored class names in tests.

## Adding a template

```sh
pnpm new:template
# or fully scripted:
pnpm new:template --id taman-sore --name "Taman Sore" --tier PREMIUM \
  --framework react --occasions pernikahan,lamaran
```

The CLI copies `_starters/<framework>` to `packages/templates/<id>` and writes a
new `manifest.ts` (`sortOrder` 100, `isVisible` true, starter palette, and the
starter's `supportedFeatures`). It does not edit the registry. Next steps, also
printed by the CLI:

1. Register it in `registry.ts`: import its `manifest` statically and add an
   entry with `load: () => import('./<id>/index.js').then((m) => m.default)` and
   `loadPreview: () => import('./<id>/preview.json').then((m) => m.default)`.
   Keep the dynamic import literal so Vite splits the theme into its own chunk.
2. Replace `<id>/preview.json` with the real invitation document; it must parse
   with `MasterInvitationSchema`.
3. Run `pnpm --filter @kalamkala/templates typecheck` and `pnpm sync:templates`.

Only templates in the registry are real. There is no speculative catalog list.

## Syncing the catalog

```sh
pnpm sync:templates --dry-run   # print the SQL
pnpm sync:templates --local     # default: local D1
pnpm sync:templates --remote    # deployed D1
```

`registry.ts` is the source of truth. The script emits an idempotent upsert per
entry into `catalog_templates` (id, name, tier, is_visible, sort_order) and runs
it through `wrangler d1 execute` from `apps/web`.

## Starters

`_starters/react` and `_starters/vanilla` are scaffolding, not catalog entries
(`isVisible: false`, `sortOrder: 999`). Both implement a cover gate that locks
page scroll, starts the invitation audio only after the open click, and returns
a cleanup that restores scroll, pauses audio, and empties the container. They
also implement an RSVP form that reports success and failure without throwing.
