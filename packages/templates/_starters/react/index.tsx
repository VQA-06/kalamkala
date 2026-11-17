import type { RsvpAttendance } from '@kalamkala/contracts'
import { resolveThemeCssVars } from '@kalamkala/templates/sdk'
import type {
  SubmitRsvpInput,
  TemplateContext,
  TemplateModule,
  TemplateMountFn,
} from '@kalamkala/templates/sdk'
import type { FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'

import { manifest } from './manifest.js'
import styles from './styles.module.css'

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error'

const ATTENDANCE_OPTIONS: ReadonlyArray<{
  value: RsvpAttendance
  labelKey: 'attendanceHadir' | 'attendanceTidakHadir' | 'attendanceRagu'
}> = [
  { value: 'HADIR', labelKey: 'attendanceHadir' },
  { value: 'TIDAK_HADIR', labelKey: 'attendanceTidakHadir' },
  { value: 'RAGU', labelKey: 'attendanceRagu' },
]

const InvitationView = ({
  ctx,
  onOpen,
}: {
  ctx: TemplateContext
  onOpen: () => void
}) => {
  const [opened, setOpened] = useState(ctx.state.isOpened)
  const [status, setStatus] = useState<SubmitStatus>('idle')
  const [guestName, setGuestName] = useState(ctx.guest?.name ?? '')
  const [attendance, setAttendance] = useState<RsvpAttendance>('HADIR')
  const [guestCount, setGuestCount] = useState(1)
  const [message, setMessage] = useState('')

  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const audioUrl = ctx.utils.resolveMediaUrl(ctx.data.media.audioKey)
    if (audioUrl === null) return undefined

    const audio = document.createElement('audio')
    audio.src = audioUrl
    audio.loop = true
    audio.preload = 'auto'
    audioRef.current = audio

    return () => {
      audio.pause()
      audio.remove()
      audioRef.current = null
    }
  }, [ctx])

  const openInvitation = () => {
    setOpened(true)
    onOpen()
    ctx.actions.openInvitation()

    const audio = audioRef.current
    if (audio === null) return
    try {
      void audio.play().catch(() => {})
    } catch {
      // happy-dom and some browsers reject playback before any user gesture.
    }
  }

  const submitRsvp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (status === 'submitting') return

    setStatus('submitting')
    const input: SubmitRsvpInput = {
      guestName: guestName.trim(),
      attendance,
      guestCount,
      message: message.trim(),
    }

    try {
      const result = await ctx.actions.submitRsvp(input)
      setStatus(result.ok ? 'success' : 'error')
    } catch {
      setStatus('error')
    }
  }

  const maxPax = ctx.guest?.maxPax ?? ctx.data.accessControl.defaultMaxPaxPerGuest

  if (!opened) {
    return (
      <div className={styles.root}>
        <section className={styles.cover}>
          <p className={styles.kicker}>{ctx.t('privateLabel')}</p>
          <h1 className={styles.coverTitle}>{ctx.data.opening.headline}</h1>
          <p className={styles.coverSubtitle}>{ctx.data.opening.subheadline}</p>
          {ctx.guest === null ? null : (
            <p className={styles.guestName}>{ctx.guest.name}</p>
          )}
          <button type="button" className={styles.button} onClick={openInvitation}>
            {ctx.t('openInvitation')}
          </button>
          <p className={styles.hint}>{ctx.t('openHint')}</p>
        </section>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <h1 className={styles.title}>{ctx.data.opening.headline}</h1>
        <p className={styles.subtitle}>{ctx.data.opening.subheadline}</p>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{ctx.t('eventsTitle')}</h2>
        <ul className={styles.eventList}>
          {ctx.data.events.map((event) => (
            <li key={event.id} className={styles.event}>
              <p className={styles.eventName}>{event.name}</p>
              <p className={styles.eventMeta}>
                {ctx.utils.formatDate(event.startsAt, event.timezone)}
              </p>
              <p className={styles.eventMeta}>
                {event.venueName} · {event.address}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{ctx.t('rsvpTitle')}</h2>

        {status === 'success' ? (
          <p className={styles.success}>
            {ctx.t('rsvpSuccess', { name: guestName.trim() })}
          </p>
        ) : (
          <form className={styles.form} onSubmit={submitRsvp}>
            <label className={styles.field}>
              <span className={styles.label}>{ctx.t('rsvpName')}</span>
              <input
                className={styles.input}
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                required
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>{ctx.t('rsvpAttendance')}</span>
              <select
                className={styles.input}
                value={attendance}
                onChange={(event) => setAttendance(event.target.value as RsvpAttendance)}
              >
                {ATTENDANCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {ctx.t(option.labelKey)}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>{ctx.t('rsvpGuestCount')}</span>
              <input
                className={styles.input}
                type="number"
                min={1}
                max={maxPax}
                value={guestCount}
                onChange={(event) => setGuestCount(Number(event.target.value))}
              />
              <span className={styles.hint}>
                {ctx.t('rsvpMaxPax', { count: maxPax })}
              </span>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>{ctx.t('rsvpMessage')}</span>
              <textarea
                className={styles.textarea}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
            </label>

            {status === 'error' ? (
              <p className={styles.error}>{ctx.t('rsvpError')}</p>
            ) : null}

            <button
              type="submit"
              className={styles.button}
              disabled={status === 'submitting'}
            >
              {status === 'submitting' ? ctx.t('rsvpSubmitting') : ctx.t('rsvpSubmit')}
            </button>
          </form>
        )}
      </section>

      {ctx.wishes.length === 0 ? null : (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{ctx.t('wishesTitle')}</h2>
          <ul className={styles.wishList}>
            {ctx.wishes.map((wish) => (
              <li key={wish.id} className={styles.wish}>
                <p className={styles.wishName}>{wish.guestName}</p>
                <p className={styles.wishMessage}>{wish.message}</p>
                {wish.hostReply === null ? null : (
                  <p className={styles.wishReply}>
                    {ctx.t('hostReply')}: {wish.hostReply}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className={styles.footer}>{ctx.t('poweredBy')}</footer>
    </div>
  )
}

export const mount: TemplateMountFn = (container, ctx) => {
  const restoreTheme = resolveThemeCssVars(container, ctx.appearance.themeTokens)

  // Locked synchronously so the cover gate cannot be scrolled past before React paints.
  const previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  const restoreScroll = (): void => {
    document.body.style.overflow = previousOverflow
  }

  const root = createRoot(container)
  root.render(<InvitationView ctx={ctx} onOpen={restoreScroll} />)

  let cleanedUp = false
  return () => {
    if (cleanedUp) return
    cleanedUp = true
    root.unmount()
    restoreScroll()
    restoreTheme()
    container.replaceChildren()
  }
}

const templateModule: TemplateModule = { manifest, mount }

export default templateModule
