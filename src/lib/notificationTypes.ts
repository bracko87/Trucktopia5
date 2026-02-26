/**
 * notificationTypes.ts
 *
 * Compatibility wrapper that re-exports the central notification catalog and helpers.
 * Keep this small file to avoid duplicate logic and to provide backward-compatible imports.
 */

/**
 * Re-export selected utilities from notificationCatalog to preserve existing import paths.
 */
/** @public */
export {
  NOTIFICATION_TYPE_CATALOG,
  NotificationTypeConfig,
  getNotificationTypeConfig,
  getNotificationAction,
} from './notificationCatalog'