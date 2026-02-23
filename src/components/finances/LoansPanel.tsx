/**
 * LoansPanel.tsx
 *
 * Loans panel for displaying company loans, schedule and actions.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient' // <- adjust to your project path

type CompanyLoan = {
  id: string
  company_id: string
  principal: number
  fee: number
  total_owed: number
  remaining_owed: number
  created_at: string
  expires_at: string
  active: boolean
}

type CompanyProfile = {
  id: string
  reputation: number | null
  level: number | null
  is_bankrupt: boolean
}

type Props = {
  companyId: string
}

type StatusFilter = 'all' | 'active' | 'inactive'
type SortKey =
  | 'created_at_desc'
  | 'created_at_asc'
  | 'expires_at_asc'
  | 'expires_at_desc'
  | 'remaining_owed_desc'
  | 'remaining_owed_asc'
  | 'total_owed_desc'
  | 'total_owed_asc'

type OfferSortKey =
  | 'apr_asc'
  | 'apr_desc'
  | 'weekly_payment_asc'
  | 'weekly_payment_desc'
  | 'max_amount_desc'
  | 'max_amount_asc'

type RepaymentMode = 'apr_simple' | 'apr_amortized' | 'factor_rate'

type EstimateResult = {
  mode: RepaymentMode
  interest: number
  originationFee: number
  adminFee: number
  totalRepayment: number
  weeklyPayment: number
}

type LoanOffer = {
  id: string
  bankName: string
  logoText: string // placeholder for future logo image
  aprMin: number // annual %
  aprMax: number // annual %
  factorRateMin: number
  factorRateMax: number
  originationFeePct: number // one-time fee %
  adminFeeFixed: number // fixed admin fee
  latePenaltyPct: number // preview only
  minAmount: number
  maxAmount: number
  minWeeks: number
  maxWeeks: number
  approvalSpeed: string
  notes: string
}

/**
 * Format currency safely
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

/**
 * Format date safely
 */
function formatDate(value: string): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString()
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * APR simple estimate (flat/simple interest)
 */
function calculateSimpleAprLoan(
  principal: number,
  weeks: number,
  aprPercent: number,
  originationFeePct: number,
  adminFeeFixed: number
): EstimateResult {
  const annualRate = aprPercent / 100
  const interest = principal * annualRate * (weeks / 52)
  const originationFee = principal * (originationFeePct / 100)
  const adminFee = adminFeeFixed
  const totalRepayment = principal + interest + originationFee + adminFee
  const weeklyPayment = totalRepayment / weeks

  return {
    mode: 'apr_simple',
    interest: round2(interest),
    originationFee: round2(originationFee),
    adminFee: round2(adminFee),
    totalRepayment: round2(totalRepayment),
    weeklyPayment: round2(weeklyPayment),
  }
}

/**
 * APR amortized estimate (weekly compounding/payments approximation)
 */
function calculateAmortizedAprLoan(
  principal: number,
  weeks: number,
  aprPercent: number,
  originationFeePct: number,
  adminFeeFixed: number
): EstimateResult {
  const weeklyRate = aprPercent / 100 / 52
  const originationFee = principal * (originationFeePct / 100)
  const adminFee = adminFeeFixed

  // For UI estimate we add fees to financed amount
  const financedPrincipal = principal + originationFee + adminFee

  let weeklyPayment = 0
  if (weeklyRate === 0) {
    weeklyPayment = financedPrincipal / weeks
  } else {
    weeklyPayment =
      (financedPrincipal * weeklyRate) / (1 - Math.pow(1 + weeklyRate, -weeks))
  }

  const totalRepayment = weeklyPayment * weeks
  const interest = totalRepayment - financedPrincipal

  return {
    mode: 'apr_amortized',
    interest: round2(interest),
    originationFee: round2(originationFee),
    adminFee: round2(adminFee),
    totalRepayment: round2(totalRepayment),
    weeklyPayment: round2(weeklyPayment),
  }
}

/**
 * Factor rate estimate (common in short-term business financing)
 */
function calculateFactorRateLoan(
  principal: number,
  weeks: number,
  factorRate: number,
  originationFeePct: number,
  adminFeeFixed: number
): EstimateResult {
  const baseRepayment = principal * factorRate
  const originationFee = principal * (originationFeePct / 100)
  const adminFee = adminFeeFixed
  const totalRepayment = baseRepayment + originationFee + adminFee
  const weeklyPayment = totalRepayment / weeks
  const interest = baseRepayment - principal

  return {
    mode: 'factor_rate',
    interest: round2(interest),
    originationFee: round2(originationFee),
    adminFee: round2(adminFee),
    totalRepayment: round2(totalRepayment),
    weeklyPayment: round2(weeklyPayment),
  }
}

/**
 * Reputation-based loan capacity system
 */
function getLoanCapacityByReputation(reputation: number | null | undefined) {
  const rep = Math.max(0, Number(reputation ?? 0))
  const tier = Math.floor(rep / 10)

  // +1 active loan every 10 rep, capped
  const maxActiveLoans = Math.min(8, 1 + tier)

  // Stepwise per-loan cap (tune as needed)
  const maxSingleLoanByTier = [
    50000, // 0-9
    75000, // 10-19
    100000, // 20-29
    150000, // 30-39
    200000, // 40-49
    275000, // 50-59
    350000, // 60-69
    425000, // 70-79
    500000, // 80+
  ]
  const maxSingleLoanAmount =
    maxSingleLoanByTier[Math.min(tier, maxSingleLoanByTier.length - 1)]

  return {
    reputation: rep,
    tier,
    maxActiveLoans,
    maxSingleLoanAmount,
  }
}

