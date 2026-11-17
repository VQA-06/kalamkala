import type { MediaOrientation, RsvpAttendance, SectionId } from '@kalamkala/contracts'

import { resolveThemeCssVars } from '../sdk/index.js'
import type {
  RsvpSubmitResult,
  SubmitRsvpInput,
  TemplateContext,
  TemplateCopyKey,
  TemplateMountFn,
  TemplateModule,
} from '../sdk/index.js'

import { manifest } from './manifest.js'
import styles from './theme.module.css'

/* DOM helpers ------------------------------------------------------------ */

const cx = (...classNames: ReadonlyArray<string | undefined>): string =>
  classNames.filter((name): name is string => name !== undefined && name.length > 0).join(' ')

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  if (className !== undefined && className.length > 0) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

const externalLink = (className: string, href: string, label: string): HTMLAnchorElement => {
  const anchor = document.createElement('a')
  anchor.className = className
  anchor.href = href
  anchor.target = '_blank'
  anchor.rel = 'noopener noreferrer'
  anchor.textContent = label
  return anchor
}

const imageOrNull = (
  ctx: TemplateContext,
  key: string | null,
  alt: string,
  className: string,
): HTMLImageElement | null => {
  const src = ctx.utils.resolveMediaUrl(key)
  if (src === null) return null
  const image = document.createElement('img')
  image.className = className
  image.src = src
  image.alt = alt
  image.loading = 'lazy'
  image.decoding = 'async'
  return image
}

const field = (labelText: string): HTMLLabelElement => {
  const label = document.createElement('label')
  label.className = cx(styles.field)
  label.append(el('span', cx(styles.labelText), labelText))
  return label
}

const textInput = (type: 'text' | 'number', name: string): HTMLInputElement => {
  const input = document.createElement('input')
  input.className = cx(styles.input)
  input.type = type
  input.name = name
  return input
}

/* Section renderers ------------------------------------------------------ */

type RenderEnv = {
  ctx: TemplateContext
  register: (dispose: () => void) => void
}

type SectionRenderer = (env: RenderEnv, body: HTMLElement) => boolean

const renderOpening: SectionRenderer = ({ ctx }, body) => {
  const { opening } = ctx.data
  body.append(el('p', cx(styles.openingHeadline), opening.headline))
  if (opening.subheadline !== null && opening.subheadline.length > 0) {
    body.append(el('p', cx(styles.openingSub), opening.subheadline))
  }
  if (opening.quote !== null && opening.quote.length > 0) {
    const quote = el('blockquote', cx(styles.quote))
    quote.append(el('p', cx(styles.quoteText), opening.quote))
    if (opening.quoteSource !== null && opening.quoteSource.length > 0) {
      quote.append(el('cite', cx(styles.quoteSource), opening.quoteSource))
    }
    body.append(quote)
  }
  return true
}

const renderHosts: SectionRenderer = ({ ctx }, body) => {
  const list = el('div', cx(styles.hostList))
  for (const role of ctx.data.hosts.displayOrder) {
    const host = ctx.data.hosts[role]
    if (host === null || host === undefined) continue
    const card = el('article', cx(styles.hostCard))
    const photo = imageOrNull(ctx, host.photoKey, host.fullName, cx(styles.hostPhoto))
    if (photo !== null) card.append(photo)
    card.append(el('h3', cx(styles.hostName), host.fullName))
    const parents = [host.fatherName, host.motherName].filter(
      (name): name is string => name !== null && name.length > 0,
    )
    if (parents.length > 0) card.append(el('p', cx(styles.hostParents), parents.join(' & ')))
    if (host.instagramHandle !== null && host.instagramHandle.length > 0) {
      const handle = host.instagramHandle.replace(/^@/u, '')
      card.append(el('p', cx(styles.hostMeta), `@${handle}`))
    }
    list.append(card)
  }
  if (list.childElementCount === 0) return false
  body.append(list)
  return true
}

