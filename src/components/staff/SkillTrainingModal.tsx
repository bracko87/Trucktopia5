/**
 * SkillTrainingModal.tsx
 *
 * Content-only skill training UI. This component:
 *  - Shows available skills
 *  - Generates a stable preview cost/duration per confirmation
 *  - Calls RPC to start training (uses startStaffSkillTraining wrapper)
 *  - Applies an optimistic UI update immediately after the user confirms
 *  - Dispatches a global event so parent lists can refetch or apply optimistic updates
 *
 * Visual layout and classNames preserved.
 */

import React from 'react'
import ModalShell from '@/components/common/ModalShell'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { dispatchHiredStaffChanged } from '@/lib/hiredStaffEvents'
import { startStaffSkillTraining } from '@/lib/api/startStaffSkillTraining'

/**
 * Minimum training cost (USD) - fallback when no rules exist
 */
const TRAINING_COST_MIN = 7000

/**
 * Maximum training cost (USD) - fallback when no rules exist
 */
const TRAINING_COST_MAX = 15000

/**
 * Minimum training duration (days) - fallback when no rules exist
 */
const TRAINING_DURATION_MIN_DAYS = 10

/**
 * Maximum training duration (days) - fallback when no rules exist
 */
const TRAINING_DURATION_MAX_DAYS = 20

/**
 * SkillMaster
 *
 * UI-friendly subset representing a skills_master row.
 */
export interface SkillMaster {
  id: string
  code: string
  name: string
  rarity: string
  description?: string | null
}

/**
 * SkillTrainingModalProps
 *
 * Props for the SkillTrainingModal component.
 */
interface SkillTrainingModalProps {
  open: boolean
  onClose: () => void
  staffId: string
  trainedSkillIds?: string[]
  trainingSkillId?: string | null
  isTraining?: boolean
  trainingUntil?: Date | null
  slotsUsed?: number
  maxSlots?: number
  jobCategory: string
  onTrain: (skillId: string) => Promise<void>
  onRemoveSkill: (skillId: string) => Promise<void>
  /**
   * Optional parent-provided persistent preview quote. When the parent
   * supplies this it will be used instead of generating a new preview.
   */
  quote?: { cost: number; days: number } | null
  /**
   * Callback used to persist a generated preview quote back to the parent
   * so the preview survives unmount/mount cycles.
   */
  onQuote?: (q: { cost: number; days: number }) => void
}

/**
 * TrainingRules
 *
 * Shape of staff_training_rules table row used by the modal.
 */
interface TrainingRules {
  id?: string
  job_category?: string | null
  min_cost?: number | null
  max_cost?: number | null
  min_duration_days?: number | null
  max_duration_days?: number | null
}

/**
 * SkillTrainingModal
 *
 * Content-only skill training UI. When open is false returns null. The caller
 * should wrap this component with ModalShell to provide the backdrop and outer
 * modal card (this keeps the visual treatment identical to SalaryModal).
 *
 * Layout and logic are preserved from the original component with minimal
 * changes to ensure stable preview quotes across unmounts.
 */
