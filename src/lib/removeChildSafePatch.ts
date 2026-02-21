/**
 * src/lib/removeChildSafePatch.ts
 *
 * Patch Node.prototype.removeChild to ignore DOMException NotFoundError when
 * other scripts removed a node before React tries to remove it. This prevents
 * React's commit phase from crashing when removeChild is called on a node that
 * is no longer a child.
 */

/**
 * installRemoveChildSafePatch
 *
 * Install the safe removeChild wrapper on Node.prototype. Wrapped in a
 * defensive runtime check so it only runs in browsers.
 */
(function installRemoveChildSafePatch() {
  if (typeof window === 'undefined' || typeof Node === 'undefined') {
    return
  }

  try {
    var originalRemoveChild = Node.prototype.removeChild

    /**
     * patchedRemoveChild
     *
     * Calls the original removeChild and silences NotFoundError (DOMException)
     * which occurs when the child is not present. Re-throws other errors.
     *
     * @param {Node} child - The node to remove.
     * @returns {Node} The removed node (or the provided child when ignored).
     */
    Node.prototype.removeChild = function patchedRemoveChild(child) {
      try {
        return originalRemoveChild.call(this, child)
      } catch (err) {
        try {
          var name = err && err.name
          var code = err && err.code
          // DOMException name for this case is "NotFoundError", some engines use code 8.
          if (name === 'NotFoundError' || code === 8) {
            // Nothing to remove — ignore safely.
            return child
          }
        } catch (inner) {
          // If accessing err properties throws, fall through and rethrow original err.
        }
        throw err
      }
    }
  } catch (e) {
    // If patching fails for any reason, do not crash the app — leave original behavior.
    // eslint-disable-next-line no-console
    console.warn('removeChildSafePatch: failed to install patch', e)
  }
})()