const renderEvents: SectionRenderer = ({ ctx }, body) => {
  const { events } = ctx.data
  if (events.length === 0) return false
  const list = el('div', cx(styles.eventList))
  for (const event of events) {
    const card = el('article', cx(styles.eventCard))
    card.append(el('h3', cx(styles.eventName), event.name))
    const start = ctx.utils.formatDate(event.startsAt, event.timezone)
    const end = event.endsAt === null ? null : ctx.utils.formatDate(event.endsAt, event.timezone)
    const when =
      end === null ? `${start} · ${event.timezone}` : `${start} – ${end} · ${event.timezone}`
    card.append(el('p', cx(styles.eventDate), when))
    card.append(el('p', cx(styles.eventVenue), event.venueName))
    card.append(el('p', cx(styles.eventAddress), event.address))
    if (event.mapsUrl !== null) {
      card.append(externalLink(cx(styles.link, styles.eventMeta), event.mapsUrl, ctx.t('viewMap')))
    }
    if (event.dressCode !== null && event.dressCode.length > 0) {
      card.append(el('p', cx(styles.eventDress), `${ctx.t('dressCodeLabel')}: ${event.dressCode}`))
    }
    list.append(card)
  }
  body.append(list)
  return true
}

const renderLoveStory: SectionRenderer = ({ ctx }, body) => {
  const loveStory = ctx.data.modules.loveStory
  if (!loveStory.enabled || loveStory.items.length === 0) return false
  const timezone = ctx.data.events[0]?.timezone ?? 'WIB'
  const timeline = el('div', cx(styles.timeline))
  for (const item of loveStory.items) {
    const entry = el('div', cx(styles.timelineItem))
    if (item.date !== null && item.date.length > 0) {
      entry.append(el('p', cx(styles.timelineDate), ctx.utils.formatDate(item.date, timezone)))
    }
    entry.append(el('h3', cx(styles.timelineTitle), item.title))
    entry.append(el('p', cx(styles.timelineStory), item.story))
    timeline.append(entry)
  }
  body.append(timeline)
  return true
}

const ORIENTATION_CLASS = {
  PORTRAIT: styles.portrait,
  LANDSCAPE: styles.landscape,
  SQUARE: styles.square,
} satisfies Record<MediaOrientation, string | undefined>

const renderGallery: SectionRenderer = ({ ctx }, body) => {
  const { gallery, videoUrl } = ctx.data.media
  if (gallery.length === 0 && videoUrl === null) return false
  if (gallery.length > 0) {
    const grid = el('div', cx(styles.galleryGrid))
    for (const item of gallery) {
      const figure = el('figure', cx(styles.galleryItem, ORIENTATION_CLASS[item.orientation]))
      const image = imageOrNull(
        ctx,
        item.key,
        item.caption ?? ctx.data.hosts.primary.fullName,
        cx(styles.galleryImage),
      )
      if (image !== null) figure.append(image)
      if (item.caption !== null && item.caption.length > 0) {
        figure.append(el('figcaption', cx(styles.galleryCaption), item.caption))
      }
      grid.append(figure)
    }
    body.append(grid)
  }
  if (videoUrl !== null) {
    const wrap = el('p', cx(styles.mediaVideo))
    wrap.append(externalLink(cx(styles.link), videoUrl, ctx.t('galleryTitle')))
    body.append(wrap)
  }
  return true
}