export default function SkillTrainingModal({
  open,
  onClose,
  staffId,
  trainedSkillIds: trainedSkillIdsProp = [],
  trainingSkillId: trainingSkillIdProp = null,
  isTraining: isTrainingProp = false,
  trainingUntil: trainingUntilProp = null,
  slotsUsed: slotsUsedProp = 0,
  maxSlots: maxSlotsProp = 3,
  jobCategory,
  onTrain,
  onRemoveSkill,
  quote,
  onQuote,
}: SkillTrainingModalProps) {
  const { user } = useAuth()

  const [skills, setSkills] = React.useState<SkillMaster[]>([])
  const [loading, setLoading] = React.useState(false)
  const [canAffordTraining, setCanAffordTraining] = React.useState(true)

  // Training rules loaded per job category (overrides hardcoded defaults)
  const [trainingRules, setTrainingRules] = React.useState<TrainingRules | null>(null)

  // DB-authoritative state loaded when modal opens
  const [dbTrainedSkillIds, setDbTrainedSkillIds] = React.useState<string[] | null>(null)
  const [dbTrainingSkillId, setDbTrainingSkillId] = React.useState<string | null | undefined>(undefined)
  const [dbIsTraining, setDbIsTraining] = React.useState<boolean | null>(null)
  const [dbTrainingUntil, setDbTrainingUntil] = React.useState<Date | null | undefined>(undefined)
  const [dbSlotsUsed, setDbSlotsUsed] = React.useState<number | null>(null)
  const [dbMaxSlots] = React.useState<number>(maxSlotsProp ?? 3)

  const [mutating, setMutating] = React.useState(false)

  /**
   * Controls the small confirmation modal shown when user selects Train.
   */
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  /**
   * Skill pending confirmation for training.
   */
  const [pendingSkill, setPendingSkill] = React.useState<SkillMaster | null>(null)

  /**
   * lastTrainingInfo
   *
   * Stores backend-returned training metadata after a successful start.
   */
  const [lastTrainingInfo, setLastTrainingInfo] = React.useState<{
    cost?: number | null
    days?: number | null
    until?: string | null
  } | null>(null)

  /**
   * previewQuote
   *
   * Local preview quote used internally. Parent-provided `quote` is preferred
   * and mirrored into this state when present.
   */
  const [previewQuote, setPreviewQuote] = React.useState<{ cost: number; days: number } | null>(null)

  /**
   * successMessage
   *
   * Temporary UI message shown after training starts.
   */
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)

  /**
   * refreshStaffState
   *
   * Fetches the hired_staff row for staffId and updates local DB-backed state.
   *
   * @returns Promise<void>
   */
  async function refreshStaffState() {
    try {
      const { data, error } = await supabase
        .from('hired_staff')
        .select(
          `
  skill1_id,
  skill2_id,
  skill3_id,
  training_skill_id,
  activity_id,
  activity_until,
  training_cost,
  training_duration_days
`
        )
        .eq('id', staffId)
        .single()

      if (error) {
        console.error('Failed to load hired_staff row', error)
        return
      }

      const trained = [data?.skill1_id, data?.skill2_id, data?.skill3_id].filter(Boolean) as string[]
      setDbTrainedSkillIds(trained)
      setDbTrainingSkillId(data?.training_skill_id ?? null)
      setDbIsTraining((data?.activity_id ?? null) === 'training')
      setDbTrainingUntil(data?.activity_until ? new Date(data.activity_until) : null)
      setDbSlotsUsed(trained.length)

      // Load fixed server-provided preview if present on the hired_staff row.
      const cost = Number((data as any)?.training_cost ?? 0)
      const days = Number((data as any)?.training_duration_days ?? 0)
      if (cost > 0 && days > 0) {
        // Ensure a stable preview taken from DB is used by the confirmation UI.
        const q = {
          cost,
          days,
        }
        setPreviewQuote(q)
        try {
          onQuote?.(q)
        } catch (e) {
          // noop
        }
      } else if (!previewQuote) {
        // No DB-provided quote found; create a deterministic fallback using rules or hardcoded defaults.
        const fallback = {
          cost: trainingRules?.min_cost ?? TRAINING_COST_MIN,
          days: trainingRules?.min_duration_days ?? TRAINING_DURATION_MIN_DAYS,
        }
        setPreviewQuote(fallback)
        try {
          onQuote?.(fallback)
        } catch (e) {
          // noop
        }
      }
    } catch (err) {
      console.error('refreshStaffState error', err)
    }
  }

  React.useEffect(() => {
    if (!open) return

    let alive = true
    setLoading(true)

    // Load skills for job category
    supabase
      .from('skills_master')
      .select('id, code, name, rarity, description')
      .eq('category', jobCategory)
      .order('name')
      .then(({ data, error }) => {
        if (!alive) return
        if (error) {
          console.error('Failed to load skills', error)
          setSkills([])
        } else {
          setSkills(data ?? [])
        }
      })

    // Load training rules for job category (overrides hardcoded defaults)
    supabase
      .from('staff_training_rules')
      .select('*')
      .eq('job_category', jobCategory)
      .single()
      .then(({ data, error }) => {
        if (!alive) return
        if (error) {
          // No rules found is acceptable; keep null to use fallbacks
          setTrainingRules(null)
        } else {
          setTrainingRules(data ?? null)
        }
      })

    // Load authoritative company balance (prefer user's company if available)
    const companyQuery = user?.company_id
      ? supabase.from('companies').select('id,balance_cents').eq('id', user.company_id).single()
      : supabase.from('companies').select('id,balance_cents').single()

    companyQuery
      .then(({ data, error }) => {
        if (!alive) return
        if (error) {
          console.error('Failed to load company balance', error)
          setCanAffordTraining(false)
          return
        }
        const balanceCents = Number(data?.balance_cents ?? 0)
        const MIN_CENTS = (trainingRules?.min_cost ?? TRAINING_COST_MIN) * 100
        setCanAffordTraining(balanceCents >= MIN_CENTS)
      })
      .finally(() => alive && setLoading(false))

    // Load staff state
    refreshStaffState()

    // Respect parent-provided quote only; do not generate fallback here to avoid races.
    if (quote) {
      setPreviewQuote(quote)
    }

    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, jobCategory, staffId, user?.company_id])

  if (!open) return null

  /**
   * stopTraining
   *
   * Stop currently running training for staff by clearing training fields.
   *
   * @returns Promise<void>
   */
  async function stopTraining() {
    setMutating(true)
    try {
      const { error } = await supabase
        .from('hired_staff')
        .update({
          training_skill_id: null,
          activity_until: null,
          activity_id: 'free',
        })
        .eq('id', staffId)

      if (error) {
        console.error('Failed to stop training', error)
      }

      await refreshStaffState()
    } catch (err) {
      console.error('stopTraining error', err)
    } finally {
      setMutating(false)
    }
  }

  /**
   * predictCostAndDuration
   *
   * Deterministic preview generator. Prefers in-memory previewQuote (or
   * parent-provided quote). If none is available, returns configured minimums.
   * This function is pure (it DOES NOT mutate state) — callers should set
   * previewQuote state and notify parent when appropriate.
   */
  function predictCostAndDuration() {
    if (previewQuote) return previewQuote

    const minCost = trainingRules?.min_cost ?? TRAINING_COST_MIN
    const minDays = trainingRules?.min_duration_days ?? TRAINING_DURATION_MIN_DAYS

    return { cost: minCost, days: minDays }
  }

  /**
   * startTrainingBackend
   *
   * Calls the startStaffSkillTraining wrapper (no p_days/p_cost sent).
   * After backend confirms it:
   *  - applies authoritative UI update
   *  - calls parent onTrain
   *  - dispatches global hired_staff changed event
   *  - refreshes authoritative staff row
   *
   * @param skill SkillMaster
   */
  async function startTrainingBackend(skill: SkillMaster) {
    setMutating(true)
    try {
      // Use wrapper (throws on error)
      const data = await startStaffSkillTraining(staffId, skill.id)

      // Backend response is authoritative; use it for UI
      const returned: any = Array.isArray(data) ? data[0] : data

      // Map backend response to local variables (backend returns duration_days / until_time)
      const cost = returned?.cost ?? null
      const days = returned?.duration_days ?? returned?.days ?? null
      const until = returned?.until_time ?? returned?.until ?? null

      setLastTrainingInfo({ cost, days, until })

      // ------------------------------
      // ✅ Authoritative UI switch (update with backend truth)
      // ------------------------------
      try {
        setDbTrainingSkillId(skill.id)
        setDbIsTraining(true)
        if (until) {
          setDbTrainingUntil(new Date(until))
        } else if (previewQuote?.days) {
          // authoritative optimistic until if backend didn't return an explicit 'until'
          setDbTrainingUntil(new Date(Date.now() + previewQuote.days * 24 * 60 * 60 * 1000))
        }
      } catch (err) {
        // Defensive - continue with authoritative refresh even if optimistic update fails
        console.warn('Authoritative UI update failed', err)
      }

      // ------------------------------
      // ✅ Notify parent(s) with authoritative payload
      // ------------------------------
      try {
        await onTrain(skill.id)
      } catch (err) {
        console.warn('parent onTrain errored (non-blocking)', err)
      } finally {
        try {
          dispatchHiredStaffChanged({
            staffId,
            trainingSkillId: skill.id,
            isTraining: true,
            until: until ?? (previewQuote?.days ? new Date(Date.now() + previewQuote.days * 24 * 60 * 60 * 1000).toISOString() : null),
            authoritative: true,
          })
        } catch (e) {
          // noop
        }
      }

      // ✅ Authoritative refresh (DB truth)
      await refreshStaffState()

      // Success message
      if (cost || days || until) {
        const untilText = until ? new Date(until).toLocaleDateString() : '—'
        const costText = typeof cost === 'number' ? `$${Number(cost).toLocaleString()}` : '—'
        const daysText = typeof days === 'number' ? `${days} days` : '—'
        setSuccessMessage(`Training started — Cost: ${costText} · Duration: ${daysText} · Ends: ${untilText}`)
        // auto-clear message after 4 seconds
        setTimeout(() => setSuccessMessage(null), 4000)
      }

      // Clean preview now that backend completed (keeps next confirmation fresh)
      setPreviewQuote(null)
      try { onQuote?.(null) } catch {}

      setConfirmOpen(false)
      setPendingSkill(null)
    } catch (err) {
      // startStaffSkillTraining throws on error so we catch it here
      console.error('startTrainingBackend error', err)
      throw err
    } finally {
      setMutating(false)
    }
  }

  // Prefer DB-backed state when available
  const displayedTrainedSkillIds = dbTrainedSkillIds ?? trainedSkillIdsProp
  const displayedTrainingSkillId =
    dbTrainingSkillId !== undefined ? (dbTrainingSkillId ?? null) : trainingSkillIdProp
  const displayedIsTraining = dbIsTraining ?? isTrainingProp
  const displayedTrainingUntil =
    dbTrainingUntil !== undefined ? (dbTrainingUntil ?? null) : trainingUntilProp
  const displayedSlotsUsed = dbSlotsUsed ?? slotsUsedProp
  const displayedMaxSlots = dbMaxSlots ?? maxSlotsProp

  // Helpers for UI ranges (use rules if available)
  const uiMinCost = trainingRules?.min_cost ?? TRAINING_COST_MIN
  const uiMaxCost = trainingRules?.max_cost ?? TRAINING_COST_MAX
  const uiMinDays = trainingRules?.min_duration_days ?? TRAINING_DURATION_MIN_DAYS
  const uiMaxDays = trainingRules?.max_duration_days ?? TRAINING_DURATION_MAX_DAYS

  // Content-only UI (no backdrop/header). The caller provides outer ModalShell.
  return (
    <div className="w-full">
      {/* Top indicators */}
      <div className="flex items-center justify-between text-sm mb-4">
        <div>
          Slots: <strong>{displayedSlotsUsed} / {displayedMaxSlots}</strong>
        </div>

        {displayedIsTraining && displayedTrainingUntil && (
          <div className="text-purple-600">
            Training until <strong>{displayedTrainingUntil.toLocaleDateString()}</strong>
          </div>
        )}
      </div>

      {/* Success message */}
      {successMessage && <div className="text-sm text-green-600 mb-3">{successMessage}</div>}

      {/* Loading */}
      {loading && <div className="text-sm text-slate-500">Loading skills…</div>}

      {/* No skills */}
      {!loading && skills.length === 0 && (
        <div className="text-sm text-slate-500">No skills available for this role.</div>
      )}

      {/* Skills list */}
      <div className="space-y-3">
        {skills.map((skill) => {
          const isTrained = displayedTrainedSkillIds?.includes(skill.id) ?? false
          const isThisTraining = displayedTrainingSkillId === skill.id

          const canTrain =
            !displayedIsTraining &&
            !isTrained &&
            !isThisTraining &&
            (displayedSlotsUsed ?? 0) < displayedMaxSlots &&
            canAffordTraining

          return (
            <div key={skill.id} className="border rounded-lg p-3 flex items-start justify-between">
              <div>
                <div className="font-medium">{skill.name}</div>
                <div className="text-xs text-slate-500">{skill.rarity}</div>

                {skill.description && <div className="text-sm text-slate-600 mt-1">{skill.description}</div>}

                {/* Display configured range for transparency */}
                <div className="text-xs text-slate-500 mt-2">
                  Cost: <strong>${uiMinCost.toLocaleString()} – ${uiMaxCost.toLocaleString()}</strong>
                  {' · '}
                  Duration: <strong>{uiMinDays}–{uiMaxDays} days</strong>
                </div>

                {!canAffordTraining && (
                  <div className="text-xs text-red-600 mt-1">Not enough funds (minimum ${uiMinCost.toLocaleString()} required)</div>
                )}
              </div>

              {/* Right side status / button */}
              <div className="ml-4 flex flex-col items-end gap-1">
                {isTrained && (
                  <>
                    <span className="text-green-600 text-sm font-medium">Trained</span>

                    {!displayedIsTraining && (
                      <button
                        onClick={async () => {
                          setMutating(true)
                          try {
                            await onRemoveSkill(skill.id)
                            await refreshStaffState()
                          } finally {
                            setMutating(false)
                          }
                        }}
                        className="px-3 py-1 text-xs rounded-md border border-red-600 text-red-600 bg-white hover:bg-red-50 transition-colors duration-150 shadow-sm flex items-center gap-2"
                        aria-label={`Remove ${skill.name}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                          <path d="M10 11v6"></path>
                          <path d="M14 11v6"></path>
                          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        Remove
                      </button>
                    )}
                  </>
                )}

                {isThisTraining && (
                  <>
                    <span className="text-purple-600 text-sm font-medium">Training…</span>

                    <button
                      onClick={async () => {
                        if (mutating) return
                        await stopTraining()
                      }}
                      disabled={mutating}
                      aria-label={`Stop training ${skill.name}`}
                      className="mt-1 inline-flex items-center gap-2 px-2 py-1 text-xs font-medium rounded-md border border-red-600 text-red-600 bg-white hover:bg-red-50 transition-colors duration-150 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {mutating ? (
                        <>
                          <svg
                            className="animate-spin -ml-0.5 h-3 w-3 text-red-600"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                          </svg>
                          <span>Stopping…</span>
                        </>
                      ) : (
                        'Stop'
                      )}
                    </button>
                  </>
                )}

                {!isTrained && !isThisTraining && (
                  <button
                    disabled={!canTrain || mutating}
                    onClick={() => {
                      // Generate a stable preview quote for confirmation (only once)
                      const q = previewQuote ?? predictCostAndDuration()
                      setPreviewQuote(q)
                      try {
                        onQuote?.(q)
                      } catch (e) {
                        // noop
                      }
                      setPendingSkill(skill)
                      setConfirmOpen(true)
                    }}
                    className={`px-3 py-1 text-sm rounded ${canTrain ? 'bg-sky-600 text-white hover:bg-sky-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                    aria-label={`Train ${skill.name}`}
                  >
                    {mutating ? 'Processing…' : 'Train'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer actions (caller ModalShell will include outer footer; keep an inline Close here) */}
      <div className="mt-6 text-right">
        <button onClick={() => { onClose(); }} className="px-4 py-2 text-sm border rounded bg-white">Close</button>
      </div>

      {/* Confirmation modal (keeps using ModalShell internally) */}
      <ModalShell
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false)
          setPendingSkill(null)
        }}
        title={pendingSkill ? `Train ${pendingSkill.name}` : 'Train skill'}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setConfirmOpen(false)
                setPendingSkill(null)
              }}
              className="px-3 py-1 border rounded bg-white"
              aria-label="Cancel training"
            >
              Cancel
            </button>

            <button
              onClick={async () => {
                if (!pendingSkill) return
                setMutating(true)
                try {
                  // Optimistic immediate UI update and broadcast so lists update right away.
                  // Use the preview quote if available to compute a sensible 'until' for UI.
                  const { days } = previewQuote ?? predictCostAndDuration()
                  const untilDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
                  try {
                    setDbTrainingSkillId(pendingSkill.id)
                    setDbIsTraining(true)
                    setDbTrainingUntil(untilDate)
                  } catch (err) {
                    // noop - optimistic local update isn't critical
                  }

                  try {
                    dispatchHiredStaffChanged({
                      staffId,
                      trainingSkillId: pendingSkill.id,
                      isTraining: true,
                      until: untilDate.toISOString(),
                      optimistic: true,
                    })
                  } catch (err) {
                    // noop
                  }

                  // Call backend - wrapper will dispatch authoritative change when done.
                  await startTrainingBackend(pendingSkill)
                } catch (err) {
                  // error logged in startTrainingBackend; keep modal open so user can retry or cancel
                  console.error(err)
                } finally {
                  setMutating(false)
                }
              }}
              className="px-3 py-1 rounded bg-sky-600 text-white hover:bg-sky-700"
              aria-label="Confirm training"
            >
              {mutating ? 'Starting…' : 'Confirm & Pay'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="text-sm text-slate-700">{pendingSkill?.description ?? 'Start training this skill.'}</div>

          {pendingSkill ? (
            (() => {
              const { cost, days } = previewQuote ?? predictCostAndDuration()
              return (
                <>
                  <div className="text-sm text-slate-600">Predicted cost: <strong>${cost.toLocaleString()}</strong></div>
                  <div className="text-sm text-slate-600">Predicted duration: <strong>{days} days</strong></div>
                  <div className="text-xs text-slate-500">The backend will apply its authoritative cost and duration when you confirm.</div>
                </>
              )
            })()
          ) : (
            <>
              <div className="text-sm text-slate-600">Cost: <strong>${uiMinCost.toLocaleString()} – ${uiMaxCost.toLocaleString()}</strong></div>
              <div className="text-sm text-slate-600">Duration: <strong>{uiMinDays}–{uiMaxDays} days</strong></div>
            </>
          )}
        </div>
      </ModalShell>
    </div>
  )
}
