import {
  CalendarClock,
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
    error?.message ||
    'Unable to load EPANTRY Pro administration right now.'
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

function statusClasses(status) {
  if (status === 'active' || status === 'paid') {
    return 'bg-emerald-100 text-emerald-800'
  }

  if (status === 'suspended' || status === 'failed') {
    return 'bg-red-100 text-red-800'
  }

  if (status === 'initiated') {
    return 'bg-blue-100 text-blue-800'
  }

  return 'bg-amber-100 text-amber-800'
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

    try {
      await Promise.all([
        loadOverview(),
        loadMemberships(),
        loadPayments(),
      ])
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [loadMemberships, loadOverview, loadPayments])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  useEffect(() => {
    if (loading) {
      return
    }

    loadMemberships().catch((requestError) => {
      setError(getErrorMessage(requestError))
    })
  }, [membershipStatus, membershipPage])

  useEffect(() => {
    if (loading) {
      return
    }

    loadPayments().catch((requestError) => {
      setError(getErrorMessage(requestError))
    })
  }, [paymentStatus, paymentPage])

  const summary = overview?.summary || {}

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
      setError('Enter a valid positive price in rupees.')
      return
    }

    const benefits = String(draft.benefitsText || '')
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)

    if (benefits.length < 1) {
      setError('Keep at least one clear customer benefit for this plan.')
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

      setMessage(`${plan.name} plan updated. New settings apply to future checkouts only.`)
      await loadAll({ silent: true })
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
        description="Plans, Customer memberships and Razorpay test payments."
      >
        <div className="grid min-h-[320px] place-items-center rounded-[28px] bg-violet-50">
          <div className="flex items-center gap-3 text-sm font-bold text-violet-800">
            <LoaderCircle size={20} className="animate-spin" aria-hidden="true" />
            Loading Pro administration...
          </div>
        </div>
      </AdminShell>
    )
  }

  return (
    <AdminShell
      title="EPANTRY Pro"
      description="Manage customer Pro plans and review membership/payment history. Existing paid access is preserved when a plan changes."
      actions={(
        <button
          type="button"
          disabled={refreshing}
          onClick={() => loadAll({ silent: true })}
          className="focus-ring inline-flex items-center gap-2 rounded-2xl bg-stone-950 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
          Refresh
        </button>
      )}
    >
      {error ? (
        <div className="mb-4 flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-800">
          <CircleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="mb-4 flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          {message}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[24px] bg-violet-100 p-4">
          <div className="flex items-center gap-2 text-violet-900">
            <Users size={18} aria-hidden="true" />
            <p className="text-[11px] font-black uppercase tracking-[0.12em]">Active members</p>
          </div>
          <p className="mt-3 text-3xl font-black text-stone-950">{summary?.memberships?.active || 0}</p>
          <p className="mt-1 text-xs font-semibold text-stone-600">Customers with Pro access today.</p>
        </article>

        <article className="rounded-[24px] bg-amber-100 p-4">
          <div className="flex items-center gap-2 text-amber-900">
            <CalendarClock size={18} aria-hidden="true" />
            <p className="text-[11px] font-black uppercase tracking-[0.12em]">Expired</p>
          </div>
          <p className="mt-3 text-3xl font-black text-stone-950">{summary?.memberships?.expired || 0}</p>
          <p className="mt-1 text-xs font-semibold text-stone-600">Historical memberships whose paid time ended.</p>
        </article>

        <article className="rounded-[24px] bg-emerald-100 p-4">
          <div className="flex items-center gap-2 text-emerald-900">
            <IndianRupee size={18} aria-hidden="true" />
            <p className="text-[11px] font-black uppercase tracking-[0.12em]">Verified test revenue</p>
          </div>
          <p className="mt-3 text-3xl font-black text-stone-950">{paidRevenue}</p>
          <p className="mt-1 text-xs font-semibold text-stone-600">Razorpay test payments captured for EPANTRY Pro.</p>
        </article>

        <article className="rounded-[24px] bg-blue-100 p-4">
          <div className="flex items-center gap-2 text-blue-900">
            <CreditCard size={18} aria-hidden="true" />
            <p className="text-[11px] font-black uppercase tracking-[0.12em]">Paid transactions</p>
          </div>
          <p className="mt-3 text-3xl font-black text-stone-950">{summary?.payments?.paidCount || 0}</p>
          <p className="mt-1 text-xs font-semibold text-stone-600">Verified Pro purchases in test mode.</p>
        </article>
      </section>

      <section className="mt-5 rounded-[28px] bg-[#fffaf0] p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white">
            <Crown size={20} aria-hidden="true" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-violet-700">Plan configuration</p>
            <h2 className="mt-1 text-xl font-black text-stone-950">What Customers can buy</h2>
            <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-stone-600">
              Price, availability and benefit copy below control future Customer checkouts. Disabling or editing a plan does not remove validity a Customer already paid for.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {(overview?.plans || []).map((plan) => {
            const draft = planDrafts[plan.code] || normalizePlanDraft(plan)
            const busy = busyPlanCode === plan.code

            return (
              <article
                key={plan.code}
                className="rounded-[24px] border border-stone-200 bg-white p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-black text-stone-950">{plan.name}</p>
                    <p className="mt-1 text-xs font-bold text-stone-500">
                      Fixed validity: {plan.validityMonths} month{plan.validityMonths === 1 ? '' : 's'}
                    </p>
                  </div>

                  <label className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-2 text-xs font-black text-stone-700">
                    <input
                      type="checkbox"
                      checked={draft.isEnabled === true}
                      onChange={(event) => updatePlanDraft(plan.code, 'isEnabled', event.target.checked)}
                      className="size-4 accent-emerald-700"
                    />
                    {draft.isEnabled ? 'Available' : 'Disabled'}
                  </label>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)]">
                  <label className="text-xs font-black text-stone-700">
                    Price (₹)
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={draft.priceRupees}
                      onChange={(event) => updatePlanDraft(plan.code, 'priceRupees', event.target.value)}
                      className="focus-ring mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-bold text-stone-950"
                    />
                  </label>

                  <label className="text-xs font-black text-stone-700">
                    Customer-facing description
                    <input
                      type="text"
                      value={draft.shortDescription}
                      onChange={(event) => updatePlanDraft(plan.code, 'shortDescription', event.target.value)}
                      className="focus-ring mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-semibold text-stone-950"
                    />
                  </label>
                </div>

                <label className="mt-3 block text-xs font-black text-stone-700">
                  Benefits shown with this plan
                  <textarea
                    rows={5}
                    value={draft.benefitsText}
                    onChange={(event) => updatePlanDraft(plan.code, 'benefitsText', event.target.value)}
                    className="focus-ring mt-1.5 w-full resize-y rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-semibold leading-5 text-stone-950"
                    placeholder="One benefit per line"
                  />
                </label>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => savePlan(plan)}
                  className="focus-ring mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? (
                    <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Save size={14} aria-hidden="true" />
                  )}
                  {busy ? 'Saving...' : 'Save plan'}
                </button>
              </article>
            )
          })}
        </div>
      </section>

      <section className="mt-5 rounded-[28px] bg-emerald-50 p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-800">Subscriptions</p>
            <h2 className="mt-1 text-xl font-black text-stone-950">Customer Pro memberships</h2>
            <p className="mt-1 text-xs font-semibold text-stone-600">View active, expired or suspended membership records. This module does not shorten paid validity.</p>
          </div>

          <select
            value={membershipStatus}
            onChange={(event) => {
              setMembershipStatus(event.target.value)
              setMembershipPage(1)
            }}
            className="focus-ring rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-black text-stone-700"
          >
            <option value="all">All memberships</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-emerald-100 bg-white">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-emerald-100/70 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-900">
              <tr>
                <th className="px-3 py-3">Customer</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Last plan</th>
                <th className="px-3 py-3">Valid until</th>
                <th className="px-3 py-3">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {memberships.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center font-semibold text-stone-500">No memberships found for this filter.</td>
                </tr>
              ) : memberships.map((membership) => (
                <tr key={membership.id} className="border-t border-stone-100">
                  <td className="px-3 py-3">
                    <p className="font-black text-stone-900">{membership.user?.name || 'Customer'}</p>
                    <p className="mt-0.5 text-[10px] font-semibold text-stone-500">{membership.user?.email || '—'}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${statusClasses(membership.status)}`}>
                      {membership.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-bold text-stone-700">{membership.lastPlan?.name || membership.lastPlanCode || '—'}</td>
                  <td className="px-3 py-3 font-semibold text-stone-700">{formatDate(membership.validUntil)}</td>
                  <td className="px-3 py-3 font-black text-stone-900">{membership.active ? `${membership.remainingDays} days` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold text-stone-500">
            {membershipPagination?.total || 0} record{membershipPagination?.total === 1 ? '' : 's'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={membershipPage <= 1}
              onClick={() => setMembershipPage((value) => Math.max(1, value - 1))}
              className="focus-ring rounded-xl bg-white px-3 py-2 text-xs font-black text-stone-700 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={!membershipPagination?.totalPages || membershipPage >= membershipPagination.totalPages}
              onClick={() => setMembershipPage((value) => value + 1)}
              className="focus-ring rounded-xl bg-stone-950 px-3 py-2 text-xs font-black text-white disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-[28px] bg-blue-50 p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-blue-800">Payments</p>
            <h2 className="mt-1 text-xl font-black text-stone-950">Razorpay Pro transactions</h2>
            <p className="mt-1 text-xs font-semibold text-stone-600">Payment history belongs to EPANTRY. Creator payout/revenue share is a separate future calculation.</p>
          </div>

          <select
            value={paymentStatus}
            onChange={(event) => {
              setPaymentStatus(event.target.value)
              setPaymentPage(1)
            }}
            className="focus-ring rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-black text-stone-700"
          >
            <option value="all">All payments</option>
            <option value="paid">Paid</option>
            <option value="initiated">Initiated</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-blue-100 bg-white">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-blue-100/70 text-[10px] font-black uppercase tracking-[0.1em] text-blue-900">
              <tr>
                <th className="px-3 py-3">Customer</th>
                <th className="px-3 py-3">Plan</th>
                <th className="px-3 py-3">Amount</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Payment date</th>
                <th className="px-3 py-3">Razorpay reference</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center font-semibold text-stone-500">No payments found for this filter.</td>
                </tr>
              ) : payments.map((payment) => (
                <tr key={payment.id} className="border-t border-stone-100">
                  <td className="px-3 py-3">
                    <p className="font-black text-stone-900">{payment.user?.name || 'Customer'}</p>
                    <p className="mt-0.5 text-[10px] font-semibold text-stone-500">{payment.user?.email || '—'}</p>
                  </td>
                  <td className="px-3 py-3 font-bold text-stone-700">{payment.plan?.name || payment.planCode}</td>
                  <td className="px-3 py-3 font-black text-stone-900">{moneyFromMinor(payment.amountMinor)}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${statusClasses(payment.status)}`}>
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-semibold text-stone-700">{formatDate(payment.paidAt || payment.initiatedAt)}</td>
                  <td className="max-w-[220px] px-3 py-3 font-mono text-[10px] text-stone-500">
                    {payment.providerPaymentId || payment.providerOrderId || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold text-stone-500">
            {paymentPagination?.total || 0} transaction{paymentPagination?.total === 1 ? '' : 's'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={paymentPage <= 1}
              onClick={() => setPaymentPage((value) => Math.max(1, value - 1))}
              className="focus-ring rounded-xl bg-white px-3 py-2 text-xs font-black text-stone-700 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={!paymentPagination?.totalPages || paymentPage >= paymentPagination.totalPages}
              onClick={() => setPaymentPage((value) => value + 1)}
              className="focus-ring rounded-xl bg-stone-950 px-3 py-2 text-xs font-black text-white disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </AdminShell>
  )
}
