/**
 * Home.tsx
 *
 * Public landing page for Tracktopia. Orchestrates hero, live stats and marketing sections.
 */

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { getTable } from '../lib/supabase'
import Hero from '../components/home/Hero'
import StatsGrid from '../components/home/StatsGrid'
import Features from '../components/home/Features'
import Screenshots from '../components/home/Screenshots'
import Reviews from '../components/home/Reviews'
import FooterCta from '../components/home/FooterCta'

/**
 * HomePage
 *
 * Renders the main marketing landing with live statistics from Supabase.
 */
export default function HomePage() {
  const nav = useNavigate()
  const [stats, setStats] = useState({
    activeUsers: 0,
    activeTrucks: 0,
    totalJobs: 0,
    totalCities: 0,
  })

  /**
   * fetchStats
   *
   * Read the pre-aggregated counts row from a stats_counts table/view and map it
   * to the local stats state. This avoids querying protected underlying tables
   * directly (which triggers RLS / 401). We try several common view names for
   * robustness and select only the count columns for id=1.
   */
  /**
   * fetchStats
   *
   * Read pre-aggregated counts from several common view/table names. If a
   * pre-aggregated row is not available, fall back to reading the job_offers
   * table directly via PostgREST and obtain the total row count using the
   * Content-Range header (Range: 0-0). This ensures the "Total Jobs" card
   * shows the real number of rows in job_offers even when no stats view exists.
   */
  async function fetchStats() {
    const candidates = ['stats_counts_table', 'stats_counts', 'stats_counts_view', 'stats_counts_table_view']

    try {
      for (const name of candidates) {
        try {
          const res = await getTable(name, '?select=users_count,trucks_count,jobs_count,cities_count&id=eq.1')
          const rows = Array.isArray(res.data) ? res.data : []
          if (rows.length > 0) {
            const row = rows[0] as any
            setStats({
              activeUsers: Number(row.users_count ?? 0),
              activeTrucks: Number(row.trucks_count ?? 0),
              totalJobs: Number(row.jobs_count ?? 0),
              totalCities: Number(row.cities_count ?? 0),
            })
            return
          }
        } catch (e) {
          // try next candidate
          // eslint-disable-next-line no-console
          console.debug(`HomePage: stats fetch failed for ${name}`, e)
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.debug('HomePage: fetchStats unexpected error', err)
    }

    /**
     * Fallback: query job_offers directly using PostgREST and read the
     * Content-Range header to obtain the total number of rows.
     *
     * Note: we embed the public REST URL and anon key here to match the other
     * market code which also uses the public REST endpoint. This is a pragmatic
     * fallback for the preview environment.
     */
    try {
      const API_BASE = 'https://iiunrkztuhhbdgxzqqgq.supabase.co'
      const SUPABASE_ANON_KEY =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpdW5ya3p0dWhoYmRneHpxcWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyOTY5MDksImV4cCI6MjA4Mjg3MjkwOX0.PTzYmKHRE5A119E5JD9HKEUSg7NQZJlAn83ehKo5fiM'

      const url = `${API_BASE}/rest/v1/job_offers?select=id`
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          // Request minimal rows but ask for range so PostgREST returns Content-Range
          Range: '0-0',
        },
      })

      if (res.ok) {
        // Content-Range example: "0-0/123"
        const cr = res.headers.get('content-range') || res.headers.get('Content-Range')
        if (cr) {
          const parts = cr.split('/')
          const total = parts.length === 2 ? Number(parts[1]) : NaN
          if (!Number.isNaN(total)) {
            setStats((s) => ({ ...s, totalJobs: total }))
            return
          }
        }

        // As a last resort, if Content-Range is missing, parse JSON length with a large Range
        const data = await res.json().catch(() => null)
        if (Array.isArray(data)) {
          setStats((s) => ({ ...s, totalJobs: data.length }))
          return
        }
      } else {
        // eslint-disable-next-line no-console
        console.debug('HomePage: job_offers count fetch failed', res.status, await res.text().catch(() => ''))
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.debug('HomePage: job_offers count fallback error', err)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-50 via-white to-white text-black">
      <Hero
        onStart={() => nav('/register')}
        onSignIn={() => nav('/login')}
      />

      <main className="max-w-7xl mx-auto px-6 -mt-8">
        <section className="mb-10">
          <StatsGrid stats={stats} />
        </section>

        <section className="mb-12">
          <Features />
        </section>

        <section className="mb-12">
          <Screenshots />
        </section>

        <section className="mb-16">
          <Reviews />
        </section>
      </main>

      <FooterCta onStart={() => nav('/register')} />
    </div>
  )
}