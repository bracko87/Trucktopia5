/**
 * cargoTypeColors.ts
 *
 * Central color mapping for cargo types used by UI badges.
 *
 * Export a record mapping human cargo type names to Tailwind utility
 * classes for background, text and border. Keep entries small and
 * easy to extend.
 */

/**
 * Cargo type color style descriptor.
 */
export interface CargoTypeColor {
  /** Background Tailwind class (e.g. bg-amber-50) */
  bg: string
  /** Text Tailwind class (e.g. text-amber-700) */
  text: string
  /** Border Tailwind class (e.g. border-amber-300) */
  border: string
}

/**
 * cargoTypeColors
 *
 * Mapping from cargo type label -> style classes.
 */
export const cargoTypeColors: Record<string, CargoTypeColor> = {
  'Dry Goods': {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-300',
  },
  'Frozen / Refrigerated': {
    bg: 'bg-cyan-50',
    text: 'text-cyan-700',
    border: 'border-cyan-300',
  },
  'Waste & Recycling': {
    bg: 'bg-lime-50',
    text: 'text-lime-700',
    border: 'border-lime-300',
  },
  'Liquid - Industrial / Chemical': {
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-300',
  },
  Livestock: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-300',
  },
  'Agricultural Bulk': {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-300',
  },
  'Construction Material': {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-300',
  },
  'Construction Debris': {
    bg: 'bg-stone-50',
    text: 'text-stone-700',
    border: 'border-stone-300',
  },
  'Corrosive Chemicals': {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-300',
  },
  'Liquid - Clean / Food Grade': {
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-300',
  },
  'Hazardous Materials': {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-300',
  },
  'Containerized / Intermodal': {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-300',
  },
  'Compressed Gases': {
    bg: 'bg-fuchsia-50',
    text: 'text-fuchsia-700',
    border: 'border-fuchsia-300',
  },
  'Heavy Machinery / Oversized': {
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-300',
  },
  'Bulk Powder / Cement': {
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    border: 'border-gray-300',
  },
  'Extra Long Loads': {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-300',
  },
  Vehicles: {
    bg: 'bg-teal-50',
    text: 'text-teal-700',
    border: 'border-teal-300',
  },
}

/**
 * getCargoTypeStyle
 *
 * Helper to fetch a cargo type style with a safe fallback.
 *
 * @param name cargo type name
 * @returns CargoTypeColor
 */
export function getCargoTypeStyle(name?: string): CargoTypeColor {
  const fallback: CargoTypeColor = {
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-300',
  }
  if (!name) return fallback
  return cargoTypeColors[name] ?? fallback
}