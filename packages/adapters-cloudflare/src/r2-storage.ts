import type { StoragePort, StoragePutOptions } from '@kalamkala/app-core'

export type R2StorageOptions = {
  /** Public bucket or custom CDN origin, without a trailing slash requirement. */
  cdnBaseUrl: string
}

export class R2StorageAdapter implements StoragePort {
  private readonly bucket: R2Bucket
  private readonly cdnBaseUrl: string

  constructor(bucket: R2Bucket, options: R2StorageOptions) {
    this.bucket = bucket
    this.cdnBaseUrl = options.cdnBaseUrl.replace(/\/+$/u, '')
  }

  async put(key: string, value: Uint8Array, options?: StoragePutOptions): Promise<void> {
    await this.bucket.put(key, value, {
      httpMetadata: {
        ...(options?.contentType === undefined ? {} : { contentType: options.contentType }),
        ...(options?.cacheControl === undefined ? {} : { cacheControl: options.cacheControl }),
      },
    })
  }

  async get(key: string): Promise<Uint8Array | null> {
    const object = await this.bucket.get(key)
    if (object === null) return null
    return new Uint8Array(await object.arrayBuffer())
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key)
  }

  publicUrl(key: string): string {
    const encodedPath = key
      .split('/')
      .filter((segment) => segment.length > 0)
      .map((segment) => encodeURIComponent(segment))
      .join('/')
    return encodedPath.length === 0 ? this.cdnBaseUrl : `${this.cdnBaseUrl}/${encodedPath}`
  }
}
