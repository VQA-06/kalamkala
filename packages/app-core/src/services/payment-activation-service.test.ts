import { describe, expect, it } from 'vitest'

import type { InvitationStatus, MasterInvitation } from '@kalamkala/contracts'

import type { ClockPort } from '../ports/clock.js'
import type {
  InvitationRepository,
  StoredInvitation,
} from '../ports/invitation-repository.js'
import type { LogFields, LoggerPort } from '../ports/logger.js'
import type { VerifiedPayment } from '../ports/payment-gateway.js'
import type {
  PaymentConfirmation,
  StoredTransaction,
  TransactionRepository,
} from '../ports/transaction-repository.js'

import {
  PaymentActivationError,
  PaymentActivationService,
  type PaymentActivationErrorCode,
} from './payment-activation-service.js'

const FIXED_NOW = new Date('2026-03-01T08:00:00.000Z')

const createClock = (now: Date): ClockPort => ({ now: () => now })

const createInvitation = (overrides: Partial<StoredInvitation> = {}): StoredInvitation => ({
  id: 'invitation_1',
  userId: 'user_1',
  slug: 'andi-sari',
  templateId: 'senja-ungu',
  tier: 'BASIC',
  status: 'DRAFT',
  content: {} as unknown as MasterInvitation,
  appearance: null,
  whatsappTemplate: null,
  publishedAt: null,
  expiresAt: null,
  ...overrides,
})

const createTransaction = (overrides: Partial<StoredTransaction> = {}): StoredTransaction => ({
  id: 'transaction_1',
  invitationId: 'invitation_1',
  userId: 'user_1',
  merchantOrderId: 'order_1',
  gatewayProvider: 'SIMULATED',
  gatewayReference: null,
  promoCode: null,
  amount: 90_000,
  status: 'PENDING',
  paidAt: null,
  createdAt: FIXED_NOW,
  ...overrides,
})

const createVerifiedPayment = (
  overrides: Partial<VerifiedPayment> = {},
): VerifiedPayment => ({
  merchantOrderId: 'order_1',
  provider: 'SIMULATED',
  status: 'PAID',
  amount: 90_000,
  gatewayReference: 'sim_ref_1',
  paidAt: FIXED_NOW,
  ...overrides,
})

type SetStatusCall = { id: string; status: InvitationStatus; publishedAt: Date | null }

type FakeInvitationRepository = {
  repository: InvitationRepository
  store: Map<string, StoredInvitation>
  setStatusCalls: SetStatusCall[]
  refreshCacheCalls: string[]
}

const createInvitationRepository = (initial: StoredInvitation): FakeInvitationRepository => {
  const store = new Map<string, StoredInvitation>([[initial.id, initial]])
  const setStatusCalls: SetStatusCall[] = []
  const refreshCacheCalls: string[] = []
  const repository: InvitationRepository = {
    findById: async (id) => store.get(id) ?? null,
    findBySlug: async (slug) => [...store.values()].find((row) => row.slug === slug) ?? null,
    listByUserId: async () => [],
    create: async () => {
      throw new Error('activation tests never create invitations')
    },
    updateContent: async () => {},
    updateAppearance: async () => {},
    setWhatsappTemplate: async () => {},
    updateTier: async () => {},
    setStatus: async (id, status, publishedAt) => {
      setStatusCalls.push({ id, status, publishedAt })
      const current = store.get(id)
      if (current !== undefined) store.set(id, { ...current, status, publishedAt })
    },
    refreshCache: async (id) => {
      refreshCacheCalls.push(id)
    },
    invalidateCache: async () => {},
  }
  return { repository, store, setStatusCalls, refreshCacheCalls }
}

type FakeTransactionRepository = {
  repository: TransactionRepository
  store: Map<string, StoredTransaction>
  markPaidCalls: PaymentConfirmation[]
}

