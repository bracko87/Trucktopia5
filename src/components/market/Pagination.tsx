/**
 * Pagination.tsx
 *
 * Small, reusable pagination control for lists.
 *
 * Renders Prev/Next, First/Last, a compact numbered range and a page-select
 * dropdown. Exposes a simple onChange(page) callback.
 */

import React from 'react'

/**
 * PaginationProps
 *
 * Props for the Pagination component.
 */
export interface PaginationProps {
  /** Current 1-based page */
  current: number
  /** Total number of pages */
  totalPages: number
  /** Called when page changes */
  onChange: (page: number) => void
  /** Optional compact mode (fewer buttons) */
  compact?: boolean
}

/**
 * Pagination
 *
 * Renders First / Prev / numbered buttons / Next / Last, plus a page-select
 * dropdown. Keeps styling compact and accessible.
 *
 * @param props - PaginationProps
 * @returns JSX.Element
 */
export default function Pagination({
  current,
  totalPages,
  onChange,
  compact = false,
}: PaginationProps) {
  if (totalPages <= 1) return null

  const makeBtn = (label: React.ReactNode, page: number, disabled = false) => (
    <button
      key={String(label) + page}
      onClick={() => !disabled && onChange(page)}
      disabled={disabled}
      className={`inline-flex items-center justify-center px-3 py-1 rounded-md border text-sm ${
        disabled ? 'bg-slate-100 border-slate-200 text-slate-400' : 'bg-white border-slate-200 hover:bg-slate-50'
      }`}
      aria-current={page === current ? 'page' : undefined}
    >
      {label}
    </button>
  )

  // Determine range to show around current page
  const radius = compact ? 1 : 2
  const start = Math.max(1, current - radius)
  const end = Math.min(totalPages, current + radius)
  const pages: (number | 'dots')[] = []

  if (start > 1) {
    pages.push(1)
    if (start > 2) pages.push('dots')
  }

  for (let p = start; p <= end; p++) pages.push(p)

  if (end < totalPages) {
    if (end < totalPages - 1) pages.push('dots')
    pages.push(totalPages)
  }

  return (
    <nav className="flex flex-wrap items-center gap-2" aria-label="Pagination">
      {makeBtn('« First', 1, current === 1)}
      {makeBtn('‹ Prev', Math.max(1, current - 1), current === 1)}

      {pages.map((p, i) =>
        p === 'dots' ? (
          <span key={`dots-${i}`} className="mx-1 text-sm text-slate-400">
            …
          </span>
        ) : p === current ? (
          <button
            key={p}
            className="inline-flex items-center justify-center px-3 py-1 rounded-md border bg-sky-600 text-white text-sm font-medium"
            aria-current="page"
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        ) : (
          makeBtn(p, p as number, false)
        )
      )}

      {makeBtn('Next ›', Math.min(totalPages, current + 1), current === totalPages)}
      {makeBtn('Last »', totalPages, current === totalPages)}

      {/* Page select dropdown for quick navigation */}
      <label className="ml-2 text-sm text-slate-500 flex items-center gap-2">
        <span className="sr-only">Select page</span>
        <select
          aria-label="Select page"
          value={current}
          onChange={(e) => onChange(Number(e.target.value))}
          className="px-2 py-1 border rounded bg-white text-sm"
        >
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pn) => (
            <option key={pn} value={pn}>
              Page {pn}
            </option>
          ))}
        </select>
      </label>

      <span className="ml-2 text-sm text-slate-500">
        Page {current} of {totalPages}
      </span>
    </nav>
  )
}