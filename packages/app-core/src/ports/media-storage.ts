export type PresignedUpload = {
  objectKey: string
  /** Short-lived URL the browser PUTs the file to. */
  uploadUrl: string
  publicUrl: string
  expiresAt: Date
}

export type PresignedUploadInput = {
  key: string
  contentType: string
  expiresInSeconds?: number
}

/**
 * Media goes straight from the browser to object storage, so the core only
 * asks for signed uploads and resolves public URLs; no bytes cross this port.
 */
export type MediaStoragePort = {
  createPresignedUpload: (input: PresignedUploadInput) => Promise<PresignedUpload>
  resolveMediaUrl: (key: string) => string
  deleteObject: (key: string) => Promise<void>
}
