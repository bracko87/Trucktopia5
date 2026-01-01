/**
 * CreateCompany.tsx
 *
 * Page that allows newly registered users to create their company and choose a hub.
 */

import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { getTable, insertRow } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router'

/**
 * CityRow
 *
 * Represents a city row in public.cities.
 */
interface CityRow {
  id: number
  country: string
  city: string
}

/**
 * CreateCompanyPage
 *
 * Allows a user to create their company, selecting country and city from public.cities.
 */
export default function CreateCompanyPage() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [companyName, setCompanyName] = useState('')
  const [cities, setCities] = useState<CityRow[]>([])
  const [countries, setCountries] = useState<string[]>([])
  const [selectedCountry, setSelectedCountry] = useState<string>('')
  const [selectedCity, setSelectedCity] = useState<string>('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  /**
   * fetchCities
   *
   * Load cities from Supabase public.cities.
   */
  async function fetchCities() {
    const res = await getTable('cities', '?select=country,city,id&order=country.asc')
    const data = res.data || []
    setCities(data)
    const uniq = Array.from(new Set(data.map((d: CityRow) => d.country)))
    setCountries(uniq)
    if (uniq.length) setSelectedCountry(uniq[0])
  }

  useEffect(() => {
    fetchCities()
  }, [])

  useEffect(() => {
    // when country changes, set the first city of that country by default
    const first = cities.find((c) => c.country === selectedCountry)
    if (first) setSelectedCity(first.city)
  }, [selectedCountry, cities])

  /**
   * handleCreate
   *
   * Insert a company row linked to the authenticated user.
   */
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!companyName || !selectedCountry || !selectedCity) {
      setError('Please complete all fields.')
      return
    }
    if (!user) {
      setError('You must be signed in.')
      return
    }
    setLoading(true)
    const row = {
      owner_id: user.id,
      name: companyName,
      country: selectedCountry,
      city: selectedCity,
    }
    const res = await insertRow('companies', row)
    setLoading(false)
    if (res && (res.status === 201 || res.status === 200)) {
      nav('/dashboard')
    } else {
      setError('Unable to create company. Ensure the database and policies are configured.')
    }
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Create your Company</h2>
        <p className="mb-4 text-black/70">Choose a company name and a hub city to start.</p>
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
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full border px-3 py-2 rounded"
            >
              {cities
                .filter((c) => c.country === selectedCountry)
                .map((c) => (
                  <option key={c.id} value={c.city}>
                    {c.city}
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
