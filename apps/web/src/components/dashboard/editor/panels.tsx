import { LOCALES, SECTION_IDS } from '@kalamkala/contracts'
import type {
  EventTimezone,
  Locale,
  MediaOrientation,
} from '@kalamkala/contracts'
import type { TemplateManifest } from '@kalamkala/templates/sdk'

import type { EditorForm } from './model'
import {
  CheckboxField,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from './fields'

const localeOptions = LOCALES.map((locale) => ({ value: locale, label: locale.toUpperCase() }))

const timezoneOptions: ReadonlyArray<{ value: EventTimezone; label: string }> = [
  { value: 'WIB', label: 'WIB' },
  { value: 'WITA', label: 'WITA' },
  { value: 'WIT', label: 'WIT' },
]

const orientationOptions: ReadonlyArray<{ value: MediaOrientation; label: string }> = [
  { value: 'PORTRAIT', label: 'Potret' },
  { value: 'LANDSCAPE', label: 'Lanskap' },
  { value: 'SQUARE', label: 'Persegi' },
]

const nullable = (value: string): string | null => (value.trim().length === 0 ? null : value)

export function BasicPanel({ form }: { form: EditorForm }) {
  return (
    <div className="grid gap-5">
      <form.Field name="content.seoMeta.title">
        {(field) => (
          <TextField
            label="Judul halaman"
            value={field.state.value}
            onChange={(value) => field.handleChange(value)}
            hint="Maksimal 70 karakter, dipakai untuk judul tab dan pratinjau tautan."
          />
        )}
      </form.Field>

      <form.Field name="content.seoMeta.description">
        {(field) => (
          <TextAreaField
            label="Deskripsi"
            rows={3}
            value={field.state.value}
            onChange={(value) => field.handleChange(value)}
            hint="Maksimal 160 karakter."
          />
        )}
      </form.Field>

      <form.Field name="content.opening.headline">
        {(field) => (
          <TextField
            label="Judul pembuka"
            value={field.state.value}
            onChange={(value) => field.handleChange(value)}
          />
        )}
      </form.Field>

      <form.Field name="content.opening.subheadline">
        {(field) => (
          <TextField
            label="Subjudul"
            value={field.state.value ?? ''}
            onChange={(value) => field.handleChange(nullable(value))}
          />
        )}
      </form.Field>

      <form.Field name="content.opening.quote">
        {(field) => (
          <TextAreaField
            label="Kutipan"
            rows={3}
            value={field.state.value ?? ''}
            onChange={(value) => field.handleChange(nullable(value))}
          />
        )}
      </form.Field>

      <form.Field name="content.opening.quoteSource">
        {(field) => (
          <TextField
            label="Sumber kutipan"
            value={field.state.value ?? ''}
            onChange={(value) => field.handleChange(nullable(value))}
          />
        )}
      </form.Field>

      <form.Field name="content.settings.locale">
        {(field) => (
          <SelectField
            label="Bahasa undangan"
            value={field.state.value}
            onChange={(value) => field.handleChange(value as Locale)}
            options={localeOptions}
          />
        )}
      </form.Field>

      <form.Field name="content.settings.showPublicRsvpStats">
        {(field) => (
          <CheckboxField
            label="Tampilkan rekap RSVP di halaman publik"
            checked={field.state.value}
            onChange={(value) => field.handleChange(value)}
          />
        )}
      </form.Field>

      <form.Field name="content.settings.showPublicWishes">
        {(field) => (
          <CheckboxField
            label="Tampilkan ucapan tamu di halaman publik"
            checked={field.state.value}
            onChange={(value) => field.handleChange(value)}
          />
        )}
      </form.Field>

      <div className="border-t border-line pt-5">
        <form.Field name="content.accessControl.isPrivatePinEnabled">
          {(field) => (
            <CheckboxField
              label="Kunci undangan dengan PIN"
              checked={field.state.value}
              onChange={(value) => field.handleChange(value)}
            />
          )}
        </form.Field>

        <form.Subscribe selector={(state) => state.values.content.accessControl.isPrivatePinEnabled}>
          {(enabled) =>
            enabled ? (
              <div className="mt-4 grid gap-4">
                <form.Field name="content.accessControl.pinCode">
                  {(field) => (
                    <TextField
                      label="PIN (4–6 digit)"
                      value={field.state.value ?? ''}
                      onChange={(value) => field.handleChange(nullable(value))}
                      hint="Tamu memasukkan PIN ini sebelum isi undangan tampil."
                    />
                  )}
                </form.Field>
              </div>
            ) : null
          }
        </form.Subscribe>

        <div className="mt-4 grid gap-4">
          <form.Field name="content.accessControl.strictGuestListOnly">
            {(field) => (
              <CheckboxField
                label="Hanya tamu dalam daftar yang boleh membuka"
                checked={field.state.value}
                onChange={(value) => field.handleChange(value)}
              />
            )}
          </form.Field>

          <form.Field name="content.accessControl.defaultMaxPaxPerGuest">
            {(field) => (
              <NumberField
                label="Maksimal orang per tamu"
                min={1}
                max={20}
                value={field.state.value}
                onChange={(value) => field.handleChange(value)}
              />
            )}
          </form.Field>
        </div>
      </div>
    </div>
  )
}

const hostField = (
  form: EditorForm,
  path: 'primary' | 'secondary',
  field: 'fullName' | 'nickname' | 'fatherName' | 'motherName' | 'instagramHandle',
  label: string,
) => (
  <form.Field name={`content.hosts.${path}.${field}`}>
    {(api) => (
      <TextField
        label={label}
        value={api.state.value ?? ''}
        onChange={(value) => api.handleChange(nullable(value))}
      />
    )}
  </form.Field>
)

export function HostsPanel({ form }: { form: EditorForm }) {
  return (
    <div className="grid gap-6">
      <form.Field name="content.hosts.primary.fullName">
        {(field) => (
          <TextField
            label="Nama lengkap mempelai pertama"
            value={field.state.value}
            onChange={(value) => field.handleChange(value)}
          />
        )}
      </form.Field>
      {hostField(form, 'primary', 'nickname', 'Nama panggilan')}
      {hostField(form, 'primary', 'fatherName', 'Nama ayah')}
      {hostField(form, 'primary', 'motherName', 'Nama ibu')}
      {hostField(form, 'primary', 'instagramHandle', 'Instagram')}

      <div className="border-t border-line pt-5">
        <form.Field name="content.hosts.secondary">
          {(field) => (
            <CheckboxField
              label="Ada mempelai kedua"
              checked={field.state.value !== null}
              onChange={(checked) =>
                field.handleChange(
                  checked
                    ? {
                        fullName: '',
                        nickname: null,
                        fatherName: null,
                        motherName: null,
                        photoKey: null,
                        instagramHandle: null,
                      }
                    : null,
                )
              }
            />
          )}
        </form.Field>

        <form.Subscribe selector={(state) => state.values.content.hosts.secondary !== null}>
          {(hasSecondary) =>
            hasSecondary ? (
              <div className="mt-4 grid gap-4">
                {hostField(form, 'secondary', 'fullName', 'Nama lengkap mempelai kedua')}
                {hostField(form, 'secondary', 'nickname', 'Nama panggilan')}
                {hostField(form, 'secondary', 'fatherName', 'Nama ayah')}
                {hostField(form, 'secondary', 'motherName', 'Nama ibu')}
                {hostField(form, 'secondary', 'instagramHandle', 'Instagram')}
              </div>
            ) : null
          }
        </form.Subscribe>
      </div>
    </div>
  )
}

export function EventsPanel({ form }: { form: EditorForm }) {
  return (
    <form.Field name="content.events">
      {(field) => {
        const events = field.state.value
        return (
          <div className="grid gap-5">
            {events.map((event, index) => {
              const update = (patch: Partial<typeof event>) =>
                field.handleChange(
                  events.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, ...patch } : item,
                  ),
                )

              return (
                <div key={event.id} className="border border-line p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-semibold text-ink">Acara {index + 1}</p>
                    <DashboardRemove onClick={() => field.removeValue(index)} />
                  </div>

                  <div className="mt-3 grid gap-3">
                    <TextField
                      label="Nama acara"
                      value={event.name}
                      onChange={(value) => update({ name: value })}
                    />
                    <TextField
                      label="Mulai (ISO 8601)"
                      value={event.startsAt}
                      onChange={(value) => update({ startsAt: value })}
                      hint="Contoh: 2026-12-12T08:00:00+07:00"
                    />
                    <TextField
                      label="Selesai (opsional, ISO 8601)"
                      value={event.endsAt ?? ''}
                      onChange={(value) => update({ endsAt: nullable(value) })}
                    />
                    <SelectField
                      label="Zona waktu"
                      value={event.timezone}
                      onChange={(value) => update({ timezone: value as EventTimezone })}
                      options={timezoneOptions}
                    />
                    <TextField
                      label="Nama tempat"
                      value={event.venueName}
                      onChange={(value) => update({ venueName: value })}
                    />
                    <TextAreaField
                      label="Alamat"
                      rows={2}
                      value={event.address}
                      onChange={(value) => update({ address: value })}
                    />
                    <TextField
                      label="Tautan peta"
                      type="url"
                      value={event.mapsUrl ?? ''}
                      onChange={(value) => update({ mapsUrl: nullable(value) })}
                    />
                    <TextField
                      label="Dress code"
                      value={event.dressCode ?? ''}
                      onChange={(value) => update({ dressCode: nullable(value) })}
                    />
                  </div>
                </div>
              )
            })}

            <div>
              <button
                type="button"
                onClick={() =>
                  field.pushValue({
                    id: crypto.randomUUID(),
                    name: 'Acara baru',
                    startsAt: new Date().toISOString(),
                    endsAt: null,
                    timezone: 'WIB',
                    venueName: 'Lokasi acara',
                    address: 'Alamat lengkap',
                    mapsUrl: null,
                    dressCode: null,
                  })
                }
                className="cursor-pointer border border-line px-3 py-2 text-sm font-semibold text-ink hover:border-champagne"
              >
                Tambah acara
              </button>
            </div>
          </div>
        )
      }}
    </form.Field>
  )
}

