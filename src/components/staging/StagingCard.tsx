/**
 * StagingCard.tsx
 *
 * Reusable card used on the Staging Area page to represent a queue (trucks, trailers, drivers, cargo).
 */

import React from 'react'

/**
 * StagingCardProps
 *
 * Props for the StagingCard component.
 */
interface StagingCardProps {
  title: string
  subtitle?: string
  count?: number
  /**
   * Optional action invoked when the Manage button is clicked.
   */
  onManage?: () => void
  children?: React.ReactNode
}

/**
 * StagingCard
 *
 * Displays a compact queue card with title, optional subtitle, count badge,
 * an area for preview content and a Manage action.
 *
 * @param props - StagingCardProps
 */
export default function StagingCard({
  title,
  subtitle,
  count = 0,
  onManage,
  children,
}: StagingCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 p-4 bg-white shadow-sm flex flex-col justify-between min-h-[140px]">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm font-medium text-slate-700">{title}</div>
          <div className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded">
            {count}
          </div>
        </div>

        {subtitle && <div className="mt-2 text-xs text-slate-500">{subtitle}</div>}

        {children && <div className="mt-4">{children}</div>}
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onManage}
          className="px-3 py-1 text-sm bg-yellow-400 text-black rounded hover:bg-yellow-500 transition"
        >
          Manage
        </button>
      </div>
    </div>
  )
}