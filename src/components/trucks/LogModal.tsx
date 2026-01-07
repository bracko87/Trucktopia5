/**
 * LogModal.tsx
 *
 * Modal component that displays recent truck logs for a given truck id.
 * Reworked to use the shared ModalShell for consistent backdrop, animations and accessibility.
 *
 * - Limits display to 10 logs per page (client-side pagination).
 * - Adds a small search box, event-type filter, and sorting control.
 * - Supports "Load more" to fetch older logs and append them; pagination still limits view to 10 per page.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { X, RefreshCw, ChevronDown, Search, Filter } from 'lucide-react'
import ModalShell from '../common/ModalShell'
import { fetchTruckLogs, TruckLog } from '../../lib/truckLogs'

/**
 * LogModalProps
 *
 * @property truckId - user_trucks.id for which to fetch logs
 * @property open - whether the modal is visible
 * @property onClose - close handler
 */
interface LogModalProps {
  truckId: string
  open: boolean
  onClose: () => void
}

/**
 * LogsControlsProps
 *
 * Small, reusable controls row used inside the modal header.
 */
function LogsControls({
  search,
  onSearchChange,
  eventTypes,
  eventFilter,
  onEventFilterChange,
  sort,
  onSortChange,
}: {
  search: string
  onSearchChange: (v: string) => void
  eventTypes: string[]
  eventFilter: string
  onEventFilterChange: (v: string) => void
  sort: 'newest' | 'oldest'
  onSortChange: (v: 'newest' | 'oldest') => void
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 gap-2 w-full">
      <div className="flex items-center gap-2 flex-1">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          aria-label="Search logs"
          placeholder="Search logs..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full text-sm px-2 py-1 border border-slate-200 rounded bg-white"
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 hidden sm:inline" />
          <select
            aria-label="Filter by event type"
            value={eventFilter}
            onChange={(e) => onEventFilterChange(e.target.value)}
            className="text-sm px-2 py-1 border border-slate-200 rounded bg-white"
          >
            <option value="">All types</option>
            {eventTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <select
          aria-label="Sort logs"
          value={sort}
          onChange={(e) => onSortChange(e.target.value as 'newest' | 'oldest')}
          className="text-sm px-2 py-1 border border-slate-200 rounded bg-white"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>
    </div>
  )
}

/**
 * LogRow
 *
 * Small presentational row for a log entry.
 *
 * @param props - { log }
 */
function LogRow({ log }: { log: TruckLog }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-b border-slate-100 last:border-b-0 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="text-sm font-medium text-slate-800">{log.event_type}</div>
            <div className="text-sm text-slate-600 truncate">{log.message ?? '—'}</div>
          </div>
          <div className="text-xs text-slate-500 mt-1">{new Date(log.created_at).toLocaleString()}</div>
        </div>

        <div className="flex items-center gap-2">
          {log.source ? <div className="text-xs text-slate-500 hidden sm:block">{log.source}</div> : null}
          <button
            type="button"
            onClick={() => setExpanded((s) => !s)}
            className="p-1 rounded hover:bg-slate-100 text-slate-600"
            aria-expanded={expanded}
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {expanded ? (
        <pre className="mt-2 bg-slate-50 border border-slate-100 rounded p-2 text-xs max-h-48 overflow-auto">
          {JSON.stringify(log.payload ?? { message: log.message ?? null }, null, 2)}
        </pre>
      ) : null}
    </div>
  )
}

/**
 * LogModal
 *
 * Fetch and display truck logs in a modal overlay using the shared ModalShell.
 *
 * - Uses client-side pagination with PAGE_SIZE entries per page.
 * - Supports search, filter by event_type, and sorting.
 *
 * @param props - LogModalProps
 * @returns JSX.Element | null
 */
