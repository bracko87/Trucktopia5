/**
 * FollowedOffersModal.tsx
 *
 * Modal listing job offers the user marked as followed (stored in localStorage).
 * Allows unfollowing, accepting (emits company-job-accept), and viewing (emits market-job-view).
 */

import React, { useEffect, useState } from 'react'
import { X, Star, Check, Eye } from 'lucide-react'

/**
 * FollowedOffersModalProps
 *
 * Props for the FollowedOffersModal.
 */
export interface FollowedOffersModalProps {
  open: boolean
  onClose: () => void
}

/**
 * readFollowedIds
 *
 * Read the followed job ids from localStorage. Returns an array (possibly empty).
 *
 * @returns string[] followed job ids
 */
function readFollowedIds(): string[] {
  try {
    const s = localStorage.getItem('followed_job_offers')
    if (!s) return []
    return JSON.parse(s) as string[]
  } catch {
    return []
  }
}

/**
 * writeFollowedIds
 *
 * Persist followed job ids to localStorage.
 *
 * @param ids - array of job ids
 */
function writeFollowedIds(ids: string[]) {
  try {
    localStorage.setItem('followed_job_offers', JSON.stringify(ids))
  } catch {
    // ignore storage errors
  }
}

/**
 * FollowedOffersModal
 *
 * Displays a simple list of followed job IDs with actions:
 * - View: emits 'market-job-view' CustomEvent with { jobId }
 * - Accept: emits 'company-job-accept' CustomEvent with { jobId }
 * - Unfollow: removes the id from storage and updates the list
 *
 * This is intentionally lightweight and does not fetch full job data so it can
 * work in preview environments and remain fast.
 */
export default function FollowedOffersModal({ open, onClose }: FollowedOffersModalProps) {
  const [ids, setIds] = useState<string[]>([])

  useEffect(() => {
    setIds(readFollowedIds())
  }, [open])

  useEffect(() => {
    function onFollowChange(e: Event | CustomEvent) {
      try {
        // re-read from storage in case of external changes
        setIds(readFollowedIds())
      } catch {
        // ignore
      }
    }
    window.addEventListener('job-follow-change', onFollowChange as EventListener)
    return () => window.removeEventListener('job-follow-change', onFollowChange as EventListener)
  }, [])

  if (!open) return null

  function unfollow(id: string) {
    const next = ids.filter((x) => x !== id)
    writeFollowedIds(next)
    setIds(next)
    try {
      window.dispatchEvent(new CustomEvent('job-follow-change', { detail: { jobId: id, followed: false } }))
    } catch {
      // ignore
    }
  }

  function accept(id: string) {
    try {
      window.dispatchEvent(new CustomEvent('company-job-accept', { detail: { jobId: id } }))
    } catch {
      // ignore
    }
  }

  function view(id: string) {
    try {
      window.dispatchEvent(new CustomEvent('market-job-view', { detail: { jobId: id } }))
    } catch {
      // ignore
    }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative z-10 w-full max-w-2xl mx-4 bg-white rounded-lg shadow-lg border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="text-sm font-medium">Followed offers</div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        <div className="p-4">
          {ids.length === 0 ? (
            <div className="text-sm text-slate-500">You have no followed offers.</div>
          ) : (
            <div className="space-y-3">
              {ids.map((id) => (
                <div key={id} className="flex items-center justify-between gap-3 p-3 rounded-md border border-slate-100 bg-white">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{id}</div>
                    <div className="text-xs text-slate-500">Followed offer id</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => view(id)}
                      className="inline-flex items-center gap-2 px-3 py-1 rounded-md border bg-white text-sm hover:bg-slate-50"
                      title="View offer"
                    >
                      <Eye className="w-4 h-4" />
                      <span className="text-xs">View</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => accept(id)}
                      className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700"
                      title="Accept offer"
                    >
                      <Check className="w-4 h-4" />
                      <span className="text-xs">Accept</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => unfollow(id)}
                      className="inline-flex items-center gap-2 px-3 py-1 rounded-md border bg-amber-50 text-amber-700 text-sm hover:bg-amber-100"
                      title="Unfollow offer"
                    >
                      <Star className="w-4 h-4" />
                      <span className="text-xs">Unfollow</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1 rounded-md border text-sm bg-white">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}