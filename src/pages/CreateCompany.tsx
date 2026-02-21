/**
 * CreateCompany.tsx
 *
 * Page component allowing a signed-in user to create a new company and ensure
 * the main hub is created/linked correctly.
 *
 * This variant scopes the decorative background to only the page content area by
 * rendering PageBackground as an absolutely positioned, low-z layer inside a
 * relative wrapper. The actual content is placed on a higher z-index so the
 * background acts as the last/back layer for this page only.
 */

import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { type CityRow, fetchCities } from '../lib/db'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router'
import CountryFlag from '../components/common/CountryFlag'
import PageBackground from '../components/PageBackground'

/**
 * CreateCompanyPage
 *
 * Page component allowing a signed-in user to create a new company and ensure
 * the main hub is created/linked correctly.
 */
export default function CreateCompanyPage() {
  const { user } = useAuth()
  const nav = useNavigate()

  const [companyName, setCompanyName] = useState('')
  const [cities, setCities] = useState<CityRow[]>([])
  const [countries, setCountries] = useState<string[]>([])
  const [selectedCountry, setSelectedCountry] = useState('')
  const [selectedCityId, setSelectedCityId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  /**
   * loadCities
   *
   * Fetches cities and initializes the country / city selectors.
   */
  async function loadCities() {
    const res = await fetchCities()
    const data = (Array.isArray(res.data) ? res.data : []) as CityRow[]
    setCities(data)

    const uniqCountries = Array.from(new Set(data.map((c) => c.country_name).filter(Boolean)))
    setCountries(uniqCountries)

    if (uniqCountries.length > 0) {
      setSelectedCountry(uniqCountries[0] as string)
      const firstCity = data.find((c) => c.country_name === uniqCountries[0])
      if (firstCity?.id) setSelectedCityId(firstCity.id)
    }
  }

  useEffect(() => {
    void loadCities()
  }, [])

  useEffect(() => {
    if (!selectedCountry) return
    const first = cities.find((c) => c.country_name === selectedCountry)
    if (first?.id) setSelectedCityId(first.id)
  }, [selectedCountry, cities])

  /**
   * ensureMainHub
   *
   * Ensure the company has a main hub record linked and owned correctly.
   *
   * @param companyId - created company id
   * @param uid - auth user id
   * @param city - selected CityRow to populate hub fields
   */
  async function ensureMainHub(companyId: string, uid: string, city: CityRow) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: existingHub } = await supabase
        .from('hubs')
        .select('id')
        .eq('owner_id', companyId)
        .eq('is_main', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (existingHub?.id) {
        await supabase
          .from('hubs')
          .update({
            city: city.city_name,
            country: city.country_name,
            city_id: city.id ?? null,
            lat: (city as any).lat ?? null,
            lon: (city as any).lon ?? null,
            owner_auth_user_id: uid,
            is_main: true,
            hub_level: 1,
          })
          .eq('id', existingHub.id)

        return
      }

      // small delay then retry
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 120))
    }

    await supabase.from('hubs').insert({
      owner_id: companyId,
      owner_auth_user_id: uid,
      is_main: true,
      hub_level: 1,
      city_id: city.id ?? null,
      city: city.city_name,
      country: city.country_name,
      lat: (city as any).lat ?? null,
      lon: (city as any).lon ?? null,
    })
  }

  /**
   * handleCreate
   *
   * Handles the company creation flow.
   *
   * @param e - form event
   */
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!companyName || !selectedCityId) {
      setError('Please complete all fields.')
      return
    }

    if (!user) {
      setError('You must be signed in.')
      return
    }

    const selectedCity = cities.find((c) => c.id === selectedCityId)
    if (!selectedCity) {
      setError('Invalid city selected.')
      return
    }

    setLoading(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        setError('Your session is not active yet. Please sign in again.')
        return
      }

      const {
        data: { user: authUser },
        error: authErr,
      } = await supabase.auth.getUser()

      if (authErr || !authUser) {
        setError('Not logged in.')
        return
      }

      const uid = authUser.id

      const { data: company, error: compErr } = await supabase
        .from('companies')
        .insert({
          name: companyName.trim(),
          hub_city: selectedCity.city_name,
          hub_country: selectedCity.country_name,
          owner_id: uid,
          owner_auth_user_id: uid,
          email: authUser.email ?? null,
        })
        .select('*')
        .single()

      if (compErr || !company) {
        // eslint-disable-next-line no-console
        console.error('Company insert error:', compErr)
        setError('Unable to create company. Please try again.')
        return
      }

      try {
        await ensureMainHub(company.id, uid, selectedCity)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('ensureMainHub failed (non-fatal):', e)
      }

      const { error: profErr } = await supabase.from('users').upsert(
        {
          auth_user_id: uid,
          email: authUser.email ?? null,
          name: authUser.email ?? null,
          company_id: company.id,
        },
        { onConflict: 'auth_user_id' }
      )

      if (profErr) {
        // eslint-disable-next-line no-console
        console.error('User upsert error:', profErr)
        setError('Company created, but linking to your profile failed.')
        return
      }

      try {
        await supabase.auth.refreshSession()
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('refreshSession failed (non-fatal):', e)
      }

      nav('/dashboard', { replace: true })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('createCompany error:', err)
      setError('Unable to create company. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout fullWidth>
      {/*
        IMPORTANT FIX:
        The wrapper must have height (or min-height). Otherwise the absolutely
        positioned background only fills the content height (form height),
        leaving the rest as plain background.
      */}
      <div className="relative isolate w-full min-h-screen overflow-hidden">
        <PageBackground
          src="https://i.ibb.co/8nwPHcvn/Chat-GPT-Image-Feb-19-2026-10-31-26-AM-2.jpg"
          opacity={0.9}
          fadeColorRGB="255,255,255"
          fadeOpacity={0.9}
          overlayColorRGB="255,255,255"
          overlayOpacity={0.7}
          className="absolute inset-0 z-0 pointer-events-none"
        />

        <div className="max-w-2xl mx-auto relative z-10 px-4 py-10">
          <h2 className="text-2xl font-bold mb-4">Create your Company</h2>

          {error && <div className="text-red-600 mb-3">{error}</div>}

          <form onSubmit={handleCreate} className="space-y-4 bg-white p-6 rounded shadow">
            <div>
              <label className="block text-sm font-medium">Company Name</label>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full border px-3 py-2 rounded"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">
                <div className="flex items-center">
                  <CountryFlag country={selectedCountry} className="w-6 h-4 mr-2" />
                  <span>Country</span>
                </div>
              </label>
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="w-full border px-3 py-2 rounded"
              >
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium">City</label>
              <select
                value={selectedCityId}
                onChange={(e) => setSelectedCityId(e.target.value)}
                className="w-full border px-3 py-2 rounded"
              >
                {cities
                  .filter((c) => c.country_name === selectedCountry)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.city_name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex justify-between items-center">
              <button
                type="submit"
                className="px-4 py-2 bg-black text-yellow-400 rounded font-semibold"
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Company'}
              </button>

              <button type="button" onClick={() => nav('/')} className="text-sm underline">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  )
}