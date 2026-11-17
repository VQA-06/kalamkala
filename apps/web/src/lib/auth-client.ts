import { createAuthClient } from 'better-auth/react'

/**
 * Browser client. It talks to the mounted handler at `/api/auth/*` on the same
 * origin, so no base URL is configured here.
 */
export const authClient = createAuthClient()