export default function LogModal({ truckId, open, onClose }: LogModalProps): JSX.Element | null {
  const [logs, setLogs] = useState<TruckLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)

  // Controls
  const [search, setSearch] = useState('')
  const [eventFilter, setEventFilter] = useState('')
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')

  // Pagination
  const PAGE_SIZE = 10
  const [page, setPage] = useState(1)

  const LIMIT_INITIAL = 50

  /**
   * loadInitial
   *
   * Load the first page of logs (fetch up to LIMIT_INITIAL rows).
   */
  async function loadInitial() {
    if (!truckId) return
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchTruckLogs(truckId, LIMIT_INITIAL)
      setLogs(rows)
      setHasMore(rows.length === LIMIT_INITIAL)
      setPage(1)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load logs')
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  /**
   * loadMore
   *
   * Load older logs using the created_at cursor of the last item and append them.
   * This supports long histories without fetching everything at once.
   */
  async function loadMore() {
    if (!truckId) return
    if (logs.length === 0) {
      await loadInitial()
      return
    }
    setLoadingMore(true)
    setError(null)
    try {
      const last = logs[logs.length - 1]
      const before = last.created_at
      const rows = await fetchTruckLogs(truckId, LIMIT_INITIAL, before)
      if (rows.length > 0) {
        setLogs((prev) => [...prev, ...rows])
      }
      setHasMore(rows.length === LIMIT_INITIAL)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load more logs')
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    if (open) loadInitial()
    if (!open) {
      setLogs([])
      setError(null)
      setHasMore(false)
      setSearch('')
      setEventFilter('')
      setSort('newest')
      setPage(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, truckId])

  /**
   * Extract event types for the filter dropdown.
   */
  const eventTypes = useMemo(() => {
    const set = new Set<string>()
    for (const l of logs) {
      if (l.event_type) set.add(l.event_type)
    }
    return Array.from(set).sort()
  }, [logs])

  /**
   * filteredAndSortedLogs
   *
   * Compute filtered and sorted array based on search, eventFilter and sort.
   */
  const filteredAndSortedLogs = useMemo(() => {
    const q = search.trim().toLowerCase()
    let arr = logs.slice()

    if (eventFilter) {
      arr = arr.filter((l) => (l.event_type ?? '').toLowerCase() === eventFilter.toLowerCase())
    }

    if (q) {
      arr = arr.filter((l) => {
        const msg = (l.message ?? '').toString().toLowerCase()
        const type = (l.event_type ?? '').toString().toLowerCase()
        const payload = JSON.stringify(l.payload ?? {}).toLowerCase()
        return msg.includes(q) || type.includes(q) || payload.includes(q)
      })
    }

    arr.sort((a, b) => {
      const ta = new Date(a.created_at).getTime()
      const tb = new Date(b.created_at).getTime()
      return sort === 'newest' ? tb - ta : ta - tb
    })

    return arr
  }, [logs, search, eventFilter, sort])

  /**
   * Pagination helpers
   */
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedLogs.length / PAGE_SIZE))
  const pageIndex = Math.min(Math.max(1, page), totalPages)
  const pageLogs = filteredAndSortedLogs.slice((pageIndex - 1) * PAGE_SIZE, pageIndex * PAGE_SIZE)

  useEffect(() => {
    // ensure page stays valid when filters change
    if (page > totalPages) setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages])

  if (!open) return null

  const footer = (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="text-xs text-slate-500">
          Showing {Math.min(filteredAndSortedLogs.length, PAGE_SIZE)} of {filteredAndSortedLogs.length} (page {pageIndex}/{totalPages})
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={pageIndex <= 1}
            className="px-3 py-1 text-sm bg-white hover:bg-slate-100 border border-slate-200 rounded disabled:opacity-50"
          >
            Prev
          </button>

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={pageIndex >= totalPages}
            className="px-3 py-1 text-sm bg-white hover:bg-slate-100 border border-slate-200 rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>

        {hasMore ? (
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="px-3 py-1 text-sm bg-white hover:bg-slate-100 border border-slate-200 rounded"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        ) : null}

        <button type="button" onClick={onClose} className="px-3 py-1 text-sm bg-white hover:bg-slate-100 border border-slate-200 rounded">
          Close
        </button>
      </div>
    </div>
  )

  return (
    <ModalShell open={open} onClose={onClose} title="Truck logs" size="lg" footer={footer}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Truck logs</div>
          <div className="text-xs text-slate-500 truncate">ID: {truckId}</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadInitial}
            className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-sm flex items-center gap-2"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      <div className="mt-3">
        <LogsControls
          search={search}
          onSearchChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          eventTypes={eventTypes}
          eventFilter={eventFilter}
          onEventFilterChange={(v) => {
            setEventFilter(v)
            setPage(1)
          }}
          sort={sort}
          onSortChange={(v) => {
            setSort(v)
            setPage(1)
          }}
        />
      </div>

      <div className="max-h-[60vh] overflow-auto mt-4">
        {loading ? (
          <div className="text-sm text-slate-500">Loading logs…</div>
        ) : error ? (
          <div className="text-sm text-rose-600">{error}</div>
        ) : pageLogs.length === 0 ? (
          <div className="text-sm text-slate-500">No logs found for this truck.</div>
        ) : (
          <div className="space-y-3">
            {pageLogs.map((l) => (
              <LogRow key={l.id} log={l} />
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  )
}