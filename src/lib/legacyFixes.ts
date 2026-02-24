/**
 * legacyFixes.ts
 *
 * Small backwards-compatibility shims for legacy global variables used by older
 * scripts. This file only defines globals when they are missing to avoid
 * ReferenceError exceptions in code that still expects them.
 */

/**
 * ensureIsRepayingLoanId
 *
 * Ensure a global named `isRepayingLoanId` exists on globalThis to prevent
 * runtime ReferenceError in legacy UI code that references it directly.
 */
(function ensureIsRepayingLoanId() {
  try {
    if (typeof (globalThis as any).isRepayingLoanId === 'undefined') {
      ;(globalThis as any).isRepayingLoanId = null
    }
  } catch (e) {
    // Defensive: if mutation of globalThis fails for any reason, swallow the error.
    // This shim is a best-effort guard only.
  }
})()