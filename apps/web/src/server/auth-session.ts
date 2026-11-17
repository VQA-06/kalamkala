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

type UserRow = { name: string; email: string; role: UserRole }

/**
 * Reads the Better Auth session on the server and joins the application role
 * from D1. Server-only: never call this from a component render body.
 */
export const getSessionUser = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionUser | null> => {
    const session = await getAuth().api.getSession({ headers: getRequestHeaders() })
    if (session === null) return null

    const user = await env.DB.prepare('SELECT name, email, role FROM users WHERE id = ?1')
      .bind(session.user.id)
      .first<UserRow>()

    if (user === null) return null

    return {
      id: session.user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    }
  },
)
