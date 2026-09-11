import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// Supabase Realtime Notifications - Server-side broadcaster
//
// Mirrors the pattern used by the grandline CMS: the CMS server pushes an
// ephemeral broadcast to the user's private channel (`notifications:user:{id}`)
// over Supabase Realtime. Clients that are subscribed to that channel update
// the notification bell instantly without polling.
// ============================================================================

let serviceClient: SupabaseClient | null = null

/**
 * Get the Supabase service-role client for server-side broadcasting.
 * Uses the service role key so it can publish to any channel.
 */
export function getSupabaseServiceClient(): SupabaseClient | null {
  if (serviceClient) return serviceClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.warn(
      '[SupabaseNotifications] Missing Supabase env vars ' +
        '(NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). Realtime notifications are disabled.',
    )
    return null
  }

  serviceClient = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return serviceClient
}

export interface BroadcastNotificationPayload {
  id: string | number
  title: string
  body: string
  domain: string
  typeKey: string
  status: string
  channel: string
  priority?: string
  deliveredAt: string
  metadata?: Record<string, unknown>
}

/**
 * Broadcast a notification event to a specific user via Supabase Realtime.
 * Delivery is fire-and-forget - if it fails, the persisted notification rows
 * are unaffected (the client reconciles via REST on next fetch).
 */
export async function broadcastUserNotification(
  userId: string | number,
  notification: BroadcastNotificationPayload,
): Promise<void> {
  try {
    const supabase = getSupabaseServiceClient()
    if (!supabase) return

    const channelName = `notifications:user:${userId}`

    const channel = supabase.channel(channelName, {
      config: {
        broadcast: {
          self: true,
        },
      },
    })

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'new_notification',
          payload: {
            type: 'new_notification',
            notification,
            timestamp: new Date().toISOString(),
          },
        })

        // Cleanup after sending - the channel is ephemeral.
        setTimeout(() => {
          supabase.removeChannel(channel)
        }, 1000)
      }
    })
  } catch (error) {
    console.error('[SupabaseNotifications] Failed to broadcast notification:', error)
  }
}

/**
 * Broadcast a "mark as read" event so every connected client updates its
 * unread badge immediately.
 */
export async function broadcastNotificationRead(
  userId: string | number,
  notificationId: string | number,
): Promise<void> {
  try {
    const supabase = getSupabaseServiceClient()
    if (!supabase) return

    const channelName = `notifications:user:${userId}`
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: {
          self: true,
        },
      },
    })

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'notification_read',
          payload: {
            type: 'notification_read',
            notificationId: String(notificationId),
            timestamp: new Date().toISOString(),
          },
        })

        setTimeout(() => {
          supabase.removeChannel(channel)
        }, 1000)
      }
    })
  } catch (error) {
    console.error('[SupabaseNotifications] Failed to broadcast read status:', error)
  }
}