import { describe, expect, it } from 'vitest'

import {
  buildWhatsAppDirectUrl,
  generateCoupleSlug,
  normalizeIndonesianPhone,
} from './utils.js'

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*-\d{4}$/

const whatsAppText = (url: string): string => {
  const separator = '?text='
  const index = url.indexOf(separator)
  return decodeURIComponent(url.slice(index + separator.length))
}

describe('generateCoupleSlug', () => {
  it('produces a lowercase slug with a four digit suffix', () => {
    const slug = generateCoupleSlug('Resa', 'Bagas')

    expect(slug).toMatch(SLUG_PATTERN)
    expect(slug).toBe(slug.toLowerCase())
    expect(slug).not.toContain('--')
  })

  it('combines both names and strips diacritics', () => {
    expect(generateCoupleSlug('Résa', 'Bagás')).toMatch(/^resa-bagas-\d{4}$/)
  })

  it('works with a single name', () => {
    expect(generateCoupleSlug('Resa')).toMatch(/^resa-\d{4}$/)
  })

  it('truncates the base to fifty characters without a trailing hyphen', () => {
    const slug = generateCoupleSlug('a'.repeat(80))
    const base = slug.slice(0, slug.lastIndexOf('-'))

    expect(base).toHaveLength(50)
    expect(base).not.toMatch(/-$/)
    expect(slug.length).toBeLessThanOrEqual(55)
  })

  it('trims a hyphen exposed by truncation', () => {
    const slug = generateCoupleSlug('a'.repeat(49), 'b')
    const base = slug.slice(0, slug.lastIndexOf('-'))

    expect(base).toBe('a'.repeat(49))
    expect(base).not.toMatch(/-$/)
  })

  it('throws when neither name contains usable characters', () => {
    expect(() => generateCoupleSlug('   ', '!!!')).toThrow(
      'generateCoupleSlug: nama wajib diisi',
    )
  })
})

describe('normalizeIndonesianPhone', () => {
  it.each([
    '0812-3456-7890',
    '+62 812 3456 7890',
    '6281234567890',
    '81234567890',
  ])('normalizes %s to 6281234567890', (input) => {
    expect(normalizeIndonesianPhone(input)).toBe('6281234567890')
  })

  it('normalizes a shorter mobile number without inventing digits', () => {
    expect(normalizeIndonesianPhone('8123456789')).toBe('628123456789')
  })

  it.each(['12345', 'abc', '021555', '+15551234567'])(
    'rejects %s with null',
    (input) => {
      expect(normalizeIndonesianPhone(input)).toBeNull()
    },
  )
})

describe('buildWhatsAppDirectUrl', () => {
  const variables = {
    nama: 'Resa',
    link: 'https://undangan.test/resa',
    mempelai: 'Resa & Bagas',
    tanggal: '1 Desember 2026',
    sesi: 'Akad',
  }

  it('returns a wa.me URL with the normalized phone number', () => {
    const url = buildWhatsAppDirectUrl({
      phoneNumber: '0812-3456-7890',
      template: 'Halo {nama}',
      variables,
    })

    expect(url).toContain('https://wa.me/6281234567890?text=')
    expect(whatsAppText(url)).toBe('Halo Resa')
  })

  it('replaces every occurrence of every placeholder', () => {
    const url = buildWhatsAppDirectUrl({
      phoneNumber: '6281234567890',
      template: '{nama}|{link}|{mempelai}|{tanggal}|{sesi}|{nama}',
      variables,
    })

    expect(whatsAppText(url)).toBe(
      `${variables.nama}|${variables.link}|${variables.mempelai}|${variables.tanggal}|${variables.sesi}|${variables.nama}`,
    )
  })

  it('leaves unknown placeholders untouched', () => {
    const url = buildWhatsAppDirectUrl({
      phoneNumber: '6281234567890',
      template: 'Halo {nama}, {x}',
      variables,
    })

    expect(whatsAppText(url)).toBe('Halo Resa, {x}')
  })

  it('throws for an invalid phone number', () => {
    expect(() =>
      buildWhatsAppDirectUrl({
        phoneNumber: '12345',
        template: 'Halo {nama}',
        variables,
      }),
    ).toThrow('Nomor WhatsApp tidak valid')
  })
})