function DashboardRemove({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer border border-line px-2.5 py-1 text-xs font-semibold text-[#9f3030] hover:border-[#9f3030]"
    >
      Hapus
    </button>
  )
}

export function MediaPanel({
  form,
  uploadState,
  onUpload,
}: {
  form: EditorForm
  uploadState: { tone: 'idle' | 'busy' | 'ok' | 'error'; text: string }
  onUpload: (file: File) => Promise<void>
}) {
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-champagne">
          Galeri
        </p>
        <form.Field name="content.media.gallery">
          {(field) => (
            <div className="mt-3 grid gap-3">
              {field.state.value.map((item, index) => (
                <div key={`${item.key}-${index}`} className="border border-line p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="break-all font-mono text-xs text-ink/70">{item.key}</p>
                    <DashboardRemove onClick={() => field.removeValue(index)} />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <SelectField
                      label="Orientasi"
                      value={item.orientation}
                      onChange={(value) =>
                        field.handleChange(
                          field.state.value.map((row, rowIndex) =>
                            rowIndex === index
                              ? { ...row, orientation: value as MediaOrientation }
                              : row,
                          ),
                        )
                      }
                      options={orientationOptions}
                    />
                    <TextField
                      label="Keterangan"
                      value={item.caption ?? ''}
                      onChange={(value) =>
                        field.handleChange(
                          field.state.value.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, caption: nullable(value) } : row,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </form.Field>

        <label className="mt-4 inline-flex cursor-pointer items-center gap-2 border border-line px-3 py-2 text-sm font-semibold text-ink hover:border-champagne">
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file !== undefined) void onUpload(file)
            }}
          />
          {uploadState.tone === 'busy' ? 'Mengunggah…' : 'Unggah foto'}
        </label>

        {uploadState.tone === 'idle' ? null : (
          <p
            role={uploadState.tone === 'error' ? 'alert' : 'status'}
            className={
              uploadState.tone === 'error'
                ? 'mt-2 text-xs text-[#9f3030]'
                : 'mt-2 break-all text-xs text-champagne'
            }
          >
            {uploadState.text}
          </p>
        )}
      </div>

      <form.Field name="content.media.videoUrl">
        {(field) => (
          <TextField
            label="Tautan video"
            type="url"
            value={field.state.value ?? ''}
            onChange={(value) => field.handleChange(nullable(value))}
          />
        )}
      </form.Field>

      <form.Field name="content.media.audioKey">
        {(field) => (
          <TextField
            label="Kunci audio latar"
            value={field.state.value ?? ''}
            onChange={(value) => field.handleChange(nullable(value))}
            hint="Kunci objek di R2, mis. lagu/nada.webm."
          />
        )}
      </form.Field>
    </div>
  )
}

export function GiftsPanel({ form }: { form: EditorForm }) {
  return (
    <div className="grid gap-6">
      <form.Field name="content.gifts.bankAccounts">
        {(field) => (
          <div className="grid gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-champagne">
              Rekening bank
            </p>
            {field.state.value.map((account, index) => {
              const update = (patch: Partial<typeof account>) =>
                field.handleChange(
                  field.state.value.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, ...patch } : item,
                  ),
                )

              return (
                <div key={index} className="border border-line p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-ink">Rekening {index + 1}</p>
                    <DashboardRemove onClick={() => field.removeValue(index)} />
                  </div>
                  <div className="mt-3 grid gap-3">
                    <TextField
                      label="Nama bank"
                      value={account.bankName}
                      onChange={(value) => update({ bankName: value })}
                    />
                    <TextField
                      label="Nomor rekening"
                      value={account.accountNumber}
                      onChange={(value) => update({ accountNumber: value })}
                    />
                    <TextField
                      label="Atas nama"
                      value={account.accountHolder}
                      onChange={(value) => update({ accountHolder: value })}
                    />
                  </div>
                </div>
              )
            })}
            <div>
              <button
                type="button"
                onClick={() =>
                  field.pushValue({
                    bankName: 'Bank',
                    accountNumber: '0000000000',
                    accountHolder: 'Nama pemilik',
                  })
                }
                className="cursor-pointer border border-line px-3 py-2 text-sm font-semibold text-ink hover:border-champagne"
              >
                Tambah rekening
              </button>
            </div>
          </div>
        )}
      </form.Field>

      <form.Field name="content.gifts.qrisImageKey">
        {(field) => (
          <TextField
            label="Kunci gambar QRIS"
            value={field.state.value ?? ''}
            onChange={(value) => field.handleChange(nullable(value))}
            hint="Unggah QRIS lewat tab Media, lalu tempel kuncinya di sini."
          />
        )}
      </form.Field>

      <form.Field name="content.gifts.physicalAddress">
        {(field) => (
          <TextAreaField
            label="Alamat kiriman hadiah"
            rows={3}
            value={field.state.value ?? ''}
            onChange={(value) => field.handleChange(nullable(value))}
          />
        )}
      </form.Field>
    </div>
  )
}

export function ModulesPanel({
  form,
  manifest,
}: {
  form: EditorForm
  manifest: TemplateManifest
}) {
  const features = new Set(manifest.supportedFeatures)

  return (
    <div className="grid gap-6">
      <form.Field name="content.modules.loveStory">
        {(field) => (
          <div className="border border-line p-4">
            <CheckboxField
              label="Kisah kami"
              checked={field.state.value.enabled}
              onChange={(checked) =>
                field.handleChange({ ...field.state.value, enabled: checked })
              }
            />
            {!field.state.value.enabled ? null : (
              <div className="mt-4 grid gap-3">
                {field.state.value.items.map((item, index) => (
                  <div key={index} className="border border-line p-3">
                    <div className="flex justify-between gap-3">
                      <p className="text-sm text-ink">Momen {index + 1}</p>
                      <DashboardRemove
                        onClick={() =>
                          field.handleChange({
                            ...field.state.value,
                            items: field.state.value.items.filter((_, itemIndex) => itemIndex !== index),
                          })
                        }
                      />
                    </div>
                    <div className="mt-3 grid gap-3">
                      <TextField
                        label="Tanggal"
                        value={item.date ?? ''}
                        onChange={(value) =>
                          field.handleChange({
                            ...field.state.value,
                            items: field.state.value.items.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, date: nullable(value) } : row,
                            ),
                          })
                        }
                      />
                      <TextField
                        label="Judul"
                        value={item.title}
                        onChange={(value) =>
                          field.handleChange({
                            ...field.state.value,
                            items: field.state.value.items.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, title: value } : row,
                            ),
                          })
                        }
                      />
                      <TextAreaField
                        label="Cerita"
                        rows={2}
                        value={item.story}
                        onChange={(value) =>
                          field.handleChange({
                            ...field.state.value,
                            items: field.state.value.items.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, story: value } : row,
                            ),
                          })
                        }
                      />
                    </div>
                  </div>
                ))}
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      field.handleChange({
                        ...field.state.value,
                        items: [
                          ...field.state.value.items,
                          { date: null, title: 'Momen baru', story: 'Cerita singkat' },
                        ],
                      })
                    }
                    className="cursor-pointer border border-line px-3 py-2 text-sm font-semibold text-ink hover:border-champagne"
                  >
                    Tambah momen
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </form.Field>

      <form.Field name="content.modules.liveStream">
        {(field) => (
          <div className="border border-line p-4">
            <CheckboxField
              label="Siaran langsung"
              checked={field.state.value.enabled}
              onChange={(checked) =>
                field.handleChange({ ...field.state.value, enabled: checked })
              }
            />
            {!field.state.value.enabled ? null : (
              <div className="mt-4 grid gap-3">
                <TextField
                  label="Tautan siaran"
                  type="url"
                  value={field.state.value.url ?? ''}
                  onChange={(value) =>
                    field.handleChange({ ...field.state.value, url: nullable(value) })
                  }
                />
                <TextField
                  label="Platform"
                  value={field.state.value.platform ?? ''}
                  onChange={(value) =>
                    field.handleChange({ ...field.state.value, platform: nullable(value) })
                  }
                />
              </div>
            )}
          </div>
        )}
      </form.Field>

      <form.Field name="content.modules.socialKit">
        {(field) => (
          <div className="border border-line p-4">
            <CheckboxField
              label="Perlengkapan sosial"
              checked={field.state.value.enabled}
              onChange={(checked) =>
                field.handleChange({ ...field.state.value, enabled: checked })
              }
            />
            {!field.state.value.enabled ? null : (
              <div className="mt-4 grid gap-3">
                <TextField
                  label="Tagar"
                  value={field.state.value.hashtag ?? ''}
                  onChange={(value) =>
                    field.handleChange({ ...field.state.value, hashtag: nullable(value) })
                  }
                />
                <TextField
                  label="Tautan filter Instagram"
                  type="url"
                  value={field.state.value.instagramFilterUrl ?? ''}
                  onChange={(value) =>
                    field.handleChange({
                      ...field.state.value,
                      instagramFilterUrl: nullable(value),
                    })
                  }
                />
                <TextAreaField
                  label="Keterangan unggahan"
                  rows={2}
                  value={field.state.value.caption ?? ''}
                  onChange={(value) =>
                    field.handleChange({ ...field.state.value, caption: nullable(value) })
                  }
                />
              </div>
            )}
          </div>
        )}
      </form.Field>

      <form.Field name="content.modules.travelInfo">
        {(field) => (
          <div className="border border-line p-4">
            <CheckboxField
              label="Informasi perjalanan"
              checked={field.state.value.enabled}
              onChange={(checked) =>
                field.handleChange({ ...field.state.value, enabled: checked })
              }
            />
            {!field.state.value.enabled ? null : (
              <div className="mt-4 grid gap-3">
                <TextField
                  label="Tautan peta venue"
                  type="url"
                  value={field.state.value.venueMapUrl ?? ''}
                  onChange={(value) =>
                    field.handleChange({ ...field.state.value, venueMapUrl: nullable(value) })
                  }
                />
                {field.state.value.hotels.map((hotel, index) => (
                  <div key={index} className="border border-line p-3">
                    <div className="flex justify-between gap-3">
                      <p className="text-sm text-ink">Penginapan {index + 1}</p>
                      <DashboardRemove
                        onClick={() =>
                          field.handleChange({
                            ...field.state.value,
                            hotels: field.state.value.hotels.filter((_, itemIndex) => itemIndex !== index),
                          })
                        }
                      />
                    </div>
                    <div className="mt-3 grid gap-3">
                      <TextField
                        label="Nama"
                        value={hotel.name}
                        onChange={(value) =>
                          field.handleChange({
                            ...field.state.value,
                            hotels: field.state.value.hotels.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, name: value } : row,
                            ),
                          })
                        }
                      />
                      <TextField
                        label="Alamat"
                        value={hotel.address}
                        onChange={(value) =>
                          field.handleChange({
                            ...field.state.value,
                            hotels: field.state.value.hotels.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, address: value } : row,
                            ),
                          })
                        }
                      />
                    </div>
                  </div>
                ))}
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      field.handleChange({
                        ...field.state.value,
                        hotels: [
                          ...field.state.value.hotels,
                          {
                            name: 'Nama penginapan',
                            address: 'Alamat',
                            bookingUrl: null,
                            distanceLabel: null,
                          },
                        ],
                      })
                    }
                    className="cursor-pointer border border-line px-3 py-2 text-sm font-semibold text-ink hover:border-champagne"
                  >
                    Tambah penginapan
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </form.Field>

      <form.Field name="content.modules.entourage">
        {(field) => (
          <div className="border border-line p-4">
            <CheckboxField
              label="Keluarga pendamping"
              checked={field.state.value.enabled}
              onChange={(checked) =>
                field.handleChange({ ...field.state.value, enabled: checked })
              }
            />
            {!field.state.value.enabled ? null : (
              <div className="mt-4 grid gap-3">
                {field.state.value.groups.map((group, index) => (
                  <div key={index} className="border border-line p-3">
                    <div className="flex justify-between gap-3">
                      <p className="text-sm text-ink">Grup {index + 1}</p>
                      <DashboardRemove
                        onClick={() =>
                          field.handleChange({
                            ...field.state.value,
                            groups: field.state.value.groups.filter((_, itemIndex) => itemIndex !== index),
                          })
                        }
                      />
                    </div>
                    <div className="mt-3 grid gap-3">
                      <TextField
                        label="Judul grup"
                        value={group.title}
                        onChange={(value) =>
                          field.handleChange({
                            ...field.state.value,
                            groups: field.state.value.groups.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, title: value } : row,
                            ),
                          })
                        }
                      />
                      <TextField
                        label="Anggota (pisahkan dengan koma)"
                        value={group.members.join(', ')}
                        onChange={(value) =>
                          field.handleChange({
                            ...field.state.value,
                            groups: field.state.value.groups.map((row, rowIndex) =>
                              rowIndex === index
                                ? {
                                    ...row,
                                    members: value
                                      .split(',')
                                      .map((member) => member.trim())
                                      .filter((member) => member.length > 0),
                                  }
                                : row,
                            ),
                          })
                        }
                      />
                    </div>
                  </div>
                ))}
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      field.handleChange({
                        ...field.state.value,
                        groups: [
                          ...field.state.value.groups,
                          { title: 'Grup baru', members: ['Anggota'] },
                        ],
                      })
                    }
                    className="cursor-pointer border border-line px-3 py-2 text-sm font-semibold text-ink hover:border-champagne"
                  >
                    Tambah grup
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </form.Field>

      <form.Field name="content.modules.coHosts">
        {(field) => (
          <div className="border border-line p-4">
            <CheckboxField
              label="Penyelenggara"
              checked={field.state.value.enabled}
              onChange={(checked) =>
                field.handleChange({ ...field.state.value, enabled: checked })
              }
            />
            {!field.state.value.enabled ? null : (
              <div className="mt-4 grid gap-3">
                {field.state.value.items.map((host, index) => (
                  <div key={index} className="border border-line p-3">
                    <div className="flex justify-between gap-3">
                      <p className="text-sm text-ink">Penyelenggara {index + 1}</p>
                      <DashboardRemove
                        onClick={() =>
                          field.handleChange({
                            ...field.state.value,
                            items: field.state.value.items.filter((_, itemIndex) => itemIndex !== index),
                          })
                        }
                      />
                    </div>
                    <div className="mt-3 grid gap-3">
                      <TextField
                        label="Nama"
                        value={host.name}
                        onChange={(value) =>
                          field.handleChange({
                            ...field.state.value,
                            items: field.state.value.items.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, name: value } : row,
                            ),
                          })
                        }
                      />
                      <TextField
                        label="Peran"
                        value={host.role ?? ''}
                        onChange={(value) =>
                          field.handleChange({
                            ...field.state.value,
                            items: field.state.value.items.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, role: nullable(value) } : row,
                            ),
                          })
                        }
                      />
                    </div>
                  </div>
                ))}
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      field.handleChange({
                        ...field.state.value,
                        items: [
                          ...field.state.value.items,
                          { name: 'Nama penyelenggara', role: null, whatsappNumber: null },
                        ],
                      })
                    }
                    className="cursor-pointer border border-line px-3 py-2 text-sm font-semibold text-ink hover:border-champagne"
                  >
                    Tambah penyelenggara
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </form.Field>

      <form.Field name="content.modules.additionalNotes">
        {(field) => (
          <div className="border border-line p-4">
            <CheckboxField
              label="Catatan tambahan"
              checked={field.state.value.enabled}
              onChange={(checked) =>
                field.handleChange({ ...field.state.value, enabled: checked })
              }
            />
            {!field.state.value.enabled ? null : (
              <div className="mt-4 grid gap-3">
                {field.state.value.notes.map((note, index) => (
                  <div key={index} className="flex items-end gap-2">
                    <div className="flex-1">
                      <TextField
                        label={`Catatan ${index + 1}`}
                        value={note}
                        onChange={(value) =>
                          field.handleChange({
                            ...field.state.value,
                            notes: field.state.value.notes.map((row, rowIndex) =>
                              rowIndex === index ? value : row,
                            ),
                          })
                        }
                      />
                    </div>
                    <DashboardRemove
                      onClick={() =>
                        field.handleChange({
                          ...field.state.value,
                          notes: field.state.value.notes.filter((_, rowIndex) => rowIndex !== index),
                        })
                      }
                    />
                  </div>
                ))}
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      field.handleChange({
                        ...field.state.value,
                        notes: [...field.state.value.notes, 'Catatan baru'],
                      })
                    }
                    className="cursor-pointer border border-line px-3 py-2 text-sm font-semibold text-ink hover:border-champagne"
                  >
                    Tambah catatan
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </form.Field>

      {features.has('qrCheckin') ? (
        <form.Field name="content.modules.enableQrCheckin">
          {(field) => (
            <CheckboxField
              label="Aktifkan QR check-in tamu"
              checked={field.state.value}
              onChange={(value) => field.handleChange(value)}
            />
          )}
        </form.Field>
      ) : null}
    </div>
  )
}

export function ClosingPanel({ form }: { form: EditorForm }) {
  return (
    <div className="grid gap-5">
      <form.Field name="content.closing.message">
        {(field) => (
          <TextAreaField
            label="Pesan penutup"
            rows={4}
            value={field.state.value}
            onChange={(value) => field.handleChange(value)}
          />
        )}
      </form.Field>

      <form.Field name="content.closing.happyFamilies">
        {(field) => (
          <div className="grid gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-champagne">
              Keluarga bahagia
            </p>
            {field.state.value.map((family, index) => (
              <div key={index} className="flex items-end gap-2">
                <div className="flex-1">
                  <TextField
                    label={`Keluarga ${index + 1}`}
                    value={family.name}
                    onChange={(value) =>
                      field.handleChange(
                        field.state.value.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, name: value } : row,
                        ),
                      )
                    }
                  />
                </div>
                <DashboardRemove onClick={() => field.removeValue(index)} />
              </div>
            ))}
            <div>
              <button
                type="button"
                onClick={() =>
                  field.pushValue({ name: 'Nama keluarga', photoKey: null })
                }
                className="cursor-pointer border border-line px-3 py-2 text-sm font-semibold text-ink hover:border-champagne"
              >
                Tambah keluarga
              </button>
            </div>
          </div>
        )}
      </form.Field>
    </div>
  )
}

