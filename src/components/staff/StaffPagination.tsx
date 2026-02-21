import React from 'react'

interface StaffPaginationProps {
  currentPage: number
  pageCount: number
  onPageChange: (p: number) => void
}

const MAX_VISIBLE = 20

function getVisiblePages(current: number, total: number) {
  if (total <= MAX_VISIBLE) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const half = Math.floor(MAX_VISIBLE / 2)

  let start = Math.max(1, current - half)
  let end = start + MAX_VISIBLE - 1

  if (end > total) {
    end = total
    start = total - MAX_VISIBLE + 1
  }

  return Array.from(
    { length: end - start + 1 },
    (_, i) => start + i
  )
}

export default function StaffPagination({
  currentPage,
  pageCount,
  onPageChange,
}: StaffPaginationProps): JSX.Element {
  function go(p: number) {
    const next = Math.max(1, Math.min(pageCount || 1, p))
    if (next !== currentPage) onPageChange(next)
  }

  const pages = getVisiblePages(currentPage, pageCount)

  return (
    <div className="flex items-center justify-between mt-4 min-w-0">
      <div className="text-sm text-slate-600">
        Page {currentPage} of {pageCount || 1}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => go(currentPage - 1)}
          disabled={currentPage <= 1}
          className="px-3 py-1 border rounded bg-white disabled:opacity-40"
        >
          Prev
        </button>

        <div className="hidden sm:flex items-center gap-1 text-sm">
          {pages.map((p) => (
            <button
              key={p}
              onClick={() => go(p)}
              className={`px-2 py-1 rounded text-sm ${
                p === currentPage
                  ? 'bg-black text-white'
                  : 'bg-slate-50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <button
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
