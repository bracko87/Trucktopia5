/**
 * CustomizeCompany.tsx
 *
 * Page for customizing a company's display name and logo.
 * - Supports file upload or entering an image URL.
 * - Shows a 16:9 preview.
 * - Persists name and logo as two independent operations (separate buttons).
 * - Uses in-file non-blocking toast notifications instead of alert/popups.
 */

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import Layout from '../../components/Layout'
import { useAuth } from '../../context/AuthContext'
import { supabaseFetch } from '../../lib/supabase'

/**
 * Toast type
 *
 * Simple in-file notification type for non-blocking messages.
 */
type Toast = {
  id: string
  message: string
  kind?: 'info' | 'success' | 'error'
}

/**
 * isValidImageUrl
 *
 * Basic check to determine if a provided string looks like an image URL.
 *
 * @param url - candidate URL
 * @returns boolean whether the url looks like an image link
 */
function isValidImageUrl(url: string) {
  try {
    const u = new URL(url)
    return /\.(jpg|jpeg|png|webp|gif|avif|svg)$/i.test(u.pathname)
  } catch {
    return false
  }
}

/**
 * CustomizeCompanyPage
 *
 * Page allowing change of company name and logo with two separate save actions.
 *
 * Key behaviours:
 * - On mount fetches the user's company row and uses it as authoritative defaults.
 * - The "Save name" button only updates name (won't send empty values).
 * - The "Save logo" button only updates company_image_url (won't touch name).
 * - All user-facing messages use non-blocking toasts (no alert/popups).
 *
 * @returns JSX.Element
 */
