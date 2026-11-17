import type { LogFields, LoggerPort } from '@kalamkala/app-core'

export type ConsoleJsonLoggerOptions = {
  /** Stamped on every line, usually the Worker or app name. */
  service?: string
  /** Receives the finished line; tests replace it, production leaves it unset. */
  sink?: (line: string) => void
}

type LogLevel = 'info' | 'warn' | 'error'

/** JSON.stringify drops Error internals, so flatten them into the line. */
const jsonReplacer = (_key: string, value: unknown): unknown =>
  value instanceof Error
    ? { name: value.name, message: value.message, stack: value.stack }
    : value

/**
 * One JSON object per line, ordered so fields cannot overwrite the canonical
 * level/message/time/service/requestId keys. Ready for `wrangler tail` and log
 * drains without a parser in between.
 */
export class ConsoleJsonLogger implements LoggerPort {
  private readonly service: string | undefined
  private readonly sink: (line: string) => void
  private readonly requestId: string | undefined

  constructor(options: ConsoleJsonLoggerOptions = {}, requestId?: string) {
    this.service = options.service
    this.sink = options.sink ?? ((line: string) => console.log(line))
    this.requestId = requestId
  }

  info(message: string, fields?: LogFields): void {
    this.write('info', message, fields)
  }

  warn(message: string, fields?: LogFields): void {
    this.write('warn', message, fields)
  }

  error(message: string, fields?: LogFields): void {
    this.write('error', message, fields)
  }

  /** New logger with the same sink and service; the parent keeps no request id. */
  withRequestId(requestId: string): LoggerPort {
    return new ConsoleJsonLogger({ service: this.service, sink: this.sink }, requestId)
  }

  private write(level: LogLevel, message: string, fields?: LogFields): void {
    this.sink(
      JSON.stringify(
        {
          ...(fields ?? {}),
          level,
          message,
          time: new Date().toISOString(),
          ...(this.service === undefined ? {} : { service: this.service }),
          ...(this.requestId === undefined ? {} : { requestId: this.requestId }),
        },
        jsonReplacer,
      ),
    )
  }
}

const HEADER_NAME = 'x-request-id'

/**
 * Takes an incoming correlation id so logs from the Worker, D1, and R2 can be
 * joined. Header lookup is case-insensitive because HTTP field names are.
 */
export const requestIdFromHeaders = (
  headers: Record<string, string | undefined>,
  fallback?: () => string,
): string => {
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() !== HEADER_NAME) continue
    const trimmed = value?.trim()
    if (trimmed !== undefined && trimmed.length > 0) return trimmed
  }

  return fallback?.() ?? crypto.randomUUID()
}