export function AppearancePanel({
  form,
  manifest,
}: {
  form: EditorForm
  manifest: TemplateManifest
}) {
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-champagne">
          Palet tema
        </p>
        <form.Field name="appearance.themeTokens">
          {(field) => (
            <div className="mt-3 grid gap-2">
              {manifest.palettes.map((palette) => {
                const selected =
                  field.state.value.bgPrimary === palette.tokens.bgPrimary &&
                  field.state.value.accent === palette.tokens.accent
                return (
                  <button
                    key={palette.id}
                    type="button"
                    onClick={() => {
                      form.setFieldValue('appearance', {
                        themeTokens: palette.tokens,
                        fontPairingId: manifest.id,
                        sectionOrder: [...SECTION_IDS],
                        hiddenSections: [],
                        sectionTitles: {},
                      })
                    }}
                    aria-pressed={selected}
                    className={`flex items-center justify-between gap-3 border px-3 py-2 text-left text-sm ${
                      selected ? 'border-ink' : 'border-line hover:border-champagne'
                    }`}
                  >
                    <span className="text-ink">{palette.name}</span>
                    <span className="flex gap-1">
                      {[palette.tokens.bgPrimary, palette.tokens.accent, palette.tokens.textPrimary].map(
                        (color) => (
                          <span
                            key={color}
                            aria-hidden="true"
                            className="size-4 border border-line"
                            style={{ backgroundColor: color }}
                          />
                        ),
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </form.Field>
      </div>

      <form.Field name="whatsappTemplate">
        {(field) => (
          <TextAreaField
            label="Template pesan WhatsApp"
            rows={5}
            value={field.state.value}
            onChange={(value) => field.handleChange(value)}
            hint="Variabel: {nama} {link} {mempelai} {tanggal} {sesi}. Template ini juga dipakai di halaman Tamu."
          />
        )}
      </form.Field>
    </div>
  )
}
