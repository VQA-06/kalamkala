import { describe, expect, it } from 'vitest'

import {
  MasterInvitationSchema,
  SECTION_IDS,
  ThemeTokensSchema,
  type MasterInvitation,
  type ThemeTokens,
} from '@kalamkala/contracts'

import { templateRegistry } from './registry.js'
import { createTemplateContext } from './sdk/index.js'
import reactStarterPreview from './_starters/react/preview.json'
import vanillaStarterPreview from './_starters/vanilla/preview.json'

type RegistryEntry = (typeof templateRegistry)[number]

const formatIssues = (issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>): string =>
  issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ')

const firstPalette = (entry: RegistryEntry) => {
  const palette = entry.palettes[0]
  expect(palette, `${entry.manifest.id} harus punya minimal satu palette`).toBeDefined()
  if (!palette) throw new Error(`${entry.manifest.id} tidak punya palette`)
  return palette
}

const loadValidPreview = async (entry: RegistryEntry): Promise<MasterInvitation> => {
  const preview = await entry.loadPreview()
  const result = MasterInvitationSchema.safeParse(preview)

  expect(
    result.success,
    `${entry.manifest.id} preview.json tidak valid: ${
      result.success ? '' : formatIssues(result.error.issues)
    }`,
  ).toBe(true)

  if (!result.success) {
    throw new Error(`Invalid preview for ${entry.manifest.id}`)
  }

  return result.data
}

const buildContext = (data: MasterInvitation, themeTokens: ThemeTokens) =>
  createTemplateContext({
    data,
    appearance: {
      themeTokens,
      fontPairingId: 'contract-test',
      sectionOrder: [...SECTION_IDS],
      hiddenSections: [],
      sectionTitles: {},
    },
    guest: {
      id: 'g1',
      name: 'Tamu Uji',
      category: 'REGULER',
      maxPax: 2,
      tableNumber: 'A1',
      sessionLabel: 'Akad',
      qrToken: 'qr-test',
    },
    wishes: [
      {
        id: 'w1',
        guestName: 'Tamu Uji',
        message: 'Selamat!',
        createdAt: '2027-01-01T00:00:00.000Z',
        hostReply: null,
      },
    ],
    rsvpSummary: { hadir: 12, tidakHadir: 2, ragu: 1 },
    actions: {
      submitRsvp: async () => ({ ok: true }),
      openInvitation: () => {},
    },
  })

describe('template registry contract', () => {
  it('registers at least one template', () => {
    expect(templateRegistry.length).toBeGreaterThan(0)
  })

  it('gives every entry a stable id and at least three valid palettes', () => {
    const ids = new Set<string>()

    for (const entry of templateRegistry) {
      const { id } = entry.manifest

      expect(id, 'manifest.id harus berupa slug folder').toMatch(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      )
      expect(ids.has(id), `manifest.id duplikat: ${id}`).toBe(false)
      ids.add(id)

      expect(
        entry.palettes.length,
        `${id} harus punya minimal tiga palette`,
      ).toBeGreaterThanOrEqual(3)

      for (const [index, palette] of entry.palettes.entries()) {
        const result = ThemeTokensSchema.safeParse(palette.tokens)
        expect(
          result.success,
          `${id} palette ke-${index} tidak valid: ${
            result.success ? '' : formatIssues(result.error.issues)
          }`,
        ).toBe(true)
      }
    }
  })
})

for (const entry of templateRegistry) {
  describe(`${entry.manifest.id} mount contract`, () => {
    it('parses the preview, mounts theme variables and cleans up twice', async () => {
      const data = await loadValidPreview(entry)
      const palette = firstPalette(entry)
      const tokens = ThemeTokensSchema.parse(palette.tokens)
      const ctx = buildContext(data, tokens)

      const container = document.createElement('div')
      document.body.append(container)
      const beforeOverflow = document.body.style.overflow

      try {
        const mod = await entry.load()

        expect(mod.manifest.id).toBe(entry.manifest.id)
        expect(typeof mod.mount).toBe('function')

        const cleanup = mod.mount(container, ctx)
        expect(typeof cleanup).toBe('function')
        expect(container.style.getPropertyValue('--tpl-accent')).toBe(tokens.accent)
        expect(document.body.style.overflow).toBe('hidden')

        cleanup()
        expect(container.childElementCount).toBe(0)
        expect(document.body.style.overflow).toBe(beforeOverflow)
        expect(() => cleanup()).not.toThrow()

        const customCtx = buildContext(data, { ...tokens, accent: '#123456' })
        const customCleanup = mod.mount(container, customCtx)

        expect(container.style.getPropertyValue('--tpl-accent')).toBe('#123456')

        customCleanup()
        expect(container.childElementCount).toBe(0)
        expect(document.body.style.overflow).toBe(beforeOverflow)
        expect(() => customCleanup()).not.toThrow()
      } finally {
        container.remove()
        document.body.style.overflow = beforeOverflow
      }
    })
  })
}

describe('template media contract', () => {
  it('mounts without network access or audio playback support', async () => {
    const entry = templateRegistry[0]
    expect(entry, 'registry harus punya minimal satu template').toBeDefined()
    if (!entry) throw new Error('templateRegistry kosong')

    const data = await loadValidPreview(entry)
    const tokens = ThemeTokensSchema.parse(firstPalette(entry).tokens)
    const ctx = buildContext(data, tokens)

    const container = document.createElement('div')
    document.body.append(container)
    const beforeOverflow = document.body.style.overflow
    let cleanup: (() => void) | undefined

    try {
      const mod = await entry.load()
      cleanup = mod.mount(container, ctx)

      expect(container.childElementCount).toBeGreaterThan(0)
    } finally {
      cleanup?.()
      container.remove()
      document.body.style.overflow = beforeOverflow
    }
  })
})

describe('starter preview contract', () => {
  it('validates every starter preview against the master schema', () => {
    const starters = [
      ['react', reactStarterPreview],
      ['vanilla', vanillaStarterPreview],
    ] as const

    for (const [name, preview] of starters) {
      const result = MasterInvitationSchema.safeParse(preview)

      expect(
        result.success,
        `${name} starter preview.json tidak valid: ${
          result.success ? '' : formatIssues(result.error.issues)
        }`,
      ).toBe(true)
    }
  })
})
