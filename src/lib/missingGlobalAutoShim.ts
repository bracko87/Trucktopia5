/**
 * src/lib/missingGlobalAutoShim.ts
 *
 * Install a defensive runtime handler that catches ReferenceError events for
 * missing globals (e.g. "L1e is not defined") and creates safe, non-invasive
 * shim objects on globalThis so legacy/minified bundles do not crash the app.
 *
 * The shim is intentionally conservative:
 * - Only creates shims for valid identifier names.
 * - Caps the total created shims to avoid masking broad failures.
 * - Creates a callable proxy that safely handles property access and calls.
 *
 * This file should be imported very early (App.tsx) so the handler is present
 * before UI mounts.
 */

/**
 * createSafeShim
 *
 * Create a callable Proxy that safely returns itself for any property access
 * and returns a harmless value when used in primitive contexts.
 *
 * @param name - The global variable name being shimmed (for debugging).
 * @returns A callable, self-referential proxy object to assign to globalThis[name].
 */
function createSafeShim(name: string): any {
  // A function target so the shim is callable
  const target = function safeShim(..._args: any[]) {
    // returning the proxy itself allows chained calls without throwing
    return proxy
  }

  const handler: ProxyHandler<any> = {
    apply(_t, _thisArg, _args) {
      return proxy
    },
    get(_t, prop) {
      // Provide reasonable primitives for common checks
      if (prop === Symbol.toPrimitive || prop === 'toString' || prop === 'valueOf') {
        return () => `[shim:${name}]`
      }
      // Avoid appearing thenable (which can break Promise code)
      if (prop === 'then') return undefined
      return proxy
    },
    set() {
      // silently accept sets
      return true
    },
    has() {
      return true
    },
    construct() {
      return proxy
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const proxy = new Proxy(target, handler)
  return proxy
}

/**
 * installAutoShimHandler
 *
 * Listen for global 'error' events and, for ReferenceError messages that match
 * "<identifier> is not defined", create a safe shim on globalThis if the name
 * looks valid and we haven't already created one.
 */
(function installAutoShimHandler() {
  try {
    const created = new Set<string>()
    const MAX_SHIMS = 100
    const INVALID_NAMES = new Set([
      'window',
      'document',
      'globalThis',
      'console',
      'location',
      'navigator'
    ])

    function isValidIdentifier(name: string) {
      return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)
    }

    window.addEventListener('error', (ev: ErrorEvent) => {
      try {
        const msg = (ev && ev.message) || (ev.error && ev.error.message) || ''
        const m = msg.match(/(?:ReferenceError: )?\s*([A-Za-z_$][A-Za-z0-9_$]*)\s+is not defined/i)
        if (!m) return
        const name = m[1]
        if (!name || created.has(name)) return
        if (!isValidIdentifier(name)) return
        if (INVALID_NAMES.has(name)) return
        if (created.size >= MAX_SHIMS) return

        // Install a safe shim (callable proxy) on globalThis
        try {
          ;(globalThis as any)[name] = createSafeShim(name)
          created.add(name)
          // eslint-disable-next-line no-console
          console.warn(`[missingGlobalAutoShim] created shim for: ${name}`)
        } catch {
          // ignore individual failures
        }
      } catch {
        // swallow per-handler errors
      }
    })
  } catch {
    // swallow installation failures to avoid breaking startup
  }
})()

export {}
