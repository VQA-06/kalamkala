import { afterEach, describe, expect, it, vi } from 'vitest'

import { R2S3MediaAdapter, type R2S3MediaAdapterOptions } from './r2-s3-media.js'

const BASE_OPTIONS: R2S3MediaAdapterOptions = {
  accountId: 'acct123',
  bucketName: 'kalamkala-media',
  accessKeyId: 'AKIATESTEXAMPLE',
  secretAccessKey: 'simulated-secret',
  cdnBaseUrl: 'https://cdn.example.com/',
}

const createAdapter = (overrides: Partial<R2S3MediaAdapterOptions> = {}): R2S3MediaAdapter =>
  new R2S3MediaAdapter({ ...BASE_OPTIONS, ...overrides })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('R2S3MediaAdapter.createPresignedUpload', () => {
  it('signs a PUT URL against the R2 S3 endpoint', async () => {
    const upload = await createAdapter().createPresignedUpload({
      key: '/invitations/abc/foto 1.jpg',
      contentType: 'image/jpeg',
    })
    const url = new URL(upload.uploadUrl)

    expect(url.protocol).toBe('https:')
    expect(url.host).toBe('acct123.r2.cloudflarestorage.com')
    expect(url.pathname).toBe('/kalamkala-media/invitations/abc/foto%201.jpg')
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900')
    expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256')
    expect(url.searchParams.get('X-Amz-Credential')).toContain('AKIATESTEXAMPLE/')
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/)
    expect(upload.objectKey).toBe('invitations/abc/foto 1.jpg')
    expect(upload.publicUrl).toBe('https://cdn.example.com/invitations/abc/foto%201.jpg')
    expect(upload.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('defaults to a 900 second expiry', async () => {
    const upload = await createAdapter().createPresignedUpload({
      key: 'media/foto.jpg',
      contentType: 'image/jpeg',
    })
    expect(new URL(upload.uploadUrl).searchParams.get('X-Amz-Expires')).toBe('900')
  })

  it('clamps the requested expiry to 60..604800 seconds', async () => {
    const adapter = createAdapter()

    const tooShort = await adapter.createPresignedUpload({
      key: 'media/foto.jpg',
      contentType: 'image/jpeg',
      expiresInSeconds: 5,
    })
    expect(new URL(tooShort.uploadUrl).searchParams.get('X-Amz-Expires')).toBe('60')

    const tooLong = await adapter.createPresignedUpload({
      key: 'media/foto.jpg',
      contentType: 'image/jpeg',
      expiresInSeconds: 9_999_999,
    })
    expect(new URL(tooLong.uploadUrl).searchParams.get('X-Amz-Expires')).toBe('604800')
  })

  it('honours the adapter default TTL', async () => {
    const upload = await createAdapter({ uploadTtlSeconds: 1800 }).createPresignedUpload({
      key: 'media/foto.jpg',
      contentType: 'image/jpeg',
    })
    expect(new URL(upload.uploadUrl).searchParams.get('X-Amz-Expires')).toBe('1800')
  })
})

describe('R2S3MediaAdapter.resolveMediaUrl', () => {
  it('joins the CDN base and encodes each path segment', () => {
    const adapter = createAdapter()

    expect(adapter.resolveMediaUrl('/media/foto 1.jpg')).toBe(
      'https://cdn.example.com/media/foto%201.jpg',
    )
    expect(adapter.resolveMediaUrl('galeri/putri&budi.png')).toBe(
      'https://cdn.example.com/galeri/putri%26budi.png',
    )
    expect(createAdapter({ cdnBaseUrl: 'https://cdn.example.com///' }).resolveMediaUrl('a.jpg')).toBe(
      'https://cdn.example.com/a.jpg',
    )
  })

  it('rejects empty, dot-dot, and blank keys', () => {
    const adapter = createAdapter()

    expect(() => adapter.resolveMediaUrl('')).toThrow(/must not be empty/)
    expect(() => adapter.resolveMediaUrl('   ')).toThrow(/must not be empty/)
    expect(() => adapter.resolveMediaUrl('/')).toThrow(/must not be empty/)
    expect(() => adapter.resolveMediaUrl('media/../secret.jpg')).toThrow(/\.\./)
    expect(() => adapter.resolveMediaUrl('..')).toThrow(/\.\./)
  })
})

describe('R2S3MediaAdapter.deleteObject', () => {
  it('sends a signed DELETE and resolves on success', async () => {
    const fetchMock = vi.fn(async (_input: Request) => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await createAdapter().deleteObject('media/foto.jpg')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const request = fetchMock.mock.calls[0]?.[0]
    if (request === undefined) throw new Error('expected a fetch call')
    const url = new URL(request.url)

    expect(request.method).toBe('DELETE')
    expect(url.host).toBe('acct123.r2.cloudflarestorage.com')
    expect(url.pathname).toBe('/kalamkala-media/media/foto.jpg')
    expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256')
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('throws when R2 rejects the delete', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async (_input: Request) =>
          new Response('denied', { status: 403, statusText: 'Forbidden' }),
      ),
    )

    await expect(createAdapter().deleteObject('media/foto.jpg')).rejects.toThrow(
      /Failed to delete R2 object media\/foto\.jpg: 403 Forbidden/,
    )
  })
})
