/**
 * src/lib/time.tsx
 *
 * Game time provider and hook.
 * - Reads latest row from public.game_time using supabase-js.
 * - Polls periodically.
 */

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase'
import { fetchLatestGameTime } from './db'

type GameTimeContextType = {
  gameTime: Date | null
  loading: boolean
  refresh: () => Promise<void>
}

const GameTimeContext = createContext<GameTimeContextType | undefined>(undefined)

function parseSupabaseTime(ts: string | null | undefined): Date | null {
  if (!ts) return null
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? null : d
}

export function GameTimeProvider({
  children,
  pollMs = 15000,
}: {
  children: React.ReactNode
  pollMs?: number
}) {
  const [gameTime, setGameTime] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)

  async function refresh() {
    try {
      const row = await fetchLatestGameTime()
      const next = parseSupabaseTime(row?.current_time ?? row?.game_timestamp)
      if (!mounted.current) return
      setGameTime(next)
    } finally {
      if (mounted.current) setLoading(false)
    }
  }

  useEffect(() => {
    mounted.current = true
    refresh()

    const t = window.setInterval(refresh, pollMs)

    // Optional realtime (safe even if realtime isn't enabled)
    const channel = supabase
      .channel('game-time')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_time' }, refresh)
      .subscribe()

    return () => {
      mounted.current = false
      window.clearInterval(t)
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollMs])

  const value = useMemo(() => ({ gameTime, loading, refresh }), [gameTime, loading])

  return <GameTimeContext.Provider value={value}>{children}</GameTimeContext.Provider>
}

export function useGameTime() {
  const ctx = useContext(GameTimeContext)
  if (!ctx) throw new Error('useGameTime must be used inside GameTimeProvider')
  return ctx
}
