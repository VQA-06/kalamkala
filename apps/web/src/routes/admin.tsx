import {
  Link,
  Outlet,
  createFileRoute,
  useRouterState,
} from '@tanstack/react-router'
import { ArrowLeftIcon } from '@radix-ui/react-icons'

import { requireAdmin } from '../lib/route-guard'

export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ location }) => requireAdmin(location.href),
  component: AdminLayout,
})

const NAV_ITEMS = [
  { to: '/admin', label: 'Ringkasan' },
  { to: '/admin/transactions', label: 'Transaksi' },
  { to: '/admin/templates', label: 'Template' },
  { to: '/admin/promos', label: 'Promo' },
] as const

const navClass = (active: boolean): string =>
  `border-b-2 px-0 py-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] ${
    active
      ? 'border-ink text-ink'
      : 'border-transparent text-ink/50 hover:text-ink'
  }`

function AdminLayout() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="font-display text-lg tracking-tight text-ink">
              Kalamkala
            </Link>
            <span className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-champagne">
              Admin
            </span>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-ink/60 hover:text-ink"
          >
            <ArrowLeftIcon aria-hidden="true" className="size-3" />
            Kembali ke dasbor
          </Link>
        </div>
        <nav
          aria-label="Navigasi admin"
          className="mx-auto flex w-full max-w-6xl flex-wrap gap-6 px-6"
        >
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              aria-current={pathname === item.to ? 'page' : undefined}
              className={navClass(pathname === item.to)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-10 sm:py-14">
        <Outlet />
      </main>
    </div>
  )
}
