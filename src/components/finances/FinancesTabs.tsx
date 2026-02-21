/**
 * FinancesTabs.tsx
 *
 * Tab shell for the Finances page. Provides the tab list and panel switching logic,
 * including the "Insurances" tab added without changing layout or styling.
 */

import React, { useState } from 'react'
import { CreditCard, FileText, DollarSign, Clock, Truck, Shield } from 'lucide-react'
import OverviewPanel from './OverviewPanel'
import LoansPanel from './LoansPanel'
import TaxesPanel from './TaxesPanel'
import TransactionsPanel from './TransactionsPanel'
import LeasesPanel from './LeasesPanel'
import InsurancesPanel from './InsurancesPanel'

/**
 * Type for available tab keys
 */
type TabKey = 'overview' | 'loans' | 'taxes' | 'transactions' | 'leases' | 'insurances'

/**
 * FinancesTabs
 *
 * Renders a horizontal tab bar and the currently selected panel.
 *
 * @returns JSX.Element
 */
export default function FinancesTabs(): JSX.Element {
  const [active, setActive] = useState<TabKey>('overview')

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <DollarSign size={16} /> },
    { key: 'loans', label: 'Loans', icon: <CreditCard size={16} /> },
    { key: 'taxes', label: 'Taxes', icon: <FileText size={16} /> },
    { key: 'transactions', label: 'Transactions', icon: <Clock size={16} /> },
    { key: 'leases', label: 'Leases', icon: <Truck size={16} /> },
    { key: 'insurances', label: 'Insurances', icon: <Shield size={16} /> },
  ]

  /**
   * Renders the panel for a given tab key.
   *
   * @param key active tab key
   * @returns JSX.Element | null
   */
  const renderPanel = (key: TabKey) => {
    switch (key) {
      case 'overview':
        return <OverviewPanel />
      case 'loans':
        return <LoansPanel />
      case 'taxes':
        return <TaxesPanel />
      case 'transactions':
        return <TransactionsPanel />
      case 'leases':
        return <LeasesPanel />
      case 'insurances':
        return <InsurancesPanel />
      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
      <nav className="bg-white rounded-xl p-2 flex items-center gap-2" role="tablist" aria-label="Finances tabs">
        {tabs.map((t) => {
          const isActive = t.key === active
          return (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              aria-pressed={isActive}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive ? 'bg-slate-100 text-slate-900 font-medium' : 'text-slate-600 hover:bg-slate-50'
              }`}
              type="button"
            >
              <span className="opacity-90">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          )
        })}
      </nav>

      <section>{renderPanel(active)}</section>
    </div>
  )
}