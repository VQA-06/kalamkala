import { describe, expect, it } from 'vitest'

import type { ClockPort } from '../ports/clock.js'
import type { CreateRsvpInput, RsvpRepository } from '../ports/rsvp-repository.js'

import {
  RsvpModerationService,
  RsvpValidationError,
  moderate,
  type RsvpValidationErrorCode,
  type SubmitRsvpInput,
} from './rsvp-moderation-service.js'

const FIXED_NOW = new Date('2026-03-01T08:00:00.000Z')

const createClock = (now: Date): ClockPort => ({ now: () => now })

const catchError = (action: () => unknown): unknown => {
  try {
    action()
    return null
  } catch (error) {
    return error
  }
}

const expectRsvpError = (action: () => unknown, code: RsvpValidationErrorCode): void => {
  const error = catchError(action)
  expect(error).toBeInstanceOf(RsvpValidationError)
  expect(error).toMatchObject({ code })
}

const createRsvpRepository = (): {
  repository: RsvpRepository
  created: CreateRsvpInput[]
} => {
  const created: CreateRsvpInput[] = []
  const repository: RsvpRepository = {
    create: async (input) => {
      created.push(input)
      return { id: 'rsvp_1', ...input, hostReply: null, createdAt: FIXED_NOW }
    },
    listByInvitation: async () => [],
    setReply: async () => {},
    setHidden: async () => {},
  }
  return { repository, created }
}

const createSubmitInput = (overrides: Partial<SubmitRsvpInput> = {}): SubmitRsvpInput => ({
  invitationId: 'invitation_1',
  guestId: null,
  guestName: 'Budi',
  attendance: 'HADIR',
  guestCount: 2,
  message: 'Selamat menempuh hidup baru!',
  maxPax: 2,
  ...overrides,
})

describe('moderate', () => {
  it('accepts a message within the party size', () => {
    expect(moderate({ message: 'Selamat menempuh hidup baru!', guestCount: 2, maxPax: 2 })).toEqual({
      message: 'Selamat menempuh hidup baru!',
      isFlagged: false,
    })
  })

  it('rejects a party larger than maxPax', () => {
    expectRsvpError(
      () => moderate({ message: 'Halo', guestCount: 3, maxPax: 2 }),
      'MAX_PAX_EXCEEDED',
    )
  })

  it('rejects a guest count of zero', () => {
    expectRsvpError(
      () => moderate({ message: 'Halo', guestCount: 0, maxPax: 2 }),
      'INVALID_GUEST_COUNT',
    )
  })

  it('rejects a non-integer guest count', () => {
    expectRsvpError(
      () => moderate({ message: 'Halo', guestCount: 1.5, maxPax: 2 }),
      'INVALID_GUEST_COUNT',
    )
  })

  it('masks profanity case-insensitively and flags the message', () => {
    expect(moderate({ message: 'Dasar ANJING dan goblok', guestCount: 1, maxPax: 2 })).toEqual({
      message: 'Dasar ****** dan ******',
      isFlagged: true,
    })
  })

  it('does not mask the pattern inside a longer word', () => {
    expect(moderate({ message: 'Jangan membabi buta', guestCount: 1, maxPax: 2 })).toEqual({
      message: 'Jangan membabi buta',
      isFlagged: false,
    })
  })

  it('returns null for an empty or whitespace message', () => {
    expect(moderate({ message: '   ', guestCount: 1, maxPax: 1 })).toEqual({
      message: null,
      isFlagged: false,
    })
  })
})

describe('RsvpModerationService.submit', () => {
  it('creates a visible RSVP after moderation', async () => {
    const { repository, created } = createRsvpRepository()
    const service = new RsvpModerationService({ rsvpRepository: repository, clock: createClock(FIXED_NOW) })

    const result = await service.submit(createSubmitInput())

    expect(result).toMatchObject({
      id: 'rsvp_1',
      invitationId: 'invitation_1',
      guestName: 'Budi',
      attendance: 'HADIR',
      guestCount: 2,
      message: 'Selamat menempuh hidup baru!',
      isHidden: false,
      createdAt: FIXED_NOW,
    })
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({ message: 'Selamat menempuh hidup baru!', isHidden: false })
  })

  it('hides and masks a flagged RSVP', async () => {
    const { repository, created } = createRsvpRepository()
    const service = new RsvpModerationService({ rsvpRepository: repository, clock: createClock(FIXED_NOW) })

    const result = await service.submit(createSubmitInput({ message: 'Dasar anjing' }))

    expect(result.message).toBe('Dasar ******')
    expect(result.isHidden).toBe(true)
    expect(created[0]).toMatchObject({ message: 'Dasar ******', isHidden: true })
  })

  it('rejects a party above maxPax before writing', async () => {
    const { repository, created } = createRsvpRepository()
    const service = new RsvpModerationService({ rsvpRepository: repository, clock: createClock(FIXED_NOW) })

    await expect(service.submit(createSubmitInput({ guestCount: 3 }))).rejects.toMatchObject({
      name: 'RsvpValidationError',
      code: 'MAX_PAX_EXCEEDED',
    })
    expect(created).toHaveLength(0)
  })

  it('rejects an invalid guest count before writing', async () => {
    const { repository, created } = createRsvpRepository()
    const service = new RsvpModerationService({ rsvpRepository: repository, clock: createClock(FIXED_NOW) })

    await expect(service.submit(createSubmitInput({ guestCount: 0 }))).rejects.toMatchObject({
      name: 'RsvpValidationError',
      code: 'INVALID_GUEST_COUNT',
    })
    expect(created).toHaveLength(0)
  })
})
