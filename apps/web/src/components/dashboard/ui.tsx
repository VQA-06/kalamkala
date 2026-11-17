import { Button } from '@base-ui/react/button'
import type { ButtonProps } from '@base-ui/react/button'
import type { ReactNode } from 'react'

const BASE =
  'inline-flex cursor-pointer items-center justify-center gap-2 border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50'

const VARIANTS = {
  primary: 'border-ink bg-ink text-paper hover:bg-champagne hover:border-champagne',
  secondary: 'border-line bg-paper text-ink hover:border-champagne',
  ghost: 'border-transparent bg-transparent text-ink/70 hover:text-ink',
  danger: 'border-[#9f3030]/40 bg-paper text-[#9f3030] hover:border-[#9f3030]',
} as const

export type DashboardButtonVariant = keyof typeof VARIANTS

export function DashboardButton({
  variant = 'secondary',
  className,
  ...props
}: ButtonProps & { variant?: DashboardButtonVariant }) {
  return (
    <Button
      {...props}
      className={`${BASE} ${VARIANTS[variant]}${className === undefined ? '' : ` ${className}`}`}
    />
  )
}

export type StatusTone = 'draft' | 'active' | 'expired'

const TONES: Record<StatusTone, string> = {
  draft: 'border-line text-ink/60',
  active: 'border-champagne text-champagne',
  expired: 'border-line text-ink/40',
}

export function StatusBadge({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center border px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-6">
      <div>
        <p className="text-[0.69rem] font-semibold uppercase tracking-[0.18em] text-champagne">
          {eyebrow}
        </p>
        <h1 className="mt-2 font-display text-3xl leading-tight text-ink sm:text-4xl">
          {title}
        </h1>
        {description === undefined ? null : (
          <p className="mt-3 max-w-xl text-sm leading-6 text-ink/65">{description}</p>
        )}
      </div>
      {actions === undefined ? null : <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  )
}

export function Panel({
  title,
  description,
  children,
  actions,
}: {
  title: string
  description?: string
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <section className="border border-line bg-paper">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {description === undefined ? null : (
            <p className="mt-1 text-xs leading-5 text-ink/60">{description}</p>
          )}
        </div>
        {actions === undefined ? null : <div className="flex gap-2">{actions}</div>}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="border border-dashed border-line px-6 py-12 text-center">
      <p className="font-display text-xl text-ink">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink/65">{body}</p>
      {action === undefined ? null : <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  )
}