const renderGifts: SectionRenderer = ({ ctx, register }, body) => {
  const { bankAccounts, qrisImageKey, physicalAddress } = ctx.data.gifts
  if (bankAccounts.length === 0 && qrisImageKey === null && physicalAddress === null) {
    return false
  }
  if (bankAccounts.length > 0) {
    const grid = el('div', cx(styles.giftGrid))
    for (const account of bankAccounts) {
      const card = el('article', cx(styles.giftCard))
      card.append(el('p', cx(styles.giftBank), account.bankName))
      card.append(el('p', cx(styles.giftAccount), account.accountNumber))
      card.append(
        el('p', cx(styles.giftHolder), `${ctx.t('giftAccountHolderLabel')}: ${account.accountHolder}`),
      )
      const copyButton = el('button', cx(styles.copyButton), ctx.t('giftCopy'))
      copyButton.type = 'button'
      const onClick = (): void => {
        const clipboard: Clipboard | undefined = navigator.clipboard
        if (clipboard === undefined) return
        clipboard.writeText(account.accountNumber).then(
          () => {
            copyButton.textContent = ctx.t('giftCopied')
          },
          () => {
            // Clipboard permission denied: the number stays visible to copy by hand.
          },
        )
      }
      copyButton.addEventListener('click', onClick)
      register(() => copyButton.removeEventListener('click', onClick))
      card.append(copyButton)
      grid.append(card)
    }
    body.append(grid)
  }
  if (qrisImageKey !== null) {
    const qris = imageOrNull(ctx, qrisImageKey, ctx.t('giftQrisTitle'), cx(styles.qrisImage))
    if (qris !== null) {
      const block = el('div', cx(styles.qrisBlock))
      block.append(el('h3', cx(styles.subheading), ctx.t('giftQrisTitle')))
      block.append(qris)
      body.append(block)
    }
  }
  if (physicalAddress !== null && physicalAddress.length > 0) {
    const address = el('div', cx(styles.giftAddress))
    address.append(el('h3', cx(styles.subheading), ctx.t('giftAddressTitle')))
    address.append(el('p', undefined, physicalAddress))
    body.append(address)
  }
  return true
}

const ATTENDANCE_OPTIONS: ReadonlyArray<readonly [RsvpAttendance, TemplateCopyKey]> = [
  ['HADIR', 'attendanceHadir'],
  ['TIDAK_HADIR', 'attendanceTidakHadir'],
  ['RAGU', 'attendanceRagu'],
]

const createStats = (ctx: TemplateContext): HTMLElement => {
  const summary = ctx.rsvpSummary
  const stats = el('div', cx(styles.stats))
  if (summary === null) return stats
  const entries: ReadonlyArray<readonly [number, string]> = [
    [summary.hadir, ctx.t('hadirCount', { count: summary.hadir })],
    [summary.tidakHadir, ctx.t('notAttendingCount', { count: summary.tidakHadir })],
    [summary.ragu, ctx.t('maybeCount', { count: summary.ragu })],
  ]
  for (const [value, label] of entries) {
    const stat = el('div', cx(styles.stat))
    stat.append(el('span', cx(styles.statLabel), label))
    stat.dataset.count = String(value)
    stats.append(stat)
  }
  return stats
}

