import { Link, Outlet, createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { authClient } from '../lib/auth-client'
import { requireSession } from '../lib/route-guard'
import { DashboardButton } from '../components/dashboard/ui'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async ({ location }) => requireSession(location.href),
  component: DashboardLayout,
})

function DashboardLayout() {
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
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <header className="flex flex-wrap items-baseline justify-between gap-4 border-b border-line py-6">
        <div className="flex items-baseline gap-4">
          <Link to="/" className="font-display text-2xl tracking-tight text-ink">
            Kalamkala
          </Link>
          <span className="hidden text-[0.69rem] font-semibold uppercase tracking-[0.18em] text-champagne sm:inline">
            Dasbor
          </span>
        </div>
        <nav className="flex items-center gap-5 text-sm">
          <Link to="/dashboard" className="text-ink">
            Undangan
          </Link>
          <Link to="/katalog" className="text-ink/70 hover:text-ink">
            Katalog
          </Link>
          <DashboardButton
            type="button"
            variant="ghost"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? 'Keluar…' : 'Keluar'}
          </DashboardButton>
        </nav>
      </header>

      <main className="py-10">
        <Outlet />
      </main>
    </div>
  )
}
