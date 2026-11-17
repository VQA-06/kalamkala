import {
  ConsoleJsonLogger,
  D1KVInvitationRepository,
  D1UserRepository,
  KvCacheAdapter,
  createAppDatabase,
} from '@kalamkala/adapters-cloudflare'
import type { InvitationStatus, InvitationTier, UserRole } from '@kalamkala/contracts'
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { env } from 'cloudflare:workers'

import { getAuth } from '../lib/auth'

export type DashboardInvitation = {
  id: string
  slug: string
  status: InvitationStatus
  tier: InvitationTier
  publishedAt: Date | null
}

export type DashboardData = {
  user: {
    id: string
    name: string
    email: string
    role: UserRole
    whatsappNumber: string | null
  }
  invitations: DashboardInvitation[]
}

/** Real owner data: profile row plus the invitations they own, newest first. */
export const getDashboardData = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DashboardData | null> => {
    const session = await getAuth().api.getSession({ headers: getRequestHeaders() })
    if (session === null) return null

    const db = createAppDatabase(env.DB)
    const user = await new D1UserRepository({ db }).findById(session.user.id)
    if (user === null) return null

    const invitations = await new D1KVInvitationRepository({
      db,
      cache: new KvCacheAdapter(env.INVITE_KV),
      logger: new ConsoleJsonLogger({ service: 'kalamkala-web' }),
    }).listByUserId(user.id)

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        whatsappNumber: user.whatsappNumber,
      },
      invitations: invitations.map((invitation) => ({
        id: invitation.id,
        slug: invitation.slug,
        status: invitation.status,
        tier: invitation.tier,
        publishedAt: invitation.publishedAt,
      })),
    }
  },
)
