import type { RsvpAttendance } from '@kalamkala/contracts'

import type { ClockPort } from '../ports/clock.js'
import type { CreateRsvpInput, RsvpRepository, StoredRsvp } from '../ports/rsvp-repository.js'

export type RsvpValidationErrorCode = 'INVALID_GUEST_COUNT' | 'MAX_PAX_EXCEEDED'

export class RsvpValidationError extends Error {
  readonly code: RsvpValidationErrorCode

  constructor(code: RsvpValidationErrorCode, message: string = code) {
    super(message)
    this.name = 'RsvpValidationError'
    this.code = code
  }
}

/**
 * Deliberately short and Indonesian: these are the words hosts ask to be
 * screened out of public RSVP walls. Word boundaries keep innocent
 * substrings intact.
 */
const PROFANITY_PATTERN =
  /\b(anjing|babi|bajingan|brengsek|goblok|tolol|kontol|memek|ngentot|keparat|kampret|bangke)\b/giu

export type ModerateRsvpInput = {
  message: string
  guestCount: number
  maxPax: number
}

export type ModerateRsvpResult = {
  message: string | null
  isFlagged: boolean
}

/** Pure moderation: validate the party size, then mask profanity. */
export const moderate = (input: ModerateRsvpInput): ModerateRsvpResult => {
  if (!Number.isInteger(input.guestCount) || input.guestCount < 1) {
    throw new RsvpValidationError('INVALID_GUEST_COUNT', 'Guest count must be a positive integer')
  }
  if (input.guestCount > input.maxPax) {
    throw new RsvpValidationError('MAX_PAX_EXCEEDED', `Guest count exceeds the allowed ${input.maxPax}`)
  }

  const trimmed = input.message.trim()
  if (trimmed.length === 0) return { message: null, isFlagged: false }

  let isFlagged = false
  const masked = trimmed.replace(PROFANITY_PATTERN, (match) => {
    isFlagged = true
    return '*'.repeat(match.length)
  })

  return { message: masked, isFlagged }
}

export type RsvpModerationServiceDeps = {
  rsvpRepository: RsvpRepository
  /** Reserved for future moderation timestamps; the repository stamps createdAt. */
  clock: ClockPort
}

export type SubmitRsvpInput = {
  invitationId: string
  guestId: string | null
  guestName: string
  attendance: RsvpAttendance
  guestCount: number
  message: string
  maxPax: number
}

export class RsvpModerationService {
  private readonly rsvpRepository: RsvpRepository

  constructor(deps: RsvpModerationServiceDeps) {
    this.rsvpRepository = deps.rsvpRepository
  }

  async submit(input: SubmitRsvpInput): Promise<StoredRsvp> {
    const moderated = moderate({
      message: input.message,
      guestCount: input.guestCount,
      maxPax: input.maxPax,
    })

    const row: CreateRsvpInput = {
      invitationId: input.invitationId,
      guestId: input.guestId,
      guestName: input.guestName,
      attendance: input.attendance,
      guestCount: input.guestCount,
      message: moderated.message,
      isHidden: moderated.isFlagged,
    }

    return this.rsvpRepository.create(row)
  }
}
