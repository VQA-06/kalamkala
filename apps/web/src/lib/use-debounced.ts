import { useEffect, useState } from 'react'

/** Keeps editor keystrokes from re-mounting the live theme on every input. */
export const useDebounced = <T,>(value: T, delayMs: number): T => {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
