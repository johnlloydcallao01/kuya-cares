import crypto from 'crypto'

const isSandbox = process.env.LALAMOVE_SANDBOX === 'true'

const LALAMOVE_BASE_URL = isSandbox
  ? 'https://rest.sandbox.lalamove.com'
  : 'https://rest.lalamove.com'

function getApiKey(): string {
  const key = isSandbox
    ? process.env.LALAMOVE_SANDBOX_API_KEY
    : process.env.LALAMOVE_API_KEY
  if (!key) throw new Error(`LALAMOVE${isSandbox ? '_SANDBOX' : ''}_API_KEY is not configured`)
  return key
}

function getApiSecret(): string {
  const secret = isSandbox
    ? process.env.LALAMOVE_SANDBOX_API_SECRET
    : process.env.LALAMOVE_API_SECRET
  if (!secret) throw new Error(`LALAMOVE${isSandbox ? '_SANDBOX' : ''}_API_SECRET is not configured`)
  return secret
}

function getMarket(): string {
  return process.env.LALAMOVE_MARKET || 'PH'
}

function signRequest(
  method: string,
  path: string,
  body: string,
): { timestamp: string; signature: string } {
  const secret = getApiSecret()
  const timestamp = Date.now().toString()
  const rawSignature = `${timestamp}\r\n${method.toUpperCase()}\r\n${path}\r\n\r\n${body}`

  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(rawSignature)
  const signature = hmac.digest('hex')

  return { timestamp, signature }
}

function buildHeaders(method: string, path: string, body: string = '') {
  const apiKey = getApiKey()
  const { timestamp, signature } = signRequest(method, path, body)
  const requestId = crypto.randomUUID()

  return {
    Authorization: `hmac ${apiKey}:${timestamp}:${signature}`,
    Market: getMarket(),
    'Request-ID': requestId,
    'Content-Type': 'application/json',
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LalamoveStop {
  coordinates: { lat: string; lng: string }
  address: string
}

export interface LalamoveQuotationResponse {
  quotationId: string
  scheduleAt: string | null
  expiresAt: string
  serviceType: string
  stops: Array<{
    stopId: string
    coordinates: { lat: string; lng: string }
    address: string
  }>
  priceBreakdown: {
    base: string
    totalBeforeOptimization: string
    totalExcludePriorityFee: string
    total: string
    currency: string
    [key: string]: string
  }
  distance: { value: string; unit: string }
}

export interface LalamoveOrderResponse {
  orderId: string
  quotationId: string
  priceBreakdown: {
    total: string
    currency: string
    priorityFee?: string
    [key: string]: string | undefined
  }
  driverId: string
  shareLink: string
  status: string
  distance: { value: string; unit: string }
  stops: Array<{
    stopId: string
    coordinates: { lat: string; lng: string }
    address: string
    name?: string
    phone?: string
  }>
}

export interface LalamoveDriverDetails {
  driverId: string
  name: string
  phone: string
  plateNumber: string
  photo: string
  coordinates: {
    lat: string
    lng: string
    updatedAt: string
  }
}

export type LalamoveServiceType =
  | 'MOTORCYCLE'
  | 'SEDAN'
  | 'MPV'
  | 'VAN'
  | 'VAN1000'
  | '1000KG_PICK_UP_TRUCK'
  | '2000KG_FB'
  | '3000KG_TRUCK'
  | 'TRUCK550'
  | string

// ─── API Methods ──────────────────────────────────────────────────────────────

export async function getCityInfo(market?: string): Promise<any> {
  const path = '/v3/cities'
  const headers = buildHeaders('GET', path)

  const response = await fetch(`${LALAMOVE_BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      ...headers,
      Market: market || getMarket(),
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Lalamove getCityInfo failed (${response.status}): ${error}`)
  }

  return response.json()
}

export async function getQuotation(
  stops: LalamoveStop[],
  serviceType: LalamoveServiceType = 'MOTORCYCLE',
  options?: {
    scheduleAt?: string
    language?: string
    specialRequests?: string[]
    item?: {
      quantity?: string
      weight?: string
      categories?: string[]
    }
  },
): Promise<LalamoveQuotationResponse> {
  const path = '/v3/quotations'
  const item = options?.item || {
    quantity: '1',
    weight: 'LESS_THAN_20_KG',
    categories: ['FOOD_AND_BEVERAGES'],
  }

  const bodyObj: Record<string, any> = {
    data: {
      serviceType,
      language: options?.language || 'en_PH',
      stops,
      isRouteOptimized: false,
      item,
    },
  }

  if (options?.scheduleAt) bodyObj.data.scheduleAt = options.scheduleAt
  if (options?.specialRequests?.length) bodyObj.data.specialRequests = options.specialRequests

  const body = JSON.stringify(bodyObj)
  const headers = buildHeaders('POST', path, body)

  const response = await fetch(`${LALAMOVE_BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Lalamove getQuotation failed (${response.status}): ${error}`)
  }

  const data = await response.json()
  return data.data
}

