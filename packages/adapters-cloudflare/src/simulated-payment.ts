import { PaymentGatewayError, systemClock } from '@kalamkala/app-core'
import type {
  CheckoutSession,
  ClockPort,
  CreateCheckoutSessionInput,
  PaymentCallbackRequest,
  PaymentGatewayPort,
  PaymentProvider,
  VerifiedPayment,
} from '@kalamkala/app-core'

export type SimulatedPaymentOptions = {
  /** Shared secret used to sign and verify simulated gateway callbacks. */
  secret: string
  /** Lifetime of the simulated checkout page in minutes. Defaults to 30. */
  checkoutTtlMinutes?: number
  now?: ClockPort
}

export type SignedCallbackInput = {
  merchantOrderId: string
  amount: number
  status: VerifiedPayment['status']
  paidAt?: Date | null
  gatewayReference?: string
}

/** Transport shape the simulation returns and `verifyCallback` accepts. */
export type SignedCallback = {
  headers: Record<string, string>
  body: string
}

const SIMULATED_PROVIDER = 'SIMULATED' satisfies PaymentProvider
const SIGNATURE_HEADER = 'x-simulated-signature'
const DEFAULT_CHECKOUT_TTL_MINUTES = 30
const CALLBACK_TTL_SECONDS = 15 * 60

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

const BASE64_INDEX: ReadonlyMap<string, number> = new Map(
  [...BASE64_ALPHABET].map((character, index) => [character, index] as const),
)

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

const bytesToBase64Url = (bytes: Uint8Array): string => {
  let encoded = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0
    const second = bytes[index + 1]
    const third = bytes[index + 2]
    encoded += BASE64_ALPHABET.charAt(first >> 2)
    encoded += BASE64_ALPHABET.charAt(((first & 0b11) << 4) | ((second ?? 0) >> 4))
    if (second === undefined) continue
    encoded += BASE64_ALPHABET.charAt(((second & 0b1111) << 2) | ((third ?? 0) >> 6))
    if (third === undefined) continue
    encoded += BASE64_ALPHABET.charAt(third & 0b111111)
  }
  return encoded
}

/** Returns null instead of throwing so callers can map failures to MALFORMED. */
const base64UrlToBytes = (value: string): Uint8Array | null => {
  const trimmed = value.replace(/=+$/u, '')
  if (trimmed.length % 4 === 1) return null
  const bytes: number[] = []
  for (let index = 0; index < trimmed.length; index += 4) {
    const first = BASE64_INDEX.get(trimmed.charAt(index))
    const second = BASE64_INDEX.get(trimmed.charAt(index + 1))
    const thirdCharacter = trimmed.charAt(index + 2)
    const fourthCharacter = trimmed.charAt(index + 3)
    if (first === undefined || second === undefined) return null
    const third = thirdCharacter.length === 0 ? undefined : BASE64_INDEX.get(thirdCharacter)
    const fourth = fourthCharacter.length === 0 ? undefined : BASE64_INDEX.get(fourthCharacter)
    if (thirdCharacter.length > 0 && third === undefined) return null
    if (fourthCharacter.length > 0 && fourth === undefined) return null
    if (third === undefined && fourth !== undefined) return null
    bytes.push((first << 2) | (second >> 4))
    if (third !== undefined) bytes.push(((second & 0b1111) << 4) | (third >> 2))
    if (third !== undefined && fourth !== undefined) bytes.push(((third & 0b11) << 6) | fourth)
  }
  return new Uint8Array(bytes)
}

const signPayload = async (secret: string, payload: string): Promise<Uint8Array> => {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(payload))
  return new Uint8Array(signature)
}

const timingSafeEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0)
  }
  return difference === 0
}

const readSignatureHeader = (headers: Record<string, string>): string | null => {
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === SIGNATURE_HEADER) return value
  }
  return null
}

const assertNonEmpty = (value: string, field: string): void => {
  if (value.trim().length === 0) {
    throw new PaymentGatewayError('VALIDATION', `${field} must not be empty`)
  }
}

/** Every field stays `unknown` until checked, so a bad payload cannot leak in. */
type RawCallbackPayload = {
  merchantOrderId?: unknown
  amount?: unknown
  status?: unknown
  paidAt?: unknown
  gatewayReference?: unknown
  exp?: unknown
}

type VerifiedCallbackPayload = {
  merchantOrderId: string
  amount: number
  status: VerifiedPayment['status']
  paidAt: Date | null
  gatewayReference: string
  exp: number
}

const malformedPayload = (reason: string): PaymentGatewayError =>
  new PaymentGatewayError('MALFORMED', `Callback payload ${reason}`)

const parseCallbackPayload = (bytes: Uint8Array): VerifiedCallbackPayload => {
  let parsed: unknown
  try {
    parsed = JSON.parse(textDecoder.decode(bytes))
  } catch {
    throw malformedPayload('is not valid JSON')
  }
  if (typeof parsed !== 'object' || parsed === null) throw malformedPayload('must be an object')

  const { merchantOrderId, amount, status, paidAt, gatewayReference, exp } = parsed as RawCallbackPayload
  if (typeof merchantOrderId !== 'string' || merchantOrderId.length === 0) {
    throw malformedPayload('needs a merchantOrderId')
  }
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
    throw malformedPayload('needs a positive integer amount')
  }
  if (status !== 'PAID' && status !== 'FAILED' && status !== 'EXPIRED') {
    throw malformedPayload('has an unknown status')
  }
  if (typeof gatewayReference !== 'string' || gatewayReference.length === 0) {
    throw malformedPayload('needs a gatewayReference')
  }
  if (typeof exp !== 'number' || !Number.isFinite(exp)) {
    throw malformedPayload('needs a numeric exp')
  }

  let parsedPaidAt: Date | null = null
  if (paidAt !== null) {
    if (typeof paidAt !== 'string') throw malformedPayload('needs an ISO paidAt or null')
    parsedPaidAt = new Date(paidAt)
    if (Number.isNaN(parsedPaidAt.getTime())) throw malformedPayload('has an invalid paidAt')
  }

  return { merchantOrderId, amount, status, paidAt: parsedPaidAt, gatewayReference, exp }
}

