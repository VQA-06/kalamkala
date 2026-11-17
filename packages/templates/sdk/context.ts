import type { AppearanceConfig, Locale, MasterInvitation } from '@kalamkala/contracts'

import { DEFAULT_TRANSLATIONS } from './translations.js'
import type {
  GuestContext,
  PublicWish,
  RsvpSubmitResult,
  RsvpSummary,
  TemplateActions,
  TemplateContext,
  TemplateCopyKey,
  TemplateRuntimeState,
  TemplateTranslations,
  TemplateUtils,
} from './types.js'

export type CreateTemplateContextInput = {
  data: MasterInvitation
  appearance: AppearanceConfig
  guest?: GuestContext | null
  wishes?: readonly PublicWish[]
  rsvpSummary?: RsvpSummary | null
  translations?: TemplateTranslations
  actions?: Partial<TemplateActions>
  utils?: Partial<TemplateUtils>
  state?: Partial<TemplateRuntimeState>
  /** Reserved for deterministic previews; templates read time through `utils`. */
  now?: Date
}

const TIME_ZONES = {
  WIB: 'Asia/Jakarta',
  WITA: 'Asia/Makassar',
  WIT: 'Asia/Jayapura',
} as const

const intlLocale = (locale: Locale): string => (locale === 'en' ? 'en-GB' : 'id-ID')

const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Builds the single object a theme receives. Everything the theme can reach is
 * injected here: there is no global store, no fetch, and no framework coupling.
 */
export const createTemplateContext = (
  input: CreateTemplateContextInput,
): TemplateContext => {
  const { data, appearance } = input
  const translations = input.translations ?? DEFAULT_TRANSLATIONS

  const state: TemplateRuntimeState = {
    isPreview: input.state?.isPreview ?? false,
    isOpened: input.state?.isOpened ?? false,
    locale: input.state?.locale ?? data.settings.locale,
    reducedMotion: input.state?.reducedMotion ?? prefersReducedMotion(),
  }

  const translate = (
    key: TemplateCopyKey,
    vars?: Readonly<Record<string, string | number>>,
  ): string => {
    const dictionary = translations[state.locale] ?? translations.id
    const template = dictionary[key] ?? key
    if (vars === undefined) return template

    return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
      const value = vars[name]
      return value === undefined ? placeholder : String(value)
    })
  }

  const actions: TemplateActions = {
    submitRsvp:
      input.actions?.submitRsvp ??
      (async (): Promise<RsvpSubmitResult> => ({
        ok: false,
        error: 'HOST_ACTION_MISSING',
      })),
    openInvitation: input.actions?.openInvitation ?? (() => {}),
  }

  const utils: TemplateUtils = {
    resolveMediaUrl:
      input.utils?.resolveMediaUrl ??
      ((key) => (key === null || key.length === 0 ? null : `/media/${key}`)),
    formatDate:
      input.utils?.formatDate ??
      ((iso, timezone) => {
        const timestamp = Date.parse(iso)
        if (Number.isNaN(timestamp)) return iso

        return new Intl.DateTimeFormat(intlLocale(state.locale), {
          dateStyle: 'long',
          timeZone: TIME_ZONES[timezone],
        }).format(timestamp)
      }),
    formatCurrency:
      input.utils?.formatCurrency ??
      ((amount) =>
        new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          maximumFractionDigits: 0,
        }).format(amount)),
  }

  return {
    data,
    appearance,
    guest: input.guest ?? null,
    t: translate,
    state,
    actions,
    utils,
    wishes: input.wishes ?? [],
    rsvpSummary: input.rsvpSummary ?? null,
  }
}
