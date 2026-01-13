/**
 * Inbox.tsx
 *
 * Connects the Inbox UI to the backend messaging tables (threads, thread_participants, messages).
 *
 * Responsibilities:
 * - Load threads for current public user via an RPC that returns other_user_name
 * - Load messages for selected thread via fetchThreadMessages
 * - Create a new thread via createThread (when given an email)
 * - Send messages via sendMessage (optimistic UI + error rollback)
 *
 * Notes:
 * - This file uses existing helpers in src/lib/messaging.ts and a generic
 *   supabaseFetch helper to resolve users by email when creating a thread.
 * - loadThreadsFromServer uses the RPC: /rpc/fetch_my_threads?p_user_id=...
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import Layout from '../../components/Layout'
import AddressBook, { ContactEntry } from '../../components/settings/inbox/AddressBook'
import MessageThread, { ThreadMessage } from '../../components/settings/inbox/MessageThread'
import Composer from '../../components/settings/inbox/Composer'
import NewThreadModal from '../../components/settings/inbox/NewThreadModal'
import { fetchThreadMessages, sendMessage as apiSendMessage, createThread as apiCreateThread, createThreadByEmail } from '../../lib/messaging'
import { supabaseFetch } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

/**
 * Thread
 *
 * Minimal thread model used by the UI.
 */
interface Thread {
  id: string
  participants: string[]
  lastMessage?: string
  updatedAt?: string
}

/**
 * Message
 *
 * Minimal message model used by the UI.
 */
interface Message {
  id: string
  threadId: string
  sender: string
  body: string
  createdAt: string
  isDraft?: boolean
}

/**
 * InboxPage
 *
 * Wires the three-column inbox layout to the backend and provides a smooth UX:
 * - loading states
 * - optimistic message send with rollback
 * - auto-scroll to bottom when messages change
 * - in-page modal for creating new conversations (no native prompt)
 *
 * @returns JSX.Element
 */
