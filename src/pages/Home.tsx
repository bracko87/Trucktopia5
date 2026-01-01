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
   * Load counts from Supabase tables to display live numbers.
   */
  async function fetchStats() {
    try {
      const [usersRes, trucksRes, jobsRes, citiesRes] = await Promise.all([
        getTable('users', '?select=id'),
        getTable('trucks', '?select=id'),
        getTable('jobs', '?select=id'),
        getTable('cities', '?select=id'),
      ])
      setStats({
        activeUsers: Array.isArray(usersRes.data) ? usersRes.data.length : 0,
        activeTrucks: Array.isArray(trucksRes.data) ? trucksRes.data.length : 0,
        totalJobs: Array.isArray(jobsRes.data) ? jobsRes.data.length : 0,
        totalCities: Array.isArray(citiesRes.data) ? citiesRes.data.length : 0,
      })
    } catch (err) {
      // fail silently - keep zeros for demo
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
