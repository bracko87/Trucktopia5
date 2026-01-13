/**
 * CargoIconSizeStyle.tsx
 *
 * Injects a small global style override to slightly reduce the size of cargo
 * type icons shown inside truck cards and listings. This avoids changing
 * component markup and preserves existing layout/design while making icons
 * visually a little smaller.
 *
 * The rule targets common alt attributes used for cargo icons and uses
 * !important to override utility classes (w-10 / h-10) applied by Tailwind.
 */

import React from 'react'

/**
 * CargoIconSizeStyle
 *
 * Renders a style tag with CSS that reduces cargo icon image dimensions by a
 * small amount. Keep this component minimal and side-effect free so it can be
 * safely mounted at the app root.
 *
 * @returns JSX.Element
 */
export default function CargoIconSizeStyle(): JSX.Element {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
/* Reduced cargo icons used in truck cards/listings to 30px for better balance */
img[alt="Cargo type"],
img[alt^="Secondary cargo type"],
img[alt*="Cargo type"],
img[alt*="cargo type"],
img[class*="cargo"][class*="icon"] {
  width: 1.5rem !important; /* 30px */
  height: 1.5rem !important;
  object-fit: cover !important;
}
`,
      }}
    />
  )
}