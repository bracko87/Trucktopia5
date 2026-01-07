/**
 * Company.tsx
 *
 * Company dashboard page. Shows basic company overview and quick stats.
 */

import React from 'react'

/**
 * CompanyPage
 *
 * Placeholder company dashboard. Replace with real data views as needed.
 */
export default function CompanyPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">My Company</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg p-4 shadow">
          <div className="text-sm text-gray-500">Company name</div>
          <div className="text-lg font-semibold">Acme Logistics</div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow">
          <div className="text-sm text-gray-500">Employees</div>
          <div className="text-lg font-semibold">24</div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow">
          <div className="text-sm text-gray-500">Fleet size</div>
          <div className="text-lg font-semibold">12 trucks</div>
        </div>
      </div>
    </div>
  )
}