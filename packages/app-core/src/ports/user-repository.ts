import type { UserRole } from '@kalamkala/contracts'

export type StoredUser = {
  id: string
  name: string
  email: string
  role: UserRole
  whatsappNumber: string | null
}

/** Read-only user lookup for server components that need a profile view. */
export type UserRepository = {
  findById: (id: string) => Promise<StoredUser | null>
}