const renderRsvp: SectionRenderer = ({ ctx, register }, body) => {
  if (ctx.data.settings.showPublicRsvpStats && ctx.rsvpSummary !== null) {
    body.append(createStats(ctx))
  }

  const maxPax = Math.max(
    1,
    ctx.guest?.maxPax ?? ctx.data.accessControl.defaultMaxPaxPerGuest,
  )

  const form = el('form', cx(styles.rsvpForm))
  form.noValidate = true

  const grid = el('div', cx(styles.formGrid))

  const nameLabel = field(ctx.t('rsvpName'))
  const nameInput = textInput('text', 'guestName')
  nameInput.value = ctx.guest?.name ?? ''
  nameInput.autocomplete = 'name'
  nameLabel.append(nameInput)
  grid.append(nameLabel)

  const attendanceLabel = field(ctx.t('rsvpAttendance'))
  const attendanceSelect = document.createElement('select')
  attendanceSelect.className = cx(styles.input)
  attendanceSelect.name = 'attendance'
  for (const [value, copyKey] of ATTENDANCE_OPTIONS) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = ctx.t(copyKey)
    attendanceSelect.append(option)
  }
  attendanceLabel.append(attendanceSelect)
  grid.append(attendanceLabel)

  const countLabel = field(ctx.t('rsvpGuestCount'))
  const countInput = textInput('number', 'guestCount')
  countInput.min = '1'
  countInput.max = String(maxPax)
  countInput.step = '1'
  countInput.value = '1'
  countInput.inputMode = 'numeric'
  countLabel.append(countInput)
  countLabel.append(el('span', cx(styles.helper), ctx.t('rsvpMaxPax', { count: maxPax })))
  grid.append(countLabel)

  const messageLabel = field(ctx.t('rsvpMessage'))
  const messageInput = document.createElement('textarea')
  messageInput.className = cx(styles.input, styles.textarea)
  messageInput.name = 'message'
  messageInput.rows = 4
  messageLabel.append(messageInput)
  grid.append(messageLabel)

  const submitButton = el('button', cx(styles.primaryButton), ctx.t('rsvpSubmit'))
  submitButton.type = 'submit'

  const status = el('p', cx(styles.formStatus))
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')

  let submitting = false
  const setBusy = (busy: boolean): void => {
    submitting = busy
    submitButton.disabled = busy
    submitButton.textContent = busy ? ctx.t('rsvpSubmitting') : ctx.t('rsvpSubmit')
  }
  const showStatus = (message: string, state: 'success' | 'error'): void => {
    status.textContent = message
    status.className =
      state === 'success'
        ? cx(styles.formStatus, styles.formStatusSuccess)
        : cx(styles.formStatus, styles.formStatusError)
  }

  const onSubmit = (event: SubmitEvent): void => {
    event.preventDefault()
    if (submitting) return

    const typedName = nameInput.value.trim()
    const guestName = typedName.length > 0 ? typedName : (ctx.guest?.name ?? '')
    if (guestName.length === 0) {
      showStatus(ctx.t('rsvpError'), 'error')
      return
    }

    const guestCount = Number.parseInt(countInput.value, 10)
    if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > maxPax) {
      showStatus(ctx.t('rsvpMaxPax', { count: maxPax }), 'error')
      return
    }

    const attendanceValue = attendanceSelect.value
    const attendance: RsvpAttendance =
      attendanceValue === 'TIDAK_HADIR' || attendanceValue === 'RAGU' ? attendanceValue : 'HADIR'
    const payload: SubmitRsvpInput = {
      guestName,
      attendance,
      guestCount,
      message: messageInput.value.trim(),
    }

    setBusy(true)
    let pending: Promise<RsvpSubmitResult>
    try {
      pending = ctx.actions.submitRsvp(payload)
    } catch {
      setBusy(false)
      showStatus(ctx.t('rsvpError'), 'error')
      return
    }

    pending
      .then((result) => {
        if (result.ok) {
          showStatus(ctx.t('rsvpSuccess', { name: guestName }), 'success')
          return
        }
        showStatus(result.error.length > 0 ? result.error : ctx.t('rsvpError'), 'error')
      })
      .catch(() => {
        showStatus(ctx.t('rsvpError'), 'error')
      })
      .finally(() => {
        setBusy(false)
      })
  }

  form.addEventListener('submit', onSubmit)
  register(() => form.removeEventListener('submit', onSubmit))
  form.append(grid, submitButton, status)
  body.append(form)
  return true
}

const renderWishes: SectionRenderer = ({ ctx }, body) => {
  if (!ctx.data.settings.showPublicWishes) return false
  if (ctx.wishes.length === 0) {
    body.append(el('p', cx(styles.emptyNote), ctx.t('wishesEmpty')))
    return true
  }
  const list = el('div', cx(styles.wishes))
  for (const wish of ctx.wishes) {
    const item = el('article', cx(styles.wish))
    const head = el('div', cx(styles.wishHead))
    head.append(el('h3', cx(styles.wishName), wish.guestName))
    item.append(head)
    item.append(el('p', cx(styles.wishMessage), wish.message))
    if (wish.hostReply !== null && wish.hostReply.length > 0) {
      const reply = el('p', cx(styles.wishReply))
      reply.append(el('span', cx(styles.labelText), ctx.t('hostReply')))
      reply.append(document.createTextNode(wish.hostReply))
      item.append(reply)
    }
    list.append(item)
  }
  body.append(list)
  return true
}

