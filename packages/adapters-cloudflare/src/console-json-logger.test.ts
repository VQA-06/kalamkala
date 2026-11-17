import { describe, expect, it } from 'vitest'

import { ConsoleJsonLogger, requestIdFromHeaders } from './console-json-logger.js'

const parseLine = (line: string | undefined): Record<string, unknown> => {
  if (line === undefined) throw new Error('expected a captured log line')
  return JSON.parse(line) as Record<string, unknown>
}

describe('ConsoleJsonLogger', () => {
  it('writes one JSON line with canonical keys last', () => {
    const lines: string[] = []
    const logger = new ConsoleJsonLogger({
      service: 'kalamkala-web',
      sink: (line) => lines.push(line),
    })

    logger.info('invitation published', { slug: 'resa-bagas-0427', level: 'debug' })

    expect(lines).toHaveLength(1)
    const entry = parseLine(lines[0])
    expect(entry.level).toBe('info')
    expect(entry.message).toBe('invitation published')
    expect(entry.slug).toBe('resa-bagas-0427')
    expect(entry.service).toBe('kalamkala-web')
    expect(entry.requestId).toBeUndefined()
    expect(typeof entry.time).toBe('string')
    expect(Number.isNaN(Date.parse(entry.time as string))).toBe(false)
  })

  it('flattens Error values instead of dropping them', () => {
    const lines: string[] = []
    const logger = new ConsoleJsonLogger({ sink: (line) => lines.push(line) })

    logger.error('payment callback failed', { err: new Error('boom') })

    const entry = parseLine(lines[0])
    const err = entry.err as Record<string, unknown>
    expect(err.name).toBe('Error')
    expect(err.message).toBe('boom')
    expect(entry.service).toBeUndefined()
  })

  it('adds requestId to a scoped logger without mutating the parent', () => {
    const lines: string[] = []
    const logger = new ConsoleJsonLogger({ sink: (line) => lines.push(line) })

    logger.withRequestId('req-123').warn('scoped entry')
    logger.info('parent entry')

    expect(parseLine(lines[0]).requestId).toBe('req-123')
    expect(parseLine(lines[0]).level).toBe('warn')
    expect(parseLine(lines[1]).requestId).toBeUndefined()
    expect(parseLine(lines[1]).level).toBe('info')
  })
})

describe('requestIdFromHeaders', () => {
  it('reads x-request-id case-insensitively and trims it', () => {
    expect(requestIdFromHeaders({ 'X-Request-Id': '  abc-123  ' })).toBe('abc-123')
    expect(requestIdFromHeaders({ 'X-REQUEST-ID': 'zzz' })).toBe('zzz')
  })

  it('falls back when the header is missing or blank', () => {
    expect(requestIdFromHeaders({ 'x-request-id': '   ' }, () => 'fallback')).toBe('fallback')
    expect(requestIdFromHeaders({}, () => 'fallback')).toBe('fallback')
  })

  it('generates a UUID when no header or fallback exists', () => {
    expect(requestIdFromHeaders({})).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })
})
