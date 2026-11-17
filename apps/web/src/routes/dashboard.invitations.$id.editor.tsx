import { Tabs } from '@base-ui/react/tabs'
import { SECTION_IDS } from '@kalamkala/contracts'
import type { AppearanceConfig, ThemeTokens } from '@kalamkala/contracts'
import type { TemplateFeature } from '@kalamkala/templates/sdk'
import { useStore } from '@tanstack/react-form'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import imageCompression from 'browser-image-compression'
import { useState } from 'react'

import { TemplateHost } from '../components/TemplateHost'
import { DashboardButton, PageHeading } from '../components/dashboard/ui'
import { useEditorForm } from '../components/dashboard/editor/model'
import {
  AppearancePanel,
  BasicPanel,
  ClosingPanel,
  EventsPanel,
  GiftsPanel,
  HostsPanel,
  MediaPanel,
  ModulesPanel,
} from '../components/dashboard/editor/panels'
import { useDebounced } from '../lib/use-debounced'
import {
  createPresignedUpload,
  getEditorPageData,
  publishInvitationChanges,
} from '../server/dashboard/editor'

export const Route = createFileRoute('/dashboard/invitations/$id/editor')({
  loader: async ({ params }) => {
    const data = await getEditorPageData({ data: { invitationId: params.id } })
    if (data === null) {
      throw redirect({ to: '/login', search: { redirect: '/dashboard' } })
    }
    return data
  },
  component: EditorPage,
})

const FALLBACK_TOKENS: ThemeTokens = {
  bgPrimary: '#faf8f5',
  bgSecondary: '#f2ece2',
  textPrimary: '#1c1917',
  textMuted: '#57534e',
  accent: '#9a7b56',
  accentContrast: '#ffffff',
  border: '#e6e1d6',
}

const MEDIA_FEATURES: readonly TemplateFeature[] = ['media', 'gallery', 'audio', 'video']
const MODULE_FEATURES: readonly TemplateFeature[] = [
  'loveStory',
  'liveStream',
  'socialKit',
  'travelInfo',
  'entourage',
  'coHosts',
  'additionalNotes',
  'qrCheckin',
]

type TabId =
  | 'dasar'
  | 'mempelai'
  | 'acara'
  | 'media'
  | 'hadiah'
  | 'modul'
  | 'penutup'
  | 'tampilan'

type StatusMessage = { tone: 'ok' | 'error'; text: string } | null

