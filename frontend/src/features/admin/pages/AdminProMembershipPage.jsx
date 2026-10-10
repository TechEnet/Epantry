import {
  CheckCircle2,
  CircleAlert,
  CreditCard,
  Crown,
  IndianRupee,
  LoaderCircle,
  RefreshCw,
  Save,
  Users,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import AdminShell from '../components/AdminShell'

import {
  getAdminProMemberships,
  getAdminProOverview,
  getAdminProPayments,
  updateAdminProPlan,
} from '../services/admin.service'

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    'Unable to load EPANTRY Pro right now.'
  )
}

function moneyFromMinor(value) {
  return `₹${Math.round(Number(value || 0) / 100).toLocaleString('en-IN')}`
}

function formatDate(value) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function readableStatus(value) {
  const status = String(value || '').trim().toLowerCase()

  if (status === 'active') return 'Active'
  if (status === 'expired') return 'Expired'
  if (status === 'suspended') return 'Suspended'
  if (status === 'paid') return 'Paid'
  if (status === 'initiated') return 'Started'
  if (status === 'failed') return 'Failed'

  return status || 'Unknown'
}

function statusClasses(status) {
  if (status === 'active' || status === 'paid') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  }

  if (status === 'suspended' || status === 'failed') {
    return 'border-red-200 bg-red-50 text-red-800'
  }

  if (status === 'initiated') {
    return 'border-blue-200 bg-blue-50 text-blue-800'
  }

  return 'border-stone-200 bg-stone-50 text-stone-600'
}

function normalizePlanDraft(plan) {
  return {
    priceRupees: String(Math.round(Number(plan?.priceMinor || 0) / 100)),
    shortDescription: plan?.shortDescription || '',
    benefitsText: Array.isArray(plan?.benefits)
      ? plan.benefits.join('\n')
      : '',
    isEnabled: plan?.isEnabled !== false,
  }
}

function planDuration(plan) {
  const months = Number(plan?.validityMonths || 0)

  if (months === 1) return '1 month'
  if (months === 12) return '12 months'
  return `${months} months`
}

