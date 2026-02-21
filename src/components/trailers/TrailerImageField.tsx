/**
 * TrailerImageField.tsx
 *
 * Trailer equivalent of TruckImageField.
 * Supports:
 * - preview image
 * - upload button
 * - URL edit modal
 * - persistence to DB
 */

import React, { useEffect, useRef, useState } from 'react'
import { Truck, Upload } from 'lucide-react'
import { supabaseFetch } from '../../lib/supabase'

export interface TrailerImageFieldProps {
  trailerId: string
  initialUrl?: string | null
  className?: string
}

export default function TrailerImageField({
  trailerId,
  initialUrl,
  className = '',
}: TrailerImageFieldProps) {
  const [url, setUrl] = useState<string | null>(initialUrl ?? null)
  const [draftUrl, setDraftUrl] = useState<string>(initialUrl ?? '')
  const [modalOpen, setModalOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setUrl(initialUrl ?? null)
    setDraftUrl(initialUrl ?? '')
  }, [initialUrl])

  function openModal() {
    setDraftUrl(url ?? '')
    setModalOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function save() {
    const cleaned = draftUrl.trim() || null

    setUrl(cleaned)
    setModalOpen(false)

    if (!trailerId) return

    try {
      await supabaseFetch(
        `/rest/v1/user_trailers?id=eq.${encodeURIComponent(trailerId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ image_url: cleaned }),
          headers: {
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
        }
      )
    } catch (err) {
      console.error('Failed to save trailer image', err)
    }
  }

  return (
    <div className={`relative group ${className}`}>
      <button
        type="button"
        onClick={openModal}
        className="w-12 h-12 rounded-sm border border-slate-100 bg-white overflow-hidden flex items-center justify-center"
      >
        {url ? (
          <img
            src={url}
            alt="Trailer"
            className="w-full h-full object-cover"
          />
        ) : (
          <Truck className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {/* Upload icon like truck cards */}
      <button
        type="button"
        onClick={openModal}
        className="absolute -right-2 -top-2 bg-white rounded-full p-1 shadow opacity-0 group-hover:opacity-100 transition"
      >
        <Upload className="w-4 h-4 text-slate-600" />
      </button>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setModalOpen(false)}
          />

          <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="px-4 py-3 border-b text-sm font-medium">
              Set trailer image URL
            </div>

            <div className="p-4 space-y-3">
              <input
                ref={inputRef}
                value={draftUrl}
                onChange={(e) => setDraftUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
              />

              <div className="h-40 border rounded flex items-center justify-center overflow-hidden bg-slate-50">
                {draftUrl ? (
                  <img
                    src={draftUrl}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-slate-400 text-sm">
                    No preview
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-3 py-1 border rounded text-sm"
                >
                  Cancel
                </button>

                <button
                  onClick={save}
                  className="px-3 py-1 bg-indigo-600 text-white rounded text-sm"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
