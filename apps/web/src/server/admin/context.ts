import {
  ConsoleJsonLogger,
  D1AdminStatsRepository,
  D1CatalogTemplateRepository,
  D1KVInvitationRepository,
  D1PromoRepository,
  D1TransactionRepository,
  D1UserRepository,
  KvCacheAdapter,
  createAppDatabase,
  requestIdFromHeaders,
} from '@kalamkala/adapters-cloudflare'
import type { AppDatabase } from '@kalamkala/adapters-cloudflare'
import { PaymentActivationService, systemClock } from '@kalamkala/app-core'
import type { CachePort, LoggerPort } from '@kalamkala/app-core'
import { getRequest, getRequestHeaders } from '@tanstack/react-start/server'
import { env } from 'cloudflare:workers'

import { getAuth } from '../../lib/auth'

export type AdminServices = {
  db: AppDatabase
  logger: LoggerPort
  cache: CachePort
  userRepository: D1UserRepository
  adminStatsRepository: D1AdminStatsRepository
  transactionRepository: D1TransactionRepository
  catalogTemplateRepository: D1CatalogTemplateRepository
  promoRepository: D1PromoRepository
  invitationRepository: D1KVInvitationRepository
  activation: PaymentActivationService
}

/**
 * Every admin server function calls this instead of trusting the route guard.
 * The role is read from D1 after the Better Auth session is verified, so a
 * forged client session or a stale guard cannot expose admin data.
 */
export const requireAdminServices = async (): Promise<AdminServices | null> => {
  const session = await getAuth().api.getSession({ headers: getRequestHeaders() })
  if (session === null) return null

  const requestId = requestIdFromHeaders(
    Object.fromEntries(getRequest().headers.entries()),
  )
  const logger = new ConsoleJsonLogger({ service: 'kalamkala-web' }).withRequestId(
    requestId,
  )
  const db = createAppDatabase(env.DB)
  const userRepository = new D1UserRepository({ db })
  const user = await userRepository.findById(session.user.id)
  if (user?.role !== 'ADMIN') return null

  const cache = new KvCacheAdapter(env.INVITE_KV)
  const transactionRepository = new D1TransactionRepository({ db, logger })
  const invitationRepository = new D1KVInvitationRepository({ db, cache, logger })

  return {
    db,
    logger,
    cache,
    userRepository,
    adminStatsRepository: new D1AdminStatsRepository({ db }),
    transactionRepository,
    catalogTemplateRepository: new D1CatalogTemplateRepository({ db }),
    promoRepository: new D1PromoRepository({ db }),
    invitationRepository,
    activation: new PaymentActivationService({
      transactionRepository,
      invitationRepository,
      clock: systemClock,
      logger,
    }),
  }
}
