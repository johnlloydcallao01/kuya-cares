'use server'

import { getServerToken, getServerUser } from './auth'

const CMS_API = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api').replace(/\/+$/, '')

export interface AdminNotification {
  id: number | string
  title: string
  body: string
  domain: string
  typeKey: string
  sourceEntityId: string | null
  priority: string
  status: 'unread' | 'read' | 'dismissed' | 'hidden'
  channel: string
  deliveredAt: string | null
  seenAt: string | null
  readAt: string | null
  archivedAt: string | null
  createdAt: string
  metadata?: Record<string, unknown> | null
}

export interface NotificationsResult {
  docs: AdminNotification[]
  totalDocs: number
  unreadCount: number
  unseenCount: number
}

async function cmsRequest(path: string, init: RequestInit = {}) {
  const token = await getServerToken()
  if (!token) throw new Error('Unauthorized')
  return fetch(`${CMS_API}${path}`, {
    ...init,
    headers: {
      Authorization: `JWT ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  })
}

function relationId(value: unknown): string | number | null {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'number' || typeof id === 'string' ? id : null
  }
  return null
}

function mapNotification(raw: Record<string, unknown>): AdminNotification | null {
  const event = raw.notificationEvent && typeof raw.notificationEvent === 'object'
    ? raw.notificationEvent as Record<string, unknown>
    : null
  const eventId = relationId(raw.notificationEvent)
  if (eventId == null) return null

  return {
    id: typeof raw.id === 'number' || typeof raw.id === 'string' ? raw.id : eventId,
    title: typeof event?.title === 'string' ? event.title : 'Notification',
    body: typeof event?.body === 'string' ? event.body : '',
    domain: typeof event?.domain === 'string' ? event.domain : 'system',
    typeKey: typeof event?.typeKey === 'string' ? event.typeKey : 'system.notification',
    sourceEntityId: typeof event?.sourceEntityId === 'string' ? event.sourceEntityId : null,
    priority: typeof event?.priority === 'string' ? event.priority : 'info',
    status: raw.status === 'read' || raw.status === 'dismissed' || raw.status === 'hidden' ? raw.status : 'unread',
    channel: typeof raw.channel === 'string' ? raw.channel : 'in_app',
    deliveredAt: typeof raw.deliveredAt === 'string' ? raw.deliveredAt : null,
    seenAt: typeof raw.seenAt === 'string' ? raw.seenAt : null,
    readAt: typeof raw.readAt === 'string' ? raw.readAt : null,
    archivedAt: typeof raw.archivedAt === 'string' ? raw.archivedAt : null,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    metadata: event?.metadata && typeof event.metadata === 'object' ? event.metadata as Record<string, unknown> : null,
  }
}

export async function getMyNotifications(): Promise<NotificationsResult | null> {
  const user = await getServerUser()
  if (!user) return null

  const query = new URLSearchParams({
    'where[user][equals]': String(user.id),
    sort: '-createdAt',
    limit: '100',
    depth: '2',
    pagination: 'false',
  })
  const response = await cmsRequest(`/user-notifications?${query.toString()}`)
  if (!response.ok) throw new Error('Unable to load notifications')
  const data = await response.json() as { docs?: Record<string, unknown>[]; totalDocs?: number }
  const docs = (data.docs || [])
    .map(mapNotification)
    .filter((item): item is AdminNotification => Boolean(item && !item.archivedAt))
  return {
    docs,
    totalDocs: data.totalDocs ?? docs.length,
    unreadCount: docs.filter((item) => item.status === 'unread').length,
    unseenCount: docs.filter((item) => !item.seenAt).length,
  }
}

export async function updateMyNotification(
  id: number | string,
  data: Partial<Pick<AdminNotification, 'status' | 'seenAt' | 'readAt' | 'archivedAt'>>,
) {
  const user = await getServerUser()
  if (!user) return null
  const query = new URLSearchParams({ 'where[user][equals]': String(user.id) })
  const response = await cmsRequest(`/user-notifications/${id}?${query.toString()}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  if (!response.ok) throw new Error('Unable to update notification')
  return response.json()
}

export async function markAllMyNotifications(data: { status?: 'read'; seenAt?: string }) {
  const result = await getMyNotifications()
  if (!result) return null
  await Promise.all(result.docs.filter((item) => !item.archivedAt).map((item) => updateMyNotification(item.id, data)))
  return true
}

export async function deleteMyNotification(id: number | string) {
  const user = await getServerUser()
  if (!user) return false
  const query = new URLSearchParams({ 'where[user][equals]': String(user.id) })
  const response = await cmsRequest(`/user-notifications/${id}?${query.toString()}`, { method: 'DELETE' })
  return response.ok
}