function EditorPage() {
  const data = Route.useLoaderData()
  const { invitation, manifest } = data
  const [tab, setTab] = useState<TabId>('dasar')
  const [publishing, setPublishing] = useState(false)
  const [publishMessage, setPublishMessage] = useState<StatusMessage>(null)
  const [uploadState, setUploadState] = useState<{
    tone: 'idle' | 'busy' | 'ok' | 'error'
    text: string
  }>({ tone: 'idle', text: '' })

  const initialAppearance: AppearanceConfig = invitation.appearance ?? {
    themeTokens: manifest.palettes[0]?.tokens ?? FALLBACK_TOKENS,
    fontPairingId: manifest.id,
    sectionOrder: [...SECTION_IDS],
    hiddenSections: [],
    sectionTitles: {},
  }

  const form = useEditorForm({
    content: invitation.content,
    appearance: initialAppearance,
    whatsappTemplate: invitation.whatsappTemplate ?? '',
  })

  const content = useStore(form.store, (state) => state.values.content)
  const appearance = useStore(form.store, (state) => state.values.appearance)
  const debouncedContent = useDebounced(content, 400)
  const debouncedAppearance = useDebounced(appearance, 400)

  const features = new Set(manifest.supportedFeatures)
  const hasMedia = MEDIA_FEATURES.some((feature) => features.has(feature))
  const hasModules = MODULE_FEATURES.some((feature) => features.has(feature))

  const tabs: ReadonlyArray<{ id: TabId; label: string }> = [
    { id: 'dasar', label: 'Dasar' },
    ...(features.has('hosts') ? [{ id: 'mempelai' as const, label: 'Mempelai' }] : []),
    ...(features.has('events') ? [{ id: 'acara' as const, label: 'Acara' }] : []),
    ...(hasMedia ? [{ id: 'media' as const, label: 'Media' }] : []),
    ...(features.has('gifts') ? [{ id: 'hadiah' as const, label: 'Hadiah' }] : []),
    ...(hasModules ? [{ id: 'modul' as const, label: 'Modul' }] : []),
    ...(features.has('closing') ? [{ id: 'penutup' as const, label: 'Penutup' }] : []),
    { id: 'tampilan', label: 'Tampilan' },
  ]

  const publish = async () => {
    if (publishing) return
    setPublishing(true)
    setPublishMessage(null)

    try {
      const values = form.state.values
      const result = await publishInvitationChanges({
        data: {
          invitationId: invitation.id,
          content: values.content,
          appearance: values.appearance,
          whatsappTemplate: values.whatsappTemplate,
        },
      })

      if (!result.ok) {
        setPublishMessage({ tone: 'error', text: result.error })
        return
      }

      setPublishMessage({
        tone: 'ok',
        text: result.refreshed
          ? 'Perubahan disimpan dan halaman publik diperbarui.'
          : 'Perubahan disimpan. Undangan masih draf.',
      })
    } catch {
      setPublishMessage({
        tone: 'error',
        text: 'Perubahan gagal disimpan. Silakan coba lagi.',
      })
    } finally {
      setPublishing(false)
    }
  }

  const uploadPhoto = async (file: File) => {
    setUploadState({ tone: 'busy', text: 'Mengompres foto…' })

    try {
      const compressed = await imageCompression(file, {
        maxWidthOrHeight: 1600,
        maxSizeMB: 0.6,
        fileType: 'image/webp',
        useWebWorker: true,
      })

      const presigned = await createPresignedUpload({
        data: {
          invitationId: invitation.id,
          filename: `${file.name.replace(/\.[^.]+$/u, '') || 'foto'}.webp`,
          contentType: 'image/webp',
        },
      })
      if (!presigned.ok) {
        setUploadState({ tone: 'error', text: presigned.error })
        return
      }

      const response = await fetch(presigned.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/webp' },
        body: compressed,
      })
      if (!response.ok) {
        setUploadState({
          tone: 'error',
          text: `Unggah gagal (HTTP ${response.status}).`,
        })
        return
      }

      const gallery = form.state.values.content.media.gallery
      form.setFieldValue('content.media.gallery', [
        ...gallery,
        { key: presigned.key, orientation: 'LANDSCAPE', caption: null },
      ])
      setUploadState({ tone: 'ok', text: `Foto tersimpan: ${presigned.key}` })
    } catch {
      setUploadState({
        tone: 'error',
        text: 'Foto gagal diunggah. Periksa koneksi lalu coba lagi.',
      })
    }
  }

  const renderPanel = (id: TabId) => {
    switch (id) {
      case 'dasar':
        return <BasicPanel form={form} />
      case 'mempelai':
        return <HostsPanel form={form} />
      case 'acara':
        return <EventsPanel form={form} />
      case 'media':
        return <MediaPanel form={form} uploadState={uploadState} onUpload={uploadPhoto} />
      case 'hadiah':
        return <GiftsPanel form={form} />
      case 'modul':
        return <ModulesPanel form={form} manifest={manifest} />
      case 'penutup':
        return <ClosingPanel form={form} />
      case 'tampilan':
        return <AppearancePanel form={form} manifest={manifest} />
    }
  }

  return (
    <div>
      <PageHeading
        eyebrow="Editor"
        title={manifest.name}
        description={`Slug publik /u/${invitation.slug} · ${invitation.status === 'DRAFT' ? 'Draf' : invitation.status === 'ACTIVE' ? 'Aktif' : 'Kedaluwarsa'}`}
        actions={
          <>
            {invitation.status === 'DRAFT' ? (
              <Link
                to="/dashboard/invitations/$id/checkout"
                params={{ id: invitation.id }}
                className="border border-line px-4 py-2 text-sm font-semibold text-ink"
              >
                Aktifkan lewat checkout
              </Link>
            ) : (
              <Link
                to="/u/$slug"
                params={{ slug: invitation.slug }}
                search={{ to: undefined, g: undefined }}
                target="_blank"
                rel="noreferrer"
                className="border border-line px-4 py-2 text-sm font-semibold text-ink"
              >
                Lihat publik
              </Link>
            )}
            <DashboardButton
              type="button"
              variant="primary"
              disabled={publishing}
              onClick={() => void publish()}
            >
              {publishing ? 'Menyimpan…' : 'Publikasikan Perubahan'}
            </DashboardButton>
          </>
        }
      />

      {publishMessage === null ? null : (
        <p
          role={publishMessage.tone === 'error' ? 'alert' : 'status'}
          className={
            publishMessage.tone === 'error'
              ? 'mt-4 border border-[#9f3030]/40 px-4 py-3 text-sm text-[#9f3030]'
              : 'mt-4 border border-champagne/60 px-4 py-3 text-sm text-champagne'
          }
        >
          {publishMessage.text}
        </p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="min-w-0 border border-line bg-paper">
          <Tabs.Root value={tab} onValueChange={(value) => setTab(value as TabId)}>
            <Tabs.List className="flex flex-wrap gap-px border-b border-line bg-line">
              {tabs.map((item) => (
                <Tabs.Tab
                  key={item.id}
                  value={item.id}
                  className="cursor-pointer bg-paper px-3 py-2 text-sm text-ink/60 aria-selected:bg-ink aria-selected:text-paper"
                >
                  {item.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>

            <div className="max-h-[calc(100vh-14rem)] overflow-y-auto px-5 py-5">
              {tabs.map((item) => (
                <Tabs.Panel key={item.id} value={item.id}>
                  {item.id === tab ? renderPanel(item.id) : null}
                </Tabs.Panel>
              ))}
            </div>
          </Tabs.Root>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <div className="border border-line bg-paper p-3">
            <p className="text-[0.69rem] font-semibold uppercase tracking-[0.14em] text-champagne">
              Pratinjau langsung
            </p>
            <div className="mt-2 max-h-[calc(100vh-10rem)] overflow-y-auto">
              <TemplateHost
                editorPreview={{
                  templateId: invitation.templateId,
                  content: debouncedContent,
                  appearance: debouncedAppearance,
                  guest: null,
                }}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
