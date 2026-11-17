import type { LogFields, LoggerPort } from '@kalamkala/app-core'

type LogLevel = 'info' | 'warn' | 'error'

/** Errors lose their prototype over JSON, so keep the useful parts readable. */
const serializeValue = (value: unknown): unknown =>
  value instanceof Error ? { name: value.name, message: value.message, stack: value.stack } : value

const serializeFields = (fields: LogFields | undefined): LogFields => {
  if (fields === undefined) return {}
  const { err, ...rest } = fields
  if (err === undefined) return rest
  return { ...rest, err: serializeValue(err) }
}

const writeLogLine = (level: LogLevel, message: string, fields?: LogFields): void => {
  const line = JSON.stringify({
    level,
    message,
    time: new Date().toISOString(),
    ...serializeFields(fields),
  })
  console.log(line)
}

/** One JSON object per line, ready for `wrangler tail` and log drains. */
export class ConsoleLoggerAdapter implements LoggerPort {
  info(message: string, fields?: LogFields): void {
    writeLogLine('info', message, fields)
  }

  warn(message: string, fields?: LogFields): void {
    writeLogLine('warn', message, fields)
  }

  error(message: string, fields?: LogFields): void {
    writeLogLine('error', message, fields)
  }
}
