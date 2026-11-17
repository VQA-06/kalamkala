import type { ClockPort } from '../ports/clock.js'
import type { StoredInvitation } from '../ports/invitation-repository.js'

export type LifecycleStatus = 'PREVIEW' | 'LIVE' | 'POST_EVENT' | 'EXPIRED'

export type InvitationLifecycleServiceDeps = {
  clock: ClockPort
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Event dates arrive as JSON content, so accept both ISO strings and Dates
 * and treat anything unparsable as "unknown" rather than throwing.
 */
const toTime = (value: unknown): number | null => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime()
  if (typeof value === 'string') {
    const time = new Date(value).getTime()
    return Number.isNaN(time) ? null : time
  }
  return null
}

/**
 * Derives the badge shown to the owner: still a draft, currently running,
 * finished more than a day ago, or expired.
 */
export class InvitationLifecycleService {
  private readonly clock: ClockPort

  constructor(deps: InvitationLifecycleServiceDeps) {
    this.clock = deps.clock
  }

  resolve(invitation: StoredInvitation): LifecycleStatus {
    const now = this.clock.now().getTime()

    if (invitation.expiresAt !== null && invitation.expiresAt.getTime() <= now) return 'EXPIRED'
    if (invitation.status === 'EXPIRED') return 'EXPIRED'
    if (invitation.status === 'DRAFT') return 'PREVIEW'

    const event = invitation.content.events?.[0]
    if (event === undefined) return 'LIVE'

    const startsAt = toTime(event.startsAt)
    if (startsAt === null) return 'LIVE'

    const end =
      event.endsAt === null || event.endsAt === undefined ? startsAt : toTime(event.endsAt)
    if (end === null) return 'LIVE'

    return now > end + DAY_MS ? 'POST_EVENT' : 'LIVE'
  }
}