const renderLiveStream: SectionRenderer = ({ ctx }, body) => {
  const live = ctx.data.modules.liveStream
  if (!live.enabled || live.url === null) return false
  const card = el('div', cx(styles.liveCard))
  if (live.platform !== null && live.platform.length > 0) {
    card.append(el('p', cx(styles.kitLabel), live.platform))
  }
  card.append(externalLink(cx(styles.primaryButton), live.url, ctx.t('watchLive')))
  body.append(card)
  return true
}

const renderSocialKit: SectionRenderer = ({ ctx }, body) => {
  const kit = ctx.data.modules.socialKit
  if (!kit.enabled) return false
  const list = el('div', cx(styles.kitList))
  const appendRow = (label: string, value: string, href?: string): void => {
    const row = el('div', cx(styles.kitRow))
    row.append(el('span', cx(styles.kitLabel), label))
    row.append(
      href === undefined
        ? el('span', cx(styles.kitValue), value)
        : externalLink(cx(styles.link, styles.kitValue), href, value),
    )
    list.append(row)
  }
  if (kit.hashtag !== null && kit.hashtag.length > 0) {
    appendRow(ctx.t('hashtagLabel'), kit.hashtag)
  }
  if (kit.instagramFilterUrl !== null) {
    appendRow(ctx.t('filterLabel'), kit.instagramFilterUrl, kit.instagramFilterUrl)
  }
  if (kit.caption !== null && kit.caption.length > 0) {
    appendRow(ctx.t('captionLabel'), kit.caption)
  }
  if (list.childElementCount === 0) return false
  body.append(list)
  return true
}

const renderTravelInfo: SectionRenderer = ({ ctx }, body) => {
  const travel = ctx.data.modules.travelInfo
  if (!travel.enabled) return false
  if (travel.venueMapUrl === null && travel.hotels.length === 0) return false

  const wrap = el('div', cx(styles.travel))
  if (travel.venueMapUrl !== null) {
    wrap.append(externalLink(cx(styles.link), travel.venueMapUrl, ctx.t('viewMap')))
  }
  if (travel.hotels.length > 0) {
    wrap.append(el('h3', cx(styles.subheading), ctx.t('hotelsTitle')))
    const hotelList = el('div', cx(styles.hotelList))
    for (const hotel of travel.hotels) {
      const card = el('article', cx(styles.hotel))
      card.append(el('h4', cx(styles.hotelName), hotel.name))
      card.append(el('p', cx(styles.hotelAddress), hotel.address))
      const meta = el('div', cx(styles.hotelMeta))
      if (hotel.distanceLabel !== null && hotel.distanceLabel.length > 0) {
        meta.append(el('span', undefined, hotel.distanceLabel))
      }
      if (hotel.bookingUrl !== null) {
        meta.append(externalLink(cx(styles.link), hotel.bookingUrl, ctx.t('bookHotel')))
      }
      card.append(meta)
      hotelList.append(card)
    }
    wrap.append(hotelList)
  }
  body.append(wrap)
  return true
}

const renderEntourage: SectionRenderer = ({ ctx }, body) => {
  const entourage = ctx.data.modules.entourage
  if (!entourage.enabled || entourage.groups.length === 0) return false
  const wrap = el('div', cx(styles.entourage))
  for (const group of entourage.groups) {
    const block = el('div')
    block.append(el('h3', cx(styles.groupTitle), group.title))
    const list = el('ul', cx(styles.memberList))
    for (const member of group.members) list.append(el('li', undefined, member))
    block.append(list)
    wrap.append(block)
  }
  body.append(wrap)
  return true
}

