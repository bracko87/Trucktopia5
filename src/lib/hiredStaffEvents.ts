/**
 * hiredStaffEvents.ts
 *
 * Small helper utilities for notifying and listening to hired-staff changes.
 * Events may optionally include a detail payload so listeners can apply
 * optimistic updates immediately without waiting for a full backend refetch.
 */

/**
 * dispatchHiredStaffChanged
 *
 * Emit a global, lightweight browser event to notify listeners that hired-staff
 * data may have changed and should be refetched. An optional payload may be
 * provided so consumers can perform optimistic updates immediately.
 *
 * @param detail Optional payload describing the change (e.g. { staffId, trainingSkillId, isTraining, until })
 */
export function dispatchHiredStaffChanged(detail?: any) {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hiredStaff:changed', { detail }))
    }
  } catch (err) {
    // noop - don't crash callers
  }
}

/**
 * useHiredStaffChangedListener
 *
 * Attach a handler that runs when the global hiredStaff:changed event is emitted.
 * The handler will receive the event.detail value (or undefined).
 *
 * @param handler Async or sync function called when the event fires. Receives event.detail.
 * @returns cleanup function to remove the listener
 */
export function useHiredStaffChangedListener(handler: (detail?: any) => unknown) {
  if (typeof window === 'undefined') return () => {}
  const cb = (ev: Event) => {
    try {
      const detail = (ev as CustomEvent).detail
      handler(detail)
    } catch (err) {
      // swallow errors from handler
    }
  }
  window.addEventListener('hiredStaff:changed', cb)
  return () => window.removeEventListener('hiredStaff:changed', cb)
}