const createTransactionRepository = (
  initial: StoredTransaction,
  options: { loseRace?: boolean } = {},
): FakeTransactionRepository => {
  const store = new Map<string, StoredTransaction>([[initial.id, initial]])
  const markPaidCalls: PaymentConfirmation[] = []

  const findByMerchantOrderId = (merchantOrderId: string): StoredTransaction | null => {
    for (const row of store.values()) {
      if (row.merchantOrderId === merchantOrderId) return row
    }
    return null
  }

  const repository: TransactionRepository = {
    findById: async (id) => store.get(id) ?? null,
    findByMerchantOrderId: async (merchantOrderId) => findByMerchantOrderId(merchantOrderId),
    create: async () => {
      throw new Error('activation tests never create transactions')
    },
    listRecent: async () => [],
    markPaidIfPending: async (merchantOrderId, confirmation) => {
      markPaidCalls.push(confirmation)
      const current = findByMerchantOrderId(merchantOrderId)
      if (current === null || current.status !== 'PENDING') return null
      const paid: StoredTransaction = {
        ...current,
        status: 'PAID',
        gatewayReference: confirmation.gatewayReference,
        paidAt: confirmation.paidAt,
      }
      store.set(paid.id, paid)
      // Simulates another callback winning the race after this update.
      return options.loseRace === true ? null : paid
    },
    markStatus: async (id, status) => {
      const current = store.get(id)
      if (current !== undefined) store.set(id, { ...current, status })
    },
  }

  return { repository, store, markPaidCalls }
}

type LogEntry = { level: string; message: string; fields?: LogFields }

const createLogger = (): { logger: LoggerPort; entries: LogEntry[] } => {
  const entries: LogEntry[] = []
  const record =
    (level: string) =>
    (message: string, fields?: LogFields): void => {
      entries.push({ level, message, fields })
    }
  const logger: LoggerPort = {
    info: record('info'),
    warn: record('warn'),
    error: record('error'),
    withRequestId: () => logger,
  }
  return { logger, entries }
}

const createFixture = (
  options: {
    transaction?: StoredTransaction
    invitation?: StoredInvitation
    loseRace?: boolean
  } = {},
): {
  service: PaymentActivationService
  invitations: FakeInvitationRepository
  transactions: FakeTransactionRepository
  entries: LogEntry[]
} => {
  const invitations = createInvitationRepository(options.invitation ?? createInvitation())
  const transactions = createTransactionRepository(
    options.transaction ?? createTransaction(),
    { loseRace: options.loseRace },
  )
  const { logger, entries } = createLogger()
  const service = new PaymentActivationService({
    transactionRepository: transactions.repository,
    invitationRepository: invitations.repository,
    clock: createClock(FIXED_NOW),
    logger,
  })
  return { service, invitations, transactions, entries }
}

const expectActivationError = async (
  action: Promise<unknown>,
  code: PaymentActivationErrorCode,
): Promise<void> => {
  const error = await action.then(
    () => null,
    (reason: unknown) => reason,
  )
  expect(error).toBeInstanceOf(PaymentActivationError)
  expect(error).toMatchObject({ code })
}

