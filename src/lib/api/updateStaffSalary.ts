import { supabase } from '@/lib/supabase'

export async function updateStaffSalary(
  staffId: string,
  salary: number | null
) {
  const { error } = await supabase
    .from('hired_staff')
    .update({ salary })
    .eq('id', staffId)

  if (error) {
    throw error
  }
}
