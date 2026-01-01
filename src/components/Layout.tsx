/**
 * Layout.tsx
 *
 * Authenticated page layout: Header, Sidebar, Content, Footer.
 */

import React, { ReactNode } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import Footer from './Footer'

/**
 * LayoutProps
 *
 * Child content for the layout.
 */
interface LayoutProps {
  children: ReactNode
}

/**
 * Layout
 *
 * Wraps content with a consistent header, sidebar, and footer.
 *
 * Note:
 * - AuthProvider is provided at the application root (App.tsx). Do not wrap here to avoid nested providers.
 */
export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-white text-black">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
      <Footer />
    </div>
  )
}
