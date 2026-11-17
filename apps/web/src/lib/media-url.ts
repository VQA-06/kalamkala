/**
 * Builds the public URL for an R2 object. Keys are encoded segment by segment
 * so spaces and Unicode survive without turning slashes into %2F.
 */
export const resolveMediaUrl = (cdnBaseUrl: string, key: string | null): string | null => {
  if (key === null || key.length === 0) return null
  const base = cdnBaseUrl.replace(/\/+$/u, '')
  if (base.length === 0) return null

  const path = key
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join('/')

  return path.length === 0 ? null : `${base}/${path}`
}
