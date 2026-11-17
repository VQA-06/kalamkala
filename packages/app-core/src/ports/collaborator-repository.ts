/**
 * Scoped access for co-hosts, planners, and family helpers.
 * `pinHash` is a hash chosen by the auth layer; the raw PIN never enters the row.
 */
export type StoredCollaborator = {
  id: string
  invitationId: string
  label: string
  accessToken: string
  pinHash: string | null
  permissionsJson: string
  expiresAt: Date | null
  createdAt: Date
}

export type CreateCollaboratorInput = {
  id: string
  invitationId: string
  label: string
  accessToken: string
  pinHash: string | null
  permissionsJson: string
  expiresAt: Date | null
}

export type CollaboratorRepository = {
  create: (input: CreateCollaboratorInput) => Promise<StoredCollaborator>
  listByInvitation: (invitationId: string) => Promise<StoredCollaborator[]>
  findById: (id: string) => Promise<StoredCollaborator | null>
  findByAccessToken: (accessToken: string) => Promise<StoredCollaborator | null>
  delete: (id: string) => Promise<void>
}
