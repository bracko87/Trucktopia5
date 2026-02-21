import React from 'react'

interface ActivityPillProps {
  activityId?: string | null
  label?: string | null
}

const COLOR_MAP: Record<string, string> = {
  free: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  assigned: 'bg-sky-100 text-sky-800 border-sky-200',
  vacation: 'bg-orange-100 text-orange-800 border-orange-200',
  training: 'bg-violet-100 text-violet-800 border-violet-200',
  sick: 'bg-rose-100 text-rose-800 border-rose-200',
  injured: 'bg-rose-100 text-rose-800 border-rose-200',
}

export default function ActivityPill({ activityId, label }: ActivityPillProps): JSX.Element {
  const id = activityId ?? 'unknown'
  const text = label ?? fallbackLabel(id)

  const classes = COLOR_MAP[id] ?? 'bg-slate-100 text-slate-700 border-slate-200'

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${classes}`}>
      {text}
    </span>
  )
}

function fallbackLabel(id: string): string {
  if (!id) return 'Unknown'
  return id.charAt(0).toUpperCase() + id.slice(1)
}
