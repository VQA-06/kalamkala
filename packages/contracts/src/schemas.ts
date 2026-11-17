/**
 * Zod schemas for the domain enums.
 *
 * These are intentionally thin: each schema derives from the tuple in
 * `./enums`, so validation and types cannot disagree. Object/DTO schemas are
 * deliberately absent until a phase actually needs them.
 */

import { z } from 'zod'

import {
  DISCOUNT_TYPES,
  EVENT_CATEGORIES,
  EVENT_TIMEZONES,
  GUEST_CATEGORIES,
  INVITATION_REPORT_REASONS,
  INVITATION_STATUSES,
  INVITATION_TIERS,
  LOCALES,
  MEDIA_ORIENTATIONS,
  PAYMENT_PROVIDERS,
  RSVP_ATTENDANCES,
  SECTION_IDS,
  TRANSACTION_STATUSES,
  USER_ROLES,
  WA_SENT_STATUSES,
} from './enums.js'

export const userRoleSchema = z.enum(USER_ROLES)
export const invitationTierSchema = z.enum(INVITATION_TIERS)
export const invitationStatusSchema = z.enum(INVITATION_STATUSES)
export const guestCategorySchema = z.enum(GUEST_CATEGORIES)
export const rsvpAttendanceSchema = z.enum(RSVP_ATTENDANCES)
export const transactionStatusSchema = z.enum(TRANSACTION_STATUSES)
export const discountTypeSchema = z.enum(DISCOUNT_TYPES)
export const waSentStatusSchema = z.enum(WA_SENT_STATUSES)
export const paymentProviderSchema = z.enum(PAYMENT_PROVIDERS)

export const eventCategorySchema = z.enum(EVENT_CATEGORIES)
export const localeSchema = z.enum(LOCALES)
export const mediaOrientationSchema = z.enum(MEDIA_ORIENTATIONS)
export const eventTimezoneSchema = z.enum(EVENT_TIMEZONES)
export const sectionIdSchema = z.enum(SECTION_IDS)
export const invitationReportReasonSchema = z.enum(INVITATION_REPORT_REASONS)
