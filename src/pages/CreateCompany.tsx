/**
 * CreateCompany.tsx
 *
 * Page that allows newly registered users to create their company and choose a hub.
 */

import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { CityRow, fetchCities, createCompanyWithBootstrap } from '../lib/db'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router'

/**
 * CreateCompanyPage
 *
 * Allows a user to create their company, selecting country and city from public.cities,
 * and bootstraps hubs and starter leases via createCompanyWithBootstrap.
 */
export default function CreateCompanyPage() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [companyName, setCompanyName] = useState('')
  const [cities, setCities] = useState<CityRow[]>([])
  const [countries, setCountries] = useState<string[]>([])
  const [selectedCountry, setSelectedCountry] = useState<string>('')
  const [selectedCityId, setSelectedCityId] = useState<string>('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  /**
   * loadCities
   *
   * Load cities from Supabase public.cities (using real schema).
   */
  async function loadCities() {
    const res = await fetchCities()
    const data = (Array.isArray(res.data) ? res.data : []) as CityRow[]
    setCities(data)

    const uniqCountries = Array.from(
      new Set(
        data
          .map((c) => c.country_name)
          .filter((v): v is string => typeof v === 'string' && v.length > 0)
      )
    )
    setCountries(uniqCountries)

    if (uniqCountries.length > 0) {
      const firstCountry = uniqCountries[0]
      setSelectedCountry(firstCountry)
      const firstCity = data.find((c) => c.country_name === firstCountry)
      if (firstCity && firstCity.id) {
        setSelectedCityId(firstCity.id)
      }
    }
  }

  useEffect(() => {
    loadCities()
  }, [])

  useEffect(() => {
    // When country changes, set the first city of that country by default
    if (!selectedCountry || cities.length === 0) return
    const first = cities.find((c) => c.country_name === selectedCountry && c.id)
    if (first && first.id) {
      setSelectedCityId(first.id)
    }
  }, [selectedCountry, cities])

  /**
   * handleCreate
   *
   * Creates a company for the current user and bootstraps hub + starter lease.
   */
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!companyName || !selectedCountry || !selectedCityId) {
      setError('Please complete all fields.')
      return
    }
    if (!user) {
      setError('You must be signed in.')
      return
    }

    const selectedCity = cities.find((c) => c.id === selectedCityId)
    if (!selectedCity) {
      setError('Please select a valid city.')
      return
    }

    setLoading(true)
    const email = user.email || ''
    const res = await createCompanyWithBootstrap(user.id, email, selectedCity, companyName)
    setLoading(false)

    if (res && (res.status === 200 || res.status === 201)) {
      nav('/dashboard')
    } else {
      setError('Unable to create company. Ensure the database and policies are configured.')
    }
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Create your Company</h2>
        <p className="mb-4 text-black/70">
          Choose a company name and a hub city to start. New companies receive a starting balance
          and a starter truck lease.
        </p>
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
            <label className="block text-sm font-medium">Country</label>
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
            <button type="submit" className="px-4 py-2 bg-black text-yellow-400 rounded font-semibold">
              {loading ? 'Creating...' : 'Create Company'}
            </button>
            <button type="button" onClick={() => nav('/')} className="text-sm underline">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </Layout>
  )
}