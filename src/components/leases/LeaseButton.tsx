/**
 * LeaseButton.tsx
 *
 * Lightweight no-op replacement to hide the inline "Lease Truck" button.
 *
 * This file intentionally renders nothing to remove the visible Lease button
 * from any card or UI that imports this component while keeping the import
 * stable so other code doesn't break.
 */

import React from 'react'

/**
 * Props for LeaseButton
 *
 * Kept for compatibility with existing usages.
 */
interface Props {
  assetModelId: string
  leaseRate?: number | null
  className?: string
  children?: React.ReactNode
  onSuccess?: (leaseId: string) => void
}

/**
 * LeaseButton
 *
 * No-op component that intentionally returns null to hide the inline Lease action.
 *
 * @param _props Props (kept for compatibility)
 * @returns null
 */
export default function LeaseButton(_props: Props): JSX.Element | null {
  return null
}