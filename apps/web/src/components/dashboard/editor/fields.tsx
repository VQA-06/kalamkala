import { Field } from '@base-ui/react/field'

const INPUT_CLASS =
  'w-full border border-line bg-paper px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne'
const LABEL_CLASS = 'text-xs font-semibold uppercase tracking-[0.14em] text-champagne'

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  hint?: string
  type?: 'text' | 'url'
}) {
  return (
    <Field.Root>
      <Field.Label className={LABEL_CLASS}>{label}</Field.Label>
      <Field.Control
        className={INPUT_CLASS}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      />
      {hint === undefined ? null : <p className="mt-1 text-xs text-ink/55">{hint}</p>}
    </Field.Root>
  )
}

export function TextAreaField({
  label,
  value,
  onChange,
  rows = 4,
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
  hint?: string
}) {
  return (
    <Field.Root>
      <Field.Label className={LABEL_CLASS}>{label}</Field.Label>
      <Field.Control
        render={
          <textarea
            rows={rows}
            className={INPUT_CLASS}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        }
      />
      {hint === undefined ? null : <p className="mt-1 text-xs text-ink/55">{hint}</p>}
    </Field.Root>
  )
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: ReadonlyArray<{ value: T; label: string }>
}) {
  return (
    <Field.Root>
      <Field.Label className={LABEL_CLASS}>{label}</Field.Label>
      <Field.Control
        render={
          <select
            className={INPUT_CLASS}
            value={value}
            onChange={(event) => onChange(event.target.value as T)}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        }
      />
    </Field.Root>
  )
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}) {
  return (
    <Field.Root>
      <Field.Label className={LABEL_CLASS}>{label}</Field.Label>
      <Field.Control
        type="number"
        min={min}
        max={max}
        className={INPUT_CLASS}
        value={value}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          onChange(Number(event.target.value))
        }
      />
    </Field.Root>
  )
}

export function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm text-ink/80">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 border border-line accent-champagne"
      />
      {label}
    </label>
  )
}
