/**
 * Visual configuration for a published invitation: colours, fonts, and section
 * order. Kept separate from the master content so a theme change does not touch
 * the invitation document.
 */

import { z } from 'zod'

import { sectionIdSchema } from './schemas.js'

const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, { message: 'Warna harus format #RRGGBB' })

export const ThemeTokensSchema = z.object({
  bgPrimary: hexColorSchema,
  bgSecondary: hexColorSchema,
  textPrimary: hexColorSchema,
  textMuted: hexColorSchema,
  accent: hexColorSchema,
  accentContrast: hexColorSchema,
  border: hexColorSchema,
})

const sectionOrderSchema = z
  .array(sectionIdSchema)
  .min(1)
  .refine((order) => new Set(order).size === order.length, {
    message: 'sectionOrder tidak boleh berisi duplikat',
  })

export const AppearanceConfigSchema = z
  .object({
    themeTokens: ThemeTokensSchema,
    fontPairingId: z.string().min(1),
    sectionOrder: sectionOrderSchema,
    hiddenSections: z.array(sectionIdSchema),
    sectionTitles: z.partialRecord(sectionIdSchema, z.string().min(1)),
  })
  .refine(
    (config) =>
      config.hiddenSections.every((sectionId) =>
        config.sectionOrder.includes(sectionId),
      ),
    {
      message: 'hiddenSections harus merupakan bagian dari sectionOrder',
      path: ['hiddenSections'],
    },
  )

export type ThemeTokens = z.infer<typeof ThemeTokensSchema>
export type AppearanceConfig = z.infer<typeof AppearanceConfigSchema>