const renderCoHosts: SectionRenderer = ({ ctx }, body) => {
  const coHosts = ctx.data.modules.coHosts
  if (!coHosts.enabled || coHosts.items.length === 0) return false
  const wrap = el('div', cx(styles.coHosts))
  for (const coHost of coHosts.items) {
    const card = el('div', cx(styles.coHostCard))
    card.append(el('span', cx(styles.coHostName), coHost.name))
    if (coHost.role !== null && coHost.role.length > 0) {
      card.append(el('span', cx(styles.coHostRole), coHost.role))
    }
    if (coHost.whatsappNumber !== null && coHost.whatsappNumber.length > 0) {
      card.append(el('span', cx(styles.coHostPhone), coHost.whatsappNumber))
    }
    wrap.append(card)
  }
  body.append(wrap)
  return true
}

const renderAdditionalNotes: SectionRenderer = ({ ctx }, body) => {
  const notes = ctx.data.modules.additionalNotes
  if (!notes.enabled || notes.notes.length === 0) return false
  const list = el('ul', cx(styles.notes))
  for (const note of notes.notes) list.append(el('li', cx(styles.noteItem), note))
  body.append(list)
  return true
}

const renderClosing: SectionRenderer = ({ ctx }, body) => {
  const { closing } = ctx.data
  const wrap = el('div', cx(styles.closing))
  wrap.append(el('p', cx(styles.closingMessage), closing.message))
  if (closing.happyFamilies.length > 0) {
    wrap.append(el('h3', cx(styles.subheading), ctx.t('happyFamiliesTitle')))
    const families = el('div', cx(styles.families))
    for (const family of closing.happyFamilies) {
      const card = el('div', cx(styles.family))
      const photo = imageOrNull(ctx, family.photoKey, family.name, cx(styles.familyImage))
      if (photo !== null) card.append(photo)
      card.append(el('span', cx(styles.familyName), family.name))
      families.append(card)
    }
    wrap.append(families)
  }
  body.append(wrap)
  return true
}

const SECTION_RENDERERS: Partial<Record<SectionId, SectionRenderer>> = {
  opening: renderOpening,
  hosts: renderHosts,
  events: renderEvents,
  loveStory: renderLoveStory,
  media: renderGallery,
  gifts: renderGifts,
  rsvp: renderRsvp,
  wishes: renderWishes,
  liveStream: renderLiveStream,
  socialKit: renderSocialKit,
  travelInfo: renderTravelInfo,
  entourage: renderEntourage,
  coHosts: renderCoHosts,
  additionalNotes: renderAdditionalNotes,
  closing: renderClosing,
}

const SECTION_TITLE_KEYS: Partial<Record<SectionId, TemplateCopyKey>> = {
  hosts: 'hostsTitle',
  events: 'eventsTitle',
  loveStory: 'loveStoryTitle',
  media: 'galleryTitle',
  gifts: 'giftTitle',
  rsvp: 'rsvpTitle',
  wishes: 'wishesTitle',
  liveStream: 'liveStreamTitle',
  socialKit: 'socialKitTitle',
  travelInfo: 'travelTitle',
  entourage: 'entourageTitle',
  coHosts: 'coHostsTitle',
  additionalNotes: 'notesTitle',
  closing: 'closingTitle',
}

/* Chrome ---------------------------------------------------------------- */

type GateOptions = {
  title: string
  dateLabel: string
  guestName: string | null
  pinCode: string | null
  onUnlocked: () => void
  register: (dispose: () => void) => void
}

