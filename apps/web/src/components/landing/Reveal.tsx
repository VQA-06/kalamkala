import { m, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

type RevealProps = {
  children: ReactNode
  className?: string
  /** Seconds, applied as a light stagger inside a section. */
  delay?: number
}

/**
 * Entrance animation for sections below the fold. The first server render is a
 * plain div, so nothing is hidden before hydration; motion only starts once the
 * client has taken over and the section scrolls into view.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const [hydrated, setHydrated] = useState(false)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    setHydrated(true)
  }, [])

  if (!hydrated || reducedMotion === true) {
    return <div className={className}>{children}</div>
  }

  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </m.div>
  )
}