export default function AdminProMembershipPage() {
  const [overview, setOverview] = useState(null)
  const [memberships, setMemberships] = useState([])
  const [payments, setPayments] = useState([])
  const [membershipPagination, setMembershipPagination] = useState(null)
  const [paymentPagination, setPaymentPagination] = useState(null)
  const [membershipStatus, setMembershipStatus] = useState('all')
  const [paymentStatus, setPaymentStatus] = useState('all')
  const [membershipPage, setMembershipPage] = useState(1)
  const [paymentPage, setPaymentPage] = useState(1)
  const [planDrafts, setPlanDrafts] = useState({})
  const [selectedPlanCode, setSelectedPlanCode] = useState('')
  const [activityView, setActivityView] = useState('memberships')
  const [busyPlanCode, setBusyPlanCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadOverview = useCallback(async () => {
    const result = await getAdminProOverview()
    setOverview(result)

    setPlanDrafts((current) => {
      const next = {
        ...current,
      }

      for (const plan of result?.plans || []) {
        if (!next[plan.code]) {
          next[plan.code] = normalizePlanDraft(plan)
        }
      }

      return next
    })

    setSelectedPlanCode((current) => current || result?.plans?.[0]?.code || '')
  }, [])

  const loadMemberships = useCallback(async () => {
    const result = await getAdminProMemberships({
      status: membershipStatus,
      page: membershipPage,
      limit: 20,
    })

    setMemberships(result?.memberships || [])
    setMembershipPagination(result?.pagination || null)
  }, [membershipStatus, membershipPage])

  const loadPayments = useCallback(async () => {
    const result = await getAdminProPayments({
      status: paymentStatus,
      page: paymentPage,
      limit: 20,
    })

    setPayments(result?.payments || [])
    setPaymentPagination(result?.pagination || null)
  }, [paymentStatus, paymentPage])

  const loadAll = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setError('')

    const results = await Promise.allSettled([
      loadOverview(),
      loadMemberships(),
      loadPayments(),
    ])

    const failed = results.find((result) => result.status === 'rejected')

    if (failed?.reason) {
      setError(getErrorMessage(failed.reason))
    }

    setLoading(false)
    setRefreshing(false)
  }, [loadMemberships, loadOverview, loadPayments])

  useEffect(() => {
    loadAll()
  }, []) // initial load only; filters below refresh their own section

  useEffect(() => {
    if (loading) return

    loadMemberships().catch((requestError) => {
      setError(getErrorMessage(requestError))
    })
  }, [membershipStatus, membershipPage])

  useEffect(() => {
    if (loading) return

    loadPayments().catch((requestError) => {
      setError(getErrorMessage(requestError))
    })
  }, [paymentStatus, paymentPage])

  const plans = overview?.plans || []
  const summary = overview?.summary || {}
  const selectedPlan = plans.find((plan) => plan.code === selectedPlanCode) || plans[0] || null
  const selectedDraft = selectedPlan
    ? planDrafts[selectedPlan.code] || normalizePlanDraft(selectedPlan)
    : null

  const paidRevenue = useMemo(
    () => moneyFromMinor(summary?.payments?.paidRevenueMinor),
    [summary],
  )

  function updatePlanDraft(planCode, key, value) {
    setPlanDrafts((current) => ({
      ...current,
      [planCode]: {
        ...(current[planCode] || {}),
        [key]: value,
      },
    }))
  }

  async function savePlan(plan) {
    const draft = planDrafts[plan.code] || normalizePlanDraft(plan)
    const rupees = Number(draft.priceRupees)

    if (!Number.isFinite(rupees) || rupees <= 0) {
      setError('Enter a valid plan price.')
      return
    }

    const benefits = String(draft.benefitsText || '')
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)

    if (benefits.length < 1) {
      setError('Add at least one customer benefit.')
      return
    }

    setBusyPlanCode(plan.code)
    setError('')
    setMessage('')

    try {
      await updateAdminProPlan({
        planCode: plan.code,
        changes: {
          priceMinor: Math.round(rupees * 100),
          shortDescription: draft.shortDescription,
          benefits,
          isEnabled: draft.isEnabled === true,
        },
      })

      setMessage(`${plan.name} updated. The change applies to new purchases.`)
      await loadOverview()
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setBusyPlanCode('')
    }
  }

  if (loading) {
    return (
      <AdminShell
        title="EPANTRY Pro"
        description="Set plans, see customer access and review payments."
      >
        <div className="grid min-h-[42svh] place-items-center bg-[#f4f6f8]">
          <div className="flex items-center gap-3 text-sm font-bold text-[#23445b]">
            <LoaderCircle size={19} className="animate-spin" aria-hidden="true" />
            Loading Pro workspace…
          </div>
        </div>
      </AdminShell>
    )
  }

  return (
    <AdminShell
      title="EPANTRY Pro"
      description="Set plans, see who has Pro access and review customer payments."
      actions={(
        <button
          type="button"
          disabled={refreshing}
          onClick={() => loadAll({ silent: true })}
          className="focus-ring inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-700 shadow-sm disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
          Refresh
        </button>
      )}
    >
      <div className="bg-[#f4f6f8] pb-8 sm:pb-10">
        {error ? (
          <div className="border-b border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-800 sm:px-7 sm:text-sm">
            <div className="flex items-start gap-2">
              <CircleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          </div>
        ) : null}

        {message ? (
          <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800 sm:px-7 sm:text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{message}</span>
            </div>
          </div>
        ) : null}

        <section className="bg-[#17334a] text-white">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_440px]">
            <div className="px-4 py-5 sm:px-7 sm:py-7">
              <h2 className="max-w-3xl text-[25px] font-black leading-[1.08] sm:text-[34px]">
                Manage Pro plans, access and payments.
              </h2>
              <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-200 sm:text-sm">
                Set plans, then review customer access and payment history.
              </p>
            </div>

            <div className="grid grid-cols-3 border-t border-white/15 lg:border-l lg:border-t-0">
              {[
                ['Active', summary?.memberships?.active || 0, Users],
                ['Revenue', paidRevenue, IndianRupee],
                ['Paid', summary?.payments?.paidCount || 0, CreditCard],
              ].map(([label, value, Icon], index) => (
                <div
                  key={label}
                  className={`px-3 py-4 sm:px-5 sm:py-5 ${index > 0 ? 'border-l border-white/15' : ''}`}
                >
                  <Icon size={16} className="text-sky-200" aria-hidden="true" />
                  <p className="mt-2 text-xl font-black sm:text-2xl">{value}</p>
                  <p className="mt-0.5 text-[10px] font-semibold text-slate-300 sm:text-xs">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 border-t border-white/15 lg:grid-cols-4">
            {[
              ['01', 'Set plans', 'Price and availability'],
              ['02', 'Customer buys', 'Checkout starts'],
              ['03', 'Access starts', 'Payment verified'],
              ['04', 'Review history', 'Access and payments'],
            ].map(([number, title, copy], index) => (
              <div
                key={number}
                className={`px-4 py-3 sm:px-6 sm:py-4 ${index % 2 === 1 ? 'border-l border-white/15' : ''} ${index >= 2 ? 'border-t border-white/15 lg:border-t-0' : ''} ${index === 2 ? 'lg:border-l lg:border-white/15' : ''}`}
              >
                <p className="text-[10px] font-black text-sky-200">{number}</p>
                <p className="mt-1 text-sm font-bold">{title}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-slate-300 sm:text-xs sm:leading-5">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4 border-y border-stone-200 bg-white sm:mt-5">
          <div className="border-b border-stone-200 px-4 py-3 sm:px-7 sm:py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-stone-950 sm:text-xl">Pro plans</h2>
              </div>

            </div>
          </div>

          {plans.length ? (
            <div className="grid lg:grid-cols-[260px_minmax(0,1fr)]">
              <div className="border-b border-stone-200 bg-[#f7f5fb] p-3 lg:border-b-0 lg:border-r lg:p-4">
                <label className="block lg:hidden">
                  <span className="text-xs font-bold text-stone-600">Choose a plan</span>
                  <select
                    value={selectedPlan?.code || ''}
                    onChange={(event) => setSelectedPlanCode(event.target.value)}
                    className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-[#d8d0e7] bg-white px-3 text-sm font-bold text-stone-900"
                  >
                    {plans.map((plan) => (
                      <option key={plan.code} value={plan.code}>
                        {plan.name} · {moneyFromMinor(plan.priceMinor)}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="hidden space-y-1.5 lg:block">
                  {plans.map((plan) => {
                    const active = selectedPlan?.code === plan.code

                    return (
                      <button
                        key={plan.code}
                        type="button"
                        onClick={() => setSelectedPlanCode(plan.code)}
                        className={`focus-ring w-full rounded-xl px-3 py-3 text-left transition ${active ? 'bg-[#35254f] text-white shadow-sm' : 'text-stone-700 hover:bg-white'}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-black">{plan.name}</span>
                          <span className={`text-xs font-bold ${active ? 'text-violet-200' : 'text-stone-500'}`}>
                            {moneyFromMinor(plan.priceMinor)}
                          </span>
                        </div>
                        <p className={`mt-1 text-xs ${active ? 'text-violet-100/80' : 'text-stone-500'}`}>
                          {planDuration(plan)} · {plan.isEnabled ? 'Available' : 'Hidden'}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {selectedPlan && selectedDraft ? (
                <div className="px-4 py-4 sm:px-7 sm:py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-200 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Crown size={17} className="text-[#6b4f9c]" aria-hidden="true" />
                        <h3 className="text-lg font-black text-stone-950">{selectedPlan.name}</h3>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-stone-500">Access for {planDuration(selectedPlan)}</p>
                    </div>

                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-bold text-stone-700">
                      <input
                        type="checkbox"
                        checked={selectedDraft.isEnabled === true}
                        onChange={(event) => updatePlanDraft(selectedPlan.code, 'isEnabled', event.target.checked)}
                        className="size-4 accent-[#6b4f9c]"
                      />
                      {selectedDraft.isEnabled ? 'Available' : 'Hidden'}
                    </label>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
                    <label className="text-xs font-bold text-stone-700">
                      Price
                      <div className="relative mt-1.5">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-stone-500">₹</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={selectedDraft.priceRupees}
                          onChange={(event) => updatePlanDraft(selectedPlan.code, 'priceRupees', event.target.value)}
                          className="focus-ring h-11 w-full rounded-xl border border-stone-200 bg-white pl-8 pr-3 text-sm font-bold text-stone-950"
                        />
                      </div>
                    </label>

                    <label className="text-xs font-bold text-stone-700">
                      Short description
                      <input
                        type="text"
                        value={selectedDraft.shortDescription}
                        onChange={(event) => updatePlanDraft(selectedPlan.code, 'shortDescription', event.target.value)}
                        className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-950"
                      />
                    </label>
                  </div>

                  <label className="mt-3 block text-xs font-bold text-stone-700">
                    Benefits
                    <textarea
                      rows={4}
                      value={selectedDraft.benefitsText}
                      onChange={(event) => updatePlanDraft(selectedPlan.code, 'benefitsText', event.target.value)}
                      className="focus-ring mt-1.5 w-full resize-y rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-semibold leading-5 text-stone-950"
                      placeholder="One benefit per line"
                    />
                  </label>

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      disabled={busyPlanCode === selectedPlan.code}
                      onClick={() => savePlan(selectedPlan)}
                      className="focus-ring inline-flex h-10 items-center gap-2 rounded-xl bg-[#6b4f9c] px-4 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busyPlanCode === selectedPlan.code ? (
                        <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
                      ) : (
                        <Save size={14} aria-hidden="true" />
                      )}
                      {busyPlanCode === selectedPlan.code ? 'Saving…' : 'Save plan'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="px-4 py-5 text-sm font-semibold text-stone-600 sm:px-7">
              No Pro plans are available.
            </div>
          )}
        </section>

        <section className="mt-4 border-y border-stone-200 bg-white sm:mt-5">
          <div className="flex flex-col gap-3 border-b border-stone-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <div>
              <h2 className="text-lg font-black text-stone-950 sm:text-xl">Customer activity</h2>
            </div>

            <div className="inline-flex self-start rounded-xl border border-stone-200 bg-stone-100 p-1">
              <button
                type="button"
                onClick={() => setActivityView('memberships')}
                className={`focus-ring rounded-lg px-3 py-2 text-xs font-black transition ${activityView === 'memberships' ? 'bg-[#17334a] text-white shadow-sm' : 'text-stone-600'}`}
              >
                Memberships ({membershipPagination?.total || 0})
              </button>
              <button
                type="button"
                onClick={() => setActivityView('payments')}
                className={`focus-ring rounded-lg px-3 py-2 text-xs font-black transition ${activityView === 'payments' ? 'bg-[#17334a] text-white shadow-sm' : 'text-stone-600'}`}
              >
                Payments ({paymentPagination?.total || 0})
              </button>
            </div>
          </div>

          {activityView === 'memberships' ? (
            <div className="bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3 sm:px-7">
                <div>
                  <p className="text-sm font-black text-stone-900">Pro access</p>
                </div>
                <select
                  value={membershipStatus}
                  onChange={(event) => {
                    setMembershipStatus(event.target.value)
                    setMembershipPage(1)
                  }}
                  className="focus-ring h-9 rounded-lg border border-stone-200 bg-white px-2.5 text-xs font-bold text-stone-700"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              {memberships.length === 0 ? (
                <div className="px-4 py-6 sm:px-7">
                  <p className="text-sm font-black text-stone-900">No Pro memberships yet.</p>
                  <p className="mt-1 line-clamp-2 text-xs text-stone-500">Paid Pro customers will appear here.</p>
                </div>
              ) : (
                <>
                  <div className="sm:hidden">
                    {memberships.map((membership, index) => (
                      <div key={membership.id} className={`px-4 py-3 ${index ? 'border-t border-stone-100' : ''}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-stone-900">{membership.user?.name || 'Customer'}</p>
                            <p className="mt-0.5 truncate text-xs text-stone-500">{membership.lastPlan?.name || membership.lastPlanCode || 'Pro access'}</p>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-black ${statusClasses(membership.status)}`}>
                            {readableStatus(membership.status)}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-stone-600">
                          <span>Until {formatDate(membership.validUntil)}</span>
                          <span className="font-bold text-stone-800">{membership.active ? `${membership.remainingDays} days` : '—'}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden overflow-x-auto sm:block">
                    <table className="min-w-full text-left text-xs">
                      <thead className="border-b border-stone-200 bg-[#f7f8fa] text-[10px] font-black uppercase tracking-[0.08em] text-stone-500">
                        <tr>
                          <th className="px-7 py-3">Customer</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Plan</th>
                          <th className="px-4 py-3">Valid until</th>
                          <th className="px-7 py-3 text-right">Remaining</th>
                        </tr>
                      </thead>
                      <tbody>
                        {memberships.map((membership) => (
                          <tr key={membership.id} className="border-b border-stone-100 last:border-b-0">
                            <td className="px-7 py-3">
                              <p className="font-black text-stone-900">{membership.user?.name || 'Customer'}</p>
                              <p className="mt-0.5 text-[10px] text-stone-500">{membership.user?.email || '—'}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-black ${statusClasses(membership.status)}`}>
                                {readableStatus(membership.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-bold text-stone-700">{membership.lastPlan?.name || membership.lastPlanCode || '—'}</td>
                            <td className="px-4 py-3 font-semibold text-stone-700">{formatDate(membership.validUntil)}</td>
                            <td className="px-7 py-3 text-right font-black text-stone-900">{membership.active ? `${membership.remainingDays} days` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between border-t border-stone-200 px-4 py-3 sm:px-7">
                <span className="text-xs font-semibold text-stone-500">{membershipPagination?.total || 0} records</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={membershipPage <= 1}
                    onClick={() => setMembershipPage((value) => Math.max(1, value - 1))}
                    className="focus-ring rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-700 disabled:opacity-35"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={!membershipPagination?.totalPages || membershipPage >= membershipPagination.totalPages}
                    onClick={() => setMembershipPage((value) => value + 1)}
                    className="focus-ring rounded-lg bg-[#17334a] px-3 py-2 text-xs font-bold text-white disabled:opacity-35"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3 sm:px-7">
                <div>
                  <p className="text-sm font-black text-stone-900">Pro payments</p>
                </div>
                <select
                  value={paymentStatus}
                  onChange={(event) => {
                    setPaymentStatus(event.target.value)
                    setPaymentPage(1)
                  }}
                  className="focus-ring h-9 rounded-lg border border-stone-200 bg-white px-2.5 text-xs font-bold text-stone-700"
                >
                  <option value="all">All</option>
                  <option value="paid">Paid</option>
                  <option value="initiated">Started</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              {payments.length === 0 ? (
                <div className="px-4 py-6 sm:px-7">
                  <p className="text-sm font-black text-stone-900">No Pro payments yet.</p>
                  <p className="mt-1 line-clamp-2 text-xs text-stone-500">Started Pro checkouts will appear here.</p>
                </div>
              ) : (
                <>
                  <div className="sm:hidden">
                    {payments.map((payment, index) => (
                      <div key={payment.id} className={`px-4 py-3 ${index ? 'border-t border-stone-100' : ''}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-stone-900">{payment.user?.name || 'Customer'}</p>
                            <p className="mt-0.5 truncate text-xs text-stone-500">{payment.plan?.name || payment.planCode || 'EPANTRY Pro'}</p>
                          </div>
                          <p className="shrink-0 text-sm font-black text-stone-950">{moneyFromMinor(payment.amountMinor)}</p>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <span className={`rounded-full border px-2 py-1 text-[9px] font-black ${statusClasses(payment.status)}`}>
                            {readableStatus(payment.status)}
                          </span>
                          <span className="text-xs text-stone-500">{formatDate(payment.paidAt || payment.initiatedAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden overflow-x-auto sm:block">
                    <table className="min-w-full text-left text-xs">
                      <thead className="border-b border-stone-200 bg-[#f7f8fa] text-[10px] font-black uppercase tracking-[0.08em] text-stone-500">
                        <tr>
                          <th className="px-7 py-3">Customer</th>
                          <th className="px-4 py-3">Plan</th>
                          <th className="px-4 py-3">Amount</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-7 py-3">Payment reference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((payment) => (
                          <tr key={payment.id} className="border-b border-stone-100 last:border-b-0">
                            <td className="px-7 py-3">
                              <p className="font-black text-stone-900">{payment.user?.name || 'Customer'}</p>
                              <p className="mt-0.5 text-[10px] text-stone-500">{payment.user?.email || '—'}</p>
                            </td>
                            <td className="px-4 py-3 font-bold text-stone-700">{payment.plan?.name || payment.planCode || 'EPANTRY Pro'}</td>
                            <td className="px-4 py-3 font-black text-stone-950">{moneyFromMinor(payment.amountMinor)}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-black ${statusClasses(payment.status)}`}>
                                {readableStatus(payment.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-semibold text-stone-700">{formatDate(payment.paidAt || payment.initiatedAt)}</td>
                            <td className="max-w-[240px] truncate px-7 py-3 font-mono text-[10px] text-stone-500">
                              {payment.providerPaymentId || payment.providerOrderId || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between border-t border-stone-200 px-4 py-3 sm:px-7">
                <span className="text-xs font-semibold text-stone-500">{paymentPagination?.total || 0} transactions</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={paymentPage <= 1}
                    onClick={() => setPaymentPage((value) => Math.max(1, value - 1))}
                    className="focus-ring rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-700 disabled:opacity-35"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={!paymentPagination?.totalPages || paymentPage >= paymentPagination.totalPages}
                    onClick={() => setPaymentPage((value) => value + 1)}
                    className="focus-ring rounded-lg bg-[#17334a] px-3 py-2 text-xs font-bold text-white disabled:opacity-35"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

      </div>
    </AdminShell>
  )
}
