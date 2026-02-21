/**
 * CategoryInfoPanel.tsx
 *
 * Presentational component that displays skills & bonuses for a staff category.
 * Rendered by the injector into the page next to the category buttons.
 */

import React from 'react'

/**
 * SkillEntry
 *
 * Single skill description.
 */
export interface SkillEntry {
  id: string
  title: string
  description?: string
}

/**
 * BonusEntry
 *
 * Single bonus description.
 */
export interface BonusEntry {
  id: string
  title: string
  detail?: string
}

/**
 * CategoryInfo
 *
 * Aggregates skills + bonuses for a staff category.
 */
export interface CategoryInfo {
  name: string
  summary?: string
  skills: SkillEntry[]
  bonuses: BonusEntry[]
}

/**
 * categoryDefinitions
 *
 * Minimal canonical definitions for available categories.
 */
const categoryDefinitions: Record<string, CategoryInfo> = {
  drivers: {
    name: 'Drivers',
    summary: 'Frontline drivers who operate trucks and deliver cargo.',
    skills: [
      { id: 'night', title: 'Night Driving', description: 'Improves speed & safety during night shifts.' },
      { id: 'eco', title: 'Fuel Efficiency', description: 'Reduces fuel consumption on long hauls.' },
      { id: 'secure_load', title: 'Secure Loading', description: 'Lowers damage chance when loading/unloading.' },
    ],
    bonuses: [
      { id: 'speed', title: 'Route Speed +5%', detail: 'Applied to delivery ETA calculations for experienced drivers.' },
      { id: 'fuel', title: 'Fuel -3%', detail: 'Reduces fuel cost on long-distance jobs.' },
    ],
  },
  mechanics: {
    name: 'Mechanics',
    summary: 'Maintain and repair trucks to keep uptime high.',
    skills: [
      { id: 'engine', title: 'Engine Tuning', description: 'Improves durability and reduces breakdown risk.' },
      { id: 'diagnostics', title: 'Diagnostics', description: 'Faster repairs and lower maintenance cost.' },
    ],
    bonuses: [
      { id: 'repair_speed', title: 'Repair Speed +15%', detail: 'Repairs finish faster reducing downtime.' },
      { id: 'maintenance_cost', title: 'Maintenance Cost -10%', detail: 'Parts and labor cost reduction.' },
    ],
  },
  dispatchers: {
    name: 'Dispatchers',
    summary: 'Coordinate routes and assign jobs to trucks and drivers.',
    skills: [
      { id: 'routing', title: 'Optimal Routing', description: 'Finds efficient routes and reduces idle time.' },
      { id: 'load_balancing', title: 'Load Balancing', description: 'Improves truck utilization across jobs.' },
    ],
    bonuses: [
      { id: 'utilization', title: 'Utilization +7%', detail: 'More jobs completed with same truck fleet.' },
      { id: 'delay_reduction', title: 'Delay Reduction -8%', detail: 'Fewer late deliveries.' },
    ],
  },
  managers: {
    name: 'Managers',
    summary: 'Oversee operations: staff assignments and medium-term planning.',
    skills: [
      { id: 'planning', title: 'Operational Planning', description: 'Improves strategic route & hub planning.' },
      { id: 'leadership', title: 'Leadership', description: 'Increases staff morale and retention.' },
      { id: 'procurement', title: 'Procurement', description: 'Better purchase deals for trucks & parts.' },
    ],
    bonuses: [
      { id: 'company_income', title: 'Revenue +8%', detail: 'Boost to company job revenue through improved operations.' },
      { id: 'hiring_cost', title: 'Hiring Cost -20%', detail: 'Reduces cost of recruiting staff.' },
      { id: 'staff_retention', title: 'Retention +10%', detail: 'Lowers staff churn and vacancy gaps.' },
    ],
  },
  directors: {
    name: 'Directors',
    summary: 'Senior leadership shaping high-level company strategy and bonuses.',
    skills: [
      { id: 'strategy', title: 'Corporate Strategy', description: 'Influences long-term company growth.' },
      { id: 'investment', title: 'Capital Allocation', description: 'Better returns on fleet investments.' },
    ],
    bonuses: [
      { id: 'company_growth', title: 'Company Growth +12%', detail: 'Stronger long-term growth multipliers.' },
      { id: 'credit_terms', title: 'Credit Terms Improved', detail: 'Access to better financing & lower interest.' },
    ],
  },
}

/**
 * InfoRow
 *
 * Small helper to render a single skill/bonus row.
 *
 * @param props.title label text
 * @param props.detail optional detail text
 */
function InfoRow({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="mb-2">
      <div className="font-semibold text-sm text-slate-800">{title}</div>
      {detail ? <div className="text-xs text-slate-500">{detail}</div> : null}
    </div>
  )
}

/**
 * CategoryInfoPanel
 *
 * Presentational panel that shows skills & bonuses for the given category.
 *
 * @param props.category category key (drivers|mechanics|dispatchers|managers|directors)
 */
export default function CategoryInfoPanel({ category }: { category?: string }) {
  const key = (category || 'drivers').toLowerCase()
  const info = categoryDefinitions[key] ?? categoryDefinitions['drivers']

  return (
    <aside className="mt-4 p-4 bg-white border border-slate-100 rounded-xl shadow-sm w-full max-w-3xl">
      <div className="flex items-start gap-3">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{info.name}</h3>
              <div className="text-xs text-slate-500">{info.summary}</div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-500 font-medium mb-2">Skills</div>
              <div>
                {info.skills.map((s) => (
                  <div key={s.id} className="mb-2">
                    <div className="text-sm text-slate-800 font-medium">{s.title}</div>
                    {s.description ? <div className="text-xs text-slate-500">{s.description}</div> : null}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 font-medium mb-2">Bonuses & Effects</div>
              <div>
                {info.bonuses.map((b) => (
                  <div key={b.id} className="mb-2">
                    <div className="text-sm text-slate-800 font-medium">{b.title}</div>
                    {b.detail ? <div className="text-xs text-slate-500">{b.detail}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}