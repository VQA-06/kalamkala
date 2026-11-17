import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import type { FormEvent } from 'react'

import { TemplateHost } from '../components/TemplateHost'
import type { PublicInvitationPayload } from '../lib/public-invitation-types'
import { getPublicInvitation, verifyPin } from '../server/public-invitations'

type MetaEntry =
  | { title: string }
  | { name: string; content: string }
  | { property: string; content: string }

const buildMeta = (payload: PublicInvitationPayload): MetaEntry[] => {
  const url = `${payload.browser.siteUrl}/u/${encodeURIComponent(payload.slug)}`
  const meta: MetaEntry[] = [
    { title: payload.seo.title },
    { name: 'description', content: payload.seo.description },
    { property: 'og:title', content: payload.seo.title },
    { property: 'og:description', content: payload.seo.description },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: url },
    { name: 'twitter:card', content: 'summary_large_image' },
  ]
  if (payload.seo.imageUrl !== null) {
    meta.push({ property: 'og:image', content: payload.seo.imageUrl })
    meta.push({ property: 'og:image:alt', content: payload.seo.title })
  }
  return meta
}

export const Route = createFileRoute('/u/$slug')({
  validateSearch: (search: Record<string, unknown>) => ({
    to: typeof search.to === 'string' && search.to.length > 0 ? search.to : undefined,
    g: typeof search.g === 'string' && search.g.length > 0 ? search.g : undefined,
  }),
  loaderDeps: ({ search }) => ({ to: search.to, g: search.g }),
  loader: ({ params, deps }) =>
    getPublicInvitation({ data: { slug: params.slug, to: deps.to, g: deps.g } }),
  head: ({ loaderData }) => {
    if (loaderData === undefined) {
      return { meta: [{ title: 'Undangan — Kalamkala' }] }
    }
    return { meta: buildMeta(loaderData) }
  },
  component: PublicInvitationPage,
})

function PublicInvitationPage() {
  const payload = Route.useLoaderData()

  if (payload.status === 'LIVE' || payload.status === 'POST_EVENT') {
    return <TemplateHost payload={payload} />
  }
  if (payload.status === 'PIN_REQUIRED') {
    return <PinGate payload={payload} />
  }
  if (payload.status === 'EXPIRED') {
    return <ExpiredPanel />
  }
  return <NotFoundPanel />
}

function PinGate({ payload }: { payload: PublicInvitationPayload }) {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (submitting) return

    if (!/^\d{4,6}$/u.test(pin)) {
      setError('PIN terdiri dari 4 sampai 6 digit.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const result = await verifyPin({ data: { slug: payload.slug, pin } })
      if (!result.ok) {
        setError(result.error)
        return
      }
      await router.invalidate()
    } catch {
      setError('PIN tidak dapat diverifikasi. Silakan coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6 py-16">
      <div className="w-full max-w-sm border border-line bg-paper p-8 text-center">
        <p className="text-[0.69rem] font-semibold uppercase tracking-[0.22em] text-champagne">
          Undangan Privat
        </p>
        <h1 className="mt-4 font-serif text-3xl leading-tight text-ink">{payload.seo.title}</h1>
        <p className="mt-3 text-sm leading-6 text-ink/70">
          Masukkan PIN yang Anda terima untuk membuka undangan ini.
        </p>

        <form className="mt-6 text-left" onSubmit={(event) => void onSubmit(event)}>
          <label
            className="block text-[0.69rem] font-semibold uppercase tracking-[0.18em] text-champagne"
            htmlFor="invitation-pin"
          >
            PIN
          </label>
          <input
            id="invitation-pin"
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            minLength={4}
            maxLength={6}
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            className="mt-2 w-full border border-line bg-white/70 px-3 py-3 text-center text-lg tracking-[0.4em] text-ink outline-none focus:border-champagne"
          />
          {error !== null ? (
            <p className="mt-3 text-sm leading-6 text-champagne" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="mt-5 inline-flex w-full items-center justify-center border border-ink bg-ink px-5 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-paper transition-colors hover:bg-ink/90 disabled:cursor-wait disabled:opacity-70"
          >
            {submitting ? 'Memeriksa…' : 'Buka Undangan'}
          </button>
        </form>
      </div>
    </div>
  )
}

function ExpiredPanel() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6 py-16">
      <div className="w-full max-w-md border border-line bg-paper p-8 text-center">
        <p className="text-[0.69rem] font-semibold uppercase tracking-[0.22em] text-champagne">
          Undangan
        </p>
        <h1 className="mt-4 font-serif text-3xl leading-tight text-ink">
          Undangan ini telah berakhir
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink/70">
          Masa berlaku undangan sudah selesai. Terima kasih atas perhatian dan doa Anda.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-champagne underline-offset-4 hover:underline"
        >
          Kembali ke Kalamkala
        </Link>
      </div>
    </div>
  )
}

function NotFoundPanel() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6 py-16">
      <div className="w-full max-w-md border border-line bg-paper p-8 text-center">
        <p className="text-[0.69rem] font-semibold uppercase tracking-[0.22em] text-champagne">
          Undangan
        </p>
        <h1 className="mt-4 font-serif text-3xl leading-tight text-ink">
          Undangan tidak ditemukan
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink/70">
          Tautan ini tidak tersedia atau undangan sudah tidak dipublikasikan. Periksa kembali
          tautan yang Anda terima.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-champagne underline-offset-4 hover:underline"
        >
          Kembali ke Kalamkala
        </Link>
      </div>
    </div>
  )
}