describe('PaymentActivationService.activateFromCallback', () => {
  it('activates the invitation on the first paid callback', async () => {
    const { service, invitations, transactions, entries } = createFixture()

    const result = await service.activateFromCallback(createVerifiedPayment())

    expect(result.alreadyProcessed).toBe(false)
    expect(result.transaction).toMatchObject({
      status: 'PAID',
      gatewayReference: 'sim_ref_1',
    })
    expect(result.transaction.paidAt?.toISOString()).toBe(FIXED_NOW.toISOString())
    expect(result.invitation.status).toBe('ACTIVE')
    expect(invitations.setStatusCalls).toEqual([
      { id: 'invitation_1', status: 'ACTIVE', publishedAt: FIXED_NOW },
    ])
    expect(invitations.refreshCacheCalls).toEqual(['invitation_1'])
    expect(transactions.markPaidCalls).toHaveLength(1)
    expect(entries).toEqual([
      {
        level: 'info',
        message: 'payment.activated',
        fields: {
          merchantOrderId: 'order_1',
          transactionId: 'transaction_1',
          invitationId: 'invitation_1',
          provider: 'SIMULATED',
          amount: 90_000,
        },
      },
    ])
  })

  it('treats a replayed callback as already processed without side effects', async () => {
    const { service, invitations, entries } = createFixture()

    await service.activateFromCallback(createVerifiedPayment())
    const replay = await service.activateFromCallback(createVerifiedPayment())

    expect(replay.alreadyProcessed).toBe(true)
    expect(replay.transaction.status).toBe('PAID')
    expect(invitations.setStatusCalls).toHaveLength(1)
    expect(invitations.refreshCacheCalls).toEqual(['invitation_1'])
    expect(entries).toHaveLength(1)
  })

  it('rejects an amount mismatch without writing', async () => {
    const { service, invitations, transactions } = createFixture()

    await expectActivationError(
      service.activateFromCallback(createVerifiedPayment({ amount: 50_000 })),
      'AMOUNT_MISMATCH',
    )
    expect(transactions.markPaidCalls).toHaveLength(0)
    expect(invitations.setStatusCalls).toHaveLength(0)
  })

  it('rejects a provider mismatch without writing', async () => {
    const { service, invitations } = createFixture()

    await expectActivationError(
      service.activateFromCallback(createVerifiedPayment({ provider: 'DUITKU' })),
      'PROVIDER_MISMATCH',
    )
    expect(invitations.setStatusCalls).toHaveLength(0)
  })

  it('rejects a callback for an unknown order', async () => {
    const { service } = createFixture()

    await expectActivationError(
      service.activateFromCallback(createVerifiedPayment({ merchantOrderId: 'missing_order' })),
      'TRANSACTION_NOT_FOUND',
    )
  })

  it('rejects a callback whose invitation is missing', async () => {
    const { service } = createFixture({ invitation: createInvitation({ id: 'other_invitation' }) })

    await expectActivationError(service.activateFromCallback(createVerifiedPayment()), 'INVITATION_NOT_FOUND')
  })

  it('rejects a callback that is not PAID', async () => {
    const { service, invitations } = createFixture()

    await expectActivationError(
      service.activateFromCallback(createVerifiedPayment({ status: 'FAILED', paidAt: null })),
      'INVALID_STATE',
    )
    expect(invitations.setStatusCalls).toHaveLength(0)
  })

  it('reports already processed when a concurrent callback wins the update race', async () => {
    const { service, invitations, transactions } = createFixture({ loseRace: true })

    const result = await service.activateFromCallback(createVerifiedPayment())

    expect(result.alreadyProcessed).toBe(true)
    expect(result.transaction.status).toBe('PAID')
    expect(transactions.markPaidCalls).toHaveLength(1)
    expect(invitations.setStatusCalls).toHaveLength(0)
    expect(invitations.refreshCacheCalls).toHaveLength(0)
  })
})

describe('PaymentActivationService.activateManually', () => {
  it('marks the order paid with a manual reference and the clock time', async () => {
    const { service, invitations } = createFixture()

    const result = await service.activateManually('order_1')

    expect(result.alreadyProcessed).toBe(false)
    expect(result.transaction).toMatchObject({
      status: 'PAID',
      gatewayReference: 'manual_order_1',
    })
    expect(result.transaction.paidAt?.toISOString()).toBe(FIXED_NOW.toISOString())
    expect(invitations.setStatusCalls).toEqual([
      { id: 'invitation_1', status: 'ACTIVE', publishedAt: FIXED_NOW },
    ])
  })

  it('uses provided overrides when given', async () => {
    const paidAt = new Date('2026-02-20T10:00:00.000Z')
    const { service } = createFixture()

    const result = await service.activateManually('order_1', {
      gatewayReference: 'manual_transfer_123',
      paidAt,
    })

    expect(result.transaction.gatewayReference).toBe('manual_transfer_123')
    expect(result.transaction.paidAt?.toISOString()).toBe(paidAt.toISOString())
  })

  it('is a no-op for an already paid order', async () => {
    const { service, invitations } = createFixture({
      transaction: createTransaction({ status: 'PAID', paidAt: FIXED_NOW }),
    })

    const result = await service.activateManually('order_1')

    expect(result.alreadyProcessed).toBe(true)
    expect(invitations.setStatusCalls).toHaveLength(0)
  })
})
