/**
 * BackgroundImageLayer.tsx
 *
 * Decorative full-bleed background image layer used by pages (Login/Register).
 * Renders an accessible img with an optional semi-transparent color overlay.
 */

import React from 'react'

/**
 * BackgroundImageLayerProps
 *
 * Props for the BackgroundImageLayer component.
 */
export interface BackgroundImageLayerProps {
  /** Image source URL */
  src: string
  /** Image opacity (0 - 1). Default 0.6 */
  opacity?: number
  /** Alt text for the image (optional decorative images may be empty) */
  alt?: string
  /** Additional tailwind classes for the wrapper (optional) */
  className?: string
  /** Overlay color in any valid CSS format (eg. 'rgba(8,35,79,0.5)' or '#08234f') */
  overlayColor?: string
  /** Additional overlay opacity (multiplies overlayColor alpha). Default 1.0 */
  overlayOpacity?: number
}

/**
 * BackgroundImageLayer
 *
 * Renders an absolutely positioned, full-bleed decorative image with a subtle
 * overlay. Pointer events are disabled so it doesn't intercept clicks.
 *
 * @param props BackgroundImageLayerProps
 * @returns JSX.Element
 */
export default function BackgroundImageLayer({
  src,
  opacity = 0.6,
  alt = '',
  className = '',
  overlayColor = 'rgba(8,35,79,0.5)', // soft dark blue at ~50%
  overlayOpacity = 1,
}: BackgroundImageLayerProps): JSX.Element {
  /**
   * overlayStyle
   *
   * Compute the overlay style object. If overlayColor already contains alpha,
   * overlayOpacity multiplies it via CSS opacity to allow fine tuning.
   */
  const overlayStyle: React.CSSProperties = {
    backgroundColor: overlayColor,
    opacity: overlayOpacity,
    pointerEvents: 'none',
  }

  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden={alt === '' ? 'true' : 'false'}
    >
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        style={{ opacity }}
      />
      {/* Solid color overlay to improve foreground contrast (soft dark blue by default) */}
      <div className="absolute inset-0" style={overlayStyle} />
    </div>
  )
}
