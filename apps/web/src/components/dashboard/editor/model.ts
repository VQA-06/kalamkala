import type { AppearanceConfig, MasterInvitation } from '@kalamkala/contracts'
import { useForm } from '@tanstack/react-form'

export type EditorFormValues = {
  content: MasterInvitation
  appearance: AppearanceConfig
  whatsappTemplate: string
}

export const useEditorForm = (initial: EditorFormValues) =>
  useForm({ defaultValues: initial })

export type EditorForm = ReturnType<typeof useEditorForm>
