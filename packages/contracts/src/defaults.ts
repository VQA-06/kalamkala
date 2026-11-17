import type { InvitationTier, Locale } from './enums.js'
import type { MasterInvitation } from './invitation.js'

/**
 * Placeholder variables supported by the WhatsApp message template. The order
 * is the order the editor shows its insert buttons in.
 */
export const WHATSAPP_TEMPLATE_VARIABLES = [
  'nama',
  'link',
  'mempelai',
  'tanggal',
  'sesi',
] as const

export const DEFAULT_WHATSAPP_TEMPLATE =
  'Halo {nama}, kami mengundang Anda untuk hadir di acara {mempelai} pada {tanggal} ({sesi}). Buka undangan dan konfirmasi kehadiran melalui tautan berikut: {link}'

/**
 * Provisional product prices in rupiah, used until Duitku pricing and the
 * tier benefits are finalized.
 */
export const INVITATION_TIER_PRICES = {
  BASIC: 49_000,
  PREMIUM: 99_000,
} as const satisfies Record<InvitationTier, number>

/**
 * Formats the default event date as 09:00 WIB one calendar year after `now`.
 * UTC components are used so the result does not depend on the server timezone.
 * A February 29 input rolls over to March 1 in the following year via
 * `setUTCFullYear`.
 */
const defaultEventDate = (now: Date): string => {
  const nextYear = new Date(now.getTime())
  nextYear.setUTCFullYear(nextYear.getUTCFullYear() + 1)

  const year = nextYear.getUTCFullYear()
  const month = String(nextYear.getUTCMonth() + 1).padStart(2, '0')
  const day = String(nextYear.getUTCDate()).padStart(2, '0')

  return `${year}-${month}-${day}T09:00:00+07:00`
}

/**
 * A complete draft document that already satisfies `MasterInvitationSchema`.
 * Hosts replace the generic names, event, and media; the shape never depends on
 * optional keys being absent.
 */
export const createDefaultInvitationContent = (input?: {
  now?: Date
  locale?: Locale
}): MasterInvitation => {
  const now = input?.now ?? new Date()

  return {
    schemaVersion: 1,
    eventCategory: 'WEDDING',
    seoMeta: {
      title: 'Undangan Pernikahan',
      description:
        'Undangan pernikahan digital untuk berbagi kabar bahagia dan konfirmasi kehadiran.',
      ogLandscapePhotoKey: null,
    },
    settings: {
      locale: input?.locale ?? 'id',
      showPublicRsvpStats: true,
      showPublicWishes: true,
      hidePlatformWatermark: false,
    },
    accessControl: {
      isPrivatePinEnabled: false,
      pinCode: null,
      strictGuestListOnly: false,
      defaultMaxPaxPerGuest: 2,
    },
    opening: {
      headline: 'Undangan Pernikahan',
      subheadline:
        'Dengan penuh syukur, kami mengundang Anda untuk berbagi kebahagiaan kami.',
      quote: null,
      quoteSource: null,
    },
    hosts: {
      displayOrder: ['primary', 'secondary'],
      primary: {
        fullName: 'Mempelai Pertama',
        nickname: null,
        fatherName: null,
        motherName: null,
        photoKey: null,
        instagramHandle: null,
      },
      secondary: {
        fullName: 'Mempelai Kedua',
        nickname: null,
        fatherName: null,
        motherName: null,
        photoKey: null,
        instagramHandle: null,
      },
    },
    events: [
      {
        id: 'acara-utama',
        name: 'Resepsi Pernikahan',
        startsAt: defaultEventDate(now),
        endsAt: null,
        timezone: 'WIB',
        venueName: 'Lokasi Acara',
        address: 'Alamat lengkap akan dilengkapi',
        mapsUrl: null,
        dressCode: null,
      },
    ],
    media: {
      gallery: [],
      videoUrl: null,
      audioKey: null,
    },
    gifts: {
      bankAccounts: [],
      qrisImageKey: null,
      physicalAddress: null,
    },
    closing: {
      message: 'Terima kasih atas doa dan restu yang Anda berikan.',
      happyFamilies: [],
    },
    modules: {
      loveStory: { enabled: false, items: [] },
      liveStream: { enabled: false, url: null, platform: null },
      socialKit: {
        enabled: false,
        hashtag: null,
        instagramFilterUrl: null,
        caption: null,
      },
      travelInfo: { enabled: false, venueMapUrl: null, hotels: [] },
      entourage: { enabled: false, groups: [] },
      coHosts: { enabled: false, items: [] },
      additionalNotes: { enabled: false, notes: [] },
      enableQrCheckin: false,
    },
  }
}
