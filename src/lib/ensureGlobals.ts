/**
 * src/lib/ensureGlobals.ts
 *
 * Provide minimal runtime shims for legacy globals referenced by third-party/minified bundles.
 * This file creates safe, non-throwing callables for globals like `ete` and `cte`
 * so that older/minified code that expects them won't crash the app.
 */

/**
 * Allow TypeScript to accept adding globals to globalThis.
 */
declare global {
  /** Legacy global helper (may be a function in older bundles) */
  var ete: any
  /** Legacy global helper (may be a function in older bundles) */
  var cte: any
}

/**
 * installShim
 *
 * Ensure a global with `name` exists and is a callable function.
 * If the global already exists as a function, it is left untouched.
 * The installed shim:
 *  - If invoked with a function, attempts to call and return its result.
 *  - Otherwise returns the provided value unchanged.
 *
 * This keeps behaviour non-invasive while preventing runtime TypeErrors.
 *
 * @param name Global variable name to ensure on globalThis.
 */
function installShim(name: 'ete' | 'cte') {
  try {
    const g = (globalThis as any)
    if (typeof g[name] === 'function') return
    g[name] = function (payload?: any) {
      try {
        if (typeof payload === 'function') {
          return payload()
        }
      } catch {
        // swallow errors from payload invocation to avoid breaking legacy callsites
      }
      return payload
    }
  } catch {
    // No-op on environments where globalThis manipulation is restricted
  }
}

/**
 * Setup shims at module load so they exist before other modules run.
 */
try {
  if (typeof globalThis !== 'undefined') {
    installShim('ete')
    installShim('cte')
  }
} catch {
  // Silently ignore any failures to avoid disrupting app startup.
}

export {}