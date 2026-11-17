import { createAppDatabase } from '@kalamkala/adapters-cloudflare'
import { accounts, sessions, users, verifications } from '@kalamkala/db-schema'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { env } from 'cloudflare:workers'

const LOCAL_ORIGIN = 'http://localhost:3000'

const createAuth = () =>
  betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [...new Set([LOCAL_ORIGIN, env.BETTER_AUTH_URL])],
    database: drizzleAdapter(createAppDatabase(env.DB), {
      provider: 'sqlite',
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
      },
    }),
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
    // Must stay last: it rewrites Set-Cookie headers into TanStack Start's
    // cookie helpers so sign-in and sign-out survive SSR.
    plugins: [tanstackStartCookies()],
  })

type Auth = ReturnType<typeof createAuth>

let instance: Auth | undefined

/**
 * Built lazily on the first request so `cloudflare:workers` env bindings are
 * read inside the Worker request context rather than at module evaluation.
 */
export const getAuth = (): Auth => {
  instance ??= createAuth()
  return instance
}
