import { Link, createFileRoute, redirect } from '@tanstack/react-router'

import { CreateInvitationDialog } from '../components/dashboard/CreateInvitationDialog'
import { InvitationCard } from '../components/dashboard/InvitationCard'
import { EmptyState, PageHeading } from '../components/dashboard/ui'
import { listOwnedInvitations } from '../server/dashboard/invitations'

export const Route = createFileRoute('/dashboard/')({
  loader: async () => {
    const data = await listOwnedInvitations()
    if (data === null) {
      throw redirect({ to: '/login', search: { redirect: '/dashboard' } })
    }
    return data
  },
  component: DashboardIndexPage,
})

function DashboardIndexPage() {
  const { invitations } = Route.useLoaderData()

  return (
    <div>
      <PageHeading
        eyebrow="Undangan Anda"
        title="Daftar undangan"
        description="Sunting isi, kelola tamu, dan terbitkan undangan dari satu tempat."
        actions={<CreateInvitationDialog />}
      />

      <div className="mt-8">
        {invitations.length === 0 ? (
          <EmptyState
            title="Belum ada undangan"
            body="Mulai dari tema Keraton Heritage, isi cerita dan jadwal acara, lalu terbitkan saat siap dibagikan."
            action={
              <Link to="/katalog" className="text-sm font-semibold text-champagne">
                Lihat katalog tema
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {invitations.map((invitation) => (
              <InvitationCard key={invitation.id} invitation={invitation} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-10 border-t border-line pt-5">
        <Link to="/katalog" className="text-sm font-semibold text-champagne">
          Butuh tema lain? Buka katalog
        </Link>
      </div>
    </div>
  )
}
