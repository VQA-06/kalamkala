/**
 * Only same-site absolute paths may be used as post-sign-in destinations.
 * Anything else falls back to the dashboard so `?redirect=` cannot be turned
 * into an open redirect.
 */
const DEFAULT_AUTH_DESTINATION = '/dashboard'

export const safeRedirectPath = (target: string | null | undefined): string => {
  if (target === null || target === undefined) return DEFAULT_AUTH_DESTINATION

  const value = target.trim()
  if (value.length === 0) return DEFAULT_AUTH_DESTINATION
  if (!value.startsWith('/')) return DEFAULT_AUTH_DESTINATION
  if (value.startsWith('//')) return DEFAULT_AUTH_DESTINATION
  if (value === '/login' || value.startsWith('/login?')) return DEFAULT_AUTH_DESTINATION

  return value
}
