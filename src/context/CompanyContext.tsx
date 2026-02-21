/**
 * CompanyContext.tsx
 *
 * Resolves active company from the local users table using
 * auth_user_id -> users.company_id mapping.
 */

import React from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'

export interface CompanyShape {
  id: string | null
  [k: string]: any
}

export function useCompany(): { company: CompanyShape | null; loading: boolean } {
  const { user } = useAuth()

  const [company, setCompany] = React.useState<CompanyShape | null>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    let mounted = true

    async function loadCompany() {
      if (!user?.id) {
        setCompany(null)
        return
      }

      setLoading(true)

      const { data, error } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (!mounted) return

      if (error) {
        console.debug('CompanyContext load error', error)
        setCompany(null)
      } else {
        setCompany({ id: data?.company_id ?? null })
      }

      setLoading(false)
    }

    loadCompany()

    return () => {
      mounted = false
    }
  }, [user?.id])

  return { company, loading }
}