export default function InboxPage(): JSX.Element {
  const nav = useNavigate()
  const { user: authUser } = useAuth() as any
  const [threads, setThreads] = useState<Thread[]>([])
  const [messages, setMessages] = useState<Record<string, Message[]>>({})
  const [selectedThread, setSelectedThread] = useState<string | null>(null)
  const [composerText, setComposerText] = useState<string>('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [search, setSearch] = useState<string>('')
  const [loadingThreads, setLoadingThreads] = useState<boolean>(false)
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false)
  const [sending, setSending] = useState<boolean>(false)
  const [showNewModal, setShowNewModal] = useState<boolean>(false)
  const publicUserIdRef = useRef<string | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement | null>(null)

  /**
   * resolvePublicUserId
   *
   * Try multiple ways to obtain the public.users.id for the currently authenticated user.
   * - First try auth context values (common shapes)
   * - Fallback: query REST /rest/v1/users by auth_user_id if we can obtain the auth uid
   *
   * @returns public users.id or null
   */
  async function resolvePublicUserId(): Promise<string | null> {
    const maybe = (authUser && (authUser.id || authUser.user?.id || authUser.publicId || authUser.public_user_id))
    if (typeof maybe === 'string' && maybe.length > 0) return maybe

    const authUid = authUser?.auth_user_id || authUser?.uid || authUser?.id
    if (!authUid) return null

    try {
      const res = await supabaseFetch(`/rest/v1/users?auth_user_id=eq.${encodeURIComponent(authUid)}&select=id&limit=1`)
      if (res?.status >= 200 && res?.status < 300 && Array.isArray(res.data) && res.data[0]) {
        return res.data[0].id
      }
    } catch {
      // ignore
    }
    return null
  }

  /**
   * loadThreadsFromServer
   *
   * Loads threads from the backend using the RPC that returns rows containing
   * other_user_name (the display name of the other participant).
   *
   * The mapping follows your requested shape:
   *   participants: r.other_user_name ? [r.other_user_name] : ['Conversation']
   *
   * @param publicUserId - public.users.id
   */
  async function loadThreadsFromServer(publicUserId: string) {
    setLoadingThreads(true)
    try {
      // Call the RPC that returns threads enriched with other_user_name
      const res = await supabaseFetch(`/rpc/fetch_my_threads?p_user_id=${encodeURIComponent(publicUserId)}`)
      if (res?.status >= 200 && res?.status < 300 && Array.isArray(res.data)) {
        const rows = res.data as any[]
        const mapped: Thread[] = rows.map((r) => ({
          id: r.id,
          participants: r.other_user_name ? [r.other_user_name] : ['Conversation'],
          lastMessage: r.last_message || '',
          updatedAt: r.last_message_at || r.created_at || '',
        }))
        setThreads(mapped)
        if (!selectedThread && mapped.length > 0) setSelectedThread(mapped[0].id)
      } else {
        // If RPC returns no data, clear threads
        setThreads([])
      }
    } catch (err) {
      console.error('loadThreadsFromServer error:', err)
      setThreads([])
    } finally {
      setLoadingThreads(false)
    }
  }

  /**
   * loadMessagesForThread
   *
   * Loads messages for a given thread id from the backend.
   *
   * @param threadId - thread uuid
   */
  async function loadMessagesForThread(threadId: string) {
    setLoadingMessages(true)
    try {
      const res = await fetchThreadMessages(threadId)
      if (res?.status >= 200 && res?.status < 300 && Array.isArray(res.data)) {
        const msgs = (res.data as any[]).map((m) => ({
          id: m.id,
          threadId: m.thread_id,
          sender: m.sender_user_id === publicUserIdRef.current ? 'You' : (m.sender_name || 'Member'),
          body: m.body,
          createdAt: m.created_at,
          isDraft: !!m.is_draft,
        } as Message))
        setMessages((prev) => ({ ...prev, [threadId]: msgs }))
      } else {
        setMessages((prev) => ({ ...prev, [threadId]: [] }))
      }
    } finally {
      setLoadingMessages(false)
      setTimeout(() => scrollToBottom(), 50)
    }
  }

  /**
   * scrollToBottom
   *
   * Scroll messages container to the bottom.
   */
  function scrollToBottom() {
    const el = document.getElementById('thread-messages')
    if (el) {
      el.scrollTop = el.scrollHeight
    } else if (messagesContainerRef.current) {
      const c = messagesContainerRef.current
      c.scrollTop = c.scrollHeight
    }
  }

  /**
   * init
   *
   * Resolve public user id and load initial threads.
   */
  useEffect(() => {
    let mounted = true
    async function init() {
      const publicId = await resolvePublicUserId()
      if (!mounted) return
      publicUserIdRef.current = publicId
      if (!publicId) return
      await loadThreadsFromServer(publicId)
    }
    init()
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser])

  /**
   * watch selectedThread change -> load messages
   */
  useEffect(() => {
    if (!selectedThread) return
    loadMessagesForThread(selectedThread)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThread])

  /**
   * Override window.prompt while this page is mounted so any leftover call to
   * window.prompt will open the in-page NewThreadModal instead of showing the
   * browser-native dialog. Restore original prompt on unmount.
   */
  useEffect(() => {
    const originalPrompt = window.prompt
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - we intentionally override prompt temporarily
    window.prompt = (msg?: string) => {
      // open our modal and return an empty string so callers get a value (not null)
      setShowNewModal(true)
      return ''
    }
    return () => {
      // restore
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      window.prompt = originalPrompt
    }
  }, [])

  /**
   * startThreadBackend
   *
   * Create a real thread using an email for the other participant.
   * The input must be an email address; we resolve the public user id for it.
   *
   * @param participantEmail - email address of the other participant
   */
  async function startThreadBackend(participantEmail: string) {
    /**
     * startThreadBackend
     *
     * Create a thread by participant email using the DB RPC.
     * Kept for backward compatibility but email-based start is fragile
     * (RLS, lookup failures). Prefer startThreadWithUserId when possible.
     */
    if (!publicUserIdRef.current) {
      alert('Unable to determine your account id. Please sign in again.')
      return
    }

    const email = participantEmail.trim()
    if (!email.includes('@')) {
      alert('Please provide an email address of an existing user to start a thread.')
      return
    }

    try {
      const rpcRes = await createThreadByEmail('Conversation', email, publicUserIdRef.current)
      console.log('RPC response:', rpcRes)

      if (
        rpcRes &&
        rpcRes.status >= 200 &&
        rpcRes.status < 300 &&
        rpcRes.data &&
        Array.isArray(rpcRes.data) &&
        rpcRes.data.length > 0
      ) {
        const createdThreadId = rpcRes.data[0].thread_id
        await loadThreadsFromServer(publicUserIdRef.current)
        setSelectedThread(createdThreadId)
      } else {
        console.error('Create thread failed:', rpcRes)
        if (rpcRes?.error?.includes('user_not_found')) {
          alert('User not found by email.')
        } else {
          alert('Failed to create thread.')
        }
      }
    } catch (err) {
      console.error(err)
      alert('Error creating thread. See console for details.')
    } finally {
      setShowNewModal(false)
    }
  }

  /**
   * startThreadWithUserId
   *
   * Create a conversation directly with a known public.users.id.
   * - Uses the createThread RPC (apiCreateThread)
   * - Avoids email lookup and RLS fragility
   *
   * @param otherUserId - public.users.id of the other participant
   */
  async function startThreadWithUserId(otherUserId: string) {
    if (!publicUserIdRef.current) {
      alert('Missing your user id')
      return
    }

    try {
      const res = await apiCreateThread('Conversation', [otherUserId], publicUserIdRef.current)
      console.log('Create thread (by id) response:', res)

      if (res?.status >= 200 && res?.status < 300 && Array.isArray(res.data) && res.data.length > 0) {
        const threadId = res.data[0].id || res.data[0].thread_id
        await loadThreadsFromServer(publicUserIdRef.current)
        if (threadId) setSelectedThread(threadId)
        else {
          console.error('Thread created but no id returned:', res)
          alert('Thread created but no id returned.')
        }
      } else {
        console.error('Failed to create thread:', res)
        alert('Failed to create thread')
      }
    } catch (e) {
      console.error(e)
      alert('Error creating thread')
    }
  }

  /**
   * onSendMessage
   *
   * Optimistically append a message to the UI and call backend send API.
   * If the API call fails, rollback the optimistic message.
   */
  async function onSendMessage() {
    if (!selectedThread || !composerText.trim()) return
    if (!publicUserIdRef.current) {
      alert('Unable to send message: missing user id.')
      return
    }
    const body = composerText.trim()
    const tmpId = 'tmp-' + Date.now().toString()
    const tmpMsg: Message = { id: tmpId, threadId: selectedThread, sender: 'You', body, createdAt: new Date().toISOString() }

    setMessages((prev) => ({ ...prev, [selectedThread]: [...(prev[selectedThread] || []), tmpMsg] }))
    setComposerText('')
    setSending(true)
    try {
      const res = await apiSendMessage(selectedThread, publicUserIdRef.current, body)
      if (res?.status >= 200 && res?.status < 300) {
        const saved = Array.isArray(res.data) && res.data[0] ? res.data[0] : null
        setMessages((prev) => {
          const list = (prev[selectedThread] || []).filter((m) => m.id !== tmpId)
          const finalMsg = saved
            ? {
                id: saved.id,
                threadId: saved.thread_id,
                sender: saved.sender_user_id === publicUserIdRef.current ? 'You' : saved.sender_name || 'Member',
                body: saved.body,
                createdAt: saved.created_at,
              }
            : tmpMsg
          return { ...prev, [selectedThread]: [...list, finalMsg] }
        })
        setThreads((prev) => prev.map((t) => (t.id === selectedThread ? { ...t, lastMessage: body, updatedAt: new Date().toISOString() } : t)))
      } else {
        setMessages((prev) => ({ ...prev, [selectedThread]: (prev[selectedThread] || []).filter((m) => m.id !== tmpId) }))
        alert('Failed to send message.')
      }
    } catch (err) {
      setMessages((prev) => ({ ...prev, [selectedThread]: (prev[selectedThread] || []).filter((m) => m.id !== tmpId) }))
      console.error(err)
      alert('Error sending message.')
    } finally {
      setSending(false)
      setTimeout(() => scrollToBottom(), 50)
    }
  }

  /**
   * contacts
   *
   * Derived contact entries for AddressBook (filters by search).
   */
  const contacts: ContactEntry[] = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = threads.map((t) => ({
      id: t.id,
      name: t.participants.filter((p) => p !== 'You').join(', ') || 'Conversation',
      lastMessage: t.lastMessage,
      updatedAt: t.updatedAt,
    }))
    if (!q) return list
    return list.filter((c) => c.name.toLowerCase().includes(q) || (c.lastMessage || '').toLowerCase().includes(q))
  }, [threads, search])

  /**
   * threadsIndex
   *
   * Map thread id => display name used by Composer for drafts.
   */
  const threadsIndex = useMemo(() => {
    const m: { [id: string]: string } = {}
    threads.forEach((t) => {
      m[t.id] = t.participants.filter((p) => p !== 'You').join(', ') || 'Thread'
    })
    return m
  }, [threads])

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Inbox</h2>
          <div className="flex gap-2">
            <button onClick={() => nav(-1)} className="px-3 py-1 rounded border text-black">
              Back
            </button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4">
          <AddressBook
            contacts={contacts}
            selectedId={selectedThread}
            onSelect={(id) => {
              setSelectedThread(id)
              const d = drafts[id] || ''
              setComposerText(d)
            }}
            onSeed={() => {
              /* intentionally left noop now that backend is used */
            }}
            onNewConversation={() => {
              setShowNewModal(true)
            }}
            search={search}
            setSearch={setSearch}
          />

          <MessageThread
            threadId={selectedThread}
            threadName={selectedThread ? threadsIndex[selectedThread] : null}
            messages={selectedThread ? (messages[selectedThread] || []).map((m) => ({ ...m })) as ThreadMessage[] : []}
            currentUserName="You"
            onDelete={async (threadId: string) => {
              /**
               * Delete thread handler
               *
               * Uses REST delete to remove the thread row, then refreshes threads
               * and messages in the UI.
               */
              if (!publicUserIdRef.current) {
                alert('Missing your user id')
                return
              }
              try {
                // Delete the thread row via REST
                const delRes = await supabaseFetch(`/rest/v1/threads?id=eq.${encodeURIComponent(threadId)}`, {
                  method: 'DELETE',
                })
                if (delRes?.status >= 200 && delRes?.status < 300) {
                  // refresh thread list and clear messages for deleted thread
                  await loadThreadsFromServer(publicUserIdRef.current)
                  setMessages((prev) => {
                    const next = { ...prev }
                    delete next[threadId]
                    return next
                  })
                  // Choose a sensible new selection: first thread or null
                  setSelectedThread((prev) => {
                    if (prev !== threadId) return prev
                    const remaining = threads.filter((t) => t.id !== threadId)
                    return remaining.length > 0 ? remaining[0].id : null
                  })
                } else {
                  console.error('Failed to delete thread:', delRes)
                  alert('Failed to delete conversation.')
                }
              } catch (err) {
                console.error('Error deleting thread:', err)
                alert('Error deleting conversation.')
              }
            }}
          />

          <Composer
            selectedThread={selectedThread}
            composerText={composerText}
            setComposerText={setComposerText}
            onSend={onSendMessage}
            onSaveDraft={() => {
              if (!selectedThread) return
              const nextDrafts = { ...drafts, [selectedThread]: composerText }
              setDrafts(nextDrafts)
              localStorage.setItem('inbox_drafts', JSON.stringify(nextDrafts))
            }}
            onClearDraft={(threadId: string) => {
              const nextDrafts = { ...drafts }
              delete nextDrafts[threadId]
              setDrafts(nextDrafts)
              localStorage.setItem('inbox_drafts', JSON.stringify(nextDrafts))
              if (threadId === selectedThread) setComposerText('')
            }}
            drafts={drafts}
            threadsIndex={threadsIndex}
            onLoadDraftToComposer={(threadId: string) => {
              const d = drafts[threadId] || ''
              setComposerText(d)
              setSelectedThread(threadId)
            }}
            onNewConversation={() => {
              setShowNewModal(true)
            }}
          />
        </div>

        {/* New Conversation modal (in-page) */}
        <NewThreadModal
          open={showNewModal}
          onClose={() => setShowNewModal(false)}
          onCreate={async (email: string) => {
            await startThreadBackend(email)
          }}
        />
      </div>
    </Layout>
  )
}