/**
 * src/lib/logoPicker.ts
 *
 * Small helper that picks a best-effort logo/image URL from a company-like object
 * returned by PostgREST. Different tables/queries have used different column names
 * (company_image_url, logo, logo_url, image_url, icon_url, etc.) so this utility
 * centralizes the fallback logic.
 */

/**
 * pickLogo
 *
 * Attempt to return a URL string for a company image from various common column names.
 *
 * @param obj - object that may contain image fields
 * @returns string|null - image url or null when none found
 */
export function pickLogo(obj: any): string | null {
  if (!obj || typeof obj !== 'object') return null
  return (
    (obj.company_image_url as string | undefined) ??
    (obj.company_image as string | undefined) ??
    (obj.company_logo as string | undefined) ??
    (obj.logo_url as string | undefined) ??
    (obj.logo as string | undefined) ??
    (obj.image_url as string | undefined) ??
    (obj.icon_url as string | undefined) ??
    null
  )
}
