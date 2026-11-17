import { Check } from '@phosphor-icons/react'
import { Link } from '@tanstack/react-router'

import { Reveal } from './Reveal'

const BASIC_CAPABILITIES = [
  'Tema kategori Basic',
  'RSVP dan buku tamu',
  'Galeri foto',
  'Undangan per tamu',
  'Sebar tautan WhatsApp',
]

const PREMIUM_CAPABILITIES = [
  'Semua tema, termasuk Keraton Heritage',
  'QR check-in tamu',
  'Amplop digital dan QRIS',
  'Tanpa watermark platform',
  'Prioritas dukungan',
]

function CapabilityList({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-6 space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-sm leading-6 text-ink/75">
          <Check
            size={16}
            weight="light"
            aria-hidden="true"
            className="mt-1 shrink-0 text-champagne"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function Pricing() {
  return (
    <section className="border-b border-line py-16 sm:py-20">
      <div className="max-w-2xl">
        <p className="text-[0.69rem] font-semibold uppercase tracking-[0.18em] text-champagne">
          Biaya
        </p>
        <h2 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
          Susun gratis, bayar saat menerbitkan.
        </h2>
        <p className="mt-4 text-sm leading-7 text-ink/70">
          Mulai tanpa biaya, lalu pilih paket saat undangan siap dibagikan. Tidak ada
          hitungan per tamu dan tidak ada langganan bulanan.
        </p>
      </div>

      <div className="mt-10 grid border-t border-line lg:grid-cols-2">
        <Reveal className="border-b border-line py-8 lg:border-b-0 lg:border-r lg:pr-10">
          <h3 className="font-display text-2xl">Basic</h3>
          <p className="mt-1 text-sm text-ink/60">Untuk perayaan yang ringkas.</p>
          <CapabilityList items={BASIC_CAPABILITIES} />
          <Link
            to="/katalog"
            className="mt-8 inline-block border-b border-champagne pb-1 text-sm font-semibold text-ink"
          >
            Lihat tema Basic
          </Link>
        </Reveal>

        <Reveal delay={0.08} className="py-8 lg:pl-10">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="font-display text-2xl">Premium</h3>
            <p className="text-[0.69rem] font-semibold uppercase tracking-[0.16em] text-champagne">
              Sekali bayar
            </p>
          </div>
          <p className="mt-1 text-sm text-ink/60">Untuk acara yang lebih besar.</p>
          <CapabilityList items={PREMIUM_CAPABILITIES} />
          <Link
            to="/login"
            search={{ redirect: '/dashboard' }}
            className="mt-8 inline-block border border-ink bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-champagne"
          >
            Mulai menyusun
          </Link>
        </Reveal>
      </div>
    </section>
  )
}
