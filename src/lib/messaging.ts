/**
 * messaging.ts
 *
 * Minimal messaging client helpers used by the Inbox UI.
 *
 * - createThread: calls RPC create_thread_with_participants to create thread + participants.
 * - fetchMyThreads: fetch basic thread list for current public.users.id
 * - fetchThreadMessages: load messages for a thread
 * - sendMessage: insert a message for a thread
 *
 * Uses the existing supabaseFetch helper so behavior matches the app's REST usage.
 */

import { supabaseFetch } from './supabase'

/**
 * createThread
 *
 * Create a new thread and participants by calling the DB RPC.
 *
 * @param subject - thread subject
 * @param participantUserIds - array of public.users.id (uuid) for participants
 * @param creatorUserId - public.users.id (uuid) of the creator
 * @returns RPC response object { status, data }
 */
export async function createThread(
  subject: string,
  participantUserIds: string[],
  creatorUserId: string
) {
  try {
    const body = {
      p_subject: subject,
      p_participant_user_ids: participantUserIds,
      p_creator_user_id: creatorUserId,
    }
    return await supabaseFetch('/rpc/create_thread_with_participants', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return { status: 0, data: null, error: (err as any)?.message || 'Network error' }
  }
}

/**
 * fetchMyThreads
 *
 * Fetch threads for the given public.users.id (game user id).
 * Implementation:
 *  - Query thread_participants to get thread ids, then request threads by id.
 *
 * @param userId - public.users.id
 */
export async function fetchMyThreads(userId: string) {
  if (!userId) return { status: 400, data: [] }
  try {
    // 1) fetch participant rows for the user to collect thread ids
    const partRes = await supabaseFetch(`/rest/v1/thread_participants?select=thread_id&user_id=eq.${encodeURIComponent(userId)}`)
    const threadIds: string[] = Array.isArray(partRes.data) ? partRes.data.map((r: any) => r.thread_id) : []
    if (threadIds.length === 0) return { status: 200, data: [] }

    // 2) fetch threads by id (in operator)
    const inList = threadIds.map((id) => id).join(',')
    const threadsRes = await supabaseFetch(`/rest/v1/threads?select=*&id=in.(${inList})&order=created_at.desc`)
    return threadsRes
  } catch (err) {
    return { status: 0, data: [], error: (err as any)?.message || 'Network error' }
  }
}

/**
 * fetchThreadMessages
 *
 * Load messages for a given thread_id ordered ascending by created_at.
 *
 * @param threadId - uuid
 */
export async function fetchThreadMessages(threadId: string) {
  if (!threadId) return { status: 400, data: [] }
  try {
    return await supabaseFetch(`/rest/v1/messages?thread_id=eq.${encodeURIComponent(threadId)}&order=created_at.asc`)
  } catch (err) {
    return { status: 0, data: [], error: (err as any)?.message || 'Network error' }
  }
}

/**
 * sendMessage
 *
 * Insert a message row for a thread.
 *
 * @param threadId - uuid
 * @param senderUserId - public.users.id
 * @param body - message body
 */
export async function sendMessage(threadId: string, senderUserId: string, body: string) {
  if (!threadId || !senderUserId) return { status: 400, data: null }
  try {
    const payload = {
      thread_id: threadId,
      sender_user_id: senderUserId,
      body,
      is_draft: false,
      is_read: false,
      created_at: new Date().toISOString(),
    }
    return await supabaseFetch('/rest/v1/messages', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    })
  } catch (err) {
    return { status: 0, data: null, error: (err as any)?.message || 'Network error' }
  }
}

/**
 * createThreadByEmail
 *
 * Create a thread by providing the other participant's email.
 * Uses a SECURITY DEFINER RPC on the DB that looks up the user by email
 * (avoiding RLS issues) and creates the thread + participants.
 *
 * @param subject - thread subject
 * @param participantEmail - email of the other participant
 * @param creatorUserId - public.users.id (uuid) of the creator
 */
export async function createThreadByEmail(
  subject: string,
  participantEmail: string,
  creatorUserId: string
) {
  if (!participantEmail || !creatorUserId) return { status: 400, data: null }
  try {
    const body = {
      p_subject: subject,
      p_email: participantEmail,
      p_creator_user_id: creatorUserId,
    }
    return await supabaseFetch('/rpc/create_thread_with_participant_email', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return { status: 0, data: null, error: (err as any)?.message || 'Network error' }
  }
}