/**
 * StaffFilterContext.tsx
 *
 * Provides a small global filter store for staff-related filters (currently: country).
 * This allows the Country filter to be shared and applied across all pages.
 */

import React from 'react'

/**
 * StaffFilterState
 *
 * Shape of the staff filters stored in context.
 */
export interface StaffFilterState {
  country: string
  setCountry: (c: string) => void
}

const STORAGE_KEY = 'global_staff_filters_v1'

/**
 * loadInitial
 *
 * Load persisted filter values from localStorage, falling back to safe defaults.
 *
 * @returns initial filter state
 */
function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { country: 'all' }
    const parsed = JSON.parse(raw)
    return { country: typeof parsed?.country === 'string' ? parsed.country : 'all' }
  } catch {
    return { country: 'all' }
  }
}

const StaffFilterContext = React.createContext<StaffFilterState | undefined>(undefined)

/**
 * StaffFilterProvider
 *
 * Wrap your app with this provider to expose the global staff filters.
 *
 * @param props.children React children
 */
export function StaffFilterProvider({ children }: { children: React.ReactNode }) {
  const initial = React.useMemo(() => loadInitial(), [])
  const [country, setCountry] = React.useState<string>(initial.country)

  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ country }))
    } catch {
      // ignore storage errors
    }
  }, [country])

  const value = React.useMemo(
    () => ({
      country,
      setCountry,
    }),
    [country]
  )

  return <StaffFilterContext.Provider value={value}>{children}</StaffFilterContext.Provider>
}

/**
 * useStaffFilter
 *
 * Hook to access and update the global staff filters.
 *
 * @returns StaffFilterState
 */
export function useStaffFilter(): StaffFilterState {
  const ctx = React.useContext(StaffFilterContext)
  if (!ctx) {
    throw new Error('useStaffFilter must be used within a StaffFilterProvider')
  }
  return ctx
}
