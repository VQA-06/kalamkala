/**
 * Pure helpers shared by the API and the rendering layer. No I/O, no database
 * access: these functions only reshape strings.
 */

/**
 * Web Crypto is available in Node and Cloudflare Workers, but this package
 * compiles against the ES2022 lib only. Declare just the method used here.
 */
declare const crypto: {
  getRandomValues: (array: Uint32Array) => Uint32Array
}

const MAX_SLUG_BASE_LENGTH = 50
const RANDOM_SUFFIX_RANGE = 10_000

const toSlugPart = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const randomFourDigitSuffix = (): string => {
  const [randomValue] = crypto.getRandomValues(new Uint32Array(1))
  return String((randomValue ?? 0) % RANDOM_SUFFIX_RANGE).padStart(4, '0')
}

/**
 * Builds a public invitation slug such as `resa-bagas-0427`.
 * Randomness is appended by the caller's runtime (Web Crypto), so the result is
 * not deterministic and should be checked for uniqueness before insertion.
 */
export const generateCoupleSlug = (
  primaryName: string,
  secondaryName?: string,
): string => {
  const base = [primaryName, secondaryName ?? '']
    .map(toSlugPart)
    .filter((part) => part.length > 0)
    .join('-')

  if (base.length === 0) {
    throw new Error('generateCoupleSlug: nama wajib diisi')
  }

  const truncatedBase = base
    .slice(0, MAX_SLUG_BASE_LENGTH)
    .replace(/-+$/g, '')

  return `${truncatedBase}-${randomFourDigitSuffix()}`
}

/**
 * Normalizes Indonesian mobile numbers to the `628...` form expected by
 * WhatsApp. Returns null for anything that is not a plausible Indonesian
 * mobile number, including landlines.
 */
export const normalizeIndonesianPhone = (input: string): string | null => {
  const compact = input.replace(/[\s().-]/g, '')

  let digits: string
  if (compact.startsWith('+62')) {
    digits = compact.slice(1)
  } else if (compact.startsWith('62')) {
    digits = compact
  } else if (compact.startsWith('0')) {
    digits = `62${compact.slice(1)}`
  } else if (compact.startsWith('8')) {
    digits = `62${compact}`
  } else {
    return null
  }

  return /^628\d{7,11}$/.test(digits) ? digits : null
}

/**
 * Builds a click-to-chat URL. Unknown placeholders are left untouched so a
 * future template variable does not silently disappear.
 */
export const buildWhatsAppDirectUrl = (input: {
  phoneNumber: string
  template: string
  variables: Record<
    'nama' | 'link' | 'mempelai' | 'tanggal' | 'sesi',
    string
  >
}): string => {
  const phoneNumber = normalizeIndonesianPhone(input.phoneNumber)
  if (phoneNumber === null) {
    throw new Error('Nomor WhatsApp tidak valid')
  }

  const text = input.template
    .replaceAll('{nama}', input.variables.nama)
    .replaceAll('{link}', input.variables.link)
    .replaceAll('{mempelai}', input.variables.mempelai)
    .replaceAll('{tanggal}', input.variables.tanggal)
    .replaceAll('{sesi}', input.variables.sesi)

  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(text)}`
}
