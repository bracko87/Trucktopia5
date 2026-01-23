/**
 * globalCityHelper.ts
 *
 * Provide a small global helper that other code (or legacy inline handlers)
 * can call: window.openCityModal(cityId?, cityName?). It simply dispatches the
 * 'open-city-modal' CustomEvent used by CityModal.
 *
 * This file is imported at app startup so the helper is always available.
 */

/**
 * Extend Window with an optional openCityModal helper.
 */
declare global {
  interface Window {
    openCityModal?: (cityId?: string | null, cityName?: string | null) => void
  }
}

;(function () {
  // Defensive: only run in browser env
  if (typeof window === 'undefined') return

  // Avoid overwriting an existing implementation
  if (window.openCityModal) return

  /**
   * openCityModal
   *
   * Dispatch the global event used by CityModal to open the modal for a city.
   *
   * @param cityId - optional city UUID
   * @param cityName - optional city name
   */
  window.openCityModal = function (cityId?: string | null, cityName?: string | null) {
    try {
      window.dispatchEvent(
        new CustomEvent('open-city-modal', {
          detail: { cityId: cityId ?? undefined, cityName: cityName ?? undefined },
        }),
      )
    } catch {
      // ignore non-browser environments or failures
    }
  }
})()

export {}
