/**
 * AssignPositionForm.tsx
 *
 * Simple form to assign, change or unassign a position for a manager/director.
 *
 * - Loads available positions from staff_positions_master filtered by category.
 * - Loads currently assigned position_ids from hired_staff to disable already-taken positions.
 * - Allows selecting a position, choosing "Unassigned" to clear the position, or using the Unassign link.
 * - Persists the change to hired_staff.position_id AND keeps activity_id in sync.
 */

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface PositionRow {
  id: string
  code: string
  name: string
  category?: string | null
}

/**
 * Dispatch a global reload event so staff list re-fetches canonically
 */
function dispatchStaffReload() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('staff:reload'))
  }
}

export default function AssignPositionForm({
  staffId,
  currentPositionId,
  category,
  onAssigned,
}: {
  staffId: string
  currentPositionId: string | null
  category: string
  onAssigned?: () => void
}) {
  const [positions, setPositions] = useState<PositionRow[]>([])
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<string | null>(currentPositionId)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Load positions + already-assigned position_ids
   */
  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      try {
        // load available positions for category
        const { data: posData, error: posErr } = await supabase
          .from('staff_positions_master')
          .select('id,code,name,category')
          .eq('category', category)
          .order('name', { ascending: true })

        if (!mounted) return
        setPositions(posErr ? [] : ((posData ?? []) as PositionRow[]))

        // load currently assigned positions
        const { data: assignedData, error: assignedErr } = await supabase
          .from('hired_staff')
          .select('position_id')
          .not('position_id', 'is', null)

        if (!mounted) return

        if (assignedErr) {
          setAssignedIds(new Set())
        } else {
          const s = new Set<string>()
          for (const r of assignedData ?? []) {
            const pid = (r as any).position_id
            if (pid) s.add(String(pid))
          }
          setAssignedIds(s)
        }
      } catch (err) {
        console.error('AssignPositionForm.load error', err)
        setPositions([])
        setAssignedIds(new Set())
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [category])

  /**
   * save
   *
   * Assign selected position and mark staff as assigned.
   */
  async function save() {
    if (!selected) {
      setError('Select a position or choose "Unassigned".')
      return
    }

    if (selected === '__unassigned') {
      await unassign()
      return
    }

    setSaving(true)
    setError(null)

    try {
      const { error } = await supabase
        .from('hired_staff')
        .update({
          position_id: selected,
          activity_id: 'assigned',
          activity_until: null,
        })
        .eq('id', staffId)

      if (error) {
        setError(error.message ?? 'Failed to assign position')
        return
      }

      onAssigned?.()
      dispatchStaffReload()
    } catch (err: any) {
      console.error('AssignPositionForm.save error', err)
      setError(err?.message ?? 'Failed to assign position')
    } finally {
      setSaving(false)
    }
  }

  /**
   * unassign
   *
   * Clear position and restore staff availability.
   */
  async function unassign() {
    setSaving(true)
    setError(null)

    try {
      const { error } = await supabase
        .from('hired_staff')
        .update({
          position_id: null,
          activity_id: 'free',
          activity_until: null,
        })
        .eq('id', staffId)

      if (error) {
        setError(error.message ?? 'Failed to unassign position')
        return
      }

      onAssigned?.()
      dispatchStaffReload()
    } catch (err: any) {
      console.error('AssignPositionForm.unassign error', err)
      setError(err?.message ?? 'Failed to unassign position')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-3">
        <label className="block text-sm text-slate-700 mb-2">Position</label>

        <select
          className="w-full border rounded px-3 py-2"
          value={selected ?? ''}
          onChange={(e) => setSelected(e.target.value || null)}
          disabled={loading || saving}
        >
          <option value="">Select a position…</option>
          <option value="__unassigned">Unassigned</option>

          {positions.map((p) => {
            const disabled = assignedIds.has(p.id) && p.id !== currentPositionId
            return (
              <option key={p.id} value={p.id} disabled={disabled}>
                {p.name}
                {disabled ? ' (assigned)' : ''}
              </option>
            )
          })}
        </select>

        {error && <div className="mt-2 text-sm text-rose-600">{error}</div>}
      </div>

      <div className="flex justify-end gap-2 mt-4">
        {currentPositionId && (
          <button
            className="text-xs text-slate-500 underline mt-1 mr-auto"
            onClick={unassign}
            disabled={saving}
          >
            Unassign position
          </button>
        )}

        <button
          className="px-3 py-2 text-sm border rounded bg-white"
          onClick={save}
          disabled={saving || loading}
        >
          Save
        </button>
      </div>
    </div>
  )
}
