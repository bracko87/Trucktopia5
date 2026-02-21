/**
 * staffEffectsCatalog.ts
 *
 * Configuration catalog with staff categories and their effect entries.
 *
 * Provides typed data used by UI components to show skills and position bonuses.
 */

/**
 * StaffCategory
 *
 * Defines supported staff categories used across the app.
 */
export type StaffCategory =
  | 'drivers'
  | 'mechanics'
  | 'dispatchers'
  | 'managers'
  | 'directors'

/**
 * EffectEntry
 *
 * Describes a single skill/position entry with title, description and individual effects.
 */
export interface EffectEntry {
  title: string
  description: string
  effects: string[]
}

/**
 * STAFF_EFFECTS_CATALOG
 *
 * Declarative mapping of StaffCategory -> EffectEntry[] that powers the UI overview.
 */
export const STAFF_EFFECTS_CATALOG: Record<StaffCategory, EffectEntry[]> = {
  drivers: [
    {
      title: 'Driving Skills',
      description: 'Individual driver skills affect only the assigned truck.',
      effects: [
        'Speed bonuses during specific conditions',
        'Fuel efficiency improvements',
        'Risk and accident modifiers',
      ],
    },
  ],

  mechanics: [
    {
      title: 'Mechanical Expertise',
      description: 'Mechanic skills reduce downtime and maintenance costs.',
      effects: [
        'Faster repair times',
        'Lower maintenance expenses',
        'Improved component durability',
      ],
    },
  ],

  dispatchers: [
    {
      title: 'Dispatch Coordination',
      description: 'Dispatchers optimize route execution and timing.',
      effects: [
        'Reduced job phase delays',
        'Faster border and checkpoint handling',
        'Improved route efficiency',
      ],
    },
  ],

  managers: [
    {
      title: 'Financial Manager',
      description: 'Optimizes company finances and expenses.',
      effects: [
        '−5% total staff salaries',
        '−10% loan interest rates',
        '−5% operational expenses',
      ],
    },
    {
      title: 'HR Manager',
      description: 'Improves staff satisfaction and retention.',
      effects: [
        '+10% happiness gain speed',
        '−20% chance of staff quitting',
      ],
    },
    {
      title: 'Logistics Manager',
      description: 'Improves routing, warehouse and logistics efficiency.',
      effects: [
        '−10% warehouse staff salaries',
        '−5% warehouse maintenance costs',
      ],
    },
  ],

  directors: [
    {
      title: 'Executive Oversight',
      description: 'High-level strategic bonuses affecting the entire company.',
      effects: [
        'Global efficiency bonuses',
        'Stackable with managers',
        'Limited to one director per position',
      ],
    },
  ],
}
