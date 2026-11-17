import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

const DETAILS = [
  { title: 'Undangan', body: 'Satu undangan untuk setiap tamu.' },
  { title: 'Acara', body: 'Jadwal dan lokasi dalam satu halaman.' },
  { title: 'RSVP', body: 'Konfirmasi kehadiran langsung tercatat.' },
]

function Home() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
      <header className="flex items-baseline justify-between gap-6 border-b border-line pb-6">
        <p className="font-serif text-lg tracking-tight">Kalamkala</p>
        <p className="text-[0.69rem] font-semibold uppercase tracking-[0.18em] text-champagne">
          Undangan Digital
        </p>
      </header>

      <main className="mt-16">
        <h1 className="max-w-2xl font-serif text-4xl leading-[1.08] sm:text-5xl">
          Undangan perayaan Indonesia dalam satu tautan yang tenang.
        </h1>
        <p className="mt-6 max-w-xl text-[0.98rem] leading-7 text-ink/80">
          Tamu membuka undangan, membaca jadwal, dan mengonfirmasi kehadiran tanpa
          memasang aplikasi. Setiap undangan disusun dari templat yang rapi, siap
          dibagikan lewat WhatsApp.
        </p>

        <dl className="mt-16 grid divide-y divide-line border-t border-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {DETAILS.map((detail) => (
            <div key={detail.title} className="py-6 sm:px-6 sm:first:pl-0 sm:last:pr-0">
              <dt className="text-[0.69rem] font-semibold uppercase tracking-[0.18em] text-champagne">
                {detail.title}
              </dt>
              <dd className="mt-2 text-sm leading-6 text-ink/75">{detail.body}</dd>
            </div>
          ))}
        </dl>
      </main>

      <footer className="mt-16 border-t border-line pt-6 text-xs tracking-wide text-champagne">
        Kalamkala — undangan untuk perayaan di Indonesia
      </footer>
    </div>
  )
}