/**
 * Stand-in for Duitku while no merchant credentials exist.
 *
 * The adapter is stateless: checkout references are random, and the
 * callback signature is the only thing that proves authenticity. That means
 * `verifyCallback` is idempotent and replay-safe by construction, which is
 * exactly what the real webhook handler needs.
 */
export class SimulatedPaymentAdapter implements PaymentGatewayPort {
  private readonly secret: string
  private readonly checkoutTtlMs: number
  private readonly clock: ClockPort

  constructor(options: SimulatedPaymentOptions) {
    if (options.secret.trim().length === 0) {
      throw new PaymentGatewayError('VALIDATION', 'Simulated payment secret must not be empty')
    }
    if (
      options.checkoutTtlMinutes !== undefined &&
      (!Number.isInteger(options.checkoutTtlMinutes) || options.checkoutTtlMinutes <= 0)
    ) {
      throw new PaymentGatewayError('VALIDATION', 'checkoutTtlMinutes must be a positive integer')
    }
    this.secret = options.secret
    this.checkoutTtlMs = (options.checkoutTtlMinutes ?? DEFAULT_CHECKOUT_TTL_MINUTES) * 60_000
    this.clock = options.now ?? systemClock
  }

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSession> {
    assertNonEmpty(input.invitationId, 'invitationId')
    assertNonEmpty(input.userId, 'userId')
    assertNonEmpty(input.merchantOrderId, 'merchantOrderId')
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw new PaymentGatewayError('VALIDATION', 'amount must be a positive integer in rupiah')
    }

    const paymentReference = `sim_${crypto.randomUUID()}`
    let redirectUrl: string
    try {
      const url = new URL('/pembayaran/simulasi', input.returnUrl)
      url.searchParams.set('ref', paymentReference)
      url.searchParams.set('order', input.merchantOrderId)
      redirectUrl = url.toString()
    } catch {
      throw new PaymentGatewayError('VALIDATION', 'returnUrl must be an absolute URL')
    }

    return {
      merchantOrderId: input.merchantOrderId,
      provider: SIMULATED_PROVIDER,
      paymentReference,
      redirectUrl,
      expiresAt: new Date(this.clock.now().getTime() + this.checkoutTtlMs),
    }
  }

  /**
   * The simulation's "gateway". Signs the exact base64url body that
   * `verifyCallback` will later re-hash, so tests can tamper freely.
   */
  async createSignedCallback(input: SignedCallbackInput): Promise<SignedCallback> {
    const payload = {
      merchantOrderId: input.merchantOrderId,
      amount: input.amount,
      status: input.status,
      paidAt: input.paidAt ? input.paidAt.toISOString() : null,
      gatewayReference: input.gatewayReference ?? `sim_${crypto.randomUUID()}`,
      exp: Math.floor(this.clock.now().getTime() / 1000) + CALLBACK_TTL_SECONDS,
    }
    const body = bytesToBase64Url(textEncoder.encode(JSON.stringify(payload)))
    const signature = await signPayload(this.secret, body)
    return {
      headers: {
        [SIGNATURE_HEADER]: bytesToBase64Url(signature),
        'content-type': 'application/json',
      },
      body,
    }
  }

  async verifyCallback(request: PaymentCallbackRequest): Promise<VerifiedPayment> {
    const signatureHeader = readSignatureHeader(request.headers)
    if (signatureHeader === null) {
      throw new PaymentGatewayError('MALFORMED', `Missing ${SIGNATURE_HEADER} header`)
    }
    const providedSignature = base64UrlToBytes(signatureHeader)
    if (providedSignature === null) {
      throw new PaymentGatewayError('MALFORMED', 'Signature header is not base64url')
    }

    const expectedSignature = await signPayload(this.secret, request.body)
    if (!timingSafeEqual(expectedSignature, providedSignature)) {
      throw new PaymentGatewayError('INVALID_SIGNATURE', 'Callback signature does not match')
    }

    const payloadBytes = base64UrlToBytes(request.body)
    if (payloadBytes === null) {
      throw new PaymentGatewayError('MALFORMED', 'Callback body is not base64url')
    }
    const payload = parseCallbackPayload(payloadBytes)

    const nowSeconds = Math.floor(this.clock.now().getTime() / 1000)
    if (payload.exp < nowSeconds) {
      throw new PaymentGatewayError('EXPIRED', 'Callback signature has expired')
    }

    return {
      merchantOrderId: payload.merchantOrderId,
      provider: SIMULATED_PROVIDER,
      status: payload.status,
      amount: payload.amount,
      gatewayReference: payload.gatewayReference,
      paidAt: payload.paidAt,
    }
  }
}
