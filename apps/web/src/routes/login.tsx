import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'

import { authClient } from '../lib/auth-client'
import { safeRedirectPath } from '../lib/redirect'
import { getSessionUser } from '../server/auth-session'

type LoginSearch = { redirect?: string }

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const user = await getSessionUser()
    if (user !== null) {
      throw redirect({ href: safeRedirectPath(search.redirect) })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  const search = Route.useSearch()
  const destination = safeRedirectPath(search.redirect)
  const [status, setStatus] = useState<'idle' | 'redirecting' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const signInWithGoogle = async () => {
    if (status === 'redirecting') return

    setStatus('redirecting')
    setErrorMessage('')

    try {
      const result = await authClient.signIn.social({
        provider: 'google',
        callbackURL: `${window.location.origin}${destination}`,
      })

      if (result.error !== null && result.error !== undefined) {
        setStatus('error')
        setErrorMessage('Google menolak permintaan masuk. Silakan coba lagi.')
      }
    } catch {
      setStatus('error')
      setErrorMessage(
        'Tidak dapat menghubungi layanan masuk. Periksa koneksi lalu coba lagi.',
      )
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <header className="flex items-baseline justify-between gap-6 border-b border-line pb-6">
        <Link to="/" className="font-display text-lg tracking-tight text-ink">
          Kalamkala
        </Link>
        <p className="text-[0.69rem] font-semibold uppercase tracking-[0.18em] text-champagne">
          Undangan Digital
        </p>
      </header>

      <main className="mt-12">
        <h1 className="font-display text-4xl leading-[1.05] text-ink">
          Masuk ke akun Anda
        </h1>
        <p className="mt-4 text-sm leading-6 text-ink/70">
          Gunakan akun Google untuk mengelola undangan, daftar tamu, dan konfirmasi
          kehadiran. Kami tidak menyimpan kata sandi.
        </p>

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={status === 'redirecting'}
          className="mt-10 flex w-full items-center justify-center border border-ink bg-ink px-5 py-3 text-sm font-semibold text-paper transition-colors hover:bg-champagne disabled:cursor-progress disabled:opacity-70"
        >
          {status === 'redirecting' ? 'Mengalihkan…' : 'Lanjutkan dengan Google'}
        </button>

        <div className="mt-4 min-h-6" aria-live="polite">
          {status === 'error' ? (
            <p role="alert" className="text-sm leading-6 text-[#9f3030]">
              {errorMessage}
            </p>
          ) : null}
        </div>

        <p className="mt-10 border-t border-line pt-6 text-xs leading-5 text-ink/60">
          Dengan melanjutkan, akun Google Anda dipakai hanya untuk mengenali pemilik
          undangan.
        </p>
      </main>

      <footer className="mt-12 text-xs text-champagne">
        <Link to="/" className="text-champagne">
          Kembali ke halaman utama
        </Link>
      </footer>
    </div>
  )
}
