import type { ClockPort } from '../ports/clock.js'
import type { InvitationRepository, StoredInvitation } from '../ports/invitation-repository.js'
import type { LoggerPort } from '../ports/logger.js'
import type { VerifiedPayment } from '../ports/payment-gateway.js'
import type {
  PaymentConfirmation,
  StoredTransaction,
  TransactionRepository,
} from '../ports/transaction-repository.js'

export type PaymentActivationErrorCode =
  | 'TRANSACTION_NOT_FOUND'
  | 'INVITATION_NOT_FOUND'
  | 'AMOUNT_MISMATCH'
  | 'PROVIDER_MISMATCH'
  | 'INVALID_STATE'

export class PaymentActivationError extends Error {
  readonly code: PaymentActivationErrorCode

  constructor(code: PaymentActivationErrorCode, message: string = code) {
    super(message)
    this.name = 'PaymentActivationError'
    this.code = code
  }
}

export type ActivationResult = {
  alreadyProcessed: boolean
  transaction: StoredTransaction
  invitation: StoredInvitation
}

export type ManualActivationOptions = {
  gatewayReference?: string
  paidAt?: Date | null
}

export type PaymentActivationServiceDeps = {
  transactionRepository: TransactionRepository
  invitationRepository: InvitationRepository
  clock: ClockPort
  logger: LoggerPort
}

/**
 * Turns a verified gateway callback into a live invitation.
 *
 * Idempotency lives in two places: an early return for rows already PAID, and
 * the repository's conditional `markPaidIfPending` for concurrent callbacks.
 */
export class PaymentActivationService {
  private readonly transactionRepository: TransactionRepository
  private readonly invitationRepository: InvitationRepository
  private readonly clock: ClockPort
  private readonly logger: LoggerPort

  constructor(deps: PaymentActivationServiceDeps) {
    this.transactionRepository = deps.transactionRepository
    this.invitationRepository = deps.invitationRepository
    this.clock = deps.clock
    this.logger = deps.logger
  }

  async activateFromCallback(verified: VerifiedPayment): Promise<ActivationResult> {
    const transaction = await this.requireTransaction(verified.merchantOrderId)
    const invitation = await this.requireInvitation(transaction.invitationId)

    if (transaction.status === 'PAID') return { alreadyProcessed: true, transaction, invitation }
    if (verified.status !== 'PAID') {
      throw new PaymentActivationError('INVALID_STATE', 'Callback did not report a successful payment')
    }
    if (verified.amount !== transaction.amount) {
      throw new PaymentActivationError('AMOUNT_MISMATCH', 'Callback amount does not match the order')
    }
    if (verified.provider !== transaction.gatewayProvider) {
      throw new PaymentActivationError('PROVIDER_MISMATCH', 'Callback provider does not match the order')
    }

    return this.applyPaid(transaction, invitation, {
      gatewayReference: verified.gatewayReference,
      paidAt: verified.paidAt ?? this.clock.now(),
    })
  }

  async activateManually(
    merchantOrderId: string,
    options: ManualActivationOptions = {},
  ): Promise<ActivationResult> {
    const transaction = await this.requireTransaction(merchantOrderId)
    const invitation = await this.requireInvitation(transaction.invitationId)

    if (transaction.status === 'PAID') return { alreadyProcessed: true, transaction, invitation }

    return this.applyPaid(transaction, invitation, {
      gatewayReference: options.gatewayReference ?? `manual_${merchantOrderId}`,
      paidAt: options.paidAt ?? this.clock.now(),
    })
  }

  private async applyPaid(
    transaction: StoredTransaction,
    invitation: StoredInvitation,
    confirmation: PaymentConfirmation,
  ): Promise<ActivationResult> {
    const paidTransaction = await this.transactionRepository.markPaidIfPending(
      transaction.merchantOrderId,
      confirmation,
    )

    if (paidTransaction === null) {
      // A concurrent callback won the conditional update. Re-read to report
      // the real outcome instead of activating twice.
      const current = await this.transactionRepository.findByMerchantOrderId(
        transaction.merchantOrderId,
      )
      if (current === null) {
        throw new PaymentActivationError('TRANSACTION_NOT_FOUND', 'Order disappeared during activation')
      }
      if (current.status === 'PAID') return { alreadyProcessed: true, transaction: current, invitation }
      throw new PaymentActivationError('INVALID_STATE', 'Order is no longer pending')
    }

    await this.invitationRepository.setStatus(
      paidTransaction.invitationId,
      'ACTIVE',
      confirmation.paidAt,
    )
    await this.invitationRepository.refreshCache(paidTransaction.invitationId)

    this.logger.info('payment.activated', {
      merchantOrderId: paidTransaction.merchantOrderId,
      transactionId: paidTransaction.id,
      invitationId: paidTransaction.invitationId,
      provider: paidTransaction.gatewayProvider,
      amount: paidTransaction.amount,
    })

    return {
      alreadyProcessed: false,
      transaction: paidTransaction,
      invitation: { ...invitation, status: 'ACTIVE', publishedAt: confirmation.paidAt },
    }
  }

  private async requireTransaction(merchantOrderId: string): Promise<StoredTransaction> {
    const transaction = await this.transactionRepository.findByMerchantOrderId(merchantOrderId)
    if (transaction === null) {
      throw new PaymentActivationError('TRANSACTION_NOT_FOUND', `No transaction for ${merchantOrderId}`)
    }
    return transaction
  }

  private async requireInvitation(invitationId: string): Promise<StoredInvitation> {
    const invitation = await this.invitationRepository.findById(invitationId)
    if (invitation === null) {
      throw new PaymentActivationError('INVITATION_NOT_FOUND', `No invitation ${invitationId}`)
    }
    return invitation
  }
}