const createGate = (ctx: TemplateContext, options: GateOptions): HTMLElement => {
  const gate = el('div', cx(styles.gate))
  gate.setAttribute('role', 'dialog')
  gate.setAttribute('aria-modal', 'true')

  const panel = el('div', cx(styles.gatePanel))
  const topOrnament = el('div', cx(styles.gateOrnament))
  topOrnament.setAttribute('aria-hidden', 'true')
  panel.append(topOrnament)
  panel.append(el('h1', cx(styles.gateTitle), options.title))
  if (options.dateLabel.length > 0) {
    panel.append(el('p', cx(styles.gateDate), options.dateLabel))
  }
  if (options.guestName !== null && options.guestName.length > 0) {
    panel.append(el('p', cx(styles.gateGuest), options.guestName))
  }
  const bottomOrnament = el('div', cx(styles.gateOrnament))
  bottomOrnament.setAttribute('aria-hidden', 'true')
  panel.append(bottomOrnament)

  const pinRequired = options.pinCode !== null && options.pinCode.length > 0
  if (pinRequired) {
    panel.append(el('p', cx(styles.subheading), ctx.t('pinTitle')))
    const form = el('form', cx(styles.pinForm))
    const label = document.createElement('label')
    label.className = cx(styles.pinLabel)
    label.append(el('span', cx(styles.labelText), ctx.t('pinLabel')))
    const input = document.createElement('input')
    input.className = cx(styles.pinInput)
    input.type = 'password'
    input.inputMode = 'numeric'
    input.autocomplete = 'one-time-code'
    input.maxLength = 6
    input.required = true
    label.append(input)
    form.append(label)

    const error = el('p', cx(styles.gateError))
    error.setAttribute('role', 'alert')
    const submit = el('button', cx(styles.primaryButton), ctx.t('pinSubmit'))
    submit.type = 'submit'
    form.append(submit, error)

    const onSubmit = (event: SubmitEvent): void => {
      event.preventDefault()
      const entered = input.value.trim()
      if (!/^\d{4,6}$/u.test(entered) || entered !== options.pinCode) {
        error.textContent = ctx.t('pinWrong')
        return
      }
      options.onUnlocked()
      gate.hidden = true
    }
    form.addEventListener('submit', onSubmit)
    options.register(() => form.removeEventListener('submit', onSubmit))
    panel.append(form)
  } else {
    const open = el('button', cx(styles.primaryButton), ctx.t('openInvitation'))
    open.type = 'button'
    const onClick = (): void => {
      options.onUnlocked()
      gate.hidden = true
    }
    open.addEventListener('click', onClick)
    options.register(() => open.removeEventListener('click', onClick))
    panel.append(open)
  }

  panel.append(el('p', cx(styles.gateHint), ctx.t('openHint')))
  gate.append(panel)
  return gate
}

const createHero = (
  ctx: TemplateContext,
  coupleName: string,
  dateLabel: string,
): HTMLElement => {
  const hero = el('header', cx(styles.hero))
  hero.append(el('h1', cx(styles.heroName), coupleName))

  const ornament = el('div', cx(styles.heroOrnament))
  ornament.setAttribute('aria-hidden', 'true')
  hero.append(ornament)

  if (dateLabel.length > 0) hero.append(el('p', cx(styles.heroDate), dateLabel))

  const firstEvent = ctx.data.events[0]
  if (firstEvent !== undefined) hero.append(el('p', cx(styles.heroVenue), firstEvent.venueName))

  if (ctx.data.accessControl.isPrivatePinEnabled) {
    hero.append(el('p', cx(styles.privateLabel), ctx.t('privateLabel')))
  }

  const qrToken = ctx.guest?.qrToken ?? null
  if (ctx.data.modules.enableQrCheckin && qrToken !== null && qrToken.length > 0) {
    const note = el('div', cx(styles.qrNote))
    note.append(el('p', cx(styles.qrTitle), ctx.t('qrCheckinTitle')))
    note.append(el('p', cx(styles.qrToken), qrToken))
    note.append(el('p', cx(styles.gateHint), ctx.t('qrCheckinNote')))
    hero.append(note)
  }

  return hero
}

const createFooter = (ctx: TemplateContext, coupleName: string): HTMLElement => {
  const footer = el('footer', cx(styles.footer))
  footer.append(el('p', cx(styles.footerMark), coupleName))
  if (!ctx.data.settings.hidePlatformWatermark) {
    footer.append(el('p', cx(styles.watermark), ctx.t('poweredBy')))
  }
  return footer
}

/* Mount ------------------------------------------------------------------ */