/**
 * Static mock loan marketplace offers (fictional banks/lenders).
 * APRs/factor rates are in realistic SMB-loan style ranges (varies by risk/profile).
 */
const MOCK_LOAN_OFFERS: LoanOffer[] = [
  {
    id: 'offer-northbridge',
    bankName: 'NorthBridge Capital',
    logoText: 'NB',
    aprMin: 8.9,
    aprMax: 14.5,
    factorRateMin: 1.08,
    factorRateMax: 1.18,
    originationFeePct: 1.5,
    adminFeeFixed: 120,
    latePenaltyPct: 2.5,
    minAmount: 10000,
    maxAmount: 250000,
    minWeeks: 12,
    maxWeeks: 72,
    approvalSpeed: '24–48 hours',
    notes: 'Balanced rates for established companies.',
  },
  {
    id: 'offer-maple-crest',
    bankName: 'Maple Crest Finance',
    logoText: 'MC',
    aprMin: 10.5,
    aprMax: 18.9,
    factorRateMin: 1.1,
    factorRateMax: 1.24,
    originationFeePct: 2.0,
    adminFeeFixed: 95,
    latePenaltyPct: 3.0,
    minAmount: 5000,
    maxAmount: 120000,
    minWeeks: 6,
    maxWeeks: 52,
    approvalSpeed: 'Same day',
    notes: 'Fast approvals for short-term working capital.',
  },
  {
    id: 'offer-riverstone',
    bankName: 'Riverstone Lending Group',
    logoText: 'RL',
    aprMin: 7.95,
    aprMax: 12.75,
    factorRateMin: 1.06,
    factorRateMax: 1.16,
    originationFeePct: 1.25,
    adminFeeFixed: 150,
    latePenaltyPct: 2.0,
    minAmount: 25000,
    maxAmount: 500000,
    minWeeks: 12,
    maxWeeks: 72,
    approvalSpeed: '2–4 business days',
    notes: 'Higher limits for larger financing needs.',
  },
  {
    id: 'offer-blueharbor',
    bankName: 'BlueHarbor Business Credit',
    logoText: 'BH',
    aprMin: 9.75,
    aprMax: 16.25,
    factorRateMin: 1.09,
    factorRateMax: 1.21,
    originationFeePct: 1.8,
    adminFeeFixed: 110,
    latePenaltyPct: 2.8,
    minAmount: 15000,
    maxAmount: 300000,
    minWeeks: 8,
    maxWeeks: 60,
    approvalSpeed: '24 hours',
    notes: 'Flexible weekly repayment options.',
  },
  {
    id: 'offer-summit-peak',
    bankName: 'SummitPeak Funding',
    logoText: 'SP',
    aprMin: 12.9,
    aprMax: 22.5,
    factorRateMin: 1.14,
    factorRateMax: 1.32,
    originationFeePct: 2.5,
    adminFeeFixed: 85,
    latePenaltyPct: 3.5,
    minAmount: 5000,
    maxAmount: 80000,
    minWeeks: 6,
    maxWeeks: 36,
    approvalSpeed: 'Within hours',
    notes: 'Good for urgent short-term cash flow needs.',
  },
  {
    id: 'offer-cedarline',
    bankName: 'CedarLine Commercial Finance',
    logoText: 'CL',
    aprMin: 8.5,
    aprMax: 13.9,
    factorRateMin: 1.07,
    factorRateMax: 1.17,
    originationFeePct: 1.4,
    adminFeeFixed: 140,
    latePenaltyPct: 2.4,
    minAmount: 20000,
    maxAmount: 400000,
    minWeeks: 10,
    maxWeeks: 72,
    approvalSpeed: '1–3 business days',
    notes: 'Competitive terms for stable businesses.',
  },
]

/**
 * LoansPanel
 *
 * Shows loans overview, summary stats and a filterable list of loans.
 *
 * @returns JSX.Element
 */
