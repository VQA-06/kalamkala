import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  MasterInvitationSchema,
  type InvitationTier,
  type MasterInvitation,
  type ThemeTokens,
} from '@kalamkala/contracts'
import { templateRegistry } from '@kalamkala/templates/registry'
import type {
  TemplateManifest,
  TemplateOccasion,
} from '@kalamkala/templates/sdk'

import { ThemePreview } from '../components/theme-preview'

type CatalogSearch = { tema?: string }

export const Route = createFileRoute('/katalog')({
  validateSearch: (search: Record<string, unknown>): CatalogSearch => ({
    tema: typeof search.tema === 'string' ? search.tema : undefined,
  }),
  head: () => ({
    meta: [
      { title: 'Katalog Tema — Kalamkala' },
      {
        name: 'description',
        content:
          'Jelajahi tema undangan digital Kalamkala untuk pernikahan, lamaran, khitanan, aqiqah, dan ulang tahun.',
      },
    ],
  }),
  component: CatalogPage,
})

const OCCASION_LABELS: Record<TemplateOccasion, string> = {
  pernikahan: 'Pernikahan',
  lamaran: 'Lamaran',
  khitanan: 'Khitanan',
  aqiqah: 'Aqiqah',
  'ulang-tahun': 'Ulang tahun',
}

const TIER_LABELS: Record<InvitationTier, string> = {
  BASIC: 'Basic',
  PREMIUM: 'Premium',
}

const SWATCH_TOKENS = [
  'bgPrimary',
  'bgSecondary',
  'accent',
  'accentContrast',
  'border',
] as const satisfies ReadonlyArray<keyof ThemeTokens>

type OccasionFilter = 'semua' | TemplateOccasion
type TierFilter = 'semua' | InvitationTier

const chipClass = (selected: boolean): string =>
  `cursor-pointer border px-3 py-1.5 text-[0.64rem] font-semibold uppercase tracking-[0.14em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne ${
    selected
      ? 'border-ink bg-ink text-paper'
      : 'border-line bg-transparent text-ink/65 hover:border-champagne hover:text-ink'
  }`

function CatalogPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()

  const [occasion, setOccasion] = useState<OccasionFilter>('semua')
  const [tier, setTier] = useState<TierFilter>('semua')

  const [preview, setPreview] = useState<MasterInvitation | null>(null)
  const [previewFailed, setPreviewFailed] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const availableOccasions = useMemo(() => {
    const seen = new Set<TemplateOccasion>()
    for (const entry of templateRegistry) {
      for (const value of entry.manifest.occasions) {
        seen.add(value)
      }
    }
    return [...seen]
  }, [])

  const visibleThemes = useMemo(
    () =>
      templateRegistry.filter(({ manifest }) => {
        const matchesOccasion =
          occasion === 'semua' || manifest.occasions.includes(occasion)
        const matchesTier = tier === 'semua' || manifest.tier === tier
        return matchesOccasion && matchesTier
      }),
    [occasion, tier],
  )

  const activeEntry = useMemo(
    () =>
      search.tema === undefined
        ? undefined
        : templateRegistry.find(
            (entry) => entry.manifest.id === search.tema,
          ),
    [search.tema],
  )

  const closePreview = useCallback(() => {
    void navigate({ to: '/katalog' })
  }, [navigate])

  useEffect(() => {
    if (!activeEntry) return

    let cancelled = false
    setPreview(null)
    setPreviewFailed(false)

    activeEntry
      .loadPreview()
      .then((raw) => {
        if (cancelled) return
        const parsed = MasterInvitationSchema.safeParse(raw)
        if (!parsed.success) {
          setPreviewFailed(true)
          return
        }
        setPreview(parsed.data)
      })
      .catch(() => {
        if (!cancelled) setPreviewFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [activeEntry])

  useEffect(() => {
    if (!activeEntry) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      void navigate({ to: '/katalog' })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [activeEntry, navigate])

  const resetFilters = (): void => {
    setOccasion('semua')
    setTier('semua')
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-14 sm:py-20">
      <header className="flex flex-wrap items-baseline justify-between gap-4 border-b border-line pb-6">
        <Link to="/" className="font-display text-lg tracking-tight text-ink">
          Kalamkala
        </Link>
        <div className="flex items-center gap-5 text-xs">
          <Link to="/katalog" className="text-ink/60">
            Katalog
          </Link>
          <Link to="/login" className="font-semibold text-champagne">
            Masuk
          </Link>
        </div>
      </header>

      <main className="mt-14">
        <p className="text-[0.69rem] font-semibold uppercase tracking-[0.18em] text-champagne">
          Katalog tema
        </p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl leading-[1.06] text-ink sm:text-5xl">
          Tema undangan yang disusun seperti alat tulis.
        </h1>
        <p className="mt-5 max-w-xl text-[0.95rem] leading-7 text-ink/70">
          Setiap tema membawa palet, tipografi, dan susunan bagiannya sendiri.
          Pratinjau di bawah memakai data contoh, bukan tangkapan layar.
        </p>

        <section
          aria-labelledby="filter-heading"
          className="mt-10 border-y border-line py-5"
        >
          <h2 id="filter-heading" className="sr-only">
            Filter katalog
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-2 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-ink/45">
              Kategori
            </span>
            <button
              type="button"
              aria-pressed={occasion === 'semua'}
              onClick={() => setOccasion('semua')}
              className={chipClass(occasion === 'semua')}
            >
              Semua
            </button>
            {availableOccasions.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={occasion === value}
                onClick={() => setOccasion(value)}
                className={chipClass(occasion === value)}
              >
                {OCCASION_LABELS[value]}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="mr-2 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-ink/45">
              Tingkat
            </span>
            <button
              type="button"
              aria-pressed={tier === 'semua'}
              onClick={() => setTier('semua')}
              className={chipClass(tier === 'semua')}
            >
              Semua
            </button>
            {(['BASIC', 'PREMIUM'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={tier === value}
                onClick={() => setTier(value)}
                className={chipClass(tier === value)}
              >
                {TIER_LABELS[value]}
              </button>
            ))}
          </div>
        </section>

        <div className="mt-6 flex items-baseline justify-between gap-4">
          <p className="text-xs text-ink/55">
            {visibleThemes.length} tema ditampilkan
          </p>
          {occasion !== 'semua' || tier !== 'semua' ? (
            <button
              type="button"
              onClick={resetFilters}
              className="cursor-pointer border-0 bg-transparent p-0 text-xs font-semibold text-champagne underline decoration-line underline-offset-4"
            >
              Hapus filter
            </button>
          ) : null}
        </div>

        {visibleThemes.length === 0 ? (
          <div className="mt-8 border border-line px-6 py-12">
            <p className="font-display text-2xl text-ink">
              Belum ada tema yang cocok.
            </p>
            <p className="mt-2 max-w-md text-sm leading-6 text-ink/65">
              Katalog saat ini belum memiliki tema untuk kombinasi filter ini.
              Coba kategori atau tingkat lain.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-6 cursor-pointer border border-line px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-ink hover:border-champagne focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne"
            >
              Tampilkan semua tema
            </button>
          </div>
        ) : (
          <ul className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {visibleThemes.map((entry) => (
              <li key={entry.manifest.id}>
                <ThemeCard manifest={entry.manifest} />
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="mt-16 border-t border-line pt-6 text-xs text-champagne">
        Kalamkala — undangan untuk perayaan di Indonesia
      </footer>

      {activeEntry ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-title"
          className="fixed inset-0 z-50 flex flex-col bg-paper"
        >
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-3">
            <div>
              <h2 id="preview-title" className="font-display text-xl text-ink">
                Pratinjau {activeEntry.manifest.name}
              </h2>
              <p className="mt-0.5 text-[0.62rem] uppercase tracking-[0.16em] text-ink/50">
                {TIER_LABELS[activeEntry.manifest.tier]} ·{' '}
                {activeEntry.manifest.occasions
                  .map((value) => OCCASION_LABELS[value])
                  .join(' · ')}
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closePreview}
              aria-label="Tutup pratinjau"
              className="cursor-pointer border border-line px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-ink hover:border-champagne focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne"
            >
              Tutup
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {previewFailed ? (
              <div className="mx-auto flex max-w-md flex-col items-start px-6 py-16">
                <p
                  role="alert"
                  className="text-sm leading-6 text-ink/70"
                >
                  Pratinjau tidak dapat dimuat. Tutup jendela ini lalu coba lagi.
                </p>
              </div>
            ) : preview === null ? (
              <div className="flex min-h-[60vh] items-center justify-center px-6">
                <p
                  role="status"
                  aria-live="polite"
                  className="text-sm text-ink/60"
                >
                  Memuat pratinjau tema…
                </p>
              </div>
            ) : (
              <ThemePreview
                templateId={activeEntry.manifest.id}
                manifest={activeEntry.manifest}
                preview={preview}
                showPaletteControls
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ThemeCard({ manifest }: { manifest: TemplateManifest }) {
  const primaryPalette = manifest.palettes[0]
  const tokens = primaryPalette?.tokens

  return (
    <article className="flex h-full flex-col border border-line bg-paper">
      <div
        className="border-b p-6"
        style={{
          backgroundColor: tokens?.bgPrimary,
          borderColor: tokens?.border,
          color: tokens?.textPrimary,
        }}
      >
        <div className="flex min-h-56 flex-col justify-between">
          <p
            className="text-[0.62rem] font-semibold uppercase tracking-[0.2em]"
            style={{ color: tokens?.textMuted }}
          >
            Koleksi {TIER_LABELS[manifest.tier]}
          </p>
          <div>
            <p className="font-display text-3xl leading-none">
              {manifest.name}
            </p>
            <span
              aria-hidden="true"
              className="mt-5 block h-px w-16"
              style={{ backgroundColor: tokens?.accent }}
            />
            <p
              className="mt-5 text-[0.62rem] font-semibold uppercase tracking-[0.18em]"
              style={{ color: tokens?.accent }}
            >
              Undangan digital
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="border border-line px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-champagne">
            {TIER_LABELS[manifest.tier]}
          </span>
          <span className="text-[0.68rem] text-ink/50">
            {manifest.occasions
              .map((value) => OCCASION_LABELS[value])
              .join(' · ')}
          </span>
        </div>

        <h2 className="mt-4 font-display text-2xl text-ink">{manifest.name}</h2>
        <p className="mt-2 text-sm leading-6 text-ink/65">
          Palet dan tipografi tema ini dapat diganti saat pratinjau dibuka.
        </p>

        <div className="mt-5" aria-label="Palet tema">
          <ul className="flex flex-wrap gap-x-4 gap-y-3">
            {manifest.palettes.map((palette) => (
              <li key={palette.id} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="flex items-center -space-x-1"
                >
                  {SWATCH_TOKENS.map((token) => (
                    <span
                      key={token}
                      className="inline-block size-4 rounded-full border border-ink/10"
                      style={{ backgroundColor: palette.tokens[token] }}
                    />
                  ))}
                </span>
                <span className="text-[0.66rem] tracking-wide text-ink/55">
                  {palette.name}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <Link
          to="/katalog"
          search={{ tema: manifest.id }}
          className="mt-6 inline-flex w-fit border border-ink px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-ink transition-colors hover:bg-ink hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne"
        >
          Pratinjau tema
        </Link>
      </div>
    </article>
  )
}
