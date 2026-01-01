/**
 * Footer.tsx
 *
 * Simple footer used on authenticated pages.
 */

import React from 'react'

/**
 * Footer
 *
 * Renders app footer.
 */
export default function Footer() {
  return (
    <footer className="mt-auto bg-white border-t border-black/10 text-black py-3 px-6">
      <div className="max-w-7xl mx-auto flex justify-between text-sm">
        <div>© {new Date().getFullYear()} Tracktopia</div>
        <div>Built with ♥ for trucking managers</div>
      </div>
    </footer>
  )
}
