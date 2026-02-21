/**
 * PageBackground.tsx
 *
 * Decorative full-bleed page background used by individual pages that need a
 * large image with a downward fade. The component intentionally disables pointer
 * events so it doesn't intercept user interaction. Supports an optional solid
 * color overlay (e.g. white at 70%) plus a configurable downward gradient fade.
 */

import React from 'react'

/**
 * PageBackgroundProps
 *
 * Props for the PageBackground component.
 */
export interface PageBackgroundProps {
  /** Image source URL (can use smart placeholder like https://sider.ai/autoimage/keyword) */
  src: string
  /** Image opacity (0 - 1). Defaults to 0.9 (90% opaque). */
  opacity?: number
  /** Fade color RGB tuple string (eg. "255,255,255" for white). Default white. */
  fadeColorRGB?: string
  /** Final fade opacity at the bottom (0 - 1). Default 0.9. */
  fadeOpacity?: number
  /** Optional overlay color RGB tuple string (eg. "255,255,255"). Default: no overlay (empty string). */
  overlayColorRGB?: string
  /** Overlay opacity (0 - 1). Only applied when overlayColorRGB is provided. Default: 0 (no overlay). */
  overlayOpacity?: number
  /** Additional wrapper CSS classes (optional) */
  className?: string
}

/**
 * PageBackground
 *
 * Renders an absolutely positioned, full-bleed decorative image with a subtle
 * downward fade into the page background. Pointer events are disabled so it
 * never intercepts clicks. An optional solid color overlay can be rendered
 * above the image (useful for ensuring consistent contrast).
 *
 * @param props PageBackgroundProps
 * @returns JSX.Element
 */
export default function PageBackground({
  src,
  opacity = 0.9,
  fadeColorRGB = '255,255,255',
  fadeOpacity = 0.9,
  overlayColorRGB = '',
  overlayOpacity = 0,
  className = '',
}: PageBackgroundProps): JSX.Element {
  // Build the CSS gradient overlay that will visually fade the image downward
  const gradientStyle: React.CSSProperties = {
    pointerEvents: 'none',
    position: 'absolute',
    inset: 0,
    background: `linear-gradient(to bottom, rgba(${fadeColorRGB}, 0) 0%, rgba(${fadeColorRGB}, ${fadeOpacity}) 85%)`,
  }

  // Solid color overlay (e.g. white at 70%) rendered above the image but beneath gradient.
  const overlayStyle: React.CSSProperties | undefined =
    overlayColorRGB && overlayOpacity > 0
      ? {
          pointerEvents: 'none',
          position: 'absolute',
          inset: 0,
          background: `rgba(${overlayColorRGB}, ${overlayOpacity})`,
        }
      : undefined

  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <img
        src={src}
        alt=""
        // the image itself is decorative; keep pointer-events disabled
        className="w-full h-full object-cover"
        style={{ opacity, pointerEvents: 'none' }}
      />

      {/* Optional solid overlay (e.g. white @ 0.7) */}
      {overlayStyle && <div style={overlayStyle} />}

      {/* Downward fade into the page background */}
      <div style={gradientStyle} />
    </div>
  )
}