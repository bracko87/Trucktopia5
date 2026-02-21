import React from 'react'
import { createRoot, Root } from 'react-dom/client'
import LeaseConfirmModal from './LeaseConfirmModal'

interface LeaseButtonPortalProps {
  modelId?: string | null
  className?: string
  title?: string
  originalText?: string
}

function LeaseButtonPortal({ modelId, className, title, originalText }: LeaseButtonPortalProps) {
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
        onClick={() => setOpen(true)}
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

/**
 * Robust ID lookup
 */
function extractModelIdFromElement(el: Element | null): string | null {
  if (!el) return null

  // 1. climb upward
  let cur: Element | null = el
  while (cur) {
    const id =
      cur.getAttribute('data-asset-model-id') ||
      cur.getAttribute('data-model-id') ||
      cur.getAttribute('data-master-truck-id')

    if (id) return id
    cur = cur.parentElement
  }

  // 2. search nearest container
  const container = el.closest('[data-asset-model-id]')
  if (container) {
    return container.getAttribute('data-asset-model-id')
  }

  // 3. search inside parent subtree
  const subtree = el.parentElement?.querySelector(
    '[data-asset-model-id]'
  )
  if (subtree) {
    return subtree.getAttribute('data-asset-model-id')
  }

  console.warn('Lease injector: no model id found', el)
  return null
}

function mountReactButtonForOriginal(original: HTMLButtonElement) {
  try {
    if ((original as any).__lease_portal_installed) return
    ;(original as any).__lease_portal_installed = true

    const className = original.className
    const title =
      original.getAttribute('title') ??
      original.getAttribute('aria-label') ??
      undefined

    const originalText = original.textContent?.trim() ?? undefined

    const modelId = extractModelIdFromElement(original)

    original.style.display = 'none'

    const container = document.createElement('div')
    container.className = 'lease-portal-container'
    original.parentNode?.insertBefore(container, original.nextSibling)

    const root: Root = createRoot(container)
    root.render(
      <LeaseButtonPortal
        modelId={modelId}
        className={className}
        title={title}
        originalText={originalText}
      />
    )
  } catch (e) {
    console.debug('LeaseTruck injector mount error', e)
  }
}

export default function LeaseTruckButtonHider(): JSX.Element | null {
  const observerRef = React.useRef<MutationObserver | null>(null)

  React.useEffect(() => {
    const initial = Array.from(
      document.querySelectorAll('button[aria-label="Lease Truck"]')
    ) as HTMLButtonElement[]

    initial.forEach((b) => mountReactButtonForOriginal(b))

    observerRef.current = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList' && m.addedNodes.length > 0) {
          m.addedNodes.forEach((node) => {
            if (!(node instanceof Element)) return

            if (node.matches?.('button[aria-label="Lease Truck"]')) {
              mountReactButtonForOriginal(node as HTMLButtonElement)
              return
            }

            const found = Array.from(
              node.querySelectorAll('button[aria-label="Lease Truck"]')
            ) as HTMLButtonElement[]

            found.forEach((b) => mountReactButtonForOriginal(b))
          })
        }
      }
    })

    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
    })

    return () => observerRef.current?.disconnect()
  }, [])

  return null
}
