import { createAppDatabase, D1UserRepository } from '@kalamkala/adapters-cloudflare'
import type { UserRole } from '@kalamkala/contracts'
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { env } from 'cloudflare:workers'

import { getAuth } from '../lib/auth'

export type SessionUser = {
  id: string
  name: string
  email: string
  role: UserRole
}

/**
 * Reads the Better Auth session on the server and joins the application profile
 * through the typed `UserRepository` port. Server-only: never call this from a
 * component render body.
 */
export const getSessionUser = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionUser | null> => {
    const session = await getAuth().api.getSession({ headers: getRequestHeaders() })
    if (session === null) return null

    const user = await new D1UserRepository({ db: createAppDatabase(env.DB) }).findById(
      session.user.id,
    )
    if (user === null) return null

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    }
  },
)