export default function CustomizeCompanyPage(): JSX.Element {
  const nav = useNavigate()
  const { user: authUser } = useAuth() as any

  const [name, setName] = useState<string>('')
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoSourceType, setLogoSourceType] = useState<'file' | 'url' | null>(null)
  const [logoUrlInput, setLogoUrlInput] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [savingName, setSavingName] = useState<boolean>(false)
  const [savingLogo, setSavingLogo] = useState<boolean>(false)
  const [originalCompany, setOriginalCompany] = useState<{ id?: string; name?: string | null; image?: string | null } | null>(null)
  const [loadingCompany, setLoadingCompany] = useState<boolean>(true)

  const [toasts, setToasts] = useState<Toast[]>([])

  /**
   * pushToast
   *
   * Add a toast message with auto-dismiss.
   *
   * @param message - text to show
   * @param kind - visual kind (info|success|error)
   */
  function pushToast(message: string, kind: Toast['kind'] = 'info') {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    setToasts((t) => [...t, { id, message, kind }])
    // auto remove after 4s
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id))
    }, 4000)
  }

  /**
   * removeToast
   *
   * Remove toast by id manually (if needed).
   *
   * @param id - toast id
   */
  function removeToast(id: string) {
    setToasts((t) => t.filter((x) => x.id !== id))
  }

  /**
   * fetchUserRow
   *
   * Attempts to fetch a users row (id + company_id) using multiple strategies:
   * 1. If authUser already carries a public id (common shapes) return it.
   * 2. If we have an auth uid (auth_user_id / uid / id) query by auth_user_id.
   * 3. If we have an email, query by email as fallback.
   *
   * @returns object with maybe publicUserId and maybe companyId
   */
  async function fetchUserRow(): Promise<{ publicUserId?: string | null; companyId?: string | null } | null> {
    const maybe =
      (authUser && (authUser.id || authUser.user?.id || authUser.publicId || authUser.public_user_id)) ||
      null
    if (typeof maybe === 'string' && maybe.length > 0) {
      try {
        const res = await supabaseFetch(`/rest/v1/users?id=eq.${encodeURIComponent(maybe)}&select=id,company_id&limit=1`)
        if (res?.status >= 200 && res?.status < 300 && Array.isArray(res.data) && res.data[0]) {
          return { publicUserId: res.data[0].id, companyId: res.data[0].company_id ?? null }
        }
      } catch {
        return { publicUserId: maybe, companyId: null }
      }
    }

    const authUid = authUser?.auth_user_id || authUser?.uid || authUser?.id || null
    if (authUid) {
      try {
        const res = await supabaseFetch(
          `/rest/v1/users?auth_user_id=eq.${encodeURIComponent(authUid)}&select=id,company_id&limit=1`
        )
        if (res?.status >= 200 && res?.status < 300 && Array.isArray(res.data) && res.data[0]) {
          return { publicUserId: res.data[0].id, companyId: res.data[0].company_id ?? null }
        }
      } catch {
        // ignore and continue
      }
    }

    const email = authUser?.email || null
    if (email) {
      try {
        const res = await supabaseFetch(`/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=id,company_id&limit=1`)
        if (res?.status >= 200 && res?.status < 300 && Array.isArray(res.data) && res.data[0]) {
          return { publicUserId: res.data[0].id, companyId: res.data[0].company_id ?? null }
        }
      } catch {
        // ignore
      }
    }

    return null
  }

  /* --- Mount: load local draft, then fetch authoritative company row and populate input --- */
  useEffect(() => {
    // Load local draft first (fallback)
    const s = JSON.parse(localStorage.getItem('companyDraft') || '{}')
    if (s) {
      if (s.name) setName(s.name)
      if (s.logo) {
        setLogoPreview(s.logo)
        setLogoSourceType(typeof s.logo === 'string' && s.logo.startsWith('data:') ? 'file' : 'url')
        if (!(typeof s.logo === 'string' && s.logo.startsWith('data:'))) setLogoUrlInput(s.logo)
      }
    }

    let mounted = true
    ;(async function fetchCompany() {
      setLoadingCompany(true)
      try {
        const userRow = await fetchUserRow()
        if (!mounted || !userRow) {
          setLoadingCompany(false)
          return
        }

        let companyId = userRow.companyId ?? null
        if (!companyId && userRow.publicUserId) {
          try {
            const ur = await supabaseFetch(
              `/rest/v1/users?id=eq.${encodeURIComponent(userRow.publicUserId)}&select=company_id&limit=1`
            )
            if (ur && ur.status >= 200 && ur.status < 300 && Array.isArray(ur.data) && ur.data[0]) {
              companyId = ur.data[0].company_id ?? null
            }
          } catch {
            // ignore
          }
        }

        if (!companyId) {
          setLoadingCompany(false)
          return
        }

        const compRes = await supabaseFetch(
          `/rest/v1/companies?id=eq.${encodeURIComponent(companyId)}&select=id,name,company_image_url&limit=1`
        )
        if (!(compRes && compRes.status >= 200 && compRes.status < 300)) {
          setLoadingCompany(false)
          return
        }
        const comp = Array.isArray(compRes.data) && compRes.data[0] ? compRes.data[0] : null
        if (!comp) {
          setLoadingCompany(false)
          return
        }

        if (mounted) {
          setOriginalCompany({ id: comp.id, name: comp.name ?? null, image: comp.company_image_url ?? null })
          // Use server-provided name as authoritative default (only if present)
          setName(comp.name ?? '')
          if (comp.company_image_url) {
            setLogoPreview(comp.company_image_url)
            setLogoSourceType('url')
            setLogoUrlInput(comp.company_image_url)
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('CustomizeCompany: failed to fetch company', err)
        pushToast('Failed to fetch current company info', 'error')
      } finally {
        setLoadingCompany(false)
      }
    })()

    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser])

  /**
   * handleFile
   *
   * Validate file and create preview (demo).
   *
   * @param f - optional File object
   */
  function handleFile(f?: File) {
    setError(null)
    if (!f) return
    const allowed = ['image/jpeg', 'image/png']
    if (!allowed.includes(f.type)) {
      setError('Only JPG and PNG are allowed.')
      return
    }
    if (f.size > 1_048_576) {
      setError('File must be 1MB or smaller.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setLogoPreview(reader.result as string)
      setLogoSourceType('file')
      setLogoUrlInput('')
    }
    reader.readAsDataURL(f)
  }

  /**
   * handleLogoUrlChange
   *
   * Update URL input state and, if valid, use as preview.
   *
   * @param url - string url value
   */
  function handleLogoUrlChange(url: string) {
    setLogoUrlInput(url)
    setError(null)
    if (!url) {
      // clearing the URL, do not clear file preview if present
      if (logoSourceType === 'url') {
        setLogoPreview(null)
        setLogoSourceType(null)
      }
      return
    }

    // Lenient validation: do not block CDN endpoints without extension
    if (!isValidImageUrl(url)) {
      // no-op; browser will show broken image if invalid
    }

    setLogoPreview(url)
    setLogoSourceType('url')
  }

  /**
   * saveName
   *
   * Persist only the company name (separate task).
   * - Avoid sending null/empty to server to prevent accidental deletion.
   */
  async function saveName() {
    setSavingName(true)
    setError(null)
    try {
      const userRow = await fetchUserRow()
      if (!userRow || !userRow.companyId) {
        pushToast('No company associated with your account. Draft saved locally.', 'error')
        localStorage.setItem('companyDraft', JSON.stringify({ name, logo: logoPreview }))
        setSavingName(false)
        return
      }

      // Do not send an empty name — this prevents accidental deletion. Require non-empty to update.
      if (!name || name.trim().length === 0) {
        pushToast('Company name is empty. Provide a non-empty value to update.', 'info')
        setSavingName(false)
        return
      }

      // Only send name if it changed compared to originalCompany
      if (originalCompany && originalCompany.name === name) {
        pushToast('No changes to company name.', 'info')
        setSavingName(false)
        return
      }

      const payload = { name }

      const patchRes = await supabaseFetch(`/rest/v1/companies?id=eq.${encodeURIComponent(userRow.companyId)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      })

      if (patchRes && patchRes.status >= 200 && patchRes.status < 300) {
        pushToast('Company name updated successfully.', 'success')
        // update original locally to reflect saved state
        setOriginalCompany((o) => ({ ...(o || {}), name }))
        localStorage.setItem('companyDraft', JSON.stringify({ name, logo: logoPreview }))
      } else {
        // eslint-disable-next-line no-console
        console.error('Company name update failed:', patchRes)
        pushToast('Failed to update company name on server. Draft saved locally.', 'error')
        localStorage.setItem('companyDraft', JSON.stringify({ name, logo: logoPreview }))
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Save name error:', err)
      pushToast('Unexpected error. Draft saved locally.', 'error')
      localStorage.setItem('companyDraft', JSON.stringify({ name, logo: logoPreview }))
    } finally {
      setSavingName(false)
    }
  }

  /**
   * saveLogo
   *
   * Persist only the company_image_url (separate task).
   * - This function will NOT touch the name field, preventing accidental name deletion.
   */
  async function saveLogo() {
    setSavingLogo(true)
    setError(null)
    try {
      const userRow = await fetchUserRow()
      if (!userRow || !userRow.companyId) {
        pushToast('No company associated with your account. Draft saved locally.', 'error')
        localStorage.setItem('companyDraft', JSON.stringify({ name, logo: logoPreview }))
        setSavingLogo(false)
        return
      }

      // Only send logo field (allow null to clear logo intentionally)
      const payload: any = { company_image_url: logoPreview || null }

      // If original exists and identical, no-op
      if (originalCompany && (originalCompany.image ?? null) === (logoPreview ?? null)) {
        pushToast('No changes to company logo.', 'info')
        setSavingLogo(false)
        return
      }

      const patchRes = await supabaseFetch(`/rest/v1/companies?id=eq.${encodeURIComponent(userRow.companyId)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      })

      if (patchRes && patchRes.status >= 200 && patchRes.status < 300) {
        pushToast('Company logo updated successfully.', 'success')
        setOriginalCompany((o) => ({ ...(o || {}), image: logoPreview ?? null }))
        localStorage.setItem('companyDraft', JSON.stringify({ name, logo: logoPreview }))
      } else {
        // eslint-disable-next-line no-console
        console.error('Company logo update failed:', patchRes)
        pushToast('Failed to update company logo on server. Draft saved locally.', 'error')
        localStorage.setItem('companyDraft', JSON.stringify({ name, logo: logoPreview }))
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Save logo error:', err)
      pushToast('Unexpected error. Draft saved locally.', 'error')
      localStorage.setItem('companyDraft', JSON.stringify({ name, logo: logoPreview }))
    } finally {
      setSavingLogo(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto p-6">
        {/* Toast container */}
        <div aria-live="polite" className="fixed right-4 top-4 z-50 flex flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`max-w-sm w-full px-4 py-2 rounded shadow text-sm ${
                t.kind === 'success' ? 'bg-emerald-600 text-white' : t.kind === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-white'
              }`}
              role="status"
            >
              <div className="flex justify-between items-start gap-2">
                <div className="truncate">{t.message}</div>
                <button onClick={() => removeToast(t.id)} className="ml-2 text-xs opacity-80">✕</button>
              </div>
            </div>
          ))}
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Customize Company</h2>
          <button onClick={() => nav(-1)} className="px-3 py-1 rounded border text-black">
            Back
          </button>
        </div>

        <div className="bg-white p-6 rounded shadow space-y-6">
          {/* Company name section - separate save button below */}
          <div>
            <label className="text-xs text-slate-600">Company name</label>
            <div className="mt-2">
              <input
                className="w-full px-3 py-2 border rounded text-black"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={loadingCompany ? 'Loading…' : ''}
                aria-label="Company name"
              />
            </div>

            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={saveName}
                disabled={savingName}
                className="px-4 py-2 rounded bg-emerald-600 text-white"
                aria-label="Save company name"
              >
                {savingName ? 'Saving…' : 'Save name'}
              </button>
              {loadingCompany && <div className="text-xs text-slate-500">Fetching current company name…</div>}
            </div>
          </div>

          {/* Logo section - separate save button below */}
          <div>
            <label className="text-xs text-slate-600">Upload logo (JPG/PNG up to 1MB) or provide an image URL</label>

            <div className="flex flex-col md:flex-row md:items-center gap-3 mt-2">
              <div>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                  aria-label="Upload logo file"
                />
                <div className="text-xs text-slate-500 mt-1">Or paste an image URL below</div>
              </div>

              <div className="flex-1">
                <input
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={logoUrlInput}
                  onChange={(e) => handleLogoUrlChange(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-black"
                  aria-label="Logo URL"
                />
              </div>
            </div>

            <div className="mt-3">
              <button
                onClick={saveLogo}
                disabled={savingLogo}
                className="px-4 py-2 rounded bg-sky-600 text-white"
                aria-label="Save company logo"
              >
                {savingLogo ? 'Saving…' : 'Save logo'}
              </button>
            </div>

            {error && <div className="text-xs text-rose-600 mt-2">{error}</div>}
          </div>

          {/* Preview */}
          <div>
            <label className="text-xs text-slate-600">Preview (16:9)</label>

            {/* 16:9 preview using padding-top trick */}
            <div className="mt-2 w-full bg-slate-50 border rounded overflow-hidden">
              <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%' }}>
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="absolute top-0 left-0 w-full h-full object-cover"
                    onError={() => {
                      setError('Failed to load preview image. Please check the URL or try a different file.')
                      pushToast('Failed to load preview image', 'error')
                    }}
                  />
                ) : (
                  <div
                    className="absolute top-0 left-0 w-full h-full flex items-center justify-center text-slate-400"
                    aria-hidden
                  >
                    <div className="text-center">
                      <div className="font-medium">No logo selected</div>
                      <div className="text-xs mt-1">Upload a JPG/PNG or paste an image URL to preview</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => nav(-1)} className="px-3 py-1 rounded border text-black">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}