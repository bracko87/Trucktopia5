import { supabase } from './supabase'

export type AppNotification = {
  id: string
  user_id: string
  type: string
  entity_id: string | null
  message: string
  created_at: string
  read_at: string | null
}

export type NotificationAction = {
  label: string
  path: string
}

type NotificationTypeConfig = {
  defaultActionLabel?: string | null
  defaultActionPath?: ((entityId: string | null) => string | null) | null
}

function toSafeNotification(row: any): AppNotification {
  return {
    id:
      typeof row?.id === 'string' && row.id
        ? row.id
        : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    user_id: typeof row?.user_id === 'string' ? row.user_id : '',
    type:
      typeof row?.type === 'string' && row.type.trim()
        ? row.type
        : 'UNKNOWN',
    entity_id: typeof row?.entity_id === 'string' ? row.entity_id : null,
    message:
      typeof row?.message === 'string' && row.message.trim()
        ? row.message
        : 'Notification',
    created_at:
      typeof row?.created_at === 'string' && row.created_at
        ? row.created_at
        : new Date().toISOString(),
    read_at: typeof row?.read_at === 'string' ? row.read_at : null,
  }
}

function getNotificationTypeConfig(type: unknown): NotificationTypeConfig {
  const t = String(type ?? '').trim().toUpperCase()

  if (t.startsWith('ADMIN_')) {
    return {
      defaultActionLabel: 'Open dashboard',
      defaultActionPath: () => '/',
    }
  }

  switch (t) {
    case 'JOB_DEADLINE_SOON':
    case 'JOB_FAILED':
    case 'JOB_COMPLETED':
      return {
        defaultActionLabel: 'Open my jobs',
        defaultActionPath: () => '/my-jobs',
      }

    case 'TRUCK_MAINTENANCE_DUE':
    case 'TRUCK_REPAIR_FINISHED':
    case 'INSURANCE_EXPIRY':
      return {
        defaultActionLabel: 'Open trucks',
        defaultActionPath: () => '/trucks',
      }

    case 'STAFF_TRAINING_COMPLETE':
    case 'STAFF_CONTRACT_EXPIRING':
      return {
        defaultActionLabel: 'Open staff',
        defaultActionPath: () => '/staff',
      }

    case 'LOAN_PAYMENT_DUE':
    case 'LOW_BALANCE_ALERT':
      return {
        defaultActionLabel: 'Open finances',
        defaultActionPath: () => '/finances',
      }

    default:
      return {
        defaultActionLabel: null,
        defaultActionPath: null,
      }
  }
}

export function getNotificationAction(
  type: unknown,
  entityId: string | null
): NotificationAction | null {
  const cfg = getNotificationTypeConfig(type)

  if (
    typeof cfg.defaultActionPath !== 'function' ||
    typeof cfg.defaultActionLabel !== 'string'
  ) {
    return null
  }

  const basePath = cfg.defaultActionPath(entityId)
  if (!basePath) return null

  const path = entityId
    ? `${basePath}${basePath.includes('?') ? '&' : '?'}focus=${encodeURIComponent(entityId)}`
    : basePath

  return {
    label: cfg.defaultActionLabel,
    path,
  }
}

export async function resolvePublicUserId(authUserId: string): Promise<string | null> {
  if (!authUserId) return null

  const res = await supabase
    .from('users')
    .select('id')
    .eq('auth_user_id', authUserId)
    .limit(1)
    .maybeSingle()

  if ((res as any).error) {
    return null
  }

  const data = (res as any).data
  return data?.id ?? null
}

/**
 * resolveNotificationUserIds
 *
 * Returns both possible notification user ids:
 * - auth user id
 * - resolved public users.id (when available)
 *
 * This keeps notification wiring compatible with legacy rows that may have used
 * either identifier format in notifications.user_id.
 */
export async function resolveNotificationUserIds(authUserId: string): Promise<string[]> {
  const ids = new Set<string>()
  if (authUserId) ids.add(authUserId)

  const publicId = await resolvePublicUserId(authUserId)
  if (publicId) ids.add(publicId)

  return Array.from(ids)
}

export async function fetchNotificationsByReadState(
  userIds: string | string[],
  read: boolean,
  limit = 50
): Promise<AppNotification[]> {
  try {
    const idList = Array.isArray(userIds) ? userIds : [userIds]
    if (idList.length === 0) return []

    const query = supabase
      .from('notifications')
      .select('id,user_id,type,entity_id,message,created_at,read_at')
      .in('user_id', idList)
      .order('created_at', { ascending: false })
      .limit(limit)

    const { data, error } = read
      ? await query.not('read_at', 'is', null)
      : await query.is('read_at', null)

    if (error || !Array.isArray(data)) return []

    return data.map(toSafeNotification)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.debug('fetchNotificationsByReadState error', err)
    return []
  }
}

export async function countUnreadNotifications(userIds: string | string[]): Promise<number> {
  try {
    const idList = Array.isArray(userIds) ? userIds : [userIds]
    if (idList.length === 0) return 0

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .in('user_id', idList)
      .is('read_at', null)

    if (error) return 0
    return typeof count === 'number' ? count : 0
  } catch (err) {
    // eslint-disable-next-line no-console
    console.debug('countUnreadNotifications error', err)
    return 0
  }
}

export async function markNotificationRead(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)

    return !error
  } catch {
    return false
  }
}

export async function markAllNotificationsRead(
  userIds: string | string[]
): Promise<boolean> {
  try {
    const idList = Array.isArray(userIds) ? userIds : [userIds]
    if (idList.length === 0) return false

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('user_id', idList)
      .is('read_at', null)

    return !error
  } catch {
    return false
  }
}