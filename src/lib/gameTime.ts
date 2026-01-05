/**
 * src/lib/gameTime.ts
 *
 * Small TypeScript helper to read the canonical game time from the DB REST endpoint.
 * Use this from server-side workers or client code that must use in-game time.
 *
 * NOTE:
 * - This helper uses the REST endpoint /rest/v1/game_time. If you prefer to use
 *   your Supabase client wrapper, adapt these calls to that wrapper.
 * - The functions return UTC Date objects derived from the stored value.
 */

/**
 * fetchGameTimeRow
 *
 * Fetch the game_time row (id = 1) using the REST endpoint.
 *
 * @returns object with current_time string or null on failure
 */
export async function fetchGameTimeRow(): Promise<{ id: number; current_time: string } | null> {
  try {
    const res = await fetch('/rest/v1/game_time?select=id,current_time&id=eq.1&limit=1', {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store'
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return null
    return data[0] as { id: number; current_time: string }
  } catch (err) {
    console.error('[gameTime] fetch error', err)
    return null
  }
}

/**
 * getGameTimeDate
 *
 * Return the current game time as a JS Date (UTC). Returns null on error.
 *
 * @returns Date | null
 */
export async function getGameTimeDate(): Promise<Date | null> {
  const row = await fetchGameTimeRow()
  if (!row || !row.current_time) return null
  // Parse as UTC if possible; Date will interpret 'YYYY-MM-DD HH:MM:SS' as local,
  // so convert safely by replacing space with 'T' and adding 'Z' if missing timezone.
  let s = row.current_time.trim()
  // If already ISO-like with T, leave it
  if (!s.includes('T')) {
    // Convert "YYYY-MM-DD hh:mm:ss" -> "YYYY-MM-DDThh:mm:ssZ" (treat stored time as UTC)
    s = s.replace(' ', 'T') + 'Z'
  }
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return d
}

/**
 * TimeProvider
 *
 * Simple in-memory cache + poller. Use in workers to avoid hitting DB on every check.
 *
 * Example:
 * const p = new TimeProvider()
 * await p.startPolling(30_000) // poll every 30s
 * const now = await p.get() // returns Date
 */
export class TimeProvider {
  private _cached: Date | null = null
  private _intervalId: number | null = null
  private _pollMs = 30000

  /**
   * startPolling
   *
   * Begin polling the game_time row every ms milliseconds.
   *
   * @param ms Poll interval in milliseconds
   */
  async startPolling(ms = 30000) {
    this._pollMs = ms
    await this._refreshOnce()
    if (this._intervalId) window.clearInterval(this._intervalId)
    this._intervalId = window.setInterval(() => this._refreshOnce().catch(console.error), this._pollMs)
  }

  /**
   * stopPolling
   *
   * Stop background polling.
   */
  stopPolling() {
    if (this._intervalId) {
      window.clearInterval(this._intervalId)
      this._intervalId = null
    }
  }

  /**
   * get
   *
   * Return cached game time or fetch if missing.
   */
  async get(): Promise<Date | null> {
    if (this._cached) return this._cached
    await this._refreshOnce()
    return this._cached
  }

  /** Internal refresh helper */
  private async _refreshOnce() {
    const d = await getGameTimeDate()
    if (d) this._cached = d
  }
}