import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { staff_id, salary } = await req.json()

    if (!staff_id) {
      return new Response(
        JSON.stringify({ error: 'Missing staff_id' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // 🔑 Service role — NO browser auth needed
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: staff, error: fetchError } = await supabase
      .from('hired_staff')
      .select('salary, happiness')
      .eq('id', staff_id)
      .single()

    if (fetchError) throw fetchError

    const oldSalary = Number(staff.salary ?? 0)
    const newSalary = salary ?? 0

    let newHappiness = staff.happiness ?? 100
    if (oldSalary > 0 && newSalary !== oldSalary) {
      const delta = ((newSalary - oldSalary) / oldSalary) * 100
      newHappiness = Math.max(0, Math.min(100, Math.round(newHappiness + delta)))
    }

    const { error: updateError } = await supabase
      .from('hired_staff')
      .update({
        salary: newSalary,
        happiness: newHappiness,
      })
      .eq('id', staff_id)

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({ ok: true, salary: newSalary, happiness: newHappiness }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
