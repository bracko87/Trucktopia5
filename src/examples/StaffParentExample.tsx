/**
 * StaffParentExample.tsx
 *
 * Example parent that consumes SkillTrainingModal and implements the recommended
 * onTrain callback which refetches hired staff and updates parent state.
 *
 * This is an example file to copy into your parent component; do not import
 * this example directly unless you want a demo.
 */

import React from 'react'
import { supabase } from '@/lib/supabase'
import SkillTrainingModal from '@/components/staff/SkillTrainingModal'
import { useEffect, useState } from 'react'
import { dispatchHiredStaffChanged, useHiredStaffChangedListener } from '@/lib/hiredStaffEvents'

export default function StaffParentExample({ companyId }: { companyId: string }) {
  const [staff, setStaff] = useState<any[]>([])
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [activeStaffRow, setActiveStaffRow] = useState<any | null>(null)

  /**
   * handleStaffTrainingChanged
   *
   * Refetch the list of hired staff for the company and update state.
   */
  async function handleStaffTrainingChanged() {
    try {
      const { data, error } = await supabase
        .from('hired_staff_view')
        .select('*')
        .eq('company_id', companyId)

      if (error) throw error
      setStaff(data ?? [])
    } catch (err) {
      console.error('Failed to reload hired staff', err)
    }
  }

  // initial load
  useEffect(() => {
    handleStaffTrainingChanged()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  // listen to global event (optional - complementary to direct onTrain call)
  useEffect(() => {
    const cb = () => {
      handleStaffTrainingChanged()
    }
    window.addEventListener('hiredStaff:changed', cb)
    return () => window.removeEventListener('hiredStaff:changed', cb)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  // open modal for a staff row
  function openForStaff(row: any) {
    setActiveStaffRow(row)
    setSelectedStaffId(row.id)
    setModalOpen(true)
  }

  return (
    <div>
      <h3 className="mb-4 font-semibold">Hired staff ({staff.length})</h3>

      <div className="space-y-2">
        {staff.map(s => (
          <div key={s.id} className="p-2 border rounded flex justify-between items-center">
            <div>
              <div className="font-medium">{s.first_name} {s.last_name}</div>
              <div className="text-xs text-slate-500">{s.job_category}</div>
            </div>

            <div>
              <button onClick={() => openForStaff(s)} className="px-3 py-1 rounded bg-sky-600 text-white">Manage</button>
            </div>
          </div>
        ))}
      </div>

      {activeStaffRow && (
        <SkillTrainingModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setSelectedStaffId(null); }}
          staffId={selectedStaffId!}
          jobCategory={activeStaffRow.job_category}
          onTrain={async () => {
            // recommended: refetch from parent
            await handleStaffTrainingChanged()
          }}
          onRemoveSkill={async (skillId: string) => {
            // example remove implementation
            await supabase.from('hired_staff').update({ skill1_id: null }).eq('id', selectedStaffId)
            // notify listeners/parent
            dispatchHiredStaffChanged()
            await handleStaffTrainingChanged()
          }}
        />
      )}
    </div>
  )
}