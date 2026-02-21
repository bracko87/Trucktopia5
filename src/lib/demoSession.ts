/**
 * src/lib/demoSession.ts
 *
 * Simple demo session storage used in Sider preview. Stores a tiny demo
 * user + company in localStorage so UI can behave as if authenticated.
 */

/**
 * DemoUser
 *
 * Minimal demo user shape.
 */
type DemoUser = {
  id: string
  email: string
}

/**
 * DemoCompany
 *
 * Minimal demo company shape used by UI.
 */
type DemoCompany = {
  id: string
  name: string
  hub: string
  balance_cents: number
}

const DEMO_USER: DemoUser = { id: "demo-user-1", email: "demo@sider.ai" }
const DEMO_COMPANY: DemoCompany = {
  id: "demo-company-1",
  name: "Demo Logistics",
  hub: "Berlin, Germany",
  balance_cents: 1000000,
}

const KEY = "TRACKTOPIA_DEMO_SESSION"

/**
 * getDemoSession
 *
 * Read demo session from localStorage. Returns null on parse error.
 *
 * @returns { user: DemoUser; company: DemoCompany } | null
 */
export function getDemoSession():
  | { user: DemoUser; company: DemoCompany }
  | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as { user: DemoUser; company: DemoCompany }
  } catch {
    return null
  }
}

/**
 * setDemoSession
 *
 * Persist a demo session and return it.
 *
 * @returns { user: DemoUser; company: DemoCompany }
 */
export function setDemoSession() {
  const session = { user: DEMO_USER, company: DEMO_COMPANY }
  try {
    localStorage.setItem(KEY, JSON.stringify(session))
  } catch {
    // ignore write errors in restrictive environments
  }
  return session
}

/**
 * clearDemoSession
 *
 * Remove demo session from localStorage.
 */
export function clearDemoSession() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}