/**
 * ensureGlobals.ts
 *
 * Small bootstrap file that ensures legacy global names used by third-party
 * or legacy inline scripts exist on globalThis to avoid runtime ReferenceError.
 *
 * This file intentionally performs a noop when the globals already exist.
 */

/**
 * Declare legacy globals on the global scope so TypeScript knows about them.
 */
declare global {
  /** Legacy runtime object sometimes referenced by bundled code. */
  var ete: any
  interface Window {
    ete?: any
  }
}

/**
 * initEnsureGlobals
 *
 * Create minimal shims for legacy globals that some bundled code expects.
 * This prevents ReferenceError at runtime without altering existing behaviour.
 */
(function initEnsureGlobals() {
  const g: any = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : {})
  if (typeof g.ete === 'undefined' || g.ete === null) {
    g.ete = {}
  }
})()

export {}
