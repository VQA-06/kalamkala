import { describe, expect, it } from 'vitest'

import type { InvitationStatus, MasterInvitation } from '@kalamkala/contracts'

import type { StoredInvitation } from '../ports/invitation-repository.js'

import { InvitationLifecycleService } from './invitation-lifecycle-service.js'

const EVENT_START = '2026-03-10T01:00:00.000Z'
const EVENT_END = '2026-03-10T05:00:00.000Z'
const END_PLUS_24H = '2026-03-11T05:00:00.000Z'

type EventFixture = { startsAt: string; endsAt: string | null }

const createService = (nowIso: string): InvitationLifecycleService =>
  new InvitationLifecycleService({ clock: { now: () => new Date(nowIso) } })

const createInvitation = (
  overrides: {
    status?: InvitationStatus
    events?: ReadonlyArray<EventFixture>
    expiresAt?: Date | null
  } = {},
): StoredInvitation => ({
  id: 'invitation_1',
  userId: 'user_1',
  slug: 'andi-sari',
  templateId: 'senja-ungu',
  tier: 'BASIC',
  status: overrides.status ?? 'ACTIVE',
  content: { events: overrides.events ?? [] } as unknown as MasterInvitation,
  appearance: null,
  publishedAt: null,
  expiresAt: overrides.expiresAt ?? null,
})

const MAIN_EVENT: ReadonlyArray<EventFixture> = [{ startsAt: EVENT_START, endsAt: EVENT_END }]

describe('InvitationLifecycleService.resolve', () => {
  it('returns PREVIEW for a draft invitation', () => {
    const service = createService(EVENT_START)

    expect(service.resolve(createInvitation({ status: 'DRAFT', events: MAIN_EVENT }))).toBe('PREVIEW')
  })

  it('returns LIVE before the main event ends', () => {
    const service = createService('2026-03-10T04:59:59.000Z')

    expect(service.resolve(createInvitation({ events: MAIN_EVENT }))).toBe('LIVE')
  })

  it('returns LIVE at exactly end plus 24 hours', () => {
    const service = createService(END_PLUS_24H)

    expect(service.resolve(createInvitation({ events: MAIN_EVENT }))).toBe('LIVE')
  })

  it('returns POST_EVENT one second after end plus 24 hours', () => {
    const service = createService('2026-03-11T05:00:01.000Z')

    expect(service.resolve(createInvitation({ events: MAIN_EVENT }))).toBe('POST_EVENT')
  })

  it('falls back to the start time when endsAt is null', () => {
    const service = createService('2026-03-11T01:00:01.000Z')

    expect(
      service.resolve(
        createInvitation({ events: [{ startsAt: EVENT_START, endsAt: null }] }),
      ),
    ).toBe('POST_EVENT')
  })

  it('returns EXPIRED when expiresAt has passed, even for ACTIVE', () => {
    const service = createService('2026-03-01T08:00:00.000Z')

    expect(
      service.resolve(
        createInvitation({
          events: MAIN_EVENT,
          expiresAt: new Date('2026-03-01T07:59:59.000Z'),
        }),
      ),
    ).toBe('EXPIRED')
  })

  it('returns EXPIRED for an EXPIRED status', () => {
    const service = createService(EVENT_START)

    expect(service.resolve(createInvitation({ status: 'EXPIRED', events: MAIN_EVENT }))).toBe('EXPIRED')
  })

  it('returns LIVE for an ACTIVE invitation without events', () => {
    const service = createService(EVENT_START)

    expect(service.resolve(createInvitation({ events: [] }))).toBe('LIVE')
  })

  it('returns LIVE when the event date cannot be parsed', () => {
    const service = createService(EVENT_START)

    expect(
      service.resolve(createInvitation({ events: [{ startsAt: 'not-a-date', endsAt: null }] })),
    ).toBe('LIVE')
  })
})
