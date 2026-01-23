/**
 * HiredStaffCard.tsx
 *
 * Read-only card to display an already-hired staff member.
 * Visuals intentionally mirror the StaffCard styling used for candidates
 * but without hire actions. This component is focused on presentation only.
 */

import React from 'react'

/**
 * HiredStaffMember
 *
 * Minimal shape for a hired_staff row used by the UI.
 */
export interface HiredStaffMember {
  id: string
  name?: string | null
  role?: string | null
  country?: string | null
  hired_at?: string | null
  note?: string | null
  created_at?: string | null
}

/**
 * countryCodeToEmoji
 *
 * Convert a 2-letter ISO code to a flag emoji.
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
 * Try to infer a simple 2-letter code from input.
 */
function inferCountryCode(country?: string | null): string | undefined {
  if (!country) return undefined
  const raw = country.trim()
  const maybeCode = raw.toUpperCase()
  if (/^[A-Z]{2,3}$/.test(maybeCode)) return maybeCode.slice(0, 2)
  return undefined
}

/**
 * getCountryDisplay
 *
 * Friendly country label (fallback to input).
 */
function getCountryDisplay(input?: string | null): string {
  if (!input) return 'Unknown'
  const code = inferCountryCode(input)
  if (code) {
    try {
      // @ts-ignore runtime optional
      if (typeof Intl !== 'undefined' && (Intl as any).DisplayNames) {
        // @ts-ignore
        const dn = new (Intl as any).DisplayNames(['en'], { type: 'region' })
        // @ts-ignore
        const name = dn.of(code)
        if (name) return name
      }
    } catch {
      /* ignore */
    }
  }
  return input
}

/**
 * HiredStaffCard
 *
 * Presentational component showing a hired staff entry. No actions.
 */
export default function HiredStaffCard({ member }: { member: HiredStaffMember }): JSX.Element {
  const countryInput = member.country ?? undefined
  const code = inferCountryCode(countryInput)
  const emoji = countryCodeToEmoji(code)
  const countryDisplay = getCountryDisplay(countryInput)

  const hiredAt = member.hired_at ?? member.created_at ?? null
  const hiredAtText = hiredAt ? new Date(hiredAt).toLocaleString() : '—'

  return (
    <article className="bg-white rounded-xl shadow p-0 overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
        <div className="p-4 flex items-center min-h-[64px]">
          <div className="flex items-center gap-3 w-full">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-700 flex-shrink-0">
              {member.name ? member.name.charAt(0).toUpperCase() : '?'}
            </div>

            <div className="min-w-0">
              <div className="font-semibold text-slate-900 truncate flex items-center gap-2">
                <span className="truncate">{member.name}</span>
                <span aria-hidden className="text-base">{emoji}</span>
                <span className="text-sm text-slate-700 truncate">{countryDisplay}</span>
              </div>

              <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                <span
                  className={`text-sm font-medium px-2 py-1 rounded-full inline-flex items-center gap-2 bg-slate-100 text-slate-800 border border-slate-200`}
                >
                  {member.role ?? 'Unknown'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="text-sm text-slate-700 font-medium mb-2">
            <span className="font-semibold">Notes:</span>{' '}
            <span className="font-normal">{member.note ?? '—'}</span>
          </div>

          <div className="text-sm text-slate-700">
            <span className="font-semibold">Hired:</span>{' '}
            <span className="font-normal">{hiredAtText}</span>
          </div>
        </div>

        <div className="p-4 flex items-center justify-end">
          <div className="text-right">
            <div className="text-xs text-slate-500">Record ID</div>
            <div className="text-sm text-slate-700 font-mono truncate max-w-[180px]">{member.id}</div>
          </div>
        </div>
      </div>
    </article>
  )
}