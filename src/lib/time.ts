/**
 * time.ts
 *
 * Time helpers for the app:
 * - formatGameTime: format a Date using an IANA timezone (Intl API)
 * - GameTimeProvider: lightweight global clock (no JSX so file can remain .ts)
 *
 * NOTE: This file intentionally does not use JSX (use React.createElement)
 *       to avoid TS parser errors in a .ts file.
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getGameTimeDate } from './gameTime'

/**
 * formatGameTime
 *
 * Format a Date using the provided IANA timezone.
 *
 * @param date - Date to format
 * @param tz - IANA timezone string (e.g. "Europe/Berlin")
 * @returns formatted string
 */
export function formatGameTime(date: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date)
  } catch {
    return date.toISOString()
  }
}

/**
 * GameTimeContextValue
 *
 * Exposed shape by GameTimeContext.
 */
export interface GameTimeContextValue {
  now: Date
  timeZone: string
}

/**
 * GameTimeContext
 *
 * Provides a ticking clock and chosen timezone so components can render consistent times.
 */
const GameTimeContext = createContext<GameTimeContextValue | undefined>(undefined)

/**
 * GameTimeProviderProps
 *
 * Props for the GameTimeProvider component.
 */
export interface GameTimeProviderProps {
  children: React.ReactNode
  timeZone: string
}

/**
 * GameTimeProvider
 *
 * React provider that ticks once per second and exposes { now, timeZone }.
 * Uses React.createElement instead of JSX so this file stays valid as .ts.
 *
 * Behavior:
 * - Attempt to fetch canonical DB time via getGameTimeDate().
 * - If DB time is received, use it as baseTime and advance the clock by elapsed real ms.
 * - Otherwise fall back to system time and continue ticking.
 *
 * This ensures UI components (Footer, etc.) show DB-backed time when available.
 *
 * @param props - Provider props
 * @returns React element
 */
export function GameTimeProvider(props: GameTimeProviderProps): React.ReactElement {
  const { children, timeZone } = props
  const [now, setNow] = useState<Date>(new Date())

  useEffect(() => {
    // Base time that the UI clock will advance from (may be DB time or local time).
    let baseTime: Date = new Date()
    // Real timestamp when baseTime was captured.
    let baseReal = Date.now()
    let mounted = true

    /**
     * init
     *
     * Try to initialize baseTime from DB game_time. On success, replace baseTime
     * and baseReal and update the local state so UI immediately reflects DB time.
     */
    async function init() {
      try {
        const dbTime = await getGameTimeDate()
        if (!mounted) return
        if (dbTime) {
          baseTime = dbTime
          baseReal = Date.now()
          setNow(dbTime)
          // eslint-disable-next-line no-console
          console.log('GameTimeProvider initialized from DB:', dbTime)
        } else {
          // eslint-disable-next-line no-console
          console.info('GameTimeProvider: no DB time available, using local time')
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('GameTimeProvider: error fetching DB time', err)
      }
    }

    init()

    const id = setInterval(() => {
      const elapsed = Date.now() - baseReal
      setNow(new Date(baseTime.getTime() + elapsed))
    }, 1000)

    return () => {
      mounted = false
      clearInterval(id)
    }
    // Intentionally run once on mount; timeZone not included to avoid restart loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo<GameTimeContextValue>(() => ({ now, timeZone }), [now, timeZone])

  // Use createElement instead of JSX to avoid TSX parsing in a .ts file.
  return React.createElement(GameTimeContext.Provider, { value }, children)
}

/**
 * useGameTime
 *
 * Hook to access current Date and timezone from context. Falls back to system timezone.
 *
 * @returns GameTimeContextValue
 */
export function useGameTime(): GameTimeContextValue {
  const ctx = useContext(GameTimeContext)
  if (!ctx) {
    return { now: new Date(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }
  }
  return ctx
}