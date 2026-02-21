import React, { ReactNode } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import Footer from './Footer'

interface LayoutProps {
  children: ReactNode
  fullWidth?: boolean
}

export default function Layout({
  children,
  fullWidth = false,
}: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 overflow-x-hidden">
      <Header />

      <div className="flex flex-1 min-w-0">
        <Sidebar />

        {/* IMPORTANT: min-w-0 prevents overflow */}
        <main className="flex-1 p-8 min-w-0">
          {fullWidth ? (
            <div className="w-full min-w-0">{children}</div>
          ) : (
            <div className="max-w-6xl mx-auto w-full min-w-0">
              {children}
            </div>
          )}
        </main>
      </div>

      <Footer />
    </div>
  )
}
