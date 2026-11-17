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

## Auth & public invitations

Google sign-in runs through Better Auth. Register this redirect URI in the
Google Cloud console: `${BETTER_AUTH_URL}/api/auth/callback/google`
(local: `http://localhost:3000/api/auth/callback/google`).

Secrets live in `apps/web/.dev.vars` locally and are set with
`wrangler secret put <NAME>` in production: `BETTER_AUTH_SECRET`,
`BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`TURNSTILE_SECRET_KEY`. `TURNSTILE_SITE_KEY` and `CDN_BASE_URL` are public and
may stay in `[vars]`.

`pnpm db:migrate:local` applies the D1 migrations in order: `0000` (schema) and
`0001` (invitation reports).

Every published invitation is reachable at `/u/<slug>`. Share a named link with
`?to=Nama%20Tamu`, or a personal code with `?g=<guest qr token>`. Invitations
with the PIN gate enabled render the PIN screen before the content.

Promote an operator after they sign in once:

```sh
pnpm --filter @kalamkala/web exec wrangler d1 execute DB --local \
  --command "UPDATE users SET role='ADMIN' WHERE email='you@example.com'"
```

Use `--remote` for the deployed database. The invitation body is mounted
client-side by `TemplateHost`; the title, description, and OG meta are rendered
on the server so link previews work.

## Scripts

| Command | Effect |
| --- | --- |
| `pnpm dev` | Turbo runs the Vite dev server for `apps/web` on port 3000 |
| `pnpm build` | Turbo builds the Worker bundle and client assets |
| `pnpm typecheck` | Typechecks every package; `apps/web` regenerates `routeTree.gen.ts` and `worker-configuration.d.ts` first |
| `pnpm test` | Runs Vitest in contracts, app-core, adapters-cloudflare, and templates |
| `pnpm db:generate` | `drizzle-kit generate` into `packages/db-schema/drizzle` |
| `pnpm db:migrate:local` | Applies D1 migrations to the local Wrangler database |
| `pnpm new:template` | Scaffolds a template from `_starters` into `packages/templates/<id>` |
| `pnpm sync:templates` | Upserts the registry into `catalog_templates` (`--dry-run`, `--local`, `--remote`) |
| `pnpm --filter @kalamkala/web deploy` | Builds and runs `wrangler deploy` |
| `pnpm --filter @kalamkala/web cf:types` | Regenerates `worker-configuration.d.ts` |

## Dependencies and audit

Both graphs report the same high advisory, GHSA-fc5q-39xc-vjpf (picomatch
<= 4.0.7, ReDoS, no patched release as of 2026-11-18):

- `pnpm audit --prod`: 1 high, reached through build tooling declared as a
  production dependency — `@tailwindcss/vite -> vite -> tinyglobby -> fdir ->
  picomatch` and `@tanstack/react-start -> @tanstack/router-utils /
  @tanstack/start-plugin-core -> tinyglobby -> fdir -> picomatch`.
- `pnpm audit --dev`: 1 high, through `@tanstack/devtools-vite` and
  `@tanstack/devtools-bundler-core`.

picomatch is a glob matcher used by Vite and the TanStack build plugins; 4.0.7
is the newest published version, so no override can clear it. It is not
runtime-reachable: `grep` over `apps/web/dist/client` and `apps/web/dist/server`
finds no picomatch, and no Worker or browser code imports it. Monitoring
upstream for a release above 4.0.7.

The earlier GHSA-67mh-4wv8-2f99 (esbuild <= 0.24.2) came through
`drizzle-kit`'s dev-only `@esbuild-kit` transpiler; `pnpm-workspace.yaml` pins
that single edge so it no longer ships:

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
packages/templates             Template SDK contract, registry with dynamic theme imports,
                               React/vanilla starters, authoring CLI, Keraton Heritage theme
```

Hexagonal rule: `packages/app-core` holds the business logic and declares the
ports it needs, and it never imports Cloudflare SDKs, Wrangler, or Drizzle
drivers. All external access is implemented in
`packages/adapters-cloudflare` and injected into `app-core`. pnpm's isolated
`node_modules` enforces this at install time.
