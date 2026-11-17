export type StoragePutOptions = {
  contentType?: string
  cacheControl?: string
}

/**
 * Object storage for photos, music, and generated invitation assets.
 * Keys are opaque path-like strings chosen by the application.
 */
export type StoragePort = {
  put: (key: string, value: Uint8Array, options?: StoragePutOptions) => Promise<void>
  get: (key: string) => Promise<Uint8Array | null>
  delete: (key: string) => Promise<void>
  /** Absolute public URL for a key, safe to embed in HTML. */
  publicUrl: (key: string) => string
}
