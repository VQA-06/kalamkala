import type {
  CreateInvitationReportInput,
  InvitationReportRepository,
  LoggerPort,
  StoredInvitationReport,
} from '@kalamkala/app-core'
import { invitationReports } from '@kalamkala/db-schema'

import type { AppDatabase } from './database.js'

export type D1InvitationReportRepositoryOptions = {
  db: AppDatabase
  logger?: LoggerPort
}

type InvitationReportRow = typeof invitationReports.$inferSelect

/** Abuse reports for admin triage; reporters are identified only by hash. */
export class D1InvitationReportRepository implements InvitationReportRepository {
  private readonly db: AppDatabase
  private readonly logger: LoggerPort | undefined

  constructor(options: D1InvitationReportRepositoryOptions) {
    this.db = options.db
    this.logger = options.logger
  }

  async create(input: CreateInvitationReportInput): Promise<StoredInvitationReport> {
    const rows = await this.db
      .insert(invitationReports)
      .values({
        id: input.id,
        invitationId: input.invitationId,
        reason: input.reason,
        note: input.note,
        reporterHash: input.reporterHash,
      })
      .returning()

    const row = rows[0]
    if (row === undefined) {
      this.logger?.error('Invitation report insert returned no row', {
        invitationId: input.invitationId,
      })
      throw new Error(`Failed to create report for invitation ${input.invitationId}`)
    }
    return this.toStoredReport(row)
  }

  private toStoredReport(row: InvitationReportRow): StoredInvitationReport {
    return {
      id: row.id,
      invitationId: row.invitationId,
      reason: row.reason,
      note: row.note,
      reporterHash: row.reporterHash,
      createdAt: row.createdAt,
    }
  }
}
