import type {
  MediaStoragePort,
  PresignedUpload,
  PresignedUploadInput,
} from '@kalamkala/app-core'
import { AwsClient } from 'aws4fetch'

export type R2S3MediaAdapterOptions = {
  /** Cloudflare account id that owns the R2 bucket. */
  accountId: string
  bucketName: string
  /** R2 S3 API token credentials, not the Worker binding. */
  accessKeyId: string
  secretAccessKey: string
  /** Public bucket domain or custom CDN origin used for reads. */
  cdnBaseUrl: string
  /** Default signed-URL lifetime. Clamped to 60s..7 days. */
  uploadTtlSeconds?: number
}

const DEFAULT_UPLOAD_TTL_SECONDS = 900
const MIN_UPLOAD_TTL_SECONDS = 60
const MAX_UPLOAD_TTL_SECONDS = 604_800

const clampTtlSeconds = (ttlSeconds: number | undefined): number => {
  if (ttlSeconds === undefined || !Number.isFinite(ttlSeconds)) {
    return DEFAULT_UPLOAD_TTL_SECONDS
  }
  return Math.min(
    MAX_UPLOAD_TTL_SECONDS,
    Math.max(MIN_UPLOAD_TTL_SECONDS, Math.trunc(ttlSeconds)),
  )
}

/**
 * Object keys are path-like strings chosen by the application. Leading slashes
 * are noise, `..` segments could escape the bucket prefix, and an empty key has
 * no object to address.
 */
const normalizeObjectKey = (key: string): string => {
  const normalized = key.trim().replace(/^\/+/u, '')
  if (normalized.length === 0) {
    throw new Error('Object key must not be empty')
  }
  if (normalized.split('/').includes('..')) {
    throw new Error(`Object key must not contain a '..' segment: ${key}`)
  }
  return normalized
}

const encodeKeyPath = (key: string): string =>
  key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')

/**
 * Media goes straight from the browser to R2 through a presigned S3 PUT, so
 * uploads never pass through the Worker. Reads go through the public CDN
 * domain; deletes stay on the signed S3 endpoint.
 */
export class R2S3MediaAdapter implements MediaStoragePort {
  private readonly client: AwsClient
  private readonly accountId: string
  private readonly bucketName: string
  private readonly cdnBaseUrl: string
  private readonly uploadTtlSeconds: number

  constructor(options: R2S3MediaAdapterOptions) {
    if (options.accountId.trim().length === 0) {
      throw new Error('R2 account id must not be empty')
    }
    if (options.bucketName.trim().length === 0) {
      throw new Error('R2 bucket name must not be empty')
    }
    if (options.accessKeyId.trim().length === 0 || options.secretAccessKey.length === 0) {
      throw new Error('R2 S3 credentials must not be empty')
    }

    this.client = new AwsClient({
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
      service: 's3',
      region: 'auto',
    })
    this.accountId = options.accountId
    this.bucketName = options.bucketName
    this.cdnBaseUrl = options.cdnBaseUrl.replace(/\/+$/u, '')
    this.uploadTtlSeconds = clampTtlSeconds(options.uploadTtlSeconds)
  }

  async createPresignedUpload(input: PresignedUploadInput): Promise<PresignedUpload> {
    const objectKey = normalizeObjectKey(input.key)
    const ttlSeconds = clampTtlSeconds(input.expiresInSeconds ?? this.uploadTtlSeconds)

    const url = this.s3Url(objectKey)
    url.searchParams.set('X-Amz-Expires', String(ttlSeconds))

    // `aws4fetch` signs the browser's PUT; required headers are part of the
    // query signature so the uploader only needs the URL.
    const signed = await this.client.sign(
      new Request(url.toString(), {
        method: 'PUT',
        headers: { 'Content-Type': input.contentType },
      }),
      { aws: { signQuery: true } },
    )

    return {
      objectKey,
      uploadUrl: signed.url,
      publicUrl: this.resolveMediaUrl(objectKey),
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    }
  }

  resolveMediaUrl(key: string): string {
    const objectKey = normalizeObjectKey(key)
    return `${this.cdnBaseUrl}/${encodeKeyPath(objectKey)}`
  }

  async deleteObject(key: string): Promise<void> {
    const objectKey = normalizeObjectKey(key)
    const url = this.s3Url(objectKey)
    url.searchParams.set('X-Amz-Expires', String(clampTtlSeconds(undefined)))

    const signed = await this.client.sign(new Request(url.toString(), { method: 'DELETE' }), {
      aws: { signQuery: true },
    })

    const response = await fetch(signed)
    if (!response.ok) {
      throw new Error(
        `Failed to delete R2 object ${objectKey}: ${response.status} ${response.statusText}`,
      )
    }
  }

  private s3Url(objectKey: string): URL {
    return new URL(
      `https://${this.accountId}.r2.cloudflarestorage.com/${this.bucketName}/${encodeKeyPath(objectKey)}`,
    )
  }
}
