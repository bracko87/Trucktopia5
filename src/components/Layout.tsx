/**
 * Layout.tsx
 *
 * Authenticated page layout: Header, Sidebar, Content, Footer.
 *
 * This layout accepts an optional `fullWidth` prop so pages (like Trucks)
 * can opt out of the centered max-width container and span the full available width.
 */

import React, { ReactNode } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import Footer from './Footer'

/**
 * LayoutProps
 *
 * Props for the Layout component.
 */
interface LayoutProps {
  children: ReactNode
  /**
   * fullWidth
   *
   * When true the page content is not constrained by the centered max-width
   * container and can span the full available width. Default: false.
   */
  fullWidth?: boolean
}

/**
 * Layout
 *
 * Wraps content with a consistent header, sidebar, and footer.
 *
 * @param props - LayoutProps
 */
export default function Layout({ children, fullWidth = false }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-8">
          {/* Choose between a centered max-width container or full-width content */}
          {fullWidth ? (
            <div className="w-full">{children}</div>
          ) : (
            <div className="max-w-6xl mx-auto w-full">{children}</div>
          )}
        </main>
      </div>
      <Footer />
    </div>
  )
}
