/**
 * HiredStaffCard.tsx
 *
 * Presentational card for a hired_staff entry.
 *
 * - Displays avatar, name, country, experience, fatigue/happiness bars and actionable controls.
 * - Owner identity is derived purely in UI and is never stored or fetched.
 * - Status (Assigned / Unassigned) is derived UI-only and displayed only on owner cards.
 */

import React from 'react'
import ActivityPill from './ActivityPill'
import SalaryModal from './SalaryModal'
import SkillTrainingModal from './SkillTrainingModal'
import ModalShell from '../common/ModalShell'
import { Menu, X, Edit2 } from 'lucide-react'
import { updateStaffSalary } from '@/lib/api/updateStaffSalary'
import { supabase } from '@/lib/supabase'
import ImageUrlField from './ImageUrlField'
import StaffProfileImageField from './StaffProfileImageField'
import AssignPositionForm from './AssignPositionForm'
import StopDrivingButton from './StopDrivingButton'
import StartDrivingButton from './StartDrivingButton'

/**
 * HiredStaffMember
 *
 * Minimal shape for a hired_staff row used by the UI.
 */
export interface HiredStaffMember {
  id: string
  name?: string | null
  role?: string | null
  country_code?: string | null
  hired_at?: string | null
  created_at?: string | null
  experience?: number | null
  experience_years?: number | null
  age?: number | null
  birth_date?: string | null
  dob?: string | null
  activity_id?: string | null
  activity_until?: string | null
  activity?: { id: string; label?: string | null; ui_color?: string | null } | null
  skills?: any[] | null
  monthly_salary?: number | null
  monthly_salary_cents?: number | null
  fatigue?: number | null
  happiness?: number | null
  job_category?: string | null
  available_at?: string | null
  company_id?: string | null
  image_url?: string | null
  imageUrl?: string | null
  avatar_url?: string | null
  photo_url?: string | null
  image?: string | null
  avatar?: string | null
  position_id?: string | null
  position?: {
    id: string
    code: string
    name: string
  } | null
  roles?: any
  staffProfileId?: string | null
  blocks_assignment?: boolean | null
}

/**
 * resolveImageUrl
 *
 * Return the first available image URL from common fields.
 *
 * @param member hired staff member
 * @returns normalized image URL or undefined
 */
function resolveImageUrl(member: HiredStaffMember): string | undefined {
  const candidates = [
    member.image_url,
    member.imageUrl,
    member.avatar_url,
    member.photo_url,
    member.image,
    member.avatar,
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c.trim()
  }
  return undefined
}

/**
 * initialsFromName
 *
 * Derive a single-letter placeholder from the member name (used when image missing).
 *
 * @param name full name
 * @returns single uppercase letter or 'H' fallback
 */
function initialsFromName(name?: string | null): string {
  if (!name) return 'H'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return 'H'
  return parts[0].charAt(0).toUpperCase() || 'H'
}

/**
 * countryCodeToEmoji
 *
 * Convert a 2-letter ISO code to a flag emoji.
 *
 * @param code 2-letter country code
 * @returns emoji string or ''
 */
function countryCodeToEmoji(code?: string | null): string {
  if (!code) return ''
  const c = code.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(c)) return ''
  const first = 0x1f1e6 + (c.charCodeAt(0) - 65)
  const second = 0x1f1e6 + (c.charCodeAt(1) - 65)
  return String.fromCodePoint(first, second)
}

/**
 * inferCountryCode
 *
 * Ensure we only accept a 2-letter form if available.
 *
 * @param input raw country input
 * @returns 2-letter code or undefined
 */
function inferCountryCode(input?: string | null): string | undefined {
  if (!input) return undefined
  const maybe = input.trim().toUpperCase()
  if (/^[A-Z]{2,3}$/.test(maybe)) return maybe.slice(0, 2)
  return undefined
}

/**
 * formatDate
 *
 * Format an ISO timestamp for UI (local string).
 *
 * @param iso iso timestamp
 * @returns formatted string or '—'
 */
function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

/**
 * formatMoney
 *
 * Simple formatter for monthly salary fallback.
 *
 * @param value number in major units
 * @returns formatted currency or '—'
 */
function formatMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
      value
    )
  } catch {
    return `${value}`
  }
}

/**
 * truncate
 *
 * Shorten a string to the requested max length adding an ellipsis when truncated.
 *
 * @param input string to truncate
 * @param max max length
 * @returns truncated string
 */
function truncate(input: string, max: number): string {
  if (input.length <= max) return input
  return input.slice(0, max - 1).trimEnd() + '…'
}

/**
 * normalizePercent
 *
 * Convert a variety of numeric shapes into 0..100 percentage.
 *
 * @param v input value
 * @returns percent or null
 */
function normalizePercent(v: any): number | null {
  if (v == null) return null
  if (typeof v === 'string') {
    const parsed = parseFloat(v)
    if (Number.isNaN(parsed)) return null
    v = parsed
  }
  if (typeof v === 'number') {
    if (v >= 0 && v <= 1) return Math.round(v * 100)
    if (v >= 0 && v <= 100) return Math.round(v)
    return Math.min(100, Math.max(0, Math.round(v)))
  }
  return null
}

/**
 * HiredStaffCard
 *
 * Presentational component showing a hired staff entry with an expandable
 * "More details" section.
 *
 * - Owner badge and status are derived UI-only values (never persisted).
 * - Role pill is shown only for non-owner staff.
 */
