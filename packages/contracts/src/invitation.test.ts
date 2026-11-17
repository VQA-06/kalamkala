import { describe, expect, it } from 'vitest'

import { AppearanceConfigSchema, type AppearanceConfig } from './appearance.js'
import {
  MasterInvitationSchema,
  type MasterInvitation,
} from './invitation.js'

const validInvitation: MasterInvitation = {
  schemaVersion: 1,
  eventCategory: 'WEDDING',
  seoMeta: {
    title: 'Resa & Bagas',
    description: 'Undangan pernikahan Resa dan Bagas.',
    ogLandscapePhotoKey: null,
  },
  settings: {
    locale: 'id',
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
    headline: 'The Wedding of Resa & Bagas',
    subheadline: null,
    quote: null,
    quoteSource: null,
  },
  hosts: {
    displayOrder: ['primary', 'secondary'],
    primary: {
      fullName: 'Résa Putri',
      nickname: 'Resa',
      fatherName: null,
      motherName: null,
      photoKey: null,
      instagramHandle: null,
    },
    secondary: {
      fullName: 'Bagas Pratama',
      nickname: 'Bagas',
      fatherName: null,
      motherName: null,
      photoKey: null,
      instagramHandle: null,
    },
  },
  events: [
    {
      id: 'akad',
      name: 'Akad Nikah',
      startsAt: '2026-12-01T08:00:00+07:00',
      endsAt: '2026-12-01T10:00:00+07:00',
      timezone: 'WIB',
      venueName: 'Masjid Agung',
      address: 'Jl. Merdeka 1, Bandung',
      mapsUrl: 'https://maps.google.com/?q=-6.9,107.6',
      dressCode: null,
    },
  ],
  media: {
    gallery: [{ key: 'gallery/1.jpg', orientation: 'LANDSCAPE', caption: null }],
    videoUrl: null,
    audioKey: null,
  },
  gifts: {
    bankAccounts: [
      {
        bankName: 'BCA',
        accountNumber: '1234567890',
        accountHolder: 'Résa Putri',
      },
    ],
    qrisImageKey: null,
    physicalAddress: null,
  },
  closing: {
    message: 'Terima kasih atas doa dan restunya.',
    happyFamilies: [{ name: 'Keluarga Putri', photoKey: null }],
  },
  modules: {
    loveStory: {
      enabled: true,
      items: [
        { date: '2020-01-01', title: 'Pertemuan', story: 'Bertemu di kampus.' },
      ],
    },
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

const validAppearance: AppearanceConfig = {
  themeTokens: {
    bgPrimary: '#ffffff',
    bgSecondary: '#f5f1e8',
    textPrimary: '#1f1b16',
    textMuted: '#6b6258',
    accent: '#b08a3e',
    accentContrast: '#ffffff',
    border: '#e2d9c8',
  },
  fontPairingId: 'classic-serif',
  sectionOrder: ['opening', 'hosts', 'events'],
  hiddenSections: ['events'],
  sectionTitles: { opening: 'Pembuka' },
}

describe('MasterInvitationSchema', () => {
  it('parses a complete valid invitation document', () => {
    expect(MasterInvitationSchema.parse(validInvitation)).toEqual(
      validInvitation,
    )
  })

  it('rejects an unknown media orientation', () => {
    const invalid = {
      ...validInvitation,
      media: {
        ...validInvitation.media,
        gallery: [{ key: 'gallery/2.jpg', orientation: 'DIAGONAL', caption: null }],
      },
    }

    expect(MasterInvitationSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects a PIN that is too short when the PIN is enabled', () => {
    const invalid = {
      ...validInvitation,
      accessControl: {
        ...validInvitation.accessControl,
        isPrivatePinEnabled: true,
        pinCode: '12',
      },
    }

    expect(MasterInvitationSchema.safeParse(invalid).success).toBe(false)
  })

  it('accepts a four digit PIN when the PIN is enabled', () => {
    const valid = {
      ...validInvitation,
      accessControl: {
        ...validInvitation.accessControl,
        isPrivatePinEnabled: true,
        pinCode: '1234',
      },
    }

    expect(MasterInvitationSchema.safeParse(valid).success).toBe(true)
  })
})

describe('AppearanceConfigSchema', () => {
  it('parses partial section titles', () => {
    expect(AppearanceConfigSchema.parse(validAppearance)).toEqual(
      validAppearance,
    )
  })

  it('rejects a hidden section that is not in the section order', () => {
    const invalid = {
      ...validAppearance,
      hiddenSections: ['media'],
    }

    expect(AppearanceConfigSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects duplicate sections in the section order', () => {
    const invalid = {
      ...validAppearance,
      sectionOrder: ['opening', 'opening'],
      hiddenSections: [],
    }

    expect(AppearanceConfigSchema.safeParse(invalid).success).toBe(false)
  })
})
