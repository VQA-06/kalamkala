/**
 * The master invitation payload stored in `invitations.content_json`.
 *
 * Absent values are represented as `null`, never as missing keys: the JSON is a
 * complete document, so consumers can rely on every field being present after
 * parsing. This schema is versioned because content written by an older release
 * must stay readable after the shape evolves.
 */

import { z } from 'zod'

import {
  eventCategorySchema,
  eventTimezoneSchema,
  localeSchema,
  mediaOrientationSchema,
} from './schemas.js'

/**
 * This package compiles against the ES2022 lib only. `URL` exists at runtime in
 * both Node and Cloudflare Workers, so declare the small surface used here
 * instead of pulling a DOM or Node lib into a shared contract package.
 */
declare const URL: {
  new (input: string): { protocol: string }
}

export const INVITATION_SCHEMA_VERSION = 1

/** Accepts absolute http/https URLs only; `z.string().url()` is deprecated in Zod 4. */
export const httpUrlSchema = z.string().refine(
  (value) => {
    try {
      const url = new URL(value)
      return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
      return false
    }
  },
  { message: 'URL harus menggunakan http atau https' },
)

/** Any value `Date.parse` understands, typically an ISO 8601 timestamp. */
export const isoDateSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Tanggal tidak valid',
  })

const hostSchema = z.object({
  fullName: z.string().min(1),
  nickname: z.string().nullable(),
  fatherName: z.string().nullable(),
  motherName: z.string().nullable(),
  photoKey: z.string().nullable(),
  instagramHandle: z.string().nullable(),
})

const displayOrderSchema = z
  .array(z.enum(['primary', 'secondary']))
  .min(1)
  .refine((order) => new Set(order).size === order.length, {
    message: 'displayOrder tidak boleh berisi duplikat',
  })

const eventSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  startsAt: isoDateSchema,
  endsAt: isoDateSchema.nullable(),
  timezone: eventTimezoneSchema,
  venueName: z.string().min(1),
  address: z.string().min(1),
  mapsUrl: httpUrlSchema.nullable(),
  dressCode: z.string().nullable(),
})

const galleryItemSchema = z.object({
  key: z.string().min(1),
  orientation: mediaOrientationSchema,
  caption: z.string().nullable(),
})

const bankAccountSchema = z.object({
  bankName: z.string().min(1),
  accountNumber: z.string().min(1),
  accountHolder: z.string().min(1),
})

const happyFamilySchema = z.object({
  name: z.string().min(1),
  photoKey: z.string().nullable(),
})

const accessControlSchema = z
  .object({
    isPrivatePinEnabled: z.boolean(),
    pinCode: z.string().nullable(),
    strictGuestListOnly: z.boolean(),
    defaultMaxPaxPerGuest: z.number().int().min(1).max(20),
  })
  .superRefine((value, ctx) => {
    if (!value.isPrivatePinEnabled) return
    if (value.pinCode === null || !/^\d{4,6}$/.test(value.pinCode)) {
      ctx.addIssue({
        code: 'custom',
        path: ['pinCode'],
        message: 'PIN harus terdiri dari 4 sampai 6 digit',
      })
    }
  })

const loveStoryItemSchema = z.object({
  date: z.string().nullable(),
  title: z.string().min(1),
  story: z.string().min(1),
})

const hotelSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  bookingUrl: httpUrlSchema.nullable(),
  distanceLabel: z.string().nullable(),
})

const entourageGroupSchema = z.object({
  title: z.string().min(1),
  members: z.array(z.string().min(1)).min(1),
})

const coHostSchema = z.object({
  name: z.string().min(1),
  role: z.string().nullable(),
  whatsappNumber: z.string().nullable(),
})

export const MasterInvitationSchema = z.object({
  schemaVersion: z.literal(INVITATION_SCHEMA_VERSION),
  eventCategory: eventCategorySchema,
  seoMeta: z.object({
    title: z.string().min(1).max(70),
    description: z.string().min(1).max(160),
    ogLandscapePhotoKey: z.string().nullable(),
  }),
  settings: z.object({
    locale: localeSchema,
    showPublicRsvpStats: z.boolean(),
    showPublicWishes: z.boolean(),
    hidePlatformWatermark: z.boolean(),
  }),
  accessControl: accessControlSchema,
  opening: z.object({
    headline: z.string().min(1),
    subheadline: z.string().nullable(),
    quote: z.string().nullable(),
    quoteSource: z.string().nullable(),
  }),
  hosts: z.object({
    displayOrder: displayOrderSchema,
    primary: hostSchema,
    secondary: hostSchema.nullable(),
  }),
  events: z.array(eventSchema).min(1),
  media: z.object({
    gallery: z.array(galleryItemSchema),
    videoUrl: httpUrlSchema.nullable(),
    audioKey: z.string().nullable(),
  }),
  gifts: z.object({
    bankAccounts: z.array(bankAccountSchema),
    qrisImageKey: z.string().nullable(),
    physicalAddress: z.string().nullable(),
  }),
  closing: z.object({
    message: z.string().min(1),
    happyFamilies: z.array(happyFamilySchema),
  }),
  modules: z.object({
    loveStory: z.object({
      enabled: z.boolean(),
      items: z.array(loveStoryItemSchema),
    }),
    liveStream: z.object({
      enabled: z.boolean(),
      url: httpUrlSchema.nullable(),
      platform: z.string().nullable(),
    }),
    socialKit: z.object({
      enabled: z.boolean(),
      hashtag: z.string().nullable(),
      instagramFilterUrl: httpUrlSchema.nullable(),
      caption: z.string().nullable(),
    }),
    travelInfo: z.object({
      enabled: z.boolean(),
      venueMapUrl: httpUrlSchema.nullable(),
      hotels: z.array(hotelSchema),
    }),
    entourage: z.object({
      enabled: z.boolean(),
      groups: z.array(entourageGroupSchema),
    }),
    coHosts: z.object({
      enabled: z.boolean(),
      items: z.array(coHostSchema),
    }),
    additionalNotes: z.object({
      enabled: z.boolean(),
      notes: z.array(z.string().min(1)),
    }),
    enableQrCheckin: z.boolean(),
  }),
})

export type MasterInvitation = z.infer<typeof MasterInvitationSchema>
