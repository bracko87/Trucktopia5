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

export async function fetchNotificationsByReadState(
  publicUserId: string,
  read: boolean,
  limit = 50
): Promise<AppNotification[]> {
  try {
    const base = supabase
      .from('notifications')
      .select('id,user_id,type,entity_id,message,created_at,read_at')
      .eq('user_id', publicUserId)
      .order('created_at', { ascending: false })
      .limit(limit)

    let res: any
    if (read) {
      res = await base.not('read_at', 'is', null)
    } else {
      res = await base.is('read_at', null)
    }

    if (res.error || !Array.isArray(res.data)) return []

    return res.data as AppNotification[]
  } catch (err) {
    // eslint-disable-next-line no-console
    console.debug('fetchNotificationsByReadState error', err)
    return []
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

export async function markAllNotificationsRead(publicUserId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', publicUserId)
      .is('read_at', null)

    return !error
  } catch {
    return false
  }
}
