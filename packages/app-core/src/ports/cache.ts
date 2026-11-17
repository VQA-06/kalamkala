/**
 * Small string cache used for sessions, rate limits, and rendered fragments.
 * Values are strings on purpose: binary belongs in StoragePort.
 */
export type CachePort = {
  get: (key: string) => Promise<string | null>
  /** ttlSeconds is optional; implementations choose a default when omitted. */
  put: (key: string, value: string, ttlSeconds?: number) => Promise<void>
  delete: (key: string) => Promise<void>
}
