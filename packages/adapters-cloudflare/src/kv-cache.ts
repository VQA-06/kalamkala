import type { CachePort } from '@kalamkala/app-core'

export type KvCacheOptions = {
  /** Prepended to every key, usually the deployment environment name. */
  keyPrefix?: string
}

export class KvCacheAdapter implements CachePort {
  private readonly kv: KVNamespace
  private readonly keyPrefix: string

  constructor(kv: KVNamespace, options: KvCacheOptions = {}) {
    this.kv = kv
    this.keyPrefix = options.keyPrefix ?? ''
  }

  async get(key: string): Promise<string | null> {
    return (await this.kv.get(this.buildKey(key))) ?? null
  }

  async put(key: string, value: string, ttlSeconds?: number): Promise<void> {
    // KV rejects a zero or negative expirationTtl, so only forward real TTLs.
    if (ttlSeconds !== undefined && ttlSeconds > 0) {
      await this.kv.put(this.buildKey(key), value, { expirationTtl: ttlSeconds })
      return
    }
    await this.kv.put(this.buildKey(key), value)
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(this.buildKey(key))
  }

  private buildKey(key: string): string {
    return `${this.keyPrefix}${key}`
  }
}
