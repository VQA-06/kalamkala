import type { RsvpAttendance } from '@kalamkala/contracts'
import { resolveThemeCssVars } from '@kalamkala/templates/sdk'
import type {
  TemplateContext,
  TemplateModule,
  TemplateMountFn,
} from '@kalamkala/templates/sdk'

import { manifest } from './manifest.js'
import styles from './styles.module.css'

const createElement = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: { className?: string; text?: string } = {},
): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tag)
  if (options.className !== undefined) element.className = options.className
  if (options.text !== undefined) element.textContent = options.text
  return element
}

const ATTENDANCE_OPTIONS: ReadonlyArray<{
  value: RsvpAttendance
  labelKey: 'attendanceHadir' | 'attendanceTidakHadir' | 'attendanceRagu'
}> = [
  { value: 'HADIR', labelKey: 'attendanceHadir' },
  { value: 'TIDAK_HADIR', labelKey: 'attendanceTidakHadir' },
  { value: 'RAGU', labelKey: 'attendanceRagu' },
]

const buildEvents = (ctx: TemplateContext): HTMLElement => {
  const section = createElement('section', { className: styles.section })
  section.append(
    createElement('h2', { className: styles.sectionTitle, text: ctx.t('eventsTitle') }),
  )

  const list = createElement('ul', { className: styles.eventList })
  for (const event of ctx.data.events) {
    const item = createElement('li', { className: styles.event })
    item.append(
      createElement('p', { className: styles.eventName, text: event.name }),
      createElement('p', {
        className: styles.eventMeta,
        text: ctx.utils.formatDate(event.startsAt, event.timezone),
      }),
      createElement('p', {
        className: styles.eventMeta,
        text: `${event.venueName} · ${event.address}`,
      }),
    )
    list.append(item)
  }
  section.append(list)
  return section
}

const buildWishes = (ctx: TemplateContext): HTMLElement | null => {
  if (ctx.wishes.length === 0) return null

  const section = createElement('section', { className: styles.section })
  section.append(
    createElement('h2', { className: styles.sectionTitle, text: ctx.t('wishesTitle') }),
  )

  const list = createElement('ul', { className: styles.wishList })
  for (const wish of ctx.wishes) {
    const item = createElement('li', { className: styles.wish })
    item.append(
      createElement('p', { className: styles.wishName, text: wish.guestName }),
      createElement('p', { className: styles.wishMessage, text: wish.message }),
    )
    if (wish.hostReply !== null) {
      item.append(
        createElement('p', {
          className: styles.wishReply,
          text: `${ctx.t('hostReply')}: ${wish.hostReply}`,
        }),
      )
    }
    list.append(item)
  }
  section.append(list)
  return section
}

