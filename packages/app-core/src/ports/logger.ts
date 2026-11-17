export type LogFields = Record<string, unknown>

export type LoggerPort = {
  info: (message: string, fields?: LogFields) => void
  warn: (message: string, fields?: LogFields) => void
  error: (message: string, fields?: LogFields) => void
  /** Returns a logger that adds requestId to every subsequent entry. */
  withRequestId: (requestId: string) => LoggerPort
}