export async function placeOrder(params: {
  quotation: LalamoveQuotationResponse
  senderName: string
  senderPhone: string
  recipients: Array<{
    name: string
    phone: string
    remarks?: string
  }>
  isPODEnabled?: boolean
  metadata?: Record<string, string>
}): Promise<LalamoveOrderResponse> {
  const path = '/v3/orders'
  const bodyObj: Record<string, any> = {
    data: {
      quotationId: params.quotation.quotationId,
      sender: {
        stopId: params.quotation.stops[0]?.stopId,
        name: params.senderName,
        phone: params.senderPhone,
      },
      recipients: params.recipients.map((recipient, index) => ({
        stopId: params.quotation.stops[index + 1]?.stopId,
        ...recipient,
      })),
    },
  }

  if (params.isPODEnabled) bodyObj.data.isPODEnabled = true
  if (params.metadata) bodyObj.data.metadata = params.metadata

  const body = JSON.stringify(bodyObj)
  const headers = buildHeaders('POST', path, body)

  const response = await fetch(`${LALAMOVE_BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Lalamove placeOrder failed (${response.status}): ${error}`)
  }

  const data = await response.json()
  return data.data
}

export async function getOrderDetails(
  orderId: string,
): Promise<any> {
  const path = `/v3/orders/${orderId}`
  const headers = buildHeaders('GET', path)

  const response = await fetch(`${LALAMOVE_BASE_URL}${path}`, {
    method: 'GET',
    headers,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Lalamove getOrderDetails failed (${response.status}): ${error}`)
  }

  const data = await response.json()
  return data.data
}

export async function getDriverDetails(
  orderId: string,
  driverId: string,
): Promise<LalamoveDriverDetails> {
  const path = `/v3/orders/${orderId}/drivers/${driverId}`
  const headers = buildHeaders('GET', path)

  const response = await fetch(`${LALAMOVE_BASE_URL}${path}`, {
    method: 'GET',
    headers,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Lalamove getDriverDetails failed (${response.status}): ${error}`)
  }

  const data = await response.json()
  return data.data
}

export async function cancelOrder(orderId: string): Promise<void> {
  const path = `/v3/orders/${orderId}`
  const headers = buildHeaders('DELETE', path)

  const response = await fetch(`${LALAMOVE_BASE_URL}${path}`, {
    method: 'DELETE',
    headers,
  })

  // 404 = order already gone (treated as cancelled). 204 = cancelled.
  if (response.ok || response.status === 404) {
    return
  }

  const errorText = await response.text()
  const body = parseJsonSafe(errorText)
  const message =
    (typeof body?.message === 'string' && body.message) ||
    (body?.error && typeof body.error === 'object' && body.error.message) ||
    (body?.error && typeof body.error === 'string' && body.error) ||
    `${response.status}: ${errorText}`

  // Surface the official cancellation-policy error so callers can explain it
  const err = new Error(`Lalamove cancelOrder failed (${response.status}): ${errorText}`) as Error & {
    status?: number
    lalamoveMessage?: string
    isCancellationForbidden?: boolean
  }
  err.status = response.status
  err.message = message
  err.isCancellationForbidden = /CANCELLATION|forbidden/i.test(message)
    || response.status === 409
  throw err
}

function parseJsonSafe(
  raw: string,
): { message?: string; error?: string | { message?: string } } | null {
  try {
    return JSON.parse(raw) as any
  } catch {
    return null
  }
}

export async function registerWebhook(url: string): Promise<void> {
  const path = '/v3/webhook'
  const body = JSON.stringify({ data: { url } })
  const headers = buildHeaders('PATCH', path, body)

  const response = await fetch(`${LALAMOVE_BASE_URL}${path}`, {
    method: 'PATCH',
    headers,
    body,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Lalamove webhook registration failed (${response.status}): ${error}`)
  }
}

export async function addPriorityFee(
  orderId: string,
  feeAmount: string,
): Promise<any> {
  const path = `/v3/orders/${orderId}/priority-fee`
  const body = JSON.stringify({ data: { priorityFee: feeAmount } })
  const headers = buildHeaders('POST', path, body)

  const response = await fetch(`${LALAMOVE_BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Lalamove addPriorityFee failed (${response.status}): ${error}`)
  }

  const data = await response.json()
  return data.data
}
