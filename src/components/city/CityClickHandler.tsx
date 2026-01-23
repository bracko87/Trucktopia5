/**
 * CityClickHandler.tsx
 *
 * Delegated click handler that listens for clicks on elements which
 * declare a city via data attributes and dispatches the global
 * `open-city-modal` CustomEvent used by CityModal.
 *
 * This keeps markup changes minimal: simply add data-city-name or
 * data-city-id or data-open-city to existing elements (no layout change).
 */

import React, { useEffect } from 'react'

/**
 * CityClickHandler
 *
 * Mounts a document-level click listener and looks for the closest
 * element with a recognized city data attribute. When found it dispatches
 * the `open-city-modal` event with { cityId?, cityName? } detail.
 *
 * The component deliberately renders nothing.
 */
export default function CityClickHandler(): null {
  useEffect(() => {
    /**
     * findCityData
     *
     * Find the nearest ancestor element containing city data attributes.
     *
     * @param el - initial clicked element
     * @returns { cityId?: string, cityName?: string } or null
     */
    function findCityData(el: Element | null) {
      let cur: Element | null = el
      while (cur) {
        // prefer explicit data-city-id or data-city-name, with legacy fallback data-open-city
        const cityId = (cur as HTMLElement).dataset?.cityId
        const cityName = (cur as HTMLElement).dataset?.cityName ?? (cur as HTMLElement).dataset?.openCity
        if (cityId || cityName) return { cityId, cityName }
        cur = cur.parentElement
      }
      return null
    }

    function onDocClick(e: MouseEvent) {
      try {
        const target = e.target as Element | null
        const data = findCityData(target)
        if (!data) return
        // dispatch the known event used by CityModal
        window.dispatchEvent(
          new CustomEvent('open-city-modal', {
            detail: { cityId: data.cityId, cityName: data.cityName },
          }),
        )
      } catch {
        // defensive: ignore errors in non-browser environments
      }
    }

    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  return null
}