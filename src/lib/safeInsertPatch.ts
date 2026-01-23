/**
 * safeInsertPatch.ts
 *
 * Provides a defensive patch for Node.prototype.insertBefore to avoid the
 * Uncaught NotFoundError thrown when a refNode is not a child of the parent.
 *
 * This file patches the DOM insertion behavior at runtime:
 * - If refNode is not a child of the parent, the insertion falls back to
 *   inserting at the end (insertBefore(..., null)).
 * - Any exceptions during the operation are caught and a last-resort append is attempted.
 *
 * NOTE: This is a minimal, pragmatic runtime safeguard. Prefer fixing the
 * caller logic where practical (ensuring refNode belongs to parent before calling).
 */

/**
 * PatchInsertBefore
 *
 * Replace Node.prototype.insertBefore with a safe wrapper that falls back to
 * append behaviour when the reference node is invalid or not a child.
 */
(function patchInsertBefore() {
  try {
    // Store original implementation
    const originalInsertBefore = (Node.prototype as any).insertBefore

    if (typeof originalInsertBefore !== 'function') {
      // Nothing to patch
      return
    }

    /**
     * safeInsertBefore
     *
     * Wrapper around the original insertBefore that performs defensive checks
     * and falls back to appending the node if the reference is invalid.
     *
     * @param this - parent node
     * @param newNode - node to insert
     * @param refNode - reference node (may be null)
     * @returns inserted node
     */
    function safeInsertBefore(this: Node, newNode: Node, refNode: Node | null) {
      try {
        // If a refNode is provided but it is not a child of this parent, fallback.
        if (refNode && refNode.parentNode !== this) {
          // Passing null inserts at end of child list
          return originalInsertBefore.call(this, newNode, null)
        }
        return originalInsertBefore.call(this, newNode, refNode)
      } catch (err) {
        // Last-resort: try to append to avoid uncaught error
        try {
          return originalInsertBefore.call(this, newNode, null)
        } catch {
          // Give up silently — return newNode to satisfy callers that expect a Node
          return newNode
        }
      }
    }

    // Apply the patch
    ;(Node.prototype as any).insertBefore = safeInsertBefore
  } catch {
    // If anything fails during patching, do nothing to avoid breaking runtime.
  }
})()