export const mount: TemplateMountFn = (container, ctx) => {
  const restoreTheme = resolveThemeCssVars(container, ctx.appearance.themeTokens)
  const controller = new AbortController()
  const { signal } = controller

  const previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'

  const audioUrl = ctx.utils.resolveMediaUrl(ctx.data.media.audioKey)
  let audio: HTMLAudioElement | null = null
  if (audioUrl !== null) {
    audio = document.createElement('audio')
    audio.src = audioUrl
    audio.loop = true
    audio.preload = 'auto'
  }

  const root = createElement('div', { className: styles.root })

  const cover = createElement('section', { className: styles.cover })
  cover.append(
    createElement('p', { className: styles.kicker, text: ctx.t('privateLabel') }),
    createElement('h1', { className: styles.coverTitle, text: ctx.data.opening.headline }),
    createElement('p', {
      className: styles.coverSubtitle,
      text: ctx.data.opening.subheadline ?? '',
    }),
  )
  if (ctx.guest !== null) {
    cover.append(createElement('p', { className: styles.guestName, text: ctx.guest.name }))
  }
  const openButton = createElement('button', {
    className: styles.button,
    text: ctx.t('openInvitation'),
  })
  openButton.type = 'button'
  cover.append(
    openButton,
    createElement('p', { className: styles.hint, text: ctx.t('openHint') }),
  )

  const content = createElement('div')
  content.hidden = true

  const header = createElement('header', { className: styles.header })
  header.append(
    createElement('h1', { className: styles.title, text: ctx.data.opening.headline }),
    createElement('p', {
      className: styles.subtitle,
      text: ctx.data.opening.subheadline ?? '',
    }),
  )

  const rsvpSection = createElement('section', { className: styles.section })
  rsvpSection.append(
    createElement('h2', { className: styles.sectionTitle, text: ctx.t('rsvpTitle') }),
  )

  const successLine = createElement('p', { className: styles.success })
  successLine.hidden = true

  const form = createElement('form', { className: styles.form })

  const nameField = createElement('label', { className: styles.field })
  const nameInput = createElement('input', { className: styles.input })
  nameInput.value = ctx.guest?.name ?? ''
  nameInput.required = true
  nameField.append(
    createElement('span', { className: styles.label, text: ctx.t('rsvpName') }),
    nameInput,
  )

  const attendanceField = createElement('label', { className: styles.field })
  const attendanceSelect = createElement('select', { className: styles.input })
  for (const option of ATTENDANCE_OPTIONS) {
    const element = document.createElement('option')
    element.value = option.value
    element.textContent = ctx.t(option.labelKey)
    attendanceSelect.append(element)
  }
  attendanceField.append(
    createElement('span', { className: styles.label, text: ctx.t('rsvpAttendance') }),
    attendanceSelect,
  )

  const maxPax = ctx.guest?.maxPax ?? ctx.data.accessControl.defaultMaxPaxPerGuest
  const countField = createElement('label', { className: styles.field })
  const countInput = createElement('input', { className: styles.input })
  countInput.type = 'number'
  countInput.min = '1'
  countInput.max = String(maxPax)
  countInput.value = '1'
  countField.append(
    createElement('span', { className: styles.label, text: ctx.t('rsvpGuestCount') }),
    countInput,
    createElement('span', {
      className: styles.hint,
      text: ctx.t('rsvpMaxPax', { count: maxPax }),
    }),
  )

  const messageField = createElement('label', { className: styles.field })
  const messageInput = createElement('textarea', { className: styles.textarea })
  messageField.append(
    createElement('span', { className: styles.label, text: ctx.t('rsvpMessage') }),
    messageInput,
  )

  const statusLine = createElement('p', { className: styles.error })
  statusLine.hidden = true

  const submitButton = createElement('button', {
    className: styles.button,
    text: ctx.t('rsvpSubmit'),
  })
  submitButton.type = 'submit'

  form.append(
    nameField,
    attendanceField,
    countField,
    messageField,
    statusLine,
    submitButton,
  )
  rsvpSection.append(successLine, form)

  const wishesSection = buildWishes(ctx)
  const footer = createElement('footer', { className: styles.footer, text: ctx.t('poweredBy') })

  content.append(header, buildEvents(ctx), rsvpSection)
  if (wishesSection !== null) content.append(wishesSection)
  content.append(footer)

  let submitting = false
  const submitRsvp = async (): Promise<void> => {
    if (submitting) return
    submitting = true
    submitButton.disabled = true
    submitButton.textContent = ctx.t('rsvpSubmitting')
    statusLine.hidden = true

    try {
      const guestCount = Math.max(1, Number(countInput.value) || 1)
      const result = await ctx.actions.submitRsvp({
        guestName: nameInput.value.trim(),
        attendance: attendanceSelect.value as RsvpAttendance,
        guestCount,
        message: messageInput.value.trim(),
      })

      if (result.ok) {
        form.hidden = true
        successLine.hidden = false
        successLine.textContent = ctx.t('rsvpSuccess', { name: nameInput.value.trim() })
      } else {
        statusLine.hidden = false
        statusLine.textContent = ctx.t('rsvpError')
      }
    } catch {
      statusLine.hidden = false
      statusLine.textContent = ctx.t('rsvpError')
    } finally {
      submitting = false
      submitButton.disabled = false
      submitButton.textContent = ctx.t('rsvpSubmit')
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    void submitRsvp()
  }, { signal })

  openButton.addEventListener('click', () => {
    cover.remove()
    content.hidden = false
    document.body.style.overflow = previousOverflow
    ctx.actions.openInvitation()

    if (audio === null) return
    try {
      void audio.play().catch(() => {})
    } catch {
      // happy-dom and some browsers reject playback before any user gesture.
    }
  }, { signal })

  root.append(cover, content)
  container.replaceChildren(root)

  let cleanedUp = false
  return () => {
    if (cleanedUp) return
    cleanedUp = true
    controller.abort()
    if (audio !== null) {
      audio.pause()
      audio.src = ''
    }
    document.body.style.overflow = previousOverflow
    container.replaceChildren()
    restoreTheme()
  }
}

const templateModule: TemplateModule = { manifest, mount }

export default templateModule
