import { Link, createFileRoute } from '@tanstack/react-router'
import { LazyMotion } from 'motion/react'

import { CatalogTeaser } from '../components/landing/CatalogTeaser'
import { Faq } from '../components/landing/Faq'
import { Features } from '../components/landing/Features'
import { PhonePreview } from '../components/landing/PhonePreview'
import { Pricing } from '../components/landing/Pricing'

const loadMotionFeatures = () => import('motion/react').then((module) => module.domAnimation)

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Kalamkala — Undangan digital untuk perayaan Indonesia' },
      {
        name: 'description',
        content:
          'Susun undangan pernikahan dan perayaan Indonesia dalam satu tautan: undangan per tamu, galeri WebP, RSVP, QR check-in, dan amplop digital.',
      },
      {
        property: 'og:title',
        content: 'Kalamkala — Undangan digital untuk perayaan Indonesia',
      },
      {
        property: 'og:description',
        content:
          'Undangan per tamu, RSVP, QR check-in, dan amplop digital untuk perayaan Indonesia. Susun gratis, bayar saat menerbitkan.',
      },
      { property: 'og:type', content: 'website' },
    ],
  }),
  component: LandingPage,
})

function LandingHeader() {
  return (
    <header className="flex flex-wrap items-baseline justify-between gap-4 border-b border-line py-6">
      <div className="flex items-baseline gap-4">
        <Link to="/" className="font-display text-2xl tracking-tight text-ink">
          Kalamkala
        </Link>
        <span className="hidden text-[0.69rem] font-semibold uppercase tracking-[0.18em] text-champagne sm:inline">
          Undangan digital
        </span>
      </div>
      <nav className="flex items-center gap-6 text-sm">
        <Link to="/katalog" className="text-ink/70 transition-colors hover:text-ink">
          Katalog
        </Link>
        <Link to="/login" className="text-ink/70 transition-colors hover:text-ink">
          Masuk
        </Link>
      </nav>
    </header>
  )
}

function Hero() {
  return (
    <section className="grid gap-14 pb-16 pt-14 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-10">
      <div>
        <p className="text-[0.69rem] font-semibold uppercase tracking-[0.18em] text-champagne">
          Undangan digital untuk perayaan Indonesia
        </p>
        <h1 className="mt-5 max-w-xl font-display text-5xl leading-[1.02] text-ink sm:text-6xl">
          Undangan perayaan, disusun dengan tenang.
        </h1>
        <p className="mt-6 max-w-lg text-[0.98rem] leading-7 text-ink/75">
          Kalamkala menyatukan cerita, jadwal acara, galeri, RSVP, dan amplop digital dalam
          satu tautan. Tamu membukanya tanpa memasang aplikasi.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-5">
          <Link
            to="/login"
            search={{ redirect: '/dashboard' }}
            className="inline-block border border-ink bg-ink px-6 py-3 text-sm font-semibold text-paper transition-colors hover:bg-champagne hover:border-champagne"
          >
            Mulai menyusun
          </Link>
          <Link
            to="/katalog"
            className="border-b border-champagne pb-1 text-sm font-semibold text-ink"
          >
            Lihat katalog
          </Link>
        </div>

        <p className="mt-10 border-t border-line pt-5 text-xs leading-5 text-ink/55">
          Susun gratis. Bayar hanya saat undangan siap diterbitkan.
        </p>
      </div>

      <div className="flex justify-center lg:justify-end">
        <PhonePreview />
      </div>
    </section>
  )
}

function LandingFooter() {
  return (
    <footer className="border-t border-line">
      <div className="flex flex-wrap items-baseline justify-between gap-4 py-8 text-xs text-ink/55">
        <p>© 2026 Kalamkala. Undangan digital untuk perayaan Indonesia.</p>
        <nav className="flex items-center gap-5">
          <Link to="/katalog" className="text-champagne">
            Katalog
          </Link>
          <Link to="/login" className="text-champagne">
            Masuk
          </Link>
        </nav>
      </div>
    </footer>
  )
}

function LandingPage() {
  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <LandingHeader />
        <main>
          <Hero />
          <Features />
          <Pricing />
          <Faq />
          <CatalogTeaser />
        </main>
        <LandingFooter />
      </div>
    </LazyMotion>
  )
}
