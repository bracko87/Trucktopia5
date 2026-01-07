/**
 * ModalShell.tsx
 *
 * Reusable modal shell used by application popups.
 *
 * - Renders into a portal on document.body to avoid stacking context issues.
 * - Provides blurred backdrop, entrance/exit animations, ESC + backdrop + close-button handling.
 * - Exposes size, title and footer props so content components remain small and focused.
 */

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/**
 * ModalShellProps
 *
 * Props for the ModalShell component.
 */
export interface ModalShellProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  /**
   * Optional title rendered in the header.
   */
  title?: string
  /**
   * Modal size controls max width.
   */
  size?: 'sm' | 'md' | 'lg' | 'full'
  /**
   * Optional footer area (button row, paging, etc).
   */
  footer?: React.ReactNode
  /**
   * Hide or show the default close button.
   */
  showCloseButton?: boolean
  /**
   * Additional classes applied to the panel.
   */
  className?: string
}

/**
 * getOrCreatePortalRoot
 *
 * Ensure a portal root exists on document.body for modals.
 *
 * @returns HTMLElement portal root
 */
function getOrCreatePortalRoot(): HTMLElement {
  const id = 'sider-modal-root'
  if (typeof document === 'undefined') return document.body as HTMLElement
  let root = document.getElementById(id)
  if (!root) {
    root = document.createElement('div')
    root.id = id
    // ensure portal root does not interfere with layout
    root.style.position = 'relative'
    document.body.appendChild(root)
  }
  return root
}

/**
 * sizeClassFor
 *
 * Map size prop to tailwind max-width classes.
 *
 * @param s - size
 * @returns string classes
 */
function sizeClassFor(s: NonNullable<ModalShellProps['size']>) {
  switch (s) {
    case 'sm':
      return 'max-w-xl'
    case 'md':
      return 'max-w-2xl'
    case 'lg':
      return 'max-w-4xl'
    case 'full':
      return 'w-full max-w-none h-full'
    default:
      return 'max-w-2xl'
  }
}

/**
 * ModalShell
 *
 * Presentational wrapper providing blurred backdrop and animated card.
 *
 * Usage:
 * <ModalShell open={open} onClose={onClose} title="Title" size="lg" footer={...}>
 *   ...body...
 * </ModalShell>
 */
export default function ModalShell({
  open,
  onClose,
  children,
  title,
  size = 'md',
  footer,
  showCloseButton = true,
  className = '',
}: ModalShellProps): JSX.Element | null {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (!open) return
    // mount animation + disable body scroll
    requestAnimationFrame(() => setMounted(true))
    const prev = typeof document !== 'undefined' ? document.body.style.overflow : ''
    if (typeof document !== 'undefined') document.body.style.overflow = 'hidden'
    return () => {
      setMounted(false)
      if (typeof document !== 'undefined') document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (open) {
      window.addEventListener('keydown', onKey)
      return () => window.removeEventListener('keydown', onKey)
    }
    return
  }, [open, onClose])

  if (!open) return null

  const backdropClass = `fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${mounted ? 'opacity-100' : 'opacity-0'}`
  const panelSize = sizeClassFor(size)
  const panelClass = `relative w-full ${panelSize} max-h-[85vh] overflow-auto bg-white rounded-lg shadow-2xl ring-1 ring-slate-200 transform transition-all duration-200 ${mounted ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-98'} ${className}`

  const portalRoot = getOrCreatePortalRoot()

  const header = title ? (
    <div className="flex items-start justify-between px-4 py-3 border-b">
      <div>
        <div className="text-lg font-semibold text-slate-900">{title}</div>
      </div>
      <div className="flex items-center gap-2">
        {showCloseButton ? (
          <button onClick={onClose} aria-label="Close" className="p-2 rounded hover:bg-slate-100 text-slate-600">
            <X className="w-5 h-5" />
          </button>
        ) : null}
      </div>
    </div>
  ) : null

  const footerNode = footer ? <div className="px-4 py-3 border-t">{footer}</div> : null

  return createPortal(
    <div aria-modal="true" role="dialog" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className={backdropClass} onClick={onClose} />
      <div className={panelClass} onClick={(e) => e.stopPropagation()}>
        {header}
        <div className="p-4">{children}</div>
        {footerNode}
      </div>
    </div>,
    portalRoot
  )
}