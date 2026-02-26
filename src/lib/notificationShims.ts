/**
 * src/lib/notificationShims.ts
 *
 * Provide non-invasive runtime shims for legacy/minified global helpers that
 * some bundles call (for example `getNotificationAction3`). These shims map
 * the legacy global names to the canonical implementations exported from
 * src/lib/notificationTypes.ts so missing globals do not crash the app.
 *
 * The module is safe to import early during app startup and intentionally
 * avoids changing behavior when proper functions already exist.
 */

/**
 * Allow TypeScript to accept adding globals to globalThis / window.
 */
declare global {
  /** Legacy/minified global name for notification action resolver. */
  var getNotificationAction3: any
  /** Legacy/minified global name for notification type config resolver. */
  var getNotificationTypeConfig3: any
}

import { getNotificationAction, getNotificationTypeConfig } from './notificationTypes'

/**
 * installNotificationShims
 *
 * Map legacy global names to canonical implementations if they are missing.
 * The function is defensive and will not overwrite existing functions.
 */
function installNotificationShims(): void {
  try {
    const g = (globalThis as any)
    if (typeof g.getNotificationAction3 !== 'function') {
      g.getNotificationAction3 = getNotificationAction
    }
    if (typeof g.getNotificationTypeConfig3 !== 'function') {
      g.getNotificationTypeConfig3 = getNotificationTypeConfig
    }

    // Mirror to window for bundles that reference window.* directly.
    try {
      if (typeof (g.window) !== 'undefined') {
        if (typeof g.window.getNotificationAction3 !== 'function') {
          g.window.getNotificationAction3 = g.getNotificationAction3
        }
        if (typeof g.window.getNotificationTypeConfig3 !== 'function') {
          g.window.getNotificationTypeConfig3 = g.getNotificationTypeConfig3
        }
      }
    } catch {
      // ignore window mirror failures
    }
  } catch {
    // swallow to avoid startup failures
  }
}

// Run immediately (safe, idempotent).
installNotificationShims()

export {} 