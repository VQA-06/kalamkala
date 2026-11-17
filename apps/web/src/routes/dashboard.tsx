import { Link, createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import type { InvitationStatus, InvitationTier, UserRole } from '@kalamkala/contracts'

import { authClient } from '../lib/auth-client'
import { requireSession } from '../lib/route-guard'
import { getDashboardData } from '../server/account'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async ({ location }) => requireSession(location.href),
  loader: async () => {
    const data = await getDashboardData()
    if (data === null) {
      throw redirect({ to: '/login', search: { redirect: '/dashboard' } })
    }
    return data
  },
  component: DashboardPage,
})

const STATUS_LABELS: Record<InvitationStatus, string> = {
  DRAFT: 'Draf',
  ACTIVE: 'Aktif',
  EXPIRED: 'Kedaluwarsa',
}

const TIER_LABELS: Record<InvitationTier, string> = {
  BASIC: 'Basic',
  PREMIUM: 'Premium',
}

const ROLE_LABELS: Record<UserRole, string> = {
  USER: 'Pengguna',
  ADMIN: 'Admin',
}

const formatDate = (value: Date): string =>
  new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(value)

function DashboardPage() {
  const { user, invitations } = Route.useLoaderData()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      await authClient.signOut()
      await router.invalidate()
      await router.navigate({ to: '/' })
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-16 sm:py-24">
      <header className="flex flex-wrap items-baseline justify-between gap-4 border-b border-line pb-6">
        <Link to="/" className="font-display text-lg tracking-tight text-ink">
          Kalamkala
        </Link>
        <div className="flex items-center gap-5 text-xs">
          {user.role === 'ADMIN' ? (
            <Link to="/admin" className="text-champagne">
              Dasbor admin
            </Link>
          ) : null}
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="cursor-pointer border-0 bg-transparent p-0 text-xs font-semibold text-ink/70 disabled:cursor-progress"
          >
            {signingOut ? 'Keluar…' : 'Keluar'}
          </button>
        </div>
      </header>

      <main className="mt-12">
        <p className="text-[0.69rem] font-semibold uppercase tracking-[0.18em] text-champagne">
          Akun
        </p>
        <h1 className="mt-3 font-display text-4xl leading-[1.05] text-ink">
          {user.name}
        </h1>

        <dl className="mt-8 grid gap-px border-y border-line sm:grid-cols-3 sm:divide-x sm:divide-line">
          <div className="py-4 sm:pr-6">
            <dt className="text-[0.69rem] font-semibold uppercase tracking-[0.16em] text-champagne">
              Email
            </dt>
            <dd className="mt-1 break-all text-sm text-ink/80">{user.email}</dd>
          </div>
          <div className="py-4 sm:px-6">
            <dt className="text-[0.69rem] font-semibold uppercase tracking-[0.16em] text-champagne">
              Peran
            </dt>
            <dd className="mt-1 text-sm text-ink/80">{ROLE_LABELS[user.role]}</dd>
          </div>
          <div className="py-4 sm:pl-6">
            <dt className="text-[0.69rem] font-semibold uppercase tracking-[0.16em] text-champagne">
              WhatsApp
            </dt>
            <dd className="mt-1 text-sm text-ink/80">
              {user.whatsappNumber ?? 'Belum diisi'}
            </dd>
          </div>
        </dl>

        <section className="mt-12">
          <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
            <h2 className="text-[0.69rem] font-semibold uppercase tracking-[0.18em] text-champagne">
              Undangan
            </h2>
            <p className="text-xs text-ink/60">{invitations.length} undangan</p>
          </div>

          {invitations.length === 0 ? (
            <p className="mt-6 text-sm leading-6 text-ink/70">
              Belum ada undangan. Undangan yang Anda buat akan muncul di sini.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {invitations.map((invitation) => (
                <li key={invitation.id} className="flex flex-wrap items-baseline justify-between gap-2 py-4">
                  <div>
                    <p className="font-medium text-ink">/u/{invitation.slug}</p>
                    <p className="text-xs text-ink/60">
                      Dibuat {formatDate(new Date(invitation.createdAt))}
                    </p>
                  </div>
                  <p className="text-xs tracking-wide text-ink/70">
                    {TIER_LABELS[invitation.tier]} · {STATUS_LABELS[invitation.status]}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
