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
  createdAt: Date
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

type UserRow = {
  id: string
  name: string
  email: string
  role: UserRole
  whatsapp_number: string | null
}

type InvitationRow = {
  id: string
  slug: string
  status: InvitationStatus
  tier: InvitationTier
  created_at: number
}

/** Real owner data: profile row plus the invitations they own, newest first. */
export const getDashboardData = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DashboardData | null> => {
    const session = await getAuth().api.getSession({ headers: getRequestHeaders() })
    if (session === null) return null

    const user = await env.DB.prepare(
      'SELECT id, name, email, role, whatsapp_number FROM users WHERE id = ?1',
    )
      .bind(session.user.id)
      .first<UserRow>()

    if (user === null) return null

    const invitations = await env.DB.prepare(
      'SELECT id, slug, status, tier, created_at FROM invitations WHERE user_id = ?1 ORDER BY created_at DESC',
    )
      .bind(user.id)
      .all<InvitationRow>()

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        whatsappNumber: user.whatsapp_number,
      },
      invitations: invitations.results.map((row) => ({
        id: row.id,
        slug: row.slug,
        status: row.status,
        tier: row.tier,
        createdAt: new Date(row.created_at * 1000),
      })),
    }
  },
)
