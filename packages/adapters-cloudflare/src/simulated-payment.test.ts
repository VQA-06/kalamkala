import { describe, expect, it } from 'vitest'

import { PaymentGatewayError } from '@kalamkala/app-core'
import type {
  ClockPort,
  CreateCheckoutSessionInput,
  PaymentGatewayErrorCode,
} from '@kalamkala/app-core'

import {
  SimulatedPaymentAdapter,
  type SignedCallback,
  type SignedCallbackInput,
} from './simulated-payment.js'

const SECRET = 'simulated-secret'
const FIXED_NOW = new Date('2026-03-01T08:00:00.000Z')

type TestClock = ClockPort & { advanceSeconds: (seconds: number) => void }

/** Frozen clock; tests move it explicitly instead of sleeping. */
const createTestClock = (start: Date): TestClock => {
  let currentMs = start.getTime()
  return {
    now: () => new Date(currentMs),
    advanceSeconds: (seconds: number) => {
      currentMs += seconds * 1000
    },
  }
}

const createInput = (
  overrides: Partial<CreateCheckoutSessionInput> = {},
): CreateCheckoutSessionInput => ({
  invitationId: 'invitation-1',
  userId: 'user-1',
  merchantOrderId: 'order-1',
  amount: 150_000,
  returnUrl: 'https://undangan.test/invitation/invitation-1',
  ...overrides,
})

const createCallback = (
  overrides: Partial<SignedCallbackInput> = {},
): SignedCallbackInput => ({
  merchantOrderId: 'order-1',
  amount: 150_000,
  status: 'PAID',
  paidAt: FIXED_NOW,
  gatewayReference: 'sim_ref_1',
  ...overrides,
})

const expectGatewayError = async (
  action: Promise<unknown>,
  code: PaymentGatewayErrorCode,
): Promise<void> => {
  const reason = await action.then(
    () => null,
    (error: unknown) => error,
  )
  expect(reason).toBeInstanceOf(PaymentGatewayError)
  expect(reason).toMatchObject({ code })
}

const createAdapter = (clock: TestClock = createTestClock(FIXED_NOW)): SimulatedPaymentAdapter =>
  new SimulatedPaymentAdapter({ secret: SECRET, now: clock })

describe('SimulatedPaymentAdapter.createCheckoutSession', () => {
  it('returns a SIMULATED session that preserves the merchant order', async () => {
    const session = await createAdapter().createCheckoutSession(createInput())

    expect(session.merchantOrderId).toBe('order-1')
    expect(session.provider).toBe('SIMULATED')
    expect(session.paymentReference).toMatch(/^sim_[0-9a-f-]{36}$/u)
  })

  it('redirects to the simulation page with ref and order parameters', async () => {
    const session = await createAdapter().createCheckoutSession(createInput())
    const redirect = new URL(session.redirectUrl)

    expect(redirect.origin).toBe('https://undangan.test')
    expect(redirect.pathname).toBe('/pembayaran/simulasi')
    expect(redirect.searchParams.get('ref')).toBe(session.paymentReference)
    expect(redirect.searchParams.get('order')).toBe('order-1')
  })

  it('expires the session at clock time plus the configured TTL', async () => {
    const clock = createTestClock(FIXED_NOW)
    const adapter = new SimulatedPaymentAdapter({
      secret: SECRET,
      checkoutTtlMinutes: 45,
      now: clock,
    })

    const session = await adapter.createCheckoutSession(createInput())

    expect(session.expiresAt.toISOString()).toBe('2026-03-01T08:45:00.000Z')
  })

  it('defaults to a 30 minute checkout TTL', async () => {
    const session = await createAdapter().createCheckoutSession(createInput())

    expect(session.expiresAt.toISOString()).toBe('2026-03-01T08:30:00.000Z')
  })

  it.each([0, -1, 1.5])('rejects amount %s with VALIDATION', async (amount) => {
    await expectGatewayError(createAdapter().createCheckoutSession(createInput({ amount })), 'VALIDATION')
  })

  it('rejects an empty merchant order id with VALIDATION', async () => {
    await expectGatewayError(
      createAdapter().createCheckoutSession(createInput({ merchantOrderId: '  ' })),
      'VALIDATION',
    )
  })

  it('rejects an empty invitation id with VALIDATION', async () => {
    await expectGatewayError(
      createAdapter().createCheckoutSession(createInput({ invitationId: '' })),
      'VALIDATION',
    )
  })
})

describe('SimulatedPaymentAdapter.verifyCallback', () => {
  it('verifies a signed PAID callback', async () => {
    const adapter = createAdapter()
    const callback = await adapter.createSignedCallback(createCallback())

    const payment = await adapter.verifyCallback(callback)

    expect(payment).toMatchObject({
      merchantOrderId: 'order-1',
      provider: 'SIMULATED',
      status: 'PAID',
      amount: 150_000,
      gatewayReference: 'sim_ref_1',
    })
    expect(payment.paidAt?.toISOString()).toBe(FIXED_NOW.toISOString())
  })

  it('rejects a tampered body with INVALID_SIGNATURE', async () => {
    const adapter = createAdapter()
    const paid = await adapter.createSignedCallback(createCallback())
    const other = await adapter.createSignedCallback(createCallback({ amount: 999_000 }))

    await expectGatewayError(
      adapter.verifyCallback({ headers: paid.headers, body: other.body }),
      'INVALID_SIGNATURE',
    )
  })

  it('rejects a callback signed with another secret', async () => {
    const clock = createTestClock(FIXED_NOW)
    const foreignAdapter = new SimulatedPaymentAdapter({ secret: 'another-secret', now: clock })
    const callback = await foreignAdapter.createSignedCallback(createCallback())

    await expectGatewayError(createAdapter(clock).verifyCallback(callback), 'INVALID_SIGNATURE')
  })

  it('rejects a callback without a signature header as MALFORMED', async () => {
    const adapter = createAdapter()
    const callback = await adapter.createSignedCallback(createCallback())

    await expectGatewayError(
      adapter.verifyCallback({ headers: {}, body: callback.body }),
      'MALFORMED',
    )
  })

  it('rejects a signature header that is not base64url as MALFORMED', async () => {
    const adapter = createAdapter()
    const callback = await adapter.createSignedCallback(createCallback())

    await expectGatewayError(
      adapter.verifyCallback({
        headers: { 'x-simulated-signature': '!!!not-base64!!!' },
        body: callback.body,
      }),
      'MALFORMED',
    )
  })

  it('rejects an expired callback', async () => {
    const clock = createTestClock(FIXED_NOW)
    const adapter = createAdapter(clock)
    const callback: SignedCallback = await adapter.createSignedCallback(createCallback())

    clock.advanceSeconds(16 * 60)

    await expectGatewayError(adapter.verifyCallback(callback), 'EXPIRED')
  })

  it('returns identical results when the same callback is replayed', async () => {
    const adapter = createAdapter()
    const callback = await adapter.createSignedCallback(createCallback())

    const first = await adapter.verifyCallback(callback)
    const second = await adapter.verifyCallback(callback)

    expect(second).toStrictEqual(first)
  })
})
