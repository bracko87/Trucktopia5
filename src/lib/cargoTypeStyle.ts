/**
 * src/lib/cargoTypeStyle.ts
 *
 * Deterministic color mapping helper for cargo type names.
 *
 * Exports a single function cargoTypeStyle which returns a Tailwind class string
 * (background, text and border) based on the provided cargo type name.
 *
 * This file ensures consistent coloring for cargo type badges across the app.
 */

/**
 * cargoTypeStyle
 *
 * Return a stable Tailwind color trio for the provided cargo type string.
 *
 * @param type optional cargo type name
 * @returns Tailwind classes: bg-*, text-*, border-*
 */
export function cargoTypeStyle(type?: string): string {
  const t = String(type || '').toLowerCase()

  if (t.includes('frozen') || t.includes('refrigerated'))
    return 'bg-blue-100 text-blue-800 border-blue-300'

  if (t.includes('waste'))
    return 'bg-green-100 text-green-800 border-green-300'

  if (t.includes('dry')) return 'bg-amber-100 text-amber-800 border-amber-300'

  if (t.includes('industrial') || t.includes('chemical'))
    return 'bg-purple-100 text-purple-800 border-purple-300'

  if (t.includes('livestock'))
    return 'bg-lime-100 text-lime-800 border-lime-300'

  if (t.includes('agricultural'))
    return 'bg-yellow-100 text-yellow-800 border-yellow-300'

  if (t.includes('construction material'))
    return 'bg-orange-100 text-orange-800 border-orange-300'

  if (t.includes('construction debris'))
    return 'bg-amber-200 text-amber-900 border-amber-400'

  if (t.includes('corrosive')) return 'bg-red-100 text-red-800 border-red-300'

  if (t.includes('food grade') || t.includes('clean'))
    return 'bg-cyan-100 text-cyan-800 border-cyan-300'

  if (t.includes('hazardous')) return 'bg-rose-100 text-rose-800 border-rose-300'

  if (t.includes('container')) return 'bg-indigo-100 text-indigo-800 border-indigo-300'

  if (t.includes('gas')) return 'bg-sky-100 text-sky-800 border-sky-300'

  if (t.includes('machinery') || t.includes('oversized'))
    return 'bg-slate-200 text-slate-900 border-slate-400'

  if (t.includes('powder') || t.includes('cement'))
    return 'bg-stone-200 text-stone-900 border-stone-400'

  if (t.includes('extra long')) return 'bg-violet-100 text-violet-800 border-violet-300'

  if (t.includes('vehicle')) return 'bg-teal-100 text-teal-800 border-teal-300'

  return 'bg-slate-100 text-slate-700 border-slate-300'
}

export default cargoTypeStyle