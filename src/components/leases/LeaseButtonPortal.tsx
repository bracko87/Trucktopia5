/**
 * LeaseButtonPortal.tsx
 *
 * Small helper component that renders a lease button and opens LeaseConfirmModal.
 * When opened the button stores a fallback model id onto window so the modal can
 * reliably resolve a model id even when callers forget to pass it.
 */

import React from 'react'
import LeaseConfirmModal from './LeaseConfirmModal'

/**
 * LeaseButtonPortalProps
 *
 * Props for LeaseButtonPortal component.
 */
interface LeaseButtonPortalProps {
  /** Truck model id that should be leased (may be null/undefined) */
  modelId?: string | null
  /** Optional additional className for the button */
  className?: string
  /** Optional title attribute for the button */
  title?: string
  /** Optional override button text */
  originalText?: string
}

/**
 * LeaseButtonPortal
 *
 * Renders a compact lease button that sets a global fallback model id and opens the
 * LeaseConfirmModal. This avoids modal failing when callers forget to pass assetModelId.
 *
 * @param props LeaseButtonPortalProps
 * @returns JSX.Element
 */
export default function LeaseButtonPortal({
  modelId,
  className,
  title,
  originalText,
}: LeaseButtonPortalProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <button
        type="button"
        className={
          className ??
          'px-3 py-1 text-sm bg-emerald-600 hover:bg-emerald-700 border border-emerald-600 rounded text-white'
        }
        title={title ?? 'Lease Truck'}
        onClick={() => {
          ;(window as any).__LEASE_MODAL_FALLBACK_MODEL_ID = modelId
          setOpen(true)
        }}
      >
        {originalText ?? 'Lease Truck'}
      </button>

      <LeaseConfirmModal
        open={open}
        onClose={() => setOpen(false)}
        assetModelId={modelId ?? ''}
        onSuccess={() => setOpen(false)}
      />
    </>
  )
}