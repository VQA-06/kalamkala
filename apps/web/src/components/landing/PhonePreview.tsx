import type { MasterInvitation } from '@kalamkala/contracts'
import { templateRegistry } from '@kalamkala/templates/registry'
import { Suspense, lazy, useEffect, useRef, useState } from 'react'

/**
 * The theme module, preview document, and theme code all arrive after the
 * landing shell: the component chunk is loaded lazily and the preview JSON is
 * fetched through the registry entry, never bundled into the landing entry.
 */
const ThemePreview = lazy(() =>
  import('../theme-preview').then((module) => ({ default: module.ThemePreview })),
)

const featured = templateRegistry[0]

function PhoneSkeleton() {
  return (
    <div className="flex h-full min-h-[420px] flex-col gap-3 p-6" aria-hidden="true">
      <div className="h-2.5 w-24 bg-line/80 motion-safe:animate-pulse" />
      <div className="mt-12 h-8 w-4/5 bg-line/80 motion-safe:animate-pulse" />
      <div className="h-2.5 w-full bg-line/60 motion-safe:animate-pulse" />
      <div className="h-2.5 w-2/3 bg-line/60 motion-safe:animate-pulse" />
      <div className="mt-auto h-10 w-full border border-line" />
    </div>
  )
}

export function PhonePreview() {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [inView, setInView] = useState(false)
  const [preview, setPreview] = useState<MasterInvitation | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const node = frameRef.current
    if (node === null) return
    if (typeof IntersectionObserver !== 'function') {
      setInView(true)
      return
    }

    const observer = new IntersectionObserver(
      (records) => {
        if (!records.some((record) => record.isIntersecting)) return
        setInView(true)
        observer.disconnect()
      },
      { rootMargin: '160px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!inView || featured === undefined) return

    let cancelled = false
    featured
      .loadPreview()
      .then((data) => {
        if (!cancelled) setPreview(data as MasterInvitation)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [inView])

  return (
    <div className="w-full max-w-[380px]">
      <div
        ref={frameRef}
        className="mx-auto aspect-[9/19.5] w-full max-w-[380px] rounded-[2.25rem] border border-line bg-paper p-2 shadow-[0_28px_70px_-46px_rgba(28,25,23,0.5)]"
      >
        <div className="h-full w-full overflow-y-auto overflow-x-hidden overscroll-contain rounded-[1.9rem] border border-line bg-paper">
          {preview !== null && featured !== undefined ? (
            <Suspense fallback={<PhoneSkeleton />}>
              <ThemePreview
                templateId={featured.manifest.id}
                manifest={featured.manifest}
                preview={preview}
              />
            </Suspense>
          ) : failed ? (
            <p className="px-6 py-10 text-center text-sm leading-6 text-ink/60">
              Pratinjau tidak dapat dimuat.
            </p>
          ) : (
            <PhoneSkeleton />
          )}
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-ink/55">Palet dapat diganti langsung.</p>
    </div>
  )
}
