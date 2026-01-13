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
      // fail silently for demo
      // eslint-disable-next-line no-console
      console.debug('HomePage: fetchStats unexpected error', err)
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