export default function HiredStaffCard({
  member,
  onSalaryUpdated,
  currentCategory,
}: {
  member: HiredStaffMember
  onSalaryUpdated?: () => void
  /** Current tab/category from StaffTabs (drivers|mechanics|dispatchers|managers|directors) */
  currentCategory?: string | undefined
}): JSX.Element {
  /**
   * isFounder
   *
   * Canonical founder detection: check for staffProfileId or obvious CEO role.
   */
  const isFounder =
    !!(member as any).staffProfileId ||
    (member.roles?.some((r: any) => {
      if (!r) return false
      if (typeof r === 'string') return r === 'CEO'
      return r.key === 'CEO' || r.code === 'CEO' || r.name === 'CEO'
    }) ?? false)

  /**
   * isOwnerRole
   *
   * Detect common owner/CEO text in the role string. Treat owner cards similarly to founders.
   */
  const rawRole = (member.role ?? '').toString()
  const isOwnerRole =
    rawRole.trim() !== '' && (rawRole.toLowerCase().includes('owner') || rawRole.toLowerCase().includes('ceo'))

  /**
   * isOwnerOrFounder
   *
   * Unified flag used to suppress skills/bonuses/training UI for owner/founder rows.
   */
  const isOwnerOrFounder = isFounder || isOwnerRole

  /**
   * isOwner
   *
   * UI-only identity label: true when the member is the company founder/owner.
   */
  const isOwner = isFounder === true

  /**
   * roleToShow
   *
   * Only show a role pill for non-owner staff; owners should not display a role string.
   */
  const roleToShow = isOwner ? undefined : (member.role ?? undefined)

  const [expanded, setExpanded] = React.useState(false)
  const [salaryOpen, setSalaryOpen] = React.useState(false)
  const [trainingOpen, setTrainingOpen] = React.useState(false)
  /**
   * trainingQuote
   *
   * Persisted preview quote (cost/days) kept on the parent so the modal
   * can unmount/remount without changing the generated preview.
   */
  const [trainingQuote, setTrainingQuote] = React.useState<{ cost: number; days: number } | null>(null)
  const [fireOpen, setFireOpen] = React.useState(false)
  const [vacationOpen, setVacationOpen] = React.useState(false)
  const [vacationMutating, setVacationMutating] = React.useState(false)
  const [assignPositionOpen, setAssignPositionOpen] = React.useState(false)

  const [editingName, setEditingName] = React.useState(false)
  const [nameFirst, setNameFirst] = React.useState('')
  const [nameLast, setNameLast] = React.useState('')
  const [savingName, setSavingName] = React.useState(false)
  const [displayName, setDisplayName] = React.useState<string>(member.name ?? '')

  const staffProfileId = (member as any).staffProfileId ?? (member as any).staff_profile_id ?? null

  React.useEffect(() => {
    let mounted = true
    if (!editingName) return
    async function load() {
      if (!staffProfileId) {
        const parts = (member.name || '').trim().split(/\s+/)
        if (mounted) {
          setNameFirst(parts[0] ?? '')
          setNameLast(parts.slice(1).join(' ') ?? '')
        }
        return
      }
      try {
        const { data } = await supabase.from('staff_profiles').select('first_name,last_name').eq('id', staffProfileId).maybeSingle()
        if (!mounted) return
        if (data) {
          setNameFirst(data.first_name ?? '')
          setNameLast(data.last_name ?? '')
        } else {
          const parts = (member.name || '').trim().split(/\s+/)
          setNameFirst(parts[0] ?? '')
          setNameLast(parts.slice(1).join(' ') ?? '')
        }
      } catch {
        const parts = (member.name || '').trim().split(/\s+/)
        if (mounted) {
          setNameFirst(parts[0] ?? '')
          setNameLast(parts.slice(1).join(' ') ?? '')
        }
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [editingName, staffProfileId, member.name])

  // Avatar handling
  const [imageError, setImageError] = React.useState(false)
  const resolvedFromMember = resolveImageUrl(member)
  const [fetchedImageUrl, setFetchedImageUrl] = React.useState<string | undefined>(undefined)
  const [fetchingImage, setFetchingImage] = React.useState(false)
  const [fetchedCountry, setFetchedCountry] = React.useState<string | undefined>(undefined)
  const [fetchingCountry, setFetchingCountry] = React.useState(false)

  React.useEffect(() => {
    setImageError(false)
  }, [resolvedFromMember, fetchedImageUrl, member?.id])

  React.useEffect(() => {
    let mounted = true

    async function loadPersistedImageAndCountry() {
      setFetchingImage(true)
      setFetchingCountry(true)
      try {
        if (isFounder) {
          if (!staffProfileId) {
            if (mounted) {
              setFetchedImageUrl(undefined)
              setFetchedCountry(undefined)
            }
            return
          }
          const { data, error } = await supabase
            .from('staff_profiles')
            .select('image_url, country_code')
            .eq('id', staffProfileId)
            .maybeSingle()

          if (!mounted || error) return
          const url = (data as any)?.image_url ?? undefined
          const country = (data as any)?.country_code ?? undefined
          if (mounted) {
            setFetchedImageUrl(url)
            setFetchedCountry(country)
          }
        } else {
          if (!member?.id) {
            if (mounted) setFetchedCountry(undefined)
            return
          }
          const { data, error } = await supabase
            .from('hired_staff')
            .select('image_url, country_code')
            .eq('id', member.id)
            .maybeSingle()

          if (!mounted || error) return
          if (mounted) {
            setFetchedImageUrl((data as any)?.image_url ?? undefined)
            setFetchedCountry((data as any)?.country_code ?? undefined)
          }
        }
      } finally {
        if (mounted) {
          setFetchingImage(false)
          setFetchingCountry(false)
        }
      }
    }

    loadPersistedImageAndCountry()
    return () => {
      mounted = false
    }
  }, [member?.id, isFounder, staffProfileId])

  const imageToShow = fetchedImageUrl ?? resolvedFromMember

  const trainedSkillIds = [
    (member as any).skill1_id,
    (member as any).skill2_id,
    (member as any).skill3_id,
  ].filter(Boolean) as string[]

  const slotsUsed = trainedSkillIds.length
  const maxSlots = 3

  const trainingSkillId = (member as any).training_skill_id ?? null
  /**
   * activityId
   *
   * Single source of truth for activity id; default to 'free'.
   */
  const activityId = member.activity?.id ?? member.activity_id ?? 'free'
  /**
   * isBlockingActivity
   *
   * All non-'free' activities are considered blocking for conflicting actions.
   */
  const isBlockingActivity = activityId !== 'free'

  const isTraining = activityId === 'training'
  const trainingUntil = member.activity_until ? new Date(member.activity_until) : null

  const availableAt = member.available_at ? new Date(member.available_at) : null
  const isBlocking = isBlockingActivity
  const isAvailable = activityId === 'free'
  const isVacation = activityId === 'vacation'
  const vacationUntil = member.activity_until ? new Date(member.activity_until) : null

  const isManagerOrDirector = (member.job_category ?? '') === 'managers' || (member.job_category ?? '') === 'directors'
  const isAssignedToPosition = Boolean(member.position_id)

  /**
   * statusLabel
   *
   * Derived UI-only status: 'Assigned' for owners or when a position is assigned; otherwise 'Unassigned'.
   */
  const statusLabel = isOwner ? 'Assigned' : isAssignedToPosition ? 'Assigned' : 'Unassigned'

  const [fetchedPosition, setFetchedPosition] = React.useState<{ id: string; name: string; code?: string } | undefined>(
    undefined
  )
  const [fetchingPosition, setFetchingPosition] = React.useState(false)

  /**
   * fetchedLocation / fetchingLocation
   *
   * Holds the resolved current city for this staff member (when available).
   */
  const [fetchedLocation, setFetchedLocation] = React.useState<{ id: string; name: string } | undefined>(undefined)
  const [fetchingLocation, setFetchingLocation] = React.useState(false)

  /**
   * loadLocation
   *
   * Attempt to load a current location for the staff member.
   * - For founders prefer staff_profiles table when staffProfileId exists (common).
   * - Otherwise look up the hired_staff record for location fields.
   * - If a city id is found, resolve the city's name from the cities table.
   *
   * This effect is intentionally tolerant of multiple possible field names
   * (location_city_id, city_id, current_city_id) to handle schema differences.
   */
  React.useEffect(() => {
    let mounted = true
    async function loadLocation() {
      setFetchingLocation(true)
      try {
        let cityId: string | null = null

        // Prefer staff_profiles lookup for founders
        if (staffProfileId) {
          try {
            const { data, error } = await supabase
              .from('staff_profiles')
              .select('location_city_id, city_id, current_city_id')
              .eq('id', staffProfileId)
              .maybeSingle()
            if (!error && data) {
              // pick first available candidate
              // @ts-ignore possible unknown shaped row
              cityId = (data.location_city_id ?? data.city_id ?? data.current_city_id) ?? null
            }
          } catch {
            // ignore and continue
          }
        }

        // Fall back to hired_staff-based lookup
        if (!cityId && member?.id) {
          try {
            const { data, error } = await supabase
              .from('hired_staff')
              .select('location_city_id, city_id, current_city_id')
              .eq('id', member.id)
              .maybeSingle()
            if (!error && data) {
              // @ts-ignore
              cityId = (data.location_city_id ?? data.city_id ?? data.current_city_id) ?? null
            }
          } catch {
            // ignore
          }
        }

        if (cityId) {
          try {
            const { data: cityData, error: cityError } = await supabase.from('cities').select('id,name').eq('id', cityId).maybeSingle()
            if (!cityError && cityData && mounted) {
              setFetchedLocation({ id: String((cityData as any).id), name: String((cityData as any).name ?? 'Unknown') })
            } else {
              if (mounted) setFetchedLocation(undefined)
            }
          } catch {
            if (mounted) setFetchedLocation(undefined)
          }
        } else {
          if (mounted) setFetchedLocation(undefined)
        }
      } finally {
        if (mounted) setFetchingLocation(false)
      }
    }

    loadLocation()
    return () => {
      mounted = false
    }
  }, [member?.id, staffProfileId])

  React.useEffect(() => {
    let mounted = true
    async function loadPosition() {
      if (!member?.position_id) {
        if (mounted) {
          setFetchedPosition(undefined)
        }
        return
      }
      setFetchingPosition(true)
      try {
        const { data, error } = await supabase
          .from('staff_positions_master')
          .select('id,code,name')
          .eq('id', member.position_id)
          .maybeSingle()

        if (!mounted) return

        if (!error && data) {
          setFetchedPosition({
            id: String((data as any).id),
            name: String((data as any).name ?? ''),
            code: (data as any).code ? String((data as any).code) : undefined,
          })
        } else {
          setFetchedPosition(undefined)
        }
      } catch {
        setFetchedPosition(undefined)
      } finally {
        if (mounted) {
          setFetchingPosition(false)
        }
      }
    }

    loadPosition()
    return () => {
      mounted = false
    }
  }, [member?.position_id])

  const rawCountryInput = fetchedCountry ?? (member.country_code ?? null)
  const code = inferCountryCode(rawCountryInput)
  const emoji = countryCodeToEmoji(code)
  const countryDisplay = code
    ? (function () {
        try {
          // Use Intl.DisplayNames when available for a human friendly region name.
          // @ts-ignore optional runtime
          if (typeof Intl !== 'undefined' && (Intl as any).DisplayNames) {
            // @ts-ignore
            const dn = new (Intl as any).DisplayNames(['en'], { type: 'region' })
            // @ts-ignore
            const name = dn.of(code)
            if (name) return name
          }
        } catch {
          // ignore
        }
        return rawCountryInput ?? 'Unknown'
      })()
    : 'Unknown'

  const flagUrl = code ? `https://flagcdn.com/${code.toLowerCase()}.svg` : undefined

  const hiredAt = member.hired_at ?? member.created_at ?? null
  const displayHired = isFounder ? 'Founder' : hiredAt ? formatDate(hiredAt) : '—'

  const resolvedExperience = member.experience ?? member.experience_years ?? null
  const displayExperience = isFounder ? 'Executive' : resolvedExperience != null ? `${resolvedExperience} yrs` : '—'

  const skills = (function normalizeSkills(memberArg: HiredStaffMember) {
    const raw = (memberArg as any).skills
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((s: any, idx: number) => {
        if (!s) {
          return {
            id: `s_${idx}`,
            code: `skill_${idx}`,
            name: 'Skill',
            rarity: 'common' as const,
            effects: {},
            description: null,
          }
        }
        if (s.id && s.code && s.name) {
          return {
            id: String(s.id),
            code: String(s.code),
            name: String(s.name),
            rarity: s.rarity === 'uncommon' || s.rarity === 'rare' ? s.rarity : 'common',
            effects: s.effects ?? {},
            description: s.description ?? (s.desc ?? null),
          }
        }
        if (typeof s === 'string') {
          return {
            id: `s_${idx}`,
            code: s.toLowerCase().replace(/\s+/g, '_'),
            name: s,
            rarity: 'common' as const,
            effects: {},
            description: null,
          }
        }
        const title = s.title ?? s.name ?? s.label ?? s.skill ?? `Skill ${idx}`
        const desc = s.subtitle ?? s.description ?? s.detail ?? s.info ?? null
        const code = s.code ?? (typeof title === 'string' ? title.toLowerCase().replace(/\s+/g, '_') : `skill_${idx}`)
        const rarity = s.rarity === 'rare' ? 'rare' : s.rarity === 'uncommon' ? 'uncommon' : 'common'
        return {
          id: s.id ? String(s.id) : `s_${idx}`,
          code: String(code),
          name: String(title),
          rarity,
          effects: s.effects ?? {},
          description: desc ?? null,
        } as any
      })
    }

    return []
  })(member)

  const displaySalary = isFounder ? '— (Owner)' : (function resolveSalaryDisplay(memberArg: HiredStaffMember) {
    if (typeof (memberArg as any).salary === 'number' && !Number.isNaN((memberArg as any).salary)) {
      return formatMoney((memberArg as any).salary)
    }
    const sMajor = memberArg.monthly_salary
    if (typeof sMajor === 'number' && !Number.isNaN(sMajor)) return formatMoney(sMajor)
    const sCents = memberArg.monthly_salary_cents
    if (typeof sCents === 'number' && !Number.isNaN(sCents)) return formatMoney(sCents / 100)
    return '—'
  })(member)

  /**
   * fetchedFatigue / fetchedHappiness
   *
   * Stats loaded from staff_profile_stats table when available. These override
   * any values present on the member row so the UI shows canonical profile stats.
   */
  const [fetchedFatigue, setFetchedFatigue] = React.useState<number | null | undefined>(undefined)
  const [fetchedHappiness, setFetchedHappiness] = React.useState<number | null | undefined>(undefined)
  const [fetchingStats, setFetchingStats] = React.useState<boolean>(false)

  /**
   * loadProfileStats
   *
   * Try to load fatigue/happiness from staff_profile_stats. We prefer a lookup
   * by staff_profile_id when available (founder rows) otherwise we fall back to
   * a hired_staff-based lookup. Failures are silent and we keep existing member fields.
   */
  React.useEffect(() => {
    let mounted = true

    async function loadProfileStats() {
      setFetchingStats(true)
      try {
        if (!staffProfileId && !member?.id) return

        let res: any = { data: null, error: null }

        if (staffProfileId) {
          res = await supabase
            .from('staff_profile_stats')
            .select('fatigue,happiness')
            .eq('staff_profile_id', staffProfileId)
            .maybeSingle()
        } else if (member?.id) {
          // When no staff_profile_id exists we still attempt to check by staff id
          // for backward compatibility with older schemas where the id might match.
          res = await supabase
            .from('staff_profile_stats')
            .select('fatigue,happiness')
            .eq('staff_profile_id', member.id)
            .maybeSingle()
        }

        if (!mounted) return

        if (!res.error && res.data) {
          setFetchedFatigue((res.data as any).fatigue ?? null)
          setFetchedHappiness((res.data as any).happiness ?? null)
        }
      } catch {
        // ignore network/errors and fall back to member fields
      } finally {
        if (mounted) setFetchingStats(false)
      }
    }

    loadProfileStats()
    return () => {
      mounted = false
    }
  }, [staffProfileId, member?.id])

  /**
   * Use fetched stats when available, otherwise fall back to values present
   * on the member row (legacy fields).
   */
  const fatiguePercent = normalizePercent(
    fetchedFatigue ?? (member as any).fatigue ?? (member as any).fatigue_level ?? null
  )
  const happinessPercent = normalizePercent(
    fetchedHappiness ?? (member as any).happiness ?? (member as any).happiness_level ?? null
  )

  const [locallyFired, setLocallyFired] = React.useState(false)
  const articleRef = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    if (!articleRef.current) return
    const spanEls = Array.from(articleRef.current.querySelectorAll('span'))
    for (const el of spanEls) {
      try {
        if (el.textContent && el.textContent.trim() === 'Available now') {
          ;(el as HTMLElement).style.display = 'none'
        }
      } catch {
        //
      }
    }

    const smallMutedDivs = Array.from(articleRef.current.querySelectorAll('div.text-xs.text-slate-500'))
    for (const d of smallMutedDivs) {
      try {
        const txt = (d.textContent || '').trim()
        if (txt.includes('Base:') && txt.includes('Fee')) {
          ;(d as HTMLElement).style.display = 'none'
        }
      } catch {
        //
      }
    }
  }, [articleRef, member.id])

  /**
   * Busy notice state and auto-dismiss timer for the popup modal.
   */
  const [busyModalOpen, setBusyModalOpen] = React.useState(false)
  const [busyMessage, setBusyMessage] = React.useState<string | null>(null)
  const busyTimerRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    return () => {
      if (busyTimerRef.current) window.clearTimeout(busyTimerRef.current)
    }
  }, [])

  /**
   * showBusyNotice
   *
   * Show a popup modal that automatically dismisses after a short time.
   */
  function showBusyNotice() {
    setBusyMessage('Staff already Assigned to some another activity, please try later again')
    setBusyModalOpen(true)
    if (busyTimerRef.current) {
      window.clearTimeout(busyTimerRef.current)
    }
    busyTimerRef.current = window.setTimeout(() => {
      setBusyModalOpen(false)
      setBusyMessage(null)
      busyTimerRef.current = null
    }, 3800)
  }

  /**
   * setVacationForDays
   *
   * Helper to set vacation via hired_staff update and optimistic local updates.
   *
   * @param days number of days for vacation
   */
  async function setVacationForDays(days: number) {
    setVacationMutating(true)
    try {
      const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
      const payload: any = {
        available_at: until.toISOString(),
        activity_id: 'vacation',
        activity_until: until.toISOString(),
      }

      const currentHappiness = normalizePercent((member as any).happiness ?? (member as any).happiness_level ?? null) ?? 0
      const currentFatigue = normalizePercent((member as any).fatigue ?? (member as any).fatigue_level ?? null) ?? 0

      const newHappiness = Math.min(100, currentHappiness + 10)
      const newFatigue = Math.max(0, currentFatigue - 35)

      payload.happiness = newHappiness
      payload.fatigue = newFatigue

      const { error } = await supabase.from('hired_staff').update(payload).eq('id', member.id)
      if (error) {
        console.error('Failed to set vacation', error)
        alert(error.message ?? 'Failed to set vacation')
        return
      }

      try {
        if (typeof onSalaryUpdated === 'function') await onSalaryUpdated()
      } catch {
        //
      }

      setVacationOpen(false)
    } finally {
      setVacationMutating(false)
    }
  }

  /**
   * saveName
   *
   * Persist edited name to staff_profiles or hired_staff as appropriate.
   *
   * @returns boolean success
   */
  async function saveName(): Promise<boolean> {
    setSavingName(true)

    try {
      const first = nameFirst?.trim()
      const last = nameLast?.trim()
      if (!first || !last) {
        alert('First and last name are required.')
        return false
      }

      const combined = `${first} ${last}`

      if (staffProfileId) {
        const { error } = await supabase
          .from('staff_profiles')
          .update({
            first_name: first,
            last_name: last,
          })
          .eq('id', staffProfileId)

        if (error) {
          console.error('Failed to update staff_profiles', error)
          alert(error.message ?? 'Failed to update staff profile')
          return false
        }

        setDisplayName(combined)
        setEditingName(false)
        if (typeof onSalaryUpdated === 'function') onSalaryUpdated()
        return true
      }

      const { error } = await supabase.from('hired_staff').update({ name: combined }).eq('id', member.id)

      if (error) {
        console.error('Failed to update hired_staff.name', error)
        alert(error.message ?? 'Failed to update name')
        return false
      }

      setDisplayName(combined)
      setEditingName(false)
      if (typeof onSalaryUpdated === 'function') onSalaryUpdated()
      return true
    } finally {
      setSavingName(false)
    }
  }

  async function handleSaveClick() {
    setSavingName(true)
    try {
      const ok = await saveName()
      if (!ok) return

      if (isFounder) {
        setDisplayName(`${nameFirst?.trim() || ''} ${nameLast?.trim() || ''}`)
        setEditingName(false)
        return
      }

      try {
        const { data, error } = await supabase.from('hired_staff').select('name').eq('id', member.id).maybeSingle()
        if (!error && data && data.name) {
          setDisplayName(String(data.name))
          setEditingName(false)
        } else {
          alert('Name updated locally but backend did not confirm persistence. This may be due to backend permissions (RLS).')
        }
      } catch (e) {
        console.warn('Failed to verify persistence', e)
      }
    } finally {
      setSavingName(false)
    }
  }

  async function clearVacation() {
    setVacationMutating(true)
    try {
      const { error } = await supabase
        .from('hired_staff')
        .update({ available_at: null, activity_id: 'free', activity_until: null })
        .eq('id', member.id)

      if (error) {
        console.error('Failed to clear vacation', error)
        alert(error.message ?? 'Failed to clear vacation')
        return
      }

      try {
        if (typeof onSalaryUpdated === 'function') await onSalaryUpdated()
      } catch {
        //
      }

      setVacationOpen(false)
    } finally {
      setVacationMutating(false)
    }
  }

  async function confirmFire() {
    try {
      const { error } = await supabase.rpc('fire_staff_now', {
        p_staff_id: member.id,
      })

      if (error) {
        console.error(error)
        alert(error.message ?? 'Failed to fire staff')
        return
      }

      setFireOpen(false)
      setLocallyFired(true)

      try {
        if (typeof onSalaryUpdated === 'function') {
          await onSalaryUpdated()
        }
      } catch (e) {
        console.warn('onSalaryUpdated failed after firing staff', e)
      }
    } catch (err: any) {
      console.error(err)
      alert(err.message ?? 'Failed to fire staff')
    }
  }

  /**
   * Handlers that enforce blocking rules at UI level (per your spec).
   *
   * These are UX conveniences only; backend must enforce rules too.
   */

  /**
   * handleOpenTraining
   *
   * Open training modal. Allowed to reopen if already training.
   */
  function handleOpenTraining(e?: React.MouseEvent) {
    try {
      e?.preventDefault()
      e?.stopPropagation()
    } catch {}
    // Locally fired rows should not accept actions
    if (locallyFired) return

    // If staff is in any blocking activity and it's not 'training' then block
    if (isBlockingActivity && activityId !== 'training') {
      showBusyNotice()
      return
    }

    setTrainingOpen(true)
  }

  /**
   * handleOpenVacation
   *
   * Open vacation modal. Allowed to reopen if already vacationing.
   */
  function handleOpenVacation(e?: React.MouseEvent) {
    try {
      e?.preventDefault()
      e?.stopPropagation()
    } catch {}
    if (locallyFired) return

    if (isBlockingActivity && activityId !== 'vacation') {
      showBusyNotice()
      return
    }

    setVacationOpen(true)
  }

  /**
   * handleOpenAssignPosition
   *
   * Open assign position modal. Refuse assignment when member.blocks_assignment is true.
   */
  function handleOpenAssignPosition(e?: React.MouseEvent) {
    try {
      e?.preventDefault()
      e?.stopPropagation()
    } catch {}
    if (locallyFired) return

    // Respect backend-provided hint that assignments are blocked
    if ((member as any).blocks_assignment) {
      alert('Assignment not allowed: staff has a blocking activity.')
      return
    }

    setAssignPositionOpen(true)
  }

  return (
    <article
      ref={articleRef}
      className={`bg-white rounded-xl shadow w-full overflow-hidden min-w-0 transition-opacity ${locallyFired ? 'opacity-50 pointer-events-none' : ''}`}
      aria-disabled={locallyFired}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 w-full divide-y md:divide-y-0 md:divide-x divide-slate-100 rounded-t-xl min-w-0">
        <div className="p-4 flex items-center min-h-[64px]">
          <div className="flex items-center gap-3 w-full">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex-shrink-0 overflow-hidden">
              {imageToShow && !imageError ? (
                // eslint-disable-next-line jsx-a11y/img-redundant-alt
                <img
                  src={imageToShow}
                  alt={member.name ? `${member.name} photo` : 'Staff image'}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm font-semibold text-slate-700">
                  {initialsFromName(displayName || member.name)}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="font-semibold text-slate-900 truncate flex items-center gap-2">
                <span className="truncate">{displayName || member.name}</span>

                {isOwnerOrFounder && (
                  <button
                    type="button"
                    aria-label="Edit name"
                    onClick={() => setEditingName(true)}
                    className="ml-2 inline-flex items-center justify-center w-7 h-7 rounded text-slate-500 hover:bg-slate-100"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}

                {flagUrl ? (
                  <img src={flagUrl} alt={`${countryDisplay} flag`} className="w-5 h-3 object-cover rounded-sm" width={24} height={16} style={{ display: 'inline-block' }} />
                ) : (
                  <span aria-hidden className="text-base">
                    {emoji}
                  </span>
                )}

                <span className="text-sm text-slate-700 truncate">{countryDisplay}</span>
              </div>

              <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                {isOwner ? (
                  <span className="text-sm font-medium px-2 py-1 rounded-full inline-flex items-center gap-2 bg-red-50 text-red-700 border border-red-200">
                    Owner
                  </span>
                ) : (
                  /* Only render a role pill for non-owner staff */
                  roleToShow ? (
                    <span className="text-sm font-medium px-2 py-1 rounded-full inline-flex items-center gap-2 bg-slate-100 text-slate-800 border border-slate-200">
                      {roleToShow}
                    </span>
                  ) : null
                )}

                {/* Status: shown only for owner cards */}
                {isOwner && (
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${statusLabel === 'Assigned' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}
                  >
                    {statusLabel}
                  </span>
                )}

                {/* Activity pill and inline training-until */}
                <div className="flex items-center gap-2">
                  {!(isManagerOrDirector && isAssignedToPosition) ? (
                    <ActivityPill
                      activityId={member.activity?.id ?? member.activity_id ?? undefined}
                      label={member.activity?.label ?? undefined}
                    />
                  ) : null}

                  {isTraining && trainingUntil && (
                    <span className="text-purple-600">
                      Training until <strong>{trainingUntil.toLocaleDateString()}</strong>
                    </span>
                  )}
                </div>

                {isVacation && vacationUntil && (
                  <div className="text-xs text-orange-600 mt-1">
                    Vacation until <strong>{vacationUntil.toLocaleDateString()}</strong>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 flex items-center">
          <div className="w-full">
            <div className="text-sm text-slate-700 font-medium mb-2">
              <span className="font-semibold">Experience:</span>{' '}
              <span className="font-normal">{displayExperience}</span>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="text-sm font-medium">{fatiguePercent == null ? '—' : `${fatiguePercent}%`}</div>
                <div className="w-36 h-2 bg-slate-200 rounded overflow-hidden">
                  <div style={{ width: fatiguePercent == null ? 0 : `${fatiguePercent}%`, background: '#e44', height: '100%', transition: 'width 220ms linear, background 220ms linear' }} />
                </div>
                <div className="text-xs text-slate-500 w-20">Fatigue</div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-sm font-medium">{happinessPercent == null ? '—' : `${happinessPercent}%`}</div>
                <div className="w-36 h-2 bg-slate-200 rounded overflow-hidden">
                  <div style={{ width: happinessPercent == null ? 0 : `${happinessPercent}%`, background: '#22c55e', height: '100%', transition: 'width 220ms linear, background 220ms linear' }} />
                </div>
                <div className="text-xs text-slate-500 w-20">Happiness</div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 flex items-start">
          <div className="flex items-start w-full">
            <div className="text-sm text-slate-700">
              <div>
                <span className="font-semibold">Hired:</span>{' '}
                <span className="font-normal">{displayHired}</span>
              </div>

              {!isFounder ? (
                <>
                  <div
                    className="mt-1 text-sm text-slate-700 cursor-pointer hover:underline"
                    onClick={() => setSalaryOpen(true)}
                  >
                    <span className="font-bold">Salary:</span>{' '}
                    <span className="font-bold text-emerald-700">{displaySalary}</span>
                  </div>

                  {currentCategory === 'drivers' && (
                    <div className="mt-1 text-sm text-slate-700">
                      <span className="font-semibold">Location:</span>{' '}
                      <span className="font-normal">{fetchingLocation ? 'Loading…' : fetchedLocation?.name ?? '—'}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-1 text-sm text-slate-700">
                  <span className="font-bold">no Salary</span>

                  {currentCategory === 'drivers' && (
                    <div className="mt-1">
                      <span className="font-semibold">Location:</span>{' '}
                      <span className="font-normal">{fetchingLocation ? 'Loading…' : fetchedLocation?.name ?? '—'}</span>
                    </div>
                  )}
                </div>
              )}

              {isManagerOrDirector && (
                <div className="mt-1 text-sm text-slate-700">
                  <span className="font-semibold">Assigned:</span>{' '}
                  <span className="font-normal">{fetchedPosition?.name ?? member.position_id ?? '—'}</span>
                </div>
              )}
            </div>

            <div className="ml-auto">
              <button
                aria-expanded={expanded}
                onClick={() => setExpanded((v) => !v)}
                className="inline-flex items-center justify-center w-9 h-9 rounded border border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100"
              >
                {expanded ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={`overflow-hidden transition-[max-height] duration-200 ease-in-out ${expanded ? 'max-h-[520px]' : 'max-h-0'}`} aria-hidden={!expanded}>
        <div className="pt-2 border-t border-slate-100 p-4 bg-white rounded-b-xl">
          <div className="flex items-center justify-between mb-0 gap-4 flex-nowrap">
            {!isOwnerOrFounder ? (
              <div className="flex items-center gap-4 min-w-[120px] flex-shrink-0">
                <div>
                  <div className="text-xs text-slate-500">Age</div>
                  <div className="text-sm text-slate-700 font-medium">{(function resolveAge(memberArg: HiredStaffMember): string {
                    const candidates: Array<any> = [(memberArg as any).age, (memberArg as any).age_years, (memberArg as any).years_old]
                    for (const c of candidates) {
                      if (typeof c === 'number' && !Number.isNaN(c)) return `${c} yrs`
                      if (typeof c === 'string' && /^\d+$/.test(c)) return `${parseInt(c, 10)} yrs`
                    }

                    const birthRaw = (memberArg as any).birth_date ?? (memberArg as any).dob ?? (memberArg as any).birthdate ?? null
                    if (birthRaw) {
                      try {
                        const d = new Date(birthRaw)
                        if (!isNaN(d.getTime())) {
                          const now = new Date()
                          let ag = now.getFullYear() - d.getFullYear()
                          const m = now.getMonth() - d.getMonth()
                          if (m < 0 || (m === 0 && now.getDate() < d.getDate())) ag--
                          if (ag >= 0) return `${ag} yrs`
                        }
                      } catch {
                        //
                      }
                    }

                    return '—'
                  })(member)}</div>
                </div>
              </div>
            ) : null}

            <div className="flex-1 min-w-0 overflow-hidden">
              {!(isOwnerOrFounder) ? (
                <div className="flex gap-2 whitespace-nowrap overflow-x-auto py-1">
                  {skills.length === 0 ? (
                    <div className="text-xs text-slate-500">No Skill</div>
                  ) : (
                    skills.map((s, idx) => (
                      <div key={s.id ?? idx} className="inline-flex items-center gap-2 flex-shrink-0">
                        <div title={s.description ?? undefined} className="inline-flex items-center gap-3 bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{s.name}</span>
                            {s.description ? <span className="text-xs text-slate-500 ml-2">{truncate(s.description, 40)}</span> : null}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            <div className="min-w-[110px] flex-shrink-0" />
          </div>

          {isManagerOrDirector && isAssignedToPosition && fetchedPosition && (
            <div className="mt-3 text-sm text-red-600 font-semibold">
              Assigned Position: {fetchedPosition.name}
            </div>
          )}

          <div className="mt-4 flex items-center gap-2">
            {isOwnerOrFounder ? (
              /**
               * Owner UI: show profile image field and a single "Stop Driving" action
               * placed on the right side. The action edits the staff_profile_roles
               * table to remove any driver role entries for the profile.
               */
              <>
                <StaffProfileImageField
                  staffProfileId={staffProfileId}
                  companyId={member.company_id ?? undefined}
                  initialUrl={(member as any).image_url ?? undefined}
                  onUpdated={async () => {
                    try {
                      const pid = staffProfileId ?? undefined
                      if (pid) {
                        const { data, error } = await supabase
                          .from('staff_profiles')
                          .select('image_url, country_code')
                          .eq('id', pid)
                          .maybeSingle()
                        if (!error && data) {
                          setFetchedImageUrl((data as any).image_url ?? undefined)
                          setFetchedCountry((data as any).country_code ?? undefined)
                        }
                      } else if (member.company_id) {
                        const { data, error } = await supabase
                          .from('staff_profiles')
                          .select('image_url, country_code')
                          .eq('company_id', member.company_id)
                          .order('created_at', { ascending: true })
                          .limit(1)
                          .maybeSingle()
                        if (!error && data) {
                          setFetchedImageUrl((data as any).image_url ?? undefined)
                          setFetchedCountry((data as any).country_code ?? undefined)
                        }
                      }
                    } catch {
                      // ignore
                    }
                    try {
                      if (typeof onSalaryUpdated === 'function') onSalaryUpdated()
                    } catch {
                      // ignore
                    }
                  }}
                />

                <div className="ml-auto">
                  {currentCategory === 'drivers' ? (
                    <StopDrivingButton
                      staffProfileId={staffProfileId}
                      onStopped={onSalaryUpdated}
                    />
                  ) : currentCategory === 'directors' ? (
                    <StartDrivingButton
                      staffProfileId={staffProfileId}
                      onStarted={onSalaryUpdated}
                    />
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <ImageUrlField
                  member={{ id: member.id, image_url: (member as any).image_url ?? null }}
                  onUpdated={() => {
                    ;(async () => {
                      try {
                        const { data, error } = await supabase.from('hired_staff').select('image_url, country_code').eq('id', member.id).maybeSingle()
                        if (!error && data) {
                          setFetchedImageUrl((data as any).image_url ?? undefined)
                          setFetchedCountry((data as any).country_code ?? undefined)
                        }
                      } catch {
                        //
                      }
                    })()
                    try {
                      if (typeof onSalaryUpdated === 'function') onSalaryUpdated()
                    } catch {
                      //
                    }
                  }}
                />

                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    className="text-sm px-3 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                    aria-label="Adjust Salary"
                    onClick={(e) => {
                      try {
                        e.preventDefault()
                        e.stopPropagation()
                      } catch {}
                      setSalaryOpen(true)
                    }}
                    style={{ pointerEvents: locallyFired ? 'none' : 'auto' }}
                  >
                    Salary
                  </button>

                  <button
                    type="button"
                    aria-label="Skill Training"
                    onClick={(e) => {
                      // Defensive click handler:
                      try {
                        e.preventDefault()
                        e.stopPropagation()
                      } catch {}
                      console.debug('HiredStaffCard: Skill Training clicked for', member.id, {
                        trainingSkillId,
                        activityId,
                      })
                      // Block only when staff is in another blocking activity (not training)
                      if (locallyFired) return
                      if (isBlockingActivity && activityId !== 'training') {
                        showBusyNotice()
                        return
                      }
                      setTrainingOpen(true)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        e.stopPropagation()
                        if (locallyFired) return
                        if (isBlockingActivity && activityId !== 'training') {
                          showBusyNotice()
                          return
                        }
                        setTrainingOpen(true)
                      }
                    }}
                    className={`text-sm px-3 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50`}
                    aria-disabled={locallyFired}
                    style={{ pointerEvents: locallyFired ? 'none' : 'auto' }}
                  >
                    Skill Training
                  </button>

                  <button
                    type="button"
                    className="text-sm px-3 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                    aria-label="Vacation"
                    onClick={(e) => {
                      try {
                        e.preventDefault()
                        e.stopPropagation()
                      } catch {}
                      if (!member.id) {
                        alert('Vacation is available only for staff with a hired_staff record.')
                        return
                      }
                      // Block only when staff is in another blocking activity (not vacation)
                      if (locallyFired) return
                      if (isBlockingActivity && activityId !== 'vacation') {
                        showBusyNotice()
                        return
                      }
                      setVacationOpen(true)
                    }}
                    style={{ pointerEvents: locallyFired ? 'none' : 'auto' }}
                  >
                    Vacation
                  </button>

                  <button
                    type="button"
                    className="text-sm px-3 py-1 rounded-md bg-red-50 border border-red-200 text-red-700 hover:bg-red-100"
                    aria-label="Fire staff"
                    onClick={(e) => {
                      try {
                        e.preventDefault()
                        e.stopPropagation()
                      } catch {}
                      if (locallyFired) return
                      setFireOpen(true)
                    }}
                    style={{ pointerEvents: locallyFired ? 'none' : 'auto' }}
                  >
                    Fire
                  </button>

                  {isManagerOrDirector && (
                    <button
                      type="button"
                      className="text-sm px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                      onClick={(e) => {
                        try {
                          e.preventDefault()
                          e.stopPropagation()
                        } catch {}
                        if (locallyFired) return
                        // Assignment should be rejected when backend indicates blocks_assignment
                        if ((member as any).blocks_assignment) {
                          alert('Assignment not allowed: staff has a blocking activity.')
                          return
                        }
                        setAssignPositionOpen(true)
                      }}
                    >
                      {isAssignedToPosition ? 'Change Position' : 'Assign Position'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <ModalShell
        open={editingName}
        onClose={() => setEditingName(false)}
        title="Edit name"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button className="px-4 py-2 text-sm border rounded" onClick={() => setEditingName(false)} disabled={savingName}>
              Cancel
            </button>

            <button
              className="px-4 py-2 text-sm rounded bg-blue-600 text-white"
              onClick={handleSaveClick}
              disabled={savingName}
            >
              {savingName ? 'Saving...' : 'Save'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">First name</label>
            <input
              className="w-full border rounded px-2 py-1"
              value={nameFirst}
              onChange={(e) => setNameFirst(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">Last name</label>
            <input
              className="w-full border rounded px-2 py-1"
              value={nameLast}
              onChange={(e) => setNameLast(e.target.value)}
            />
          </div>

          <div className="text-xs text-slate-500">This change is saved to the staff_profiles table when possible, otherwise it updates the hired_staff.name column.</div>
        </div>
      </ModalShell>

      <SalaryModal
        open={salaryOpen}
        initialSalary={(function extractSalaryNumber(memberArg: HiredStaffMember): number | null {
          if (typeof (memberArg as any).salary === 'number' && !Number.isNaN((memberArg as any).salary)) return (memberArg as any).salary
          if (typeof memberArg.monthly_salary === 'number' && !Number.isNaN(memberArg.monthly_salary)) return memberArg.monthly_salary
          if (typeof memberArg.monthly_salary_cents === 'number' && !Number.isNaN(memberArg.monthly_salary_cents)) return memberArg.monthly_salary_cents / 100
          return null
        })(member)}
        onClose={() => setSalaryOpen(false)}
        onSave={async (val) => {
          await updateStaffSalary(member.id, val)
          setSalaryOpen(false)
          try {
            if (typeof onSalaryUpdated === 'function') {
              await onSalaryUpdated()
            }
          } catch (err) {
            console.error('onSalaryUpdated error', err)
          }
        }}
      />

      {!(isOwnerOrFounder) && (
        <ModalShell open={trainingOpen} onClose={() => setTrainingOpen(false)} title="Skill Training" size="md">
          <SkillTrainingModal
            open={true}
            onClose={() => setTrainingOpen(false)}
            staffId={member.id}
            trainedSkillIds={trainedSkillIds}
            trainingSkillId={trainingSkillId}
            isTraining={isTraining}
            trainingUntil={trainingUntil}
            slotsUsed={slotsUsed}
            maxSlots={maxSlots}
            jobCategory={member.job_category ?? 'drivers'}
            quote={trainingQuote}
            onQuote={(q) => setTrainingQuote(q)}
            onTrain={async (skillId: string) => {
              // Try the newer RPC name first; fall back to legacy if needed.
              const tryRpc = async (name: string) => {
                try {
                  const res = await supabase.rpc(name, {
                    p_staff_id: member.id,
                    p_skill_id: skillId,
                  })
                  if (res.error) throw res.error
                  return res
                } catch (err) {
                  throw err
                }
              }

              let rpcResult: any = null
              try {
                rpcResult = await tryRpc('start_staff_skill_training')
              } catch (e1) {
                // fallback to legacy name
                try {
                  rpcResult = await tryRpc('start_staff_training')
                } catch (e2) {
                  // rethrow original error to be handled by caller/modal
                  throw e2 || e1
                }
              }

              // Notify parent UI to refresh (non-blocking)
              try {
                onSalaryUpdated?.()
              } catch (e) {
                console.warn('onSalaryUpdated failed after training RPC', e)
              }

              // Return RPC result so SkillTrainingModal can read the backend's response.
              // NOTE: modal will handle closing itself after showing receipt.
              return rpcResult.data ?? rpcResult
            }}
            onRemoveSkill={async (skillId: string) => {
              const updates: any = {}

              if ((member as any).skill1_id === skillId) updates.skill1_id = null
              else if ((member as any).skill2_id === skillId) updates.skill2_id = null
              else if ((member as any).skill3_id === skillId) updates.skill3_id = null

              await supabase.from('hired_staff').update(updates).eq('id', member.id)

              onSalaryUpdated?.()
            }}
          />
        </ModalShell>
      )}

      <ModalShell
        open={assignPositionOpen}
        onClose={() => setAssignPositionOpen(false)}
        title="Assign Position"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button
              className="px-4 py-2 text-sm border rounded"
              onClick={() => setAssignPositionOpen(false)}
            >
              Cancel
            </button>
          </div>
        }
      >
        <AssignPositionForm
          staffId={member.id}
          currentPositionId={member.position_id ?? null}
          category={member.job_category ?? 'drivers'}
          onAssigned={() => {
            setAssignPositionOpen(false)
            onSalaryUpdated?.()
          }}
        />
      </ModalShell>

      <ModalShell
        open={fireOpen}
        onClose={() => setFireOpen(false)}
        title="Fire staff member"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button className="px-4 py-2 text-sm border rounded" onClick={() => setFireOpen(false)}>
              Cancel
            </button>

            <button
              className="px-4 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-700"
              onClick={confirmFire}
              disabled={locallyFired}
            >
              Confirm Fire
            </button>
          </div>
        }
      >
        <div>
          <p className="text-sm text-slate-600 mb-4">
            Are you sure you want to fire <strong>{displayName || member.name}</strong>?
            <br />
            This will cost:
          </p>

          <div className="text-lg font-bold text-red-600 mb-2" style={{ pointerEvents: 'auto' }}>
            ${Math.round(((function extractSalaryNumber(memberArg: HiredStaffMember): number | null {
              if (typeof (memberArg as any).salary === 'number' && !Number.isNaN((memberArg as any).salary)) return (memberArg as any).salary
              if (typeof memberArg.monthly_salary === 'number' && !Number.isNaN(memberArg.monthly_salary)) return memberArg.monthly_salary
              if (typeof memberArg.monthly_salary_cents === 'number' && !Number.isNaN(memberArg.monthly_salary_cents)) return memberArg.monthly_salary_cents / 100
              return 0
            })(member)) * 3).toLocaleString()}
          </div>

          <div className="text-sm text-slate-500 mb-6">
            This is a one-time termination fee equal to three times the staff member's monthly salary (3 × {displaySalary}).
          </div>
        </div>
      </ModalShell>

      <ModalShell
        open={vacationOpen}
        onClose={() => setVacationOpen(false)}
        title="Set Vacation"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button className="px-4 py-2 text-sm border rounded" onClick={() => setVacationOpen(false)} disabled={vacationMutating}>
              Cancel
            </button>
          </div>
        }
      >
        <div>
          <p className="text-sm text-slate-700 mb-3">
            Choose a vacation length. Each week increases happiness by 10% and reduces fatigue by 35% (values clamped to 0–100).
          </p>

          <div className="flex items-center gap-2">
            <button className="px-3 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50" onClick={() => setVacationForDays(7)} disabled={vacationMutating}>
              One week
            </button>

            <button className="px-3 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50" onClick={() => setVacationForDays(14)} disabled={vacationMutating}>
              Two weeks
            </button>

            <button className="px-2 py-1 rounded-md text-sm bg-white border border-slate-200 hover:bg-slate-50 ml-auto" onClick={clearVacation} disabled={vacationMutating}>
              Clear
            </button>
          </div>

          <div className="text-xs text-slate-500 mt-3">The backend will apply the availability and adjust happiness/fatigue accordingly.</div>
        </div>
      </ModalShell>

      {/* Busy popup modal (auto-dismissed) */}
      <ModalShell
        open={busyModalOpen}
        onClose={() => {
          if (busyTimerRef.current) {
            window.clearTimeout(busyTimerRef.current)
            busyTimerRef.current = null
          }
          setBusyModalOpen(false)
          setBusyMessage(null)
        }}
        title="Notice"
        size="sm"
      >
        <div className="text-sm text-amber-800">
          {busyMessage}
        </div>
      </ModalShell>
    </article>
  )
}