/**
 * notificationCatalog.ts
 *
 * Central catalog for in-app notification types.
 * Controls labels, high-level category (admin vs game), and default actions.
 *
 * NOTE: This file intentionally avoids TypeScript-only syntax so the legacy
 * build (older esbuild) can parse it. Types are provided via JSDoc.
 */

/**
 * @typedef {'admin'|'game'} NotificationCategory
 */

/**
 * @typedef NotificationTypeConfig
 * @property {string} type
 * @property {string} label
 * @property {NotificationCategory} category
 * @property {string} [defaultActionLabel]
 * @property {(function(string|null): string)|undefined} [defaultActionPath]
 */

/**
 * NOTIFICATION_TYPE_CATALOG
 *
 * Central registry for all known notification types.
 * Keys are type codes as written into the database.
 * @type {Record<string, NotificationTypeConfig>}
 */
export const NOTIFICATION_TYPE_CATALOG = {
  ADMIN_ANNOUNCEMENT: {
    type: 'ADMIN_ANNOUNCEMENT',
    label: 'Announcement',
    category: 'admin',
  },
  ADMIN_MAINTENANCE: {
    type: 'ADMIN_MAINTENANCE',
    label: 'Maintenance',
    category: 'admin',
  },
  ADMIN_COMPENSATION: {
    type: 'ADMIN_COMPENSATION',
    label: 'Compensation',
    category: 'admin',
  },
  INSURANCE_EXPIRY: {
    type: 'INSURANCE_EXPIRY',
    label: 'Insurance',
    category: 'game',
    defaultActionLabel: 'Open truck insurance',
    defaultActionPath: function () { return '/trucks' },
  },
  JOB_DEADLINE_SOON: {
    type: 'JOB_DEADLINE_SOON',
    label: 'Job deadline',
    category: 'game',
    defaultActionLabel: 'Open my jobs',
    defaultActionPath: function () { return '/my-jobs' },
  },
  JOB_FAILED: {
    type: 'JOB_FAILED',
    label: 'Job failed',
    category: 'game',
    defaultActionLabel: 'Open my jobs',
    defaultActionPath: function () { return '/my-jobs' },
  },
  JOB_COMPLETED: {
    type: 'JOB_COMPLETED',
    label: 'Job completed',
    category: 'game',
    defaultActionLabel: 'Open my jobs',
    defaultActionPath: function () { return '/my-jobs' },
  },
  TRUCK_MAINTENANCE_DUE: {
    type: 'TRUCK_MAINTENANCE_DUE',
    label: 'Truck maintenance',
    category: 'game',
    defaultActionLabel: 'Open trucks',
    defaultActionPath: function () { return '/trucks' },
  },
  TRUCK_REPAIR_FINISHED: {
    type: 'TRUCK_REPAIR_FINISHED',
    label: 'Truck repaired',
    category: 'game',
    defaultActionLabel: 'Open trucks',
    defaultActionPath: function () { return '/trucks' },
  },
  STAFF_TRAINING_COMPLETE: {
    type: 'STAFF_TRAINING_COMPLETE',
    label: 'Training complete',
    category: 'game',
    defaultActionLabel: 'Open staff',
    defaultActionPath: function () { return '/staff' },
  },
  STAFF_CONTRACT_EXPIRING: {
    type: 'STAFF_CONTRACT_EXPIRING',
    label: 'Contract expiring',
    category: 'game',
    defaultActionLabel: 'Open staff',
    defaultActionPath: function () { return '/staff' },
  },
  LOAN_PAYMENT_DUE: {
    type: 'LOAN_PAYMENT_DUE',
    label: 'Loan payment',
    category: 'game',
    defaultActionLabel: 'Open finances',
    defaultActionPath: function () { return '/finances' },
  },
  LOW_BALANCE_ALERT: {
    type: 'LOW_BALANCE_ALERT',
    label: 'Low balance',
    category: 'game',
    defaultActionLabel: 'Open finances',
    defaultActionPath: function () { return '/finances' },
  },
}

/**
 * normalizeType
 *
 * Coerces any raw notification type into a safe, non-empty string so one bad
 * row cannot crash the bell dropdown render path.
 *
 * @param {*} rawType
 * @returns {string}
 */
function normalizeType(rawType) {
  if (typeof rawType === 'string' && rawType.trim().length > 0) {
    return rawType.trim()
  }
  return 'UNKNOWN'
}

/**
 * humanizeType
 *
 * Converts a normalized type code into a readable label using broad runtime-
 * compatible string operations.
 *
 * @param {string} type
 * @returns {string}
 */
function humanizeType(type) {
  return type.split('_').join(' ').toLowerCase()
}

/**
 * getNotificationTypeConfig
 *
 * Resolve configuration for a given notification type.
 * Falls back to a generic config when the type is unknown or malformed.
 *
 * @param {*} rawType - Raw type value from the database.
 * @returns {NotificationTypeConfig}
 */
export function getNotificationTypeConfig(rawType) {
  var type = normalizeType(rawType)
  var fromCatalog = NOTIFICATION_TYPE_CATALOG[type]

  if (fromCatalog) return fromCatalog

  return {
    type: type,
    label: humanizeType(type),
    category: type.toUpperCase().startsWith('ADMIN') ? 'admin' : 'game',
  }
}