/**
 * StaffCategoryEffects.tsx
 *
 * Presentational component that renders category-specific staff effects using
 * the static STAFF_CATEGORY_EFFECTS config.
 */

import React from 'react'
import { STAFF_CATEGORY_EFFECTS, StaffCategory } from '../../lib/staffCategoryEffects'

/**
 * StaffCategoryEffectsProps
 *
 * Props for StaffCategoryEffects component.
 */
interface StaffCategoryEffectsProps {
  category: StaffCategory
}

/**
 * StaffCategoryEffects
 *
 * Renders the effect blocks for a single staff category.
 *
 * @param props.category - Selected staff category to render effects for.
 * @returns JSX.Element | null
 */
export default function StaffCategoryEffects({ category }: StaffCategoryEffectsProps) {
  const blocks = STAFF_CATEGORY_EFFECTS[category]

  if (!blocks || blocks.length === 0) return null

  return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold mb-3">Staff Skills & Position Effects</h2>

      <div className="space-y-4">
        {blocks.map((block, idx) => (
          <div key={idx} className="bg-white rounded-lg border p-4">
            <h3 className="font-semibold text-slate-800">{block.title}</h3>

            <p className="text-sm text-slate-600 mt-1">{block.description}</p>

            <ul className="list-disc list-inside mt-3 text-sm text-slate-700 space-y-1">
              {block.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
