/**
 * RouteTypographyStylePatch.tsx
 *
 * Injects a small, high-specificity CSS override to increase flag image sizes
 * and city name text size for inline route rows like:
 * <div class="flex items-center gap-2"> <img class="w-3 h-3"> City → ...</div>
 *
 * This is intentionally non-invasive and only affects presentation. It uses
 * !important to override inline Tailwind-generated size utilities so the
 * layout and structure remain unchanged.
 */

import React from 'react'

/**
 * RouteTypographyStylePatch
 *
 * A tiny component that mounts style rules into the document to bump
 * flag image sizes (w-3/h-3 -> visual w-4/h-4, w-4/h-4 -> w-5/h-5) and
 * increase city name typography to text-base for better readability.
 *
 * @returns null (no visual DOM output besides injected styles)
 */
export default function RouteTypographyStylePatch(): JSX.Element | null {
  // CSS targets the common container used across the app for route rows.
  // Using attribute/class selectors and !important ensures the override
  // applies even when Tailwind utility classes are present on the element.
  const css = `
/* Increase tiny flag icons inside route rows */
.flex.items-center.gap-2 img.w-3.h-3,
.flex.items-center.gap-2 img.w-3,
.flex.items-center.gap-2 img.h-3 {
  width: 1rem !important; /* w-4 */
  height: 1rem !important; /* h-4 */
}

/* Increase w-4 -> w-5 for slightly larger flags */
.flex.items-center.gap-2 img.w-4.h-4,
.flex.items-center.gap-2 img.w-4,
.flex.items-center.gap-2 img.h-4 {
  width: 1.25rem !important; /* w-5 */
  height: 1.25rem !important; /* h-5 */
}

/* Make city label spans one step larger (text-base) while keeping font-weight */
.flex.items-center.gap-2 span.font-semibold,
.flex.items-center.gap-2 span.font-bold,
.flex.items-center.gap-2 span.text-slate-800,
.flex.items-center.gap-2 span.text-slate-900 {
  font-size: 1rem !important; /* text-base */
  line-height: 1.25rem !important;
}

/* Keep arrow and secondary text visually subdued but aligned */
.flex.items-center.gap-2 > .text-slate-400 {
  font-size: 0.95rem !important;
}
`

  return <style dangerouslySetInnerHTML={{ __html: css }} />
} 