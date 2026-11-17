import { useEffect, useRef, useState } from 'react'

type TurnstileRenderOptions = {
  sitekey: string
  theme: 'light' | 'dark' | 'auto'
  size: 'normal' | 'compact' | 'flexible'
  callback: (token: string) => void
  'expired-callback': () => void
  'error-callback': () => void
}

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string | undefined
  remove: (widgetId: string) => void
  reset: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const TURNSTILE_SCRIPT_ID = 'cf-turnstile-script'
const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const SCRIPT_TIMEOUT_MS = 15_000

let scriptLoader: Promise<boolean> | null = null

const loadTurnstileScript = (): Promise<boolean> => {
  if (window.turnstile !== undefined) return Promise.resolve(true)
  if (scriptLoader !== null) return scriptLoader

  scriptLoader = new Promise<boolean>((resolve) => {
    let settled = false
    const finish = (available: boolean): void => {
      if (settled) return
      settled = true
      resolve(available)
    }

    const timeout = window.setTimeout(() => finish(window.turnstile !== undefined), SCRIPT_TIMEOUT_MS)
    const onLoad = (): void => {
      window.clearTimeout(timeout)
      finish(window.turnstile !== undefined)
    }
    const onError = (): void => {
      window.clearTimeout(timeout)
      finish(false)
    }

    const existing = document.getElementById(TURNSTILE_SCRIPT_ID)
    if (existing !== null) {
      existing.addEventListener('load', onLoad)
      existing.addEventListener('error', onError)
      return
    }

    const script = document.createElement('script')
    script.id = TURNSTILE_SCRIPT_ID
    script.src = TURNSTILE_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.addEventListener('load', onLoad)
    script.addEventListener('error', onError)
    document.head.appendChild(script)
  })

  return scriptLoader
}

export type TurnstileWidgetProps = {
  siteKey: string
  /** Must be a stable setter; it is a dependency of the render effect. */
  onToken: (token: string | null) => void
  /** Bump to discard the previous token and render a fresh widget. */
  resetKey?: number
}

/**
 * Official Turnstile widget in explicit-render mode.
 * A missing or blocked script degrades to a visible note instead of throwing;
 * the RSVP server function will then reject the missing token safely.
 */
export function TurnstileWidget({ siteKey, onToken, resetKey = 0 }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (siteKey.length === 0) {
      setFailed(true)
      return
    }

    const container = containerRef.current
    if (container === null) return

    let disposed = false
    let widgetId: string | null = null
    setFailed(false)
    onToken(null)
    container.replaceChildren()

    void loadTurnstileScript()
      .then((available) => {
        if (disposed) return
        if (!available || window.turnstile === undefined) {
          setFailed(true)
          return
        }
        const id = window.turnstile.render(container, {
          sitekey: siteKey,
          theme: 'light',
          size: 'flexible',
          callback: (token) => onToken(token),
          'expired-callback': () => onToken(null),
          'error-callback': () => onToken(null),
        })
        widgetId = typeof id === 'string' ? id : null
      })
      .catch(() => {
        if (!disposed) setFailed(true)
      })

    return () => {
      disposed = true
      onToken(null)
      if (widgetId !== null && window.turnstile !== undefined) {
        try {
          window.turnstile.remove(widgetId)
        } catch {
          // The widget was already removed by a navigation.
        }
      }
      container.replaceChildren()
    }
  }, [siteKey, onToken, resetKey])

  return (
    <div className="min-h-[65px]">
      <div ref={containerRef} />
      {failed ? (
        <p className="text-xs leading-5 text-ink/60" role="status">
          Verifikasi keamanan tidak tersedia. Muat ulang halaman untuk mencoba lagi.
        </p>
      ) : null}
    </div>
  )
}