export default function LoansPanel({ companyId }: Props): JSX.Element {
  const [loans, setLoans] = useState<CompanyLoan[]>([])
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null)

  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Existing loans table filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [minRemaining, setMinRemaining] = useState<string>('')
  const [maxRemaining, setMaxRemaining] = useState<string>('')
  const [expiresFrom, setExpiresFrom] = useState<string>('')
  const [expiresTo, setExpiresTo] = useState<string>('')
  const [sortKey, setSortKey] = useState<SortKey>('created_at_desc')

  // Apply-for-loan modal state
  const [isOffersOpen, setIsOffersOpen] = useState<boolean>(false)
  const [requestedAmount, setRequestedAmount] = useState<number>(50000)
  const [requestedWeeks, setRequestedWeeks] = useState<number>(24)

  // Advanced repayment mode
  const [repaymentMode, setRepaymentMode] = useState<RepaymentMode>('apr_amortized')

  // Offer filters/sorting
  const [offerSortKey, setOfferSortKey] = useState<OfferSortKey>('apr_asc')
  const [offerAprCap, setOfferAprCap] = useState<string>('') // max APR filter
  const [onlyExactTermSupport, setOnlyExactTermSupport] = useState<boolean>(true)
  const [minOfferLimit, setMinOfferLimit] = useState<string>('') // filter by lender max amount >= X

  // Reusable refresh loader
  async function refreshLoansForCompany(targetCompanyId: string) {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('company_loans')
      .select(
        `
        id,
        company_id,
        principal,
        fee,
        total_owed,
        remaining_owed,
        created_at,
        expires_at,
        active
      `
      )
      .eq('company_id', targetCompanyId)

    if (error) {
      setError(error.message)
      setLoans([])
    } else {
      setError(null)
      setLoans((data ?? []) as CompanyLoan[])
    }

    setLoading(false)
  }

  useEffect(() => {
    let mounted = true

    async function fetchLoans() {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('company_loans')
        .select(
          `
          id,
          company_id,
          principal,
          fee,
          total_owed,
          remaining_owed,
          created_at,
          expires_at,
          active
        `
        )
        .eq('company_id', companyId)

      if (!mounted) return

      if (error) {
        setError(error.message)
        setLoans([])
      } else {
        setLoans((data ?? []) as CompanyLoan[])
      }

      setLoading(false)
    }

    if (companyId) {
      fetchLoans()
    } else {
      setLoans([])
      setLoading(false)
    }

    return () => {
      mounted = false
    }
  }, [companyId])

  useEffect(() => {
    let mounted = true

    async function fetchCompanyProfile() {
      if (!companyId) return

      const { data, error } = await supabase
        .from('companies')
        .select('id, reputation, level, is_bankrupt')
        .eq('id', companyId)
        .single()

      if (!mounted) return

      if (error) {
        // keep UI working even if profile fetch fails
        console.error('Failed to fetch company profile:', error.message)
        setCompanyProfile(null)
        return
      }

      setCompanyProfile(data as CompanyProfile)
    }

    fetchCompanyProfile()

    return () => {
      mounted = false
    }
  }, [companyId])

  const filteredLoans = useMemo(() => {
    let result = [...loans]

    if (statusFilter === 'active') {
      result = result.filter((loan) => loan.active)
    } else if (statusFilter === 'inactive') {
      result = result.filter((loan) => !loan.active)
    }

    const q = searchTerm.trim().toLowerCase()
    if (q) {
      result = result.filter((loan) => {
        return (
          loan.id.toLowerCase().includes(q) ||
          loan.company_id.toLowerCase().includes(q)
        )
      })
    }

    const minVal = minRemaining !== '' ? Number(minRemaining) : null
    const maxVal = maxRemaining !== '' ? Number(maxRemaining) : null

    if (minVal !== null && !Number.isNaN(minVal)) {
      result = result.filter((loan) => Number(loan.remaining_owed) >= minVal)
    }
    if (maxVal !== null && !Number.isNaN(maxVal)) {
      result = result.filter((loan) => Number(loan.remaining_owed) <= maxVal)
    }

    if (expiresFrom) {
      const from = new Date(`${expiresFrom}T00:00:00`).getTime()
      result = result.filter((loan) => new Date(loan.expires_at).getTime() >= from)
    }
    if (expiresTo) {
      const to = new Date(`${expiresTo}T23:59:59`).getTime()
      result = result.filter((loan) => new Date(loan.expires_at).getTime() <= to)
    }

    result.sort((a, b) => {
      switch (sortKey) {
        case 'created_at_asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'created_at_desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'expires_at_asc':
          return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime()
        case 'expires_at_desc':
          return new Date(b.expires_at).getTime() - new Date(a.expires_at).getTime()
        case 'remaining_owed_asc':
          return Number(a.remaining_owed) - Number(b.remaining_owed)
        case 'remaining_owed_desc':
          return Number(b.remaining_owed) - Number(a.remaining_owed)
        case 'total_owed_asc':
          return Number(a.total_owed) - Number(b.total_owed)
        case 'total_owed_desc':
          return Number(b.total_owed) - Number(a.total_owed)
        default:
          return 0
      }
    })

    return result
  }, [
    loans,
    statusFilter,
    searchTerm,
    minRemaining,
    maxRemaining,
    expiresFrom,
    expiresTo,
    sortKey,
  ])

  const stats = useMemo(() => {
    const activeLoans = loans.filter((l) => l.active)
    const nextExpiringActive = [...activeLoans].sort(
      (a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime()
    )[0]

    const nextPaymentDisplay = nextExpiringActive
      ? formatCurrency(Number(nextExpiringActive.remaining_owed))
      : '$0.00'

    return {
      activeCount: activeLoans.length,
      nextPaymentDisplay,
    }
  }, [loans])

  const activeLoansCount = useMemo(
    () => loans.filter((loan) => loan.active).length,
    [loans]
  )

  const companyCapacity = useMemo(
    () => getLoanCapacityByReputation(companyProfile?.reputation),
    [companyProfile?.reputation]
  )

  const canOpenAnotherLoan = activeLoansCount < companyCapacity.maxActiveLoans
  const requestedAmountWithinCompanyLimit =
    requestedAmount <= companyCapacity.maxSingleLoanAmount

  const offerResults = useMemo(() => {
    let result = [...MOCK_LOAN_OFFERS]

    const aprCapNum = offerAprCap !== '' ? Number(offerAprCap) : null
    const minOfferLimitNum = minOfferLimit !== '' ? Number(minOfferLimit) : null

    // Company reputation global amount cap
    result = result.filter(
      () => requestedAmount <= companyCapacity.maxSingleLoanAmount
    )

    // Lender amount eligibility
    result = result.filter(
      (offer) =>
        requestedAmount >= offer.minAmount && requestedAmount <= offer.maxAmount
    )

    // Term eligibility
    if (onlyExactTermSupport) {
      result = result.filter(
        (offer) => requestedWeeks >= offer.minWeeks && requestedWeeks <= offer.maxWeeks
      )
    }

    // Max APR cap (uses worst-case APR max)
    if (aprCapNum !== null && !Number.isNaN(aprCapNum)) {
      result = result.filter((offer) => offer.aprMax <= aprCapNum)
    }

    // Filter by lender capacity / limit
    if (minOfferLimitNum !== null && !Number.isNaN(minOfferLimitNum)) {
      result = result.filter((offer) => offer.maxAmount >= minOfferLimitNum)
    }

    const enriched = result.map((offer) => {
      const selectedApr = (offer.aprMin + offer.aprMax) / 2
      const selectedFactorRate = (offer.factorRateMin + offer.factorRateMax) / 2

      const estimate =
        repaymentMode === 'apr_simple'
          ? calculateSimpleAprLoan(
              requestedAmount,
              requestedWeeks,
              selectedApr,
              offer.originationFeePct,
              offer.adminFeeFixed
            )
          : repaymentMode === 'apr_amortized'
          ? calculateAmortizedAprLoan(
              requestedAmount,
              requestedWeeks,
              selectedApr,
              offer.originationFeePct,
              offer.adminFeeFixed
            )
          : calculateFactorRateLoan(
              requestedAmount,
              requestedWeeks,
              selectedFactorRate,
              offer.originationFeePct,
              offer.adminFeeFixed
            )

      return {
        ...offer,
        selectedApr,
        selectedFactorRate,
        estimate,
      }
    })

    enriched.sort((a, b) => {
      switch (offerSortKey) {
        case 'apr_asc':
          return a.selectedApr - b.selectedApr
        case 'apr_desc':
          return b.selectedApr - a.selectedApr
        case 'weekly_payment_asc':
          return a.estimate.weeklyPayment - b.estimate.weeklyPayment
        case 'weekly_payment_desc':
          return b.estimate.weeklyPayment - a.estimate.weeklyPayment
        case 'max_amount_desc':
          return b.maxAmount - a.maxAmount
        case 'max_amount_asc':
          return a.maxAmount - b.maxAmount
        default:
          return 0
      }
    })

    return enriched
  }, [
    requestedAmount,
    requestedWeeks,
    offerSortKey,
    offerAprCap,
    onlyExactTermSupport,
    minOfferLimit,
    repaymentMode,
    companyCapacity.maxSingleLoanAmount,
  ])

  const resetFilters = () => {
    setStatusFilter('all')
    setSearchTerm('')
    setMinRemaining('')
    setMaxRemaining('')
    setExpiresFrom('')
    setExpiresTo('')
    setSortKey('created_at_desc')
  }

  const resetOfferFilters = () => {
    setOfferSortKey('apr_asc')
    setOfferAprCap('')
    setOnlyExactTermSupport(true)
    setMinOfferLimit('')
    setRepaymentMode('apr_amortized')
  }

  const handleAcceptOffer = async (
    offer: (typeof offerResults)[number]
  ): Promise<void> => {
    if (!canOpenAnotherLoan) {
      window.alert(
        `Loan limit reached. Company reputation (${companyCapacity.reputation}) allows up to ${companyCapacity.maxActiveLoans} active loan(s).`
      )
      return
    }

    if (!requestedAmountWithinCompanyLimit) {
      window.alert(
        `Requested amount exceeds your current company limit. Reputation (${companyCapacity.reputation}) allows up to ${formatCurrency(
          companyCapacity.maxSingleLoanAmount
        )} per loan.`
      )
      return
    }

    if (companyProfile?.is_bankrupt) {
      window.alert('Bankrupt companies cannot accept new loans.')
      return
    }

    const pricingLine =
      repaymentMode === 'factor_rate'
        ? `Factor rate (midpoint): ${offer.selectedFactorRate.toFixed(2)}x`
        : `APR (midpoint): ${offer.selectedApr.toFixed(2)}% (${
            repaymentMode === 'apr_amortized' ? 'amortized weekly' : 'simple'
          })`

    const summary = [
      `Bank: ${offer.bankName}`,
      `Amount: ${formatCurrency(requestedAmount)}`,
      `Term: ${requestedWeeks} weeks`,
      pricingLine,
      `Origination fee: ${offer.originationFeePct.toFixed(2)}% (${formatCurrency(
        offer.estimate.originationFee
      )})`,
      `Admin fee: ${formatCurrency(offer.estimate.adminFee)}`,
      `Estimated interest/finance charge: ${formatCurrency(offer.estimate.interest)}`,
      `Estimated total repayment: ${formatCurrency(offer.estimate.totalRepayment)}`,
      `Estimated weekly payment: ${formatCurrency(offer.estimate.weeklyPayment)}`,
      `Late penalty preview: ${offer.latePenaltyPct.toFixed(2)}% of missed payment`,
      '',
      'Do you want to accept this loan offer?',
    ].join('\n')

    const confirmed = window.confirm(summary)
    if (!confirmed) return

    const now = new Date()
    const expiresAt = new Date(now)
    expiresAt.setDate(expiresAt.getDate() + requestedWeeks * 7)

    const principal = requestedAmount
    const fee = Number(
      (offer.estimate.originationFee + offer.estimate.adminFee).toFixed(2)
    )
    const totalOwed = Number(offer.estimate.totalRepayment.toFixed(2))
    const remainingOwed = totalOwed

    const { error: insertError } = await supabase.from('company_loans').insert({
      company_id: companyId,
      principal,
      fee,
      total_owed: totalOwed,
      remaining_owed: remainingOwed,
      expires_at: expiresAt.toISOString(),
      active: true,
    })

    if (insertError) {
      window.alert(`Failed to accept loan: ${insertError.message}`)
      return
    }

    window.alert('Loan accepted successfully.')

    setIsOffersOpen(false)
    await refreshLoansForCompany(companyId)
  }

  return (
    <div className="space-y-4">
      {/* Header/intro with CTA in green-circled area */}
      <section className="bg-white p-6 rounded-xl shadow">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold mb-2">Loans</h2>
            <p className="text-sm text-black/70">
              Active loans, repayment overview and loan details for this company.
            </p>
          </div>

          <div className="w-full md:w-auto md:min-w-[260px] flex justify-start md:justify-end">
            <button
              type="button"
              onClick={() => setIsOffersOpen(true)}
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-slate-800 w-full md:w-auto"
              title="Open loan offers marketplace"
            >
              Apply for Loan
            </button>
          </div>
        </div>
      </section>

      {/* Summary cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-xs text-slate-500">Active loans</div>
          <div className="text-lg font-medium mt-1">{stats.activeCount}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-xs text-slate-500">Next payment</div>
          <div className="text-lg font-medium mt-1">{stats.nextPaymentDisplay}</div>
        </div>
      </section>

      {/* Existing company loans box */}
      <section className="bg-white rounded-xl shadow p-4 md:p-6">
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base md:text-lg font-semibold">Company Loans</h3>
            <div className="text-xs text-slate-500">
              {loading ? 'Loading…' : `${filteredLoans.length} result(s)`}
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Search (Loan ID / Company ID)</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="e.g. loan UUID"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300 bg-white"
              >
                <option value="all">All</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Sort by</label>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300 bg-white"
              >
                <option value="created_at_desc">Created date (newest)</option>
                <option value="created_at_asc">Created date (oldest)</option>
                <option value="expires_at_asc">Expiry date (soonest)</option>
                <option value="expires_at_desc">Expiry date (latest)</option>
                <option value="remaining_owed_desc">Remaining owed (high → low)</option>
                <option value="remaining_owed_asc">Remaining owed (low → high)</option>
                <option value="total_owed_desc">Total owed (high → low)</option>
                <option value="total_owed_asc">Total owed (low → high)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1 justify-end">
              <label className="text-xs text-transparent select-none">Reset</label>
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
              >
                Reset filters
              </button>
            </div>
          </div>

          {/* Advanced filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Min remaining owed</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={minRemaining}
                onChange={(e) => setMinRemaining(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Max remaining owed</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={maxRemaining}
                onChange={(e) => setMaxRemaining(e.target.value)}
                placeholder="100000.00"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Expires from</label>
              <input
                type="date"
                value={expiresFrom}
                onChange={(e) => setExpiresFrom(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Expires to</label>
              <input
                type="date"
                value={expiresTo}
                onChange={(e) => setExpiresTo(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
          </div>
        </div>

        {/* States */}
        {loading && (
          <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-500">
            Loading company loans…
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Failed to load loans: {error}
          </div>
        )}

        {!loading && !error && filteredLoans.length === 0 && (
          <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-500">
            No loans found for the selected filters.
          </div>
        )}

        {!loading && !error && filteredLoans.length > 0 && (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block overflow-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left font-medium px-4 py-3">Loan ID</th>
                    <th className="text-left font-medium px-4 py-3">Company ID</th>
                    <th className="text-left font-medium px-4 py-3">Principal</th>
                    <th className="text-left font-medium px-4 py-3">Fee</th>
                    <th className="text-left font-medium px-4 py-3">Total Owed</th>
                    <th className="text-left font-medium px-4 py-3">Remaining Owed</th>
                    <th className="text-left font-medium px-4 py-3">Created At</th>
                    <th className="text-left font-medium px-4 py-3">Expires At</th>
                    <th className="text-left font-medium px-4 py-3">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLoans.map((loan) => (
                    <tr key={loan.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-mono text-xs">{loan.id}</td>
                      <td className="px-4 py-3 font-mono text-xs">{loan.company_id}</td>
                      <td className="px-4 py-3">{formatCurrency(Number(loan.principal))}</td>
                      <td className="px-4 py-3">{formatCurrency(Number(loan.fee))}</td>
                      <td className="px-4 py-3">{formatCurrency(Number(loan.total_owed))}</td>
                      <td className="px-4 py-3">{formatCurrency(Number(loan.remaining_owed))}</td>
                      <td className="px-4 py-3">{formatDate(loan.created_at)}</td>
                      <td className="px-4 py-3">{formatDate(loan.expires_at)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={[
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                            loan.active
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-700',
                          ].join(' ')}
                        >
                          {loan.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile / tablet cards */}
            <div className="lg:hidden space-y-3">
              {filteredLoans.map((loan) => (
                <div key={loan.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="text-xs text-slate-500">Loan ID</div>
                      <div className="font-mono text-xs break-all">{loan.id}</div>
                    </div>
                    <span
                      className={[
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        loan.active
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-700',
                      ].join(' ')}
                    >
                      {loan.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-slate-500">Company ID</div>
                      <div className="font-mono text-xs break-all">{loan.company_id}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Principal</div>
                      <div>{formatCurrency(Number(loan.principal))}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Fee</div>
                      <div>{formatCurrency(Number(loan.fee))}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Total Owed</div>
                      <div>{formatCurrency(Number(loan.total_owed))}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Remaining Owed</div>
                      <div>{formatCurrency(Number(loan.remaining_owed))}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Created At</div>
                      <div>{formatDate(loan.created_at)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Expires At</div>
                      <div>{formatDate(loan.expires_at)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Loan Offers Modal / Slide-up */}
      {isOffersOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
          aria-modal="true"
          role="dialog"
        >
          {/* Backdrop */}
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsOffersOpen(false)}
            aria-label="Close loan offers modal"
          />

          {/* Panel */}
          <div className="relative w-full md:max-w-6xl bg-white rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden">
            {/* Modal header */}
            <div className="border-b border-slate-200 px-4 md:px-6 py-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Apply for Loan</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Compare offers from fictional lenders. Estimates shown are illustrative.
                </p>

                {companyProfile?.is_bankrupt && (
                  <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1 mt-2 inline-block">
                    This company is bankrupt and cannot accept new loans.
                  </p>
                )}

                {!canOpenAnotherLoan && !companyProfile?.is_bankrupt && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 mt-2 inline-block">
                    Active loan limit reached for current reputation.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsOffersOpen(false)}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(90vh-72px)] p-4 md:p-6 space-y-5">
              {/* Company capacity panel */}
              <section className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <h4 className="font-medium">Company Loan Capacity</h4>
                    <p className="text-sm text-slate-500 mt-1">
                      Based on company reputation and current active loans.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="rounded-md bg-slate-50 p-2">
                      <div className="text-xs text-slate-500">Reputation</div>
                      <div className="font-semibold">{companyCapacity.reputation}</div>
                    </div>
                    <div className="rounded-md bg-slate-50 p-2">
                      <div className="text-xs text-slate-500">Active loans</div>
                      <div className="font-semibold">
                        {activeLoansCount} / {companyCapacity.maxActiveLoans}
                      </div>
                    </div>
                    <div className="rounded-md bg-slate-50 p-2">
                      <div className="text-xs text-slate-500">Max per loan</div>
                      <div className="font-semibold">
                        {formatCurrency(companyCapacity.maxSingleLoanAmount)}
                      </div>
                    </div>
                    <div className="rounded-md bg-slate-50 p-2">
                      <div className="text-xs text-slate-500">Status</div>
                      <div className="font-semibold">
                        {companyProfile?.is_bankrupt ? 'Bankrupt' : 'Eligible'}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Request controls */}
              <section className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h4 className="font-medium">Loan Request</h4>
                    <div className="text-sm text-slate-600">
                      Requested: <span className="font-semibold">{formatCurrency(requestedAmount)}</span>{' '}
                      · <span className="font-semibold">{requestedWeeks} weeks</span>
                    </div>
                  </div>

                  {!requestedAmountWithinCompanyLimit && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-700 px-3 py-2 text-sm">
                      Requested amount exceeds your current company limit of{' '}
                      <span className="font-semibold">
                        {formatCurrency(companyCapacity.maxSingleLoanAmount)}
                      </span>
                      . Increase reputation to unlock higher limits.
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Amount */}
                    <div className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <label className="text-slate-600">Amount</label>
                        <span className="font-medium">{formatCurrency(requestedAmount)}</span>
                      </div>
                      <input
                        type="range"
                        min={5000}
                        max={500000}
                        step={1000}
                        value={requestedAmount}
                        onChange={(e) => setRequestedAmount(Number(e.target.value))}
                        className="w-full"
                      />
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        {[10000, 50000, 100000].map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setRequestedAmount(v)}
                            className="rounded-md border border-slate-200 px-2 py-1.5 text-xs hover:bg-slate-50"
                          >
                            {formatCurrency(v)}
                          </button>
                        ))}
                      </div>
                      <div className="mt-3">
                        <input
                          type="number"
                          min={5000}
                          max={500000}
                          step={1000}
                          value={requestedAmount}
                          onChange={(e) => {
                            const next = Number(e.target.value)
                            if (Number.isNaN(next)) return
                            setRequestedAmount(Math.min(500000, Math.max(5000, next)))
                          }}
                          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>

                    {/* Term */}
                    <div className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <label className="text-slate-600">Repayment term</label>
                        <span className="font-medium">{requestedWeeks} weeks</span>
                      </div>
                      <input
                        type="range"
                        min={6}
                        max={72}
                        step={1}
                        value={requestedWeeks}
                        onChange={(e) => setRequestedWeeks(Number(e.target.value))}
                        className="w-full"
                      />
                      <div className="grid grid-cols-4 gap-2 mt-3">
                        {[6, 12, 24, 52].map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setRequestedWeeks(v)}
                            className="rounded-md border border-slate-200 px-2 py-1.5 text-xs hover:bg-slate-50"
                          >
                            {v}w
                          </button>
                        ))}
                      </div>
                      <div className="mt-3">
                        <input
                          type="number"
                          min={6}
                          max={72}
                          step={1}
                          value={requestedWeeks}
                          onChange={(e) => {
                            const next = Number(e.target.value)
                            if (Number.isNaN(next)) return
                            setRequestedWeeks(Math.min(72, Math.max(6, next)))
                          }}
                          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Offer filters/sorting */}
              <section className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <h4 className="font-medium">Offer Filters & Sorting</h4>
                  <div className="text-xs text-slate-500">{offerResults.length} matching offer(s)</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500">Repayment calculation mode</label>
                    <select
                      value={repaymentMode}
                      onChange={(e) => setRepaymentMode(e.target.value as RepaymentMode)}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-white"
                    >
                      <option value="apr_amortized">APR (amortized weekly)</option>
                      <option value="apr_simple">APR (simple estimate)</option>
                      <option value="factor_rate">Factor rate</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500">Sort offers</label>
                    <select
                      value={offerSortKey}
                      onChange={(e) => setOfferSortKey(e.target.value as OfferSortKey)}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-white"
                    >
                      <option value="apr_asc">APR (lowest first)</option>
                      <option value="apr_desc">APR (highest first)</option>
                      <option value="weekly_payment_asc">Weekly payment (lowest first)</option>
                      <option value="weekly_payment_desc">Weekly payment (highest first)</option>
                      <option value="max_amount_desc">Max amount (highest first)</option>
                      <option value="max_amount_asc">Max amount (lowest first)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500">Max APR (worst-case)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={offerAprCap}
                      onChange={(e) => setOfferAprCap(e.target.value)}
                      placeholder="e.g. 18"
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500">Min lender max amount</label>
                    <input
                      type="number"
                      min="5000"
                      step="1000"
                      value={minOfferLimit}
                      onChange={(e) => setMinOfferLimit(e.target.value)}
                      placeholder="e.g. 100000"
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm border border-slate-200 rounded-md px-3 py-2 w-full">
                      <input
                        type="checkbox"
                        checked={onlyExactTermSupport}
                        onChange={(e) => setOnlyExactTermSupport(e.target.checked)}
                      />
                      <span>Exact term support</span>
                    </label>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={resetOfferFilters}
                      className="rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 w-full"
                    >
                      Reset offer filters
                    </button>
                  </div>
                </div>
              </section>

              {/* Offer cards */}
              <section className="space-y-4">
                {offerResults.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 p-6 text-sm text-slate-500">
                    No lenders match the selected amount/term and filters. Try lowering the amount,
                    changing the term, relaxing APR filters, or increasing company reputation.
                  </div>
                ) : (
                  offerResults.map((offer) => {
                    const amountSupported =
                      requestedAmount >= offer.minAmount && requestedAmount <= offer.maxAmount
                    const termSupported =
                      requestedWeeks >= offer.minWeeks && requestedWeeks <= offer.maxWeeks

                    const canAccept =
                      amountSupported &&
                      termSupported &&
                      canOpenAnotherLoan &&
                      requestedAmountWithinCompanyLimit &&
                      !companyProfile?.is_bankrupt

                    return (
                      <div
                        key={offer.id}
                        className="rounded-xl border border-slate-200 p-4 md:p-5 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex flex-col xl:flex-row gap-4 xl:items-start xl:justify-between">
                          {/* Left: brand + offer basics */}
                          <div className="flex gap-4 min-w-0">
                            {/* Logo placeholder */}
                            <div className="h-14 w-14 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-sm font-semibold text-slate-700 shrink-0">
                              {offer.logoText}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center flex-wrap gap-2">
                                <h5 className="font-semibold">{offer.bankName}</h5>
                                <span className="text-xs rounded-full bg-slate-100 text-slate-700 px-2 py-0.5">
                                  {offer.approvalSpeed}
                                </span>
                              </div>
                              <p className="text-sm text-slate-500 mt-1">{offer.notes}</p>

                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3 text-sm">
                                <div className="rounded-md bg-slate-50 p-2">
                                  <div className="text-xs text-slate-500">APR range</div>
                                  <div className="font-medium">
                                    {offer.aprMin.toFixed(2)}% – {offer.aprMax.toFixed(2)}%
                                  </div>
                                </div>

                                <div className="rounded-md bg-slate-50 p-2">
                                  <div className="text-xs text-slate-500">Factor rate range</div>
                                  <div className="font-medium">
                                    {offer.factorRateMin.toFixed(2)}x – {offer.factorRateMax.toFixed(2)}x
                                  </div>
                                </div>

                                <div className="rounded-md bg-slate-50 p-2">
                                  <div className="text-xs text-slate-500">Fees</div>
                                  <div className="font-medium">
                                    {offer.originationFeePct.toFixed(2)}% +{' '}
                                    {formatCurrency(offer.adminFeeFixed)}
                                  </div>
                                </div>

                                <div className="rounded-md bg-slate-50 p-2">
                                  <div className="text-xs text-slate-500">Late penalty (preview)</div>
                                  <div className="font-medium">
                                    {offer.latePenaltyPct.toFixed(2)}%
                                  </div>
                                </div>

                                <div className="rounded-md bg-slate-50 p-2">
                                  <div className="text-xs text-slate-500">Amount range</div>
                                  <div className="font-medium">
                                    {formatCurrency(offer.minAmount)} – {formatCurrency(offer.maxAmount)}
                                  </div>
                                </div>

                                <div className="rounded-md bg-slate-50 p-2">
                                  <div className="text-xs text-slate-500">Term range</div>
                                  <div className="font-medium">
                                    {offer.minWeeks}–{offer.maxWeeks} weeks
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Right: estimate & action */}
                          <div className="xl:min-w-[360px] rounded-lg border border-slate-200 p-4">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-medium">Estimated repayment</div>
                              <span className="text-xs text-slate-500">
                                {repaymentMode === 'factor_rate'
                                  ? `Factor rate used: ${offer.selectedFactorRate.toFixed(2)}x`
                                  : `APR used: ${offer.selectedApr.toFixed(2)}% (${
                                      repaymentMode === 'apr_amortized'
                                        ? 'amortized'
                                        : 'simple'
                                    })`}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                              <div>
                                <div className="text-xs text-slate-500">Requested amount</div>
                                <div className="font-medium">{formatCurrency(requestedAmount)}</div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">Term</div>
                                <div className="font-medium">{requestedWeeks} weeks</div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">Origination fee</div>
                                <div className="font-medium">
                                  {formatCurrency(offer.estimate.originationFee)}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">Admin fee</div>
                                <div className="font-medium">
                                  {formatCurrency(offer.estimate.adminFee)}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">
                                  {repaymentMode === 'factor_rate'
                                    ? 'Finance charge'
                                    : 'Estimated interest'}
                                </div>
                                <div className="font-medium">
                                  {formatCurrency(offer.estimate.interest)}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">Weekly payment</div>
                                <div className="text-base font-semibold">
                                  {formatCurrency(offer.estimate.weeklyPayment)}
                                </div>
                              </div>
                              <div className="col-span-2">
                                <div className="text-xs text-slate-500">Total repayment</div>
                                <div className="text-base font-semibold">
                                  {formatCurrency(offer.estimate.totalRepayment)}
                                </div>
                              </div>
                            </div>

                            <div className="mt-2 text-xs text-slate-500">
                              Late penalty preview (per missed installment):{' '}
                              {formatCurrency(
                                offer.estimate.weeklyPayment * (offer.latePenaltyPct / 100)
                              )}
                            </div>

                            <div className="mt-3 space-y-2 text-xs">
                              {!amountSupported && (
                                <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-700 px-2 py-1">
                                  Requested amount is outside this lender’s range.
                                </div>
                              )}
                              {!termSupported && (
                                <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-700 px-2 py-1">
                                  Requested term is outside this lender’s range.
                                </div>
                              )}
                              {!requestedAmountWithinCompanyLimit && (
                                <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-700 px-2 py-1">
                                  Requested amount exceeds your company’s current reputation-based limit.
                                </div>
                              )}
                              {!canOpenAnotherLoan && (
                                <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-700 px-2 py-1">
                                  Acceptance is blocked because active loan limit for current reputation is reached.
                                </div>
                              )}
                              {companyProfile?.is_bankrupt && (
                                <div className="rounded-md border border-red-200 bg-red-50 text-red-700 px-2 py-1">
                                  Bankrupt companies cannot accept new loans.
                                </div>
                              )}
                            </div>

                            <div className="mt-4 flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleAcceptOffer(offer)}
                                disabled={!canAccept}
                                className="flex-1 rounded-md bg-slate-900 text-white px-3 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Accept offer
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  window.alert(
                                    [
                                      `Bank: ${offer.bankName}`,
                                      `APR range: ${offer.aprMin.toFixed(2)}% - ${offer.aprMax.toFixed(2)}%`,
                                      `Factor rate range: ${offer.factorRateMin.toFixed(2)}x - ${offer.factorRateMax.toFixed(2)}x`,
                                      `Origination fee: ${offer.originationFeePct.toFixed(2)}%`,
                                      `Admin fee: ${formatCurrency(offer.adminFeeFixed)}`,
                                      `Late penalty preview: ${offer.latePenaltyPct.toFixed(2)}%`,
                                      `Amount range: ${formatCurrency(offer.minAmount)} - ${formatCurrency(offer.maxAmount)}`,
                                      `Term range: ${offer.minWeeks}-${offer.maxWeeks} weeks`,
                                      `Approval speed: ${offer.approvalSpeed}`,
                                      `Notes: ${offer.notes}`,
                                    ].join('\n')
                                  )
                                }}
                                className="rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                              >
                                Details
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}