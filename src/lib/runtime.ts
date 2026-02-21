/**
 * src/lib/runtime.ts
 *
 * Runtime helpers. Provides a small utility to detect when the app is
 * running inside Sider preview / wisebase-static so we can enable demo
 * behaviours (demo session, relaxed guards, etc).
 */

/**
 * isSiderRuntime
 *
 * Detect whether the current page is running inside Sider's preview/runtime.
 *
 * @returns boolean - true when running in Sider preview hosts
 */
export function isSiderRuntime(): boolean {
  if (typeof window === "undefined") return false
  const host = window.location.hostname || ""
  // covers sider.ai and their preview hostnames
  return host.endsWith("sider.ai") || window.location.href.includes("wisebase-static")
}