import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { fetchCities, insertCity, CityRow } from '../lib/db'

export default function SeedCitiesPage(): JSX.Element {
  const [cities, setCities] = useState<CityRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const res: any = await fetchCities()
      const data = Array.isArray(res?.data) ? res.data : []
      setCities(data)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load cities')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sample: CityRow[] = [
    { city_name: 'Colombo', country_code: 'LK', country_name: 'Sri Lanka', lat: 6.9271, lon: 79.8612 },
    { city_name: 'Kandy', country_code: 'LK', country_name: 'Sri Lanka', lat: 7.2906, lon: 80.6337 },
    { city_name: 'Galle', country_code: 'LK', country_name: 'Sri Lanka', lat: 6.0535, lon: 80.2210 },
  ]

  async function handleSeed() {
    setLoading(true)
    setError(null)
    try {
      for (const c of sample) {
        // best-effort insert; ignore individual failures
        // insertCity uses the same supabase helper as the app
        // eslint-disable-next-line no-await-in-loop
        await insertCity(c)
      }
      await load()
    } catch (err: any) {
      setError(err?.message ?? 'Seed failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Seed Cities (dev)</h1>

        <p className="mb-4 text-sm text-black/70">
          Developer utility to insert a few example cities into public.cities. Use a service role key when running on
          production environments.
        </p>

        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={handleSeed}
            disabled={loading}
            className="px-4 py-2 bg-black text-yellow-400 rounded font-semibold"
          >
            {loading ? 'Seeding...' : 'Seed example cities'}
          </button>

          <button onClick={load} className="px-3 py-2 border rounded">
            Refresh list
          </button>
        </div>

        {error && <div className="mb-3 text-red-600">{error}</div>}

        <div className="bg-white rounded shadow p-4">
          <h2 className="font-semibold mb-2">Existing cities</h2>
          {cities.length === 0 ? (
            <div className="text-sm text-gray-500">No cities found</div>
          ) : (
            <ul className="space-y-2 text-sm">
              {cities.map((c) => (
                <li key={c.id ?? `${c.city_name}-${c.country_name}`}>
                  <div className="font-medium">{c.city_name}</div>
                  <div className="text-xs text-gray-600">
                    {c.country_name} — {c.lat ?? '—'},{' '}
                    {c.lon ?? '—'}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Layout>
  )
}