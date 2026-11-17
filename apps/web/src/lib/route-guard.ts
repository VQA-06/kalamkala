import { redirect } from '@tanstack/react-router'

import { getSessionUser } from '../server/auth-session'
import type { SessionUser } from '../server/auth-session'

/**
 * Route guards live in `beforeLoad`, which TanStack Start runs on the server
 * during SSR. The server function re-reads the Better Auth session, so a client
 * cannot fake the context: unauthenticated navigation is redirected before the
 * route renders, and non-admins never reach `/admin`.
 */
export type GuardedRouteContext = { user: SessionUser }

export const requireSession = async (href: string): Promise<GuardedRouteContext> => {
  const user = await getSessionUser()
  if (user === null) {
    throw redirect({ to: '/login', search: { redirect: href } })
  }
  return { user }
}

export const requireAdmin = async (href: string): Promise<GuardedRouteContext> => {
  const user = await getSessionUser()
  if (user === null) {
    throw redirect({ to: '/login', search: { redirect: href } })
  }
  if (user.role !== 'ADMIN') {
    throw redirect({ to: '/dashboard' })
  }
  return { user }
}