export const mount: TemplateMountFn = (container, ctx) => {
  container.replaceChildren()
  const restoreTheme = resolveThemeCssVars(container, ctx.appearance.themeTokens)

  const previousOverflow = document.body.style.overflow
  const gateRequired = !ctx.state.isOpened
  if (gateRequired) document.body.style.overflow = 'hidden'

  const disposers: Array<() => void> = []
  const register = (dispose: () => void): void => {
    disposers.push(dispose)
  }

  const root = el('div', cx(styles.root))
  root.dataset.template = 'keraton-heritage'
  root.dataset.reducedMotion = ctx.state.reducedMotion ? 'true' : 'false'
  container.append(root)

  let audio: HTMLAudioElement | null = null
  const audioSource = ctx.utils.resolveMediaUrl(ctx.data.media.audioKey)
  if (audioSource !== null) {
    const node = document.createElement('audio')
    node.loop = true
    node.preload = 'auto'
    node.hidden = true
    node.src = audioSource
    root.append(node)
    audio = node
  }

  const startAudio = (): void => {
    if (audio === null) return
    try {
      audio.play().catch(() => {
        // Autoplay can be refused; the invitation remains fully usable.
      })
    } catch {
      // Older engines throw synchronously instead of returning a promise.
    }
  }

  if (ctx.state.isPreview) {
    root.append(el('div', cx(styles.previewBadge), ctx.t('previewBadge')))
  }

  const paper = el('main', cx(styles.paper))
  root.append(paper)
  const secondaryName = ctx.data.hosts.secondary?.fullName ?? null
  const coupleName =
    secondaryName === null
      ? ctx.data.hosts.primary.fullName
      : `${ctx.data.hosts.primary.fullName} & ${secondaryName}`
  const firstEvent = ctx.data.events[0]
  const dateLabel =
    firstEvent === undefined ? '' : ctx.utils.formatDate(firstEvent.startsAt, firstEvent.timezone)
  paper.append(createHero(ctx, coupleName, dateLabel))

  for (const sectionId of ctx.appearance.sectionOrder) {
    if (ctx.appearance.hiddenSections.includes(sectionId)) continue
    const render = SECTION_RENDERERS[sectionId]
    if (render === undefined) continue

    const body = el('div', cx(styles.sectionBody))
    if (!render({ ctx, register }, body)) continue

    const section = el('section', cx(styles.section))
    section.dataset.section = sectionId

    const titleKey = SECTION_TITLE_KEYS[sectionId]
    if (titleKey !== undefined) {
      section.append(
        el(
          'h2',
          cx(styles.sectionTitle),
          ctx.appearance.sectionTitles[sectionId] ?? ctx.t(titleKey),
        ),
      )
      const ornament = el('div', cx(styles.sectionOrnament))
      ornament.setAttribute('aria-hidden', 'true')
      section.append(ornament)
    }

    section.append(body)
    paper.append(section)
  }

  paper.append(createFooter(ctx, coupleName))

  let opened = ctx.state.isOpened
  const unlock = (): void => {
    if (opened) return
    opened = true
    document.body.style.overflow = previousOverflow
    ctx.actions.openInvitation()
    startAudio()
  }

  if (gateRequired) {
    root.append(
      createGate(ctx, {
        title: coupleName,
        dateLabel,
        guestName: ctx.guest?.name ?? null,
        pinCode: ctx.data.accessControl.isPrivatePinEnabled
          ? ctx.data.accessControl.pinCode
          : null,
        onUnlocked: unlock,
        register,
      }),
    )
  }

  let cleanedUp = false
  return () => {
    if (cleanedUp) return
    cleanedUp = true
    for (const dispose of disposers) dispose()
    if (audio !== null) {
      try {
        audio.pause()
      } catch {
        // Media support is best effort in preview and non-browser hosts.
      }
      audio.remove()
    }
    document.body.style.overflow = previousOverflow
    restoreTheme()
    container.replaceChildren()
  }
}

export default { manifest, mount } satisfies TemplateModule
