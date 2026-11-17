import { describe, expect, it } from 'vitest'

import type { KVNamespace } from '@cloudflare/workers-types'

import { KvCacheAdapter } from './kv-cache.js'

type PutCall = { key: string; value: string; expirationTtl: number | undefined }

const createFakeKv = (): {
  kv: KVNamespace
  store: Map<string, string>
  puts: PutCall[]
} => {
  const store = new Map<string, string>()
  const puts: PutCall[] = []
  const fake = {
    get: async (key: string): Promise<string | null> => store.get(key) ?? null,
    put: async (key: string, value: string, options?: { expirationTtl?: number }): Promise<void> => {
      store.set(key, value)
      puts.push({ key, value, expirationTtl: options?.expirationTtl })
    },
    delete: async (key: string): Promise<void> => {
      store.delete(key)
    },
  }
  return { kv: fake as unknown as KVNamespace, store, puts }
}

describe('KvCacheAdapter', () => {
  it('stores, reads, and deletes values under the configured prefix', async () => {
    const { kv, store } = createFakeKv()
    const cache = new KvCacheAdapter(kv, { keyPrefix: 'undangan:' })

    await cache.put('session:1', 'value')
    expect(store.get('undangan:session:1')).toBe('value')
    expect(await cache.get('session:1')).toBe('value')

    await cache.delete('session:1')
    expect(await cache.get('session:1')).toBeNull()
  })

  it('returns null for a missing key', async () => {
    const { kv } = createFakeKv()

    expect(await new KvCacheAdapter(kv).get('missing')).toBeNull()
  })

  it('forwards a positive TTL to KV', async () => {
    const { kv, puts } = createFakeKv()

    await new KvCacheAdapter(kv).put('key', 'value', 60)

    expect(puts).toEqual([{ key: 'key', value: 'value', expirationTtl: 60 }])
  })

  it('omits expirationTtl for zero, negative, or missing TTLs', async () => {
    const { kv, puts } = createFakeKv()
    const cache = new KvCacheAdapter(kv)

    await cache.put('zero', 'value', 0)
    await cache.put('negative', 'value', -5)
    await cache.put('missing', 'value')

    expect(puts.map((call) => call.expirationTtl)).toEqual([undefined, undefined, undefined])
  })
})
