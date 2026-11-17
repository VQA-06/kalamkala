import { templateRegistry } from '@kalamkala/templates/registry'
import { Link } from '@tanstack/react-router'

import { Reveal } from './Reveal'

const featured = templateRegistry[0]

export function CatalogTeaser() {
  return (
    <section className="py-16 sm:py-20">
      <div className="grid gap-10 border-t border-line pt-10 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="max-w-xl">
          <p className="text-[0.69rem] font-semibold uppercase tracking-[0.18em] text-champagne">
            Katalog
          </p>
          <h2 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
            Satu tema, tiga nuansa.
          </h2>
          <p className="mt-4 text-sm leading-7 text-ink/70">
            Keraton Heritage tampil dalam tiga palet, dan setiap tema baru membawa paletnya
            sendiri. Pilih nuansa yang paling dekat dengan acara Anda, lalu sesuaikan
            warnanya kapan saja.
          </p>

          {featured === undefined ? null : (
            <ul className="mt-7 flex flex-wrap gap-3">
              {featured.manifest.palettes.map((palette) => (
                <li
                  key={palette.id}
                  className="flex items-center gap-2 border border-line px-3 py-1.5 text-xs text-ink/70"
                >
                  <span
                    aria-hidden="true"
                    className="size-3 rounded-full border border-line"
                    style={{ backgroundColor: palette.tokens.accent }}
                  />
                  {palette.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <Reveal className="lg:pb-1">
          <Link
            to="/katalog"
            className="inline-block border border-ink px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-ink hover:text-paper"
          >
            Buka katalog tema
          </Link>
        </Reveal>
      </div>
    </section>
  )
}
