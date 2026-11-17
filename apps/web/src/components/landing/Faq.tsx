import { CaretDown } from '@phosphor-icons/react'

const FAQ_ITEMS = [
  {
    question: 'Kapan undangan bisa dibuka tamu?',
    answer:
      'Setelah Anda menekan terbitkan. Sebelum itu undangan berstatus draf dan hanya bisa dibuka dari akun Anda.',
  },
  {
    question: 'Bisakah mengganti tema atau palet setelah terbit?',
    answer:
      'Bisa. Isi undangan dan tampilan disimpan terpisah, jadi mengganti tema atau palet tidak mengubah teks, jadwal, atau daftar tamu.',
  },
  {
    question: 'Bagaimana tamu menerima undangan?',
    answer:
      'Lewat tautan personal yang dikirim di WhatsApp. Nama tamu yang dituju sudah tertulis di halaman, tanpa perlu mengetik ulang.',
  },
  {
    question: 'Apakah undangan bisa dikunci PIN?',
    answer:
      'Ya. Undangan privat memakai PIN empat sampai enam digit; tamu memasukkan PIN sebelum isi undangan ditampilkan.',
  },
  {
    question: 'Bagaimana pembayaran paket Premium?',
    answer:
      'Pembayaran diproses lewat gateway pembayaran dan undangan aktif setelah pembayaran terkonfirmasi. Tidak ada langganan bulanan.',
  },
  {
    question: 'Di mana data undangan dan tamu disimpan?',
    answer:
      'Di database Cloudflare D1 milik aplikasi. RSVP dan ucapan hanya tampil pada undangan yang mengizinkannya.',
  },
]

export function Faq() {
  return (
    <section className="border-b border-line py-16 sm:py-20">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="text-[0.69rem] font-semibold uppercase tracking-[0.18em] text-champagne">
            Pertanyaan
          </p>
          <h2 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
            Hal yang biasanya ditanyakan
          </h2>
        </div>

        <div className="border-t border-line">
          {FAQ_ITEMS.map((item) => (
            <details key={item.question} className="group border-b border-line py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-sm font-semibold text-ink marker:content-none">
                {item.question}
                <CaretDown
                  size={16}
                  weight="light"
                  aria-hidden="true"
                  className="shrink-0 text-champagne transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
                />
              </summary>
              <p className="mt-3 max-w-xl text-sm leading-7 text-ink/70">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
