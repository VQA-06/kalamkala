import { useEffect, useMemo, useRef, useState } from 'react'

import { SECTION_IDS } from '@kalamkala/contracts'
import type { AppearanceConfig, MasterInvitation } from '@kalamkala/contracts'
import { loadTemplate } from '@kalamkala/templates/registry'
import { createTemplateContext } from '@kalamkala/templates/sdk'
import type { TemplateManifest } from '@kalamkala/templates/sdk'

import { injectFonts } from '../../lib/theme-fonts'

const PREVIEW_AUDIO_URL = '/preview/keraton-ambience.wav'
const PREVIEW_QRIS_URL = '/preview/qris-placeholder.svg'
const PREVIEW_MEDIA_URL = '/preview/media-placeholder.svg'
/** Only used when the preview document has no audio key at all. */
const PREVIEW_AUDIO_SENTINEL = 'preview/audio/ambience'
const PREVIEW_RSVP_ERROR = 'Mode pratinjau: konfirmasi tidak dikirim.'

export type ThemePreviewProps = {
  templateId: string
  manifest: TemplateManifest
  preview: MasterInvitation
  initialPaletteId?: string
  /** Defaults to true; hosts can hide the chips in dense catalog cards. */
  showPaletteControls?: boolean
  className?: string
  onOpened?: () => void
}

const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Mounts a real theme against neutral preview media and no server wiring.
 * Palette chips replace the theme tokens and re-mount, keeping the opened
 * state and scroll position so comparing palettes does not reset the visitor.
 */
export function ThemePreview({
  templateId,
  manifest,
  preview,
  initialPaletteId,
  showPaletteControls = true,
  className,
  onOpened,
}: ThemePreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const openedRef = useRef(false)
  const restoreScrollRef = useRef<number | null>(null)
  const restoreInnerScrollRef = useRef<number | null>(null)
  const onOpenedRef = useRef(onOpened)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [opened, setOpened] = useState(false)

  const [paletteId, setPaletteId] = useState(() => {
    const requested =
      initialPaletteId === undefined
        ? undefined
        : manifest.palettes.find((candidate) => candidate.id === initialPaletteId)
    return requested?.id ?? manifest.palettes[0]?.id ?? ''
  })

  const palette = manifest.palettes.find((candidate) => candidate.id === paletteId)

  useEffect(() => {
    onOpenedRef.current = onOpened
  }, [onOpened])

  const content = useMemo<MasterInvitation>(() => {
    const audioKey = preview.media.audioKey ?? PREVIEW_AUDIO_SENTINEL
    return { ...preview, media: { ...preview.media, audioKey } }
  }, [preview])

  const qrisKey = content.gifts.qrisImageKey

  useEffect(() => {
    const container = containerRef.current
    if (container === null || palette === undefined) return

    let disposed = false
    let cleanedUp = false
    let cleanup: (() => void) | null = null
    setPhase('loading')
    const removeFonts = injectFonts(manifest.fonts ?? [])

    const resolvePreviewMediaUrl = (key: string | null): string | null => {
      if (key === null || key.length === 0) return null
      if (key === content.media.audioKey) return PREVIEW_AUDIO_URL
      if (qrisKey !== null && key === qrisKey) return PREVIEW_QRIS_URL
      return PREVIEW_MEDIA_URL
    }

    void loadTemplate(templateId)
      .then((template) => {
        if (disposed) return

        const appearance: AppearanceConfig = {
          themeTokens: palette.tokens,
          fontPairingId: manifest.id,
          sectionOrder: [...SECTION_IDS],
          hiddenSections: [],
          sectionTitles: {},
        }

        const context = createTemplateContext({
          data: content,
          appearance,
          guest: null,
          wishes: [],
          rsvpSummary: null,
          state: {
            isPreview: true,
            isOpened: openedRef.current,
            locale: content.settings.locale,
            reducedMotion: prefersReducedMotion(),
          },
          actions: {
            openInvitation: () => {
              openedRef.current = true
              setOpened(true)
              onOpenedRef.current?.()
            },
            submitRsvp: async () => ({ ok: false, error: PREVIEW_RSVP_ERROR }),
          },
          utils: {
            resolveMediaUrl: resolvePreviewMediaUrl,
          },
        })

        const previousBodyOverflow = document.body.style.overflow
        try {
          cleanup = template.mount(container, context)
        } finally {
          // The theme locks the body for its fixed gate; embedded previews must
          // not freeze the host page. Catalog modals keep their own prior value.
          document.body.style.overflow = previousBodyOverflow
        }
        setPhase('ready')

        const target = restoreScrollRef.current
        const innerTarget = restoreInnerScrollRef.current
        restoreScrollRef.current = null
        restoreInnerScrollRef.current = null
        if (target !== null || innerTarget !== null) {
          window.requestAnimationFrame(() => {
            if (target !== null) window.scrollTo({ top: target })
            if (innerTarget !== null) viewportRef.current?.scrollTo({ top: innerTarget })
          })
        }
      })
      .catch(() => {
        if (!disposed) setPhase('error')
      })

    return () => {
      if (cleanedUp) return
      cleanedUp = true
      disposed = true
      cleanup?.()
      removeFonts()
      container.replaceChildren()
    }
  }, [templateId, manifest, content, palette, qrisKey])

  const selectPalette = (nextId: string): void => {
    if (nextId === paletteId) return
    restoreScrollRef.current = window.scrollY
    restoreInnerScrollRef.current = viewportRef.current?.scrollTop ?? 0
    setPaletteId(nextId)
  }

  const unavailable = palette === undefined

  return (
    <div className={className}>
      {showPaletteControls && manifest.palettes.length > 0 ? (
        <div
          className="mb-4 flex flex-wrap items-center justify-center gap-2"
          role="group"
          aria-label="Palet warna"
        >
          {manifest.palettes.map((option) => {
            const selected = option.id === palette?.id
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                onClick={() => selectPalette(option.id)}
                className={`flex items-center gap-2 border px-3 py-2 text-xs transition-colors ${
                  selected
                    ? 'border-champagne bg-white/60 text-ink'
                    : 'border-line text-ink/70 hover:border-champagne'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-4 w-4 border border-line"
                  style={{ backgroundColor: option.tokens.bgPrimary }}
                >
                  <span
                    className="block h-1/2 w-full"
                    style={{ backgroundColor: option.tokens.accent }}
                  />
                </span>
                {option.name}
              </button>
            )
          })}
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-[430px] border border-line bg-paper shadow-[0_18px_40px_rgba(24,20,16,0.08)]">
        <div
          ref={viewportRef}
          className={`relative h-[clamp(520px,78vh,820px)] ${
            opened ? 'overflow-y-auto' : 'overflow-hidden'
          }`}
          style={{ transform: 'translateZ(0)' }}
        >
          <div ref={containerRef} className="min-h-full" />

          {phase === 'loading' && !unavailable ? (
            <p
              className="absolute inset-x-0 top-6 px-6 text-center text-sm text-ink/60"
              role="status"
            >
              Menyiapkan pratinjau…
            </p>
          ) : null}
          {phase === 'error' || unavailable ? (
            <p
              className="absolute inset-x-0 top-6 px-6 text-center text-sm leading-6 text-ink/70"
              role="status"
            >
              Pratinjau tema gagal dimuat.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
