import {
  ChatCircleDots,
  Images,
  QrCode,
  Ticket,
  Wallet,
  WhatsappLogo,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'

import { Reveal } from './Reveal'

type Feature = {
  icon: Icon
  title: string
  body: string
}

const FEATURES: readonly Feature[] = [
  {
    icon: Ticket,
    title: 'Undangan per tamu',
    body: 'Satu tautan menyapa setiap tamu dengan namanya sendiri, tanpa menyusun ulang halaman.',
  },
  {
    icon: Images,
    title: 'Galeri WebP cepat',
    body: 'Foto dikompres ke WebP, jadi halaman tetap ringan dibuka dari jaringan seluler.',
  },
  {
    icon: WhatsappLogo,
    title: 'Sebar WhatsApp langsung',
    body: 'Kirim tautan personal lewat WhatsApp tanpa menyalin pesan satu per satu.',
  },
  {
    icon: ChatCircleDots,
    title: 'RSVP & buku tamu',
    body: 'Konfirmasi kehadiran, jumlah tamu, dan ucapan terkumpul di satu halaman.',
  },
  {
    icon: QrCode,
    title: 'QR check-in',
    body: 'Tamu datang, kode dipindai, dan daftar hadir langsung tercatat rapi.',
  },
  {
    icon: Wallet,
    title: 'Amplop digital',
    body: 'Rekening dan QRIS tampil di undangan, tanpa perlu bertanya lewat chat.',
  },
]

export function Features() {
  return (
    <section className="border-b border-line py-16 sm:py-20">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 className="font-display text-3xl leading-tight sm:text-4xl">
          Yang disiapkan untuk setiap perayaan
        </h2>
        <p className="max-w-sm text-sm leading-6 text-ink/60">
          Alat yang benar-benar dipakai tamu, bukan daftar fitur yang tidak pernah dibuka.
        </p>
      </div>

      <ul className="mt-10 grid gap-px border-t border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature, index) => (
          <Reveal
            key={feature.title}
            delay={index * 0.05}
            className="bg-paper py-7 sm:px-7"
          >
            <feature.icon
              size={26}
              weight="light"
              aria-hidden="true"
              className="text-champagne"
            />
            <h3 className="mt-4 text-sm font-semibold tracking-wide text-ink">
              {feature.title}
            </h3>
            <p className="mt-2 max-w-xs text-sm leading-6 text-ink/65">{feature.body}</p>
          </Reveal>
        ))}
      </ul>
    </section>
  )
}
