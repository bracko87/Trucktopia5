/**
 * TruckActions.tsx
 *
 * Small expandable actions panel for a truck. Rendered near the "More" button.
 *
 * Responsibilities:
 * - Provide a minimal set of actions (Details, Assign Driver, View Logs) displayed as three lines.
 * - Keep UI compact and accessible. Panel can be controlled by parent via isOpen prop.
 * - Each action emits a callback; actual action handlers can be provided or are placeholders.
 */

import React from 'react'
import { Info, User, FileText } from 'lucide-react'

/**
 * TruckActionsProps
 *
 * Props for the TruckActions component.
 */
interface TruckActionsProps {
  truck: any
  isOpen: boolean
  onClose?: () => void
  onViewDetails?: (truck: any) => void
  onAssignDriver?: (truck: any) => void
  onViewLogs?: (truck: any) => void
}

/**
 * TruckActions
 *
 * Presentational dropdown-like actions panel. Rendered when isOpen is true.
 *
 * @param props - TruckActionsProps
 * @returns Actions panel JSX or null when closed
 */
export default function TruckActions({
  truck,
  isOpen,
  onClose,
  onViewDetails,
  onAssignDriver,
  onViewLogs,
}: TruckActionsProps) {
  if (!isOpen) return null

  function handleDetails() {
    onViewDetails ? onViewDetails(truck) : console.debug('View details', truck?.id)
    onClose?.()
  }

  function handleAssign() {
    onAssignDriver ? onAssignDriver(truck) : console.debug('Assign driver', truck?.id)
    onClose?.()
  }

  function handleLogs() {
    onViewLogs ? onViewLogs(truck) : console.debug('View logs', truck?.id)
    onClose?.()
  }

  return (
    <div
      role="menu"
      aria-label="Truck actions"
      className="absolute right-3 top-12 z-30 w-56 bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden"
    >
      <button
        type="button"
        role="menuitem"
        onClick={handleDetails}
        className="w-full flex items-start gap-3 px-3 py-2 hover:bg-slate-50 focus:bg-slate-50 text-left"
      >
        <Info className="w-5 h-5 text-slate-500 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-medium text-slate-800">Details</div>
          <div className="text-xs text-slate-500">View full truck information</div>
        </div>
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={handleAssign}
        className="w-full flex items-start gap-3 px-3 py-2 hover:bg-slate-50 focus:bg-slate-50 text-left"
      >
        <User className="w-5 h-5 text-slate-500 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-medium text-slate-800">Assign driver</div>
          <div className="text-xs text-slate-500">Quickly assign or change driver</div>
        </div>
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={handleLogs}
        className="w-full flex items-start gap-3 px-3 py-2 hover:bg-slate-50 focus:bg-slate-50 text-left"
      >
        <FileText className="w-5 h-5 text-slate-500 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-medium text-slate-800">View logs</div>
          <div className="text-xs text-slate-500">Activity and history for this truck</div>
        </div>
      </button>
    </div>
  )
}