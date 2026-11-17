import { useEffect, useRef, useState } from 'react'

import { loadTemplate } from '@kalamkala/templates/registry'
import { createTemplateContext } from '@kalamkala/templates/sdk'
import type {
  PublicWish,
  RsvpSubmitResult,
  SubmitRsvpInput,
} from '@kalamkala/templates/sdk'

import type { PublicInvitationPayload, PublicWishPage } from '../lib/public-invitation-types'
import { resolveMediaUrl } from '../lib/media-url'
import { injectFonts } from '../lib/theme-fonts'
import { loadMoreWishes, submitRsvp } from '../server/public-invitations'
import { TurnstileWidget } from './TurnstileWidget'

const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export type TemplateHostProps = {
  payload: PublicInvitationPayload
}

/**
 * Mounts one vanilla theme inside a phone-width frame, keeps the font and
 * Turnstile lifecycles, and re-mounts after loading more wishes.
 */
export function TemplateHost({ payload }: TemplateHostProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [mountVersion, setMountVersion] = useState(0)
  const [wishItems, setWishItems] = useState<readonly PublicWish[]>(payload.wishes.items)
  const [nextCursor, setNextCursor] = useState<string | null>(payload.wishes.nextCursor)
  const [loadingMore, setLoadingMore] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)

  const tokenRef = useRef<string | null>(null)
  const wishesRef = useRef<readonly PublicWish[]>(wishItems)
  const openedRef = useRef(false)
  const restoreScrollRef = useRef<number | null>(null)

  useEffect(() => {
    tokenRef.current = turnstileToken
  }, [turnstileToken])

  wishesRef.current = wishItems

  useEffect(() => {
    const container = containerRef.current
    const invitation = payload.invitation
    if (container === null || invitation === null) return

    let disposed = false
    let cleanup: (() => void) | null = null
    setPhase('loading')
    const removeFonts = injectFonts(payload.theme.fonts)

    void loadTemplate(payload.theme.templateId)
      .then((template) => {
        if (disposed) return

        const context = createTemplateContext({
          data: invitation.content,
          appearance: payload.theme.appearance,
          guest: invitation.guest,
          wishes: wishesRef.current,
          rsvpSummary: null,
          state: {
            isPreview: false,
            isOpened: openedRef.current,
            locale: invitation.content.settings.locale,
            reducedMotion: prefersReducedMotion(),
          },
          actions: {
            openInvitation: () => {
              openedRef.current = true
            },
            submitRsvp: async (input: SubmitRsvpInput): Promise<RsvpSubmitResult> => {
              const token = tokenRef.current
              if (token === null) {
                return {
                  ok: false,
                  error: 'Verifikasi keamanan belum siap. Silakan muat ulang halaman.',
                }
              }

              try {
                const result = await submitRsvp({
                  data: {
                    slug: payload.slug,
                    guestName: input.guestName,
                    attendance: input.attendance,
                    guestCount: input.guestCount,
                    message: input.message,
                    turnstileToken: token,
                    guestToken: invitation.guest?.qrToken ?? undefined,
                  },
                })
                if (result.ok) {
                  // Turnstile tokens are single-use; ask for a fresh widget.
                  setTurnstileToken(null)
                  setTurnstileResetKey((key) => key + 1)
                }
                return result
              } catch {
                return { ok: false, error: 'Konfirmasi gagal dikirim. Silakan coba lagi.' }
              }
            },
          },
          utils: {
            resolveMediaUrl: (key) => resolveMediaUrl(payload.browser.cdnBaseUrl, key),
          },
        })

        cleanup = template.mount(container, context)
        setPhase('ready')

        const target = restoreScrollRef.current
        if (target !== null) {
          restoreScrollRef.current = null
          window.requestAnimationFrame(() => window.scrollTo({ top: target }))
        }
      })
      .catch(() => {
        if (!disposed) setPhase('error')
      })

    return () => {
      disposed = true
      cleanup?.()
      removeFonts()
      container.replaceChildren()
    }
  }, [payload, mountVersion])

  const handleLoadMore = async (): Promise<void> => {
    if (nextCursor === null || loadingMore) return

    setLoadingMore(true)
    try {
      const page: PublicWishPage = await loadMoreWishes({
        data: { slug: payload.slug, cursor: nextCursor, limit: 10 },
      })
      setWishItems((current) => [...current, ...page.items])
      setNextCursor(page.nextCursor)
      restoreScrollRef.current = window.scrollY
      setMountVersion((version) => version + 1)
    } catch {
      // Keep the cursor so the guest can retry.
    } finally {
      setLoadingMore(false)
    }
  }

  if (payload.invitation === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-6">
        <p className="max-w-sm text-center text-sm leading-6 text-ink/70">
          Undangan ini tidak dapat ditampilkan saat ini.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto w-full min-w-[320px] max-w-[430px] sm:my-8 sm:border sm:border-line sm:bg-paper sm:shadow-[0_18px_40px_rgba(24,20,16,0.08)]">
        <div ref={containerRef} className="min-h-[60vh]" />

        {phase === 'loading' ? (
          <p className="px-6 py-4 text-center text-sm text-ink/60" role="status">
            Menyiapkan undangan…
          </p>
        ) : null}
        {phase === 'error' ? (
          <p className="px-6 py-4 text-center text-sm leading-6 text-ink/70" role="status">
            Undangan gagal dimuat. Muat ulang halaman untuk mencoba lagi.
          </p>
        ) : null}

        <div className="border-t border-line px-4 py-3">
          <TurnstileWidget
            siteKey={payload.browser.turnstileSiteKey}
            onToken={setTurnstileToken}
            resetKey={turnstileResetKey}
          />
        </div>

        {nextCursor !== null ? (
          <div className="border-t border-line px-4 py-5 text-center">
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => {
                void handleLoadMore()
              }}
              className="border border-line px-5 py-3 text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink/70 transition-colors hover:border-champagne hover:text-ink disabled:cursor-wait disabled:opacity-60"
            >
              {loadingMore ? 'Memuat ucapan…' : 'Muat lebih banyak ucapan'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
