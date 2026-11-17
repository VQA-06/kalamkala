# Kalamkala — Undangan Digital

Digital invitation SaaS for Indonesian weddings and celebrations, built on the
Cloudflare Free Tier (D1, KV, R2).

Phase 1 is the monorepo foundation only: workspace layout, package boundaries,
Cloudflare wiring, and one server-rendered page. No auth, invitation editor, or
landing page yet; payment is a simulated adapter.

## Prerequisites

- Node.js >= 20
- pnpm 12 (`corepack enable`)
- A Cloudflare account only for deploying; local development works offline

## Setup

```sh
pnpm install
cp apps/web/.dev.vars.example apps/web/.dev.vars
pnpm db:generate
pnpm db:migrate:local
pnpm dev
```

`pnpm dev` serves the app on http://localhost:3000 with D1, KV, and R2 bound
locally through Wrangler.

Local secrets are read from `apps/web/.dev.vars`, which is git-ignored. Fill it
in from your own credentials file; nothing in it is committed. The root
`.dev.vars` is not loaded by the Worker.

## Verify

```sh
pnpm typecheck && pnpm test && pnpm build
```

`pnpm typecheck` regenerates what it needs: `apps/web` recreates
`src/routeTree.gen.ts` (`tsr generate`) and `worker-configuration.d.ts`
(`wrangler types`) before running `tsc`, so a fresh clone typechecks without
committed generated files.

## Cloudflare resources

| Resource | Name | Binding |
| --- | --- | --- |
| Worker | `kalamkala-web` | — |
| D1 database | `kalamkala-db` | `DB` |
| KV namespace | `INVITE_KV` | `INVITE_KV` |
| R2 bucket | `kalamkala-media` | `MEDIA_BUCKET` |

`database_id` and the KV `id` in `apps/web/wrangler.toml` are placeholders
(`00000000-...` / 32 zeros). Local development and local migrations work with
them as-is; replace them with the ids printed by `wrangler d1 create
kalamkala-db` and `wrangler kv namespace create INVITE_KV` before the first
deploy. Also replace `CDN_BASE_URL` with the R2 public or custom domain.

## Scripts

| Command | Effect |
| --- | --- |
| `pnpm dev` | Turbo runs the Vite dev server for `apps/web` on port 3000 |
| `pnpm build` | Turbo builds the Worker bundle and client assets |
| `pnpm typecheck` | Typechecks every package; `apps/web` regenerates `routeTree.gen.ts` and `worker-configuration.d.ts` first |
| `pnpm test` | Runs Vitest in `packages/adapters-cloudflare` |
| `pnpm db:generate` | `drizzle-kit generate` into `packages/db-schema/drizzle` |
| `pnpm db:migrate:local` | Applies D1 migrations to the local Wrangler database |
| `pnpm --filter @kalamkala/web deploy` | Builds and runs `wrangler deploy` |
| `pnpm --filter @kalamkala/web cf:types` | Regenerates `worker-configuration.d.ts` |

## Dependencies and audit

`pnpm audit` reports no known vulnerabilities. One advisory
(GHSA-67mh-4wv8-2f99, esbuild <= 0.24.2) used to appear through `drizzle-kit`'s
dev-only `@esbuild-kit` transpiler; `pnpm-workspace.yaml` now pins that single
edge so it no longer ships:

```yaml
overrides:
  "@esbuild-kit/core-utils>esbuild": "^0.25.0"
```

`pnpm db:generate` was re-verified with the override in place. Drop the override
once `drizzle-kit` no longer depends on `@esbuild-kit`.

## Architecture

```
apps/web                       TanStack Start (Vite plugin) on Cloudflare Workers
packages/contracts             Zod schemas and shared types
packages/db-schema             Drizzle schema and D1 migrations
packages/app-core              Business logic and port definitions (no Cloudflare imports)
packages/adapters-cloudflare   Port implementations backed by D1, KV, and R2
packages/templates             Invitation templates
```

Hexagonal rule: `packages/app-core` holds the business logic and declares the
ports it needs, and it never imports Cloudflare SDKs, Wrangler, or Drizzle
drivers. All external access is implemented in
`packages/adapters-cloudflare` and injected into `app-core`. pnpm's isolated
`node_modules` enforces this at install time.
