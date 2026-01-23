/**
 * StaffPagination.tsx
 *
 * Simple pagination control for Staff Market.
 */

import React from 'react'

/**
 * Props for StaffPagination component.
 */
interface StaffPaginationProps {
  currentPage: number
  pageCount: number
  onPageChange: (p: number) => void
}

/**
 * StaffPagination
 *
 * Provides previous/next buttons and a simple page selector for up to `pageCount` pages.
 *
 * @param props StaffPaginationProps
 * @returns JSX.Element
 */
export default function StaffPagination({
  currentPage,
  pageCount,
  onPageChange,
}: StaffPaginationProps): JSX.Element {
  function go(p: number) {
    const next = Math.max(1, Math.min(pageCount || 1, p))
    if (next !== currentPage) onPageChange(next)
  }

  return (
    <div className="flex items-center justify-between mt-4">
      <div className="text-sm text-slate-600">
        Page {currentPage} of {pageCount || 1}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => go(currentPage - 1)}
          disabled={currentPage <= 1}
          className="px-3 py-1 border rounded bg-white disabled:opacity-40"
        >
          Prev
        </button>

        <div className="hidden sm:flex items-center gap-1 text-sm">
          {Array.from({ length: Math.max(0, pageCount) }).map((_, i) => {
            const p = i + 1
            return (
              <button
                key={p}
                onClick={() => go(p)}
                className={`px-2 py-1 rounded text-sm ${
                  p === currentPage ? 'bg-black text-white' : 'bg-slate-50'
                }`}
              >
                {p}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => go(currentPage + 1)}
          disabled={currentPage >= pageCount}
          className="px-3 py-1 border rounded bg-white disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  )
}
