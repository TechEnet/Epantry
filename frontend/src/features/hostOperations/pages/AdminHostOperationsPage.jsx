import {
  ArrowRight,
  BadgeCheck,
  ChefHat,
  CircleAlert,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Store,
  WalletCards,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  useSearchParams,
} from 'react-router-dom'

import AdminShell from '../../admin/components/AdminShell'
import { useAdmin } from '../../admin/context/AdminContext'

import {
  approveAdminHospitalityChangeCase,
  approveAdminHospitalityDishPassport,
  approveAdminHospitalityProductionRecipe,
  createAdminSettlement,
  decideAdminHostActivation,
  decideAdminHostKyb,
  decideAdminSettlement,
  getHostOperationsErrorMessage,
  listAdminBrandRecipes,
  listAdminHospitalityApprovals,
  listAdminHostKyb,
  listAdminSettlements,
  markAdminSettlementPaid,
  reviewAdminBrandRecipe,
  reviewAdminHospitalityRestaurantRecipe,
} from '../services/hostOperations.service'

const inputClass =
  'focus-ring w-full border border-stone-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-900 outline-none focus:border-emerald-600'

function titleize(value) {
  return String(value || 'unknown')
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function businessReviewStatus(value) {
  const labels = {
    draft: 'Saved draft',
    submitted: 'Ready for review',
    needs_information: 'More information needed',
    approved: 'Business approved',
    rejected: 'Not approved',
  }

  return labels[value] || titleize(value)
}

function goLiveStatus(value) {
  const labels = {
    onboarding: 'Go-live not requested',
    pending_review: 'Go-live waiting for approval',
    active: 'Live',
    suspended: 'Paused',
  }

  return labels[value] || titleize(value)
}

function brandRecipeStatus(value) {
  const labels = {
    submitted: 'Waiting for review',
    accepted_for_governance: 'Sent to Recipe Review',
    changes_requested: 'Changes requested',
    rejected: 'Not accepted',
  }

  return labels[value] || titleize(value)
}

function settlementStatus(value) {
  const labels = {
    pending_approval: 'Waiting for approval',
    approved: 'Approved',
    rejected: 'Rejected',
    paid: 'Paid',
    void: 'Cancelled',
  }

  return labels[value] || titleize(value)
}

function money(amountMinor, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amountMinor || 0) / 100)
}

function hospitalityApprovalEvidence(reason) {
  return [
    {
      type: 'audit_event',
      label: 'Super Admin Hospitality approval',
      referenceId: '',
      uri: '',
      note: reason,
    },
  ]
}

async function loadEveryPage(loader, itemKey, params = {}) {
  const rows = []
  let page = 1
  let pages = 1

  do {
    const result = await loader({
      ...params,
      page,
      limit: 100,
    })

    rows.push(...(Array.isArray(result?.[itemKey]) ? result[itemKey] : []))
    pages = Math.max(1, Number(result?.pagination?.pages || 1))
    page += 1
  } while (page <= pages)

  return rows
}

function hospitalityRows(approvals) {
  return [
    ...(approvals.restaurantRecipes || []).map((item) => ({
      key: `restaurant_recipe:${item.id}`,
      kind: 'restaurant_recipe',
      label: 'Restaurant recipe',
      item,
    })),
    ...(approvals.productionRecipes || []).map((item) => ({
      key: `production_recipe:${item.id}`,
      kind: 'production_recipe',
      label: 'Kitchen recipe',
      item,
    })),
    ...(approvals.dishPassports || []).map((item) => ({
      key: `dish_passport:${item.id}`,
      kind: 'dish_passport',
      label: 'Dish record',
      item,
    })),
    ...(approvals.changeCases || []).map((item) => ({
      key: `change_case:${item.id}`,
      kind: 'change_case',
      label: 'Restaurant change',
      item,
    })),
  ]
}

function hospitalityTitle(row) {
  if (!row) {
    return 'Hospitality request'
  }

  if (row.kind === 'restaurant_recipe') {
    return row.item.title || row.item.dishName || 'Restaurant recipe'
  }

  if (row.kind === 'production_recipe') {
    return row.item.title || row.item.recipeKey || 'Kitchen recipe'
  }

  if (row.kind === 'dish_passport') {
    return row.item.snapshot?.dish?.name || row.item.passportKey || 'Dish record'
  }

  return row.item.caseKey || 'Restaurant change'
}

function hospitalityStatus(row) {
  if (!row) {
    return 'Waiting'
  }

  if (row.kind === 'dish_passport') {
    return `${titleize(row.item.status)} · ${titleize(row.item.verificationState)}`
  }

  return titleize(row.item.status)
}

function QueueRows({
  rows,
  selectedId,
  onSelect,
  emptyTitle,
  emptyText,
  getId,
  getTitle,
  getMeta,
}) {
  if (!rows.length) {
    return (
      <div className="border-t border-stone-200 py-5 sm:py-7">
        <p className="text-sm font-bold text-stone-900">{emptyTitle}</p>
        <p className="mt-1 max-w-xl text-xs leading-5 text-stone-500 sm:text-sm">
          {emptyText}
        </p>
      </div>
    )
  }

  return (
    <div className="border-t border-stone-200">
      {rows.map((item, index) => {
        const id = getId(item)
        const active = id === selectedId

        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(item)}
            className={`focus-ring block w-full border-b border-stone-200 px-3 py-3 text-left transition sm:px-4 sm:py-4 ${
              active
                ? 'bg-[#e7f4ef] text-stone-950'
                : 'bg-white text-stone-800 hover:bg-stone-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${active ? 'bg-emerald-700' : 'bg-stone-300'}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="truncate text-sm font-bold">{getTitle(item)}</p>
                  <span className="shrink-0 text-[10px] font-bold text-stone-400">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-stone-500">
                  {getMeta(item)}
                </p>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}


function friendlyLoadWarning(warnings) {
  const areas = []
  const values = Array.isArray(warnings) ? warnings : []

  if (values.some((item) => /business verification|business-verification drafts/i.test(item))) {
    areas.push('business approvals')
  }

  if (values.some((item) => /brand recipe/i.test(item))) {
    areas.push('brand recipes')
  }

  if (values.some((item) => /settlement/i.test(item))) {
    areas.push('payout records')
  }

  if (values.some((item) => /restaurant approval/i.test(item))) {
    areas.push('restaurant approvals')
  }

  const uniqueAreas = [...new Set(areas)]

  if (!uniqueAreas.length) {
    return 'Some sections could not load. Use Refresh to try again.'
  }

  const label = uniqueAreas.length === 1
    ? uniqueAreas[0]
    : `${uniqueAreas.slice(0, -1).join(', ')} and ${uniqueAreas.at(-1)}`

  return `${label.charAt(0).toUpperCase()}${label.slice(1)} could not load. Use Refresh to try again.`
}

export default function AdminHostOperationsPage() {
  const {
    hasAdminPermission,
    isRootSuperAdmin,
  } = useAdmin()

  const canMarketplaceMutate = hasAdminPermission('marketplace.mutate')
  const canFinanceMutate = hasAdminPermission('finance.mutate')
  const canRecipeMutate = hasAdminPermission('recipe.mutate')

  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const requestedFocus = searchParams.get('focus') || ''

  const initialTab =
    requestedTab === 'recipes' ||
    requestedTab === 'finance' ||
    (requestedTab === 'hospitality' && isRootSuperAdmin)
      ? requestedTab
      : 'kyb'

  const [tab, setTab] = useState(initialTab)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loadWarnings, setLoadWarnings] = useState([])
  const [kybCases, setKybCases] = useState([])
  const [brandRecipes, setBrandRecipes] = useState([])
  const [settlements, setSettlements] = useState([])
  const [hospitalityApprovals, setHospitalityApprovals] = useState({
    restaurantRecipes: [],
    productionRecipes: [],
    dishPassports: [],
    changeCases: [],
    recipeMigrationAudit: null,
  })
  const [selectedId, setSelectedId] = useState('')
  const [reason, setReason] = useState('')
  const [testOrderReference, setTestOrderReference] = useState('')
  const [settlementForm, setSettlementForm] = useState({
    organizationId: '',
    periodStart: '',
    periodEnd: '',
  })
  const [payoutReference, setPayoutReference] = useState('')

  const hospitalityQueue = useMemo(
    () => hospitalityRows(hospitalityApprovals),
    [hospitalityApprovals],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setLoadWarnings([])

    try {
      const [
        pendingKybResult,
        draftKybResult,
        recipeResult,
        settlementResult,
        hospitalityResult,
      ] = await Promise.allSettled([
        loadEveryPage(listAdminHostKyb, 'kybCases'),
        loadEveryPage(listAdminHostKyb, 'kybCases', { status: 'draft' }),
        loadEveryPage(listAdminBrandRecipes, 'submissions'),
        loadEveryPage(listAdminSettlements, 'settlements'),
        isRootSuperAdmin
          ? listAdminHospitalityApprovals()
          : Promise.resolve({
              restaurantRecipes: [],
              productionRecipes: [],
              dishPassports: [],
              changeCases: [],
              recipeMigrationAudit: null,
            }),
      ])

      const warnings = []

      if (pendingKybResult.status === 'fulfilled') {
        const draftCases =
          draftKybResult.status === 'fulfilled' ? draftKybResult.value : []

        const mergedCases = [
          ...pendingKybResult.value,
          ...draftCases,
        ].filter(
          (item, index, rows) =>
            rows.findIndex((candidate) => candidate.id === item.id) === index,
        )

        setKybCases(mergedCases)
      } else {
        setKybCases([])
        warnings.push('Business verification queue could not be loaded.')
      }

      if (draftKybResult.status === 'rejected') {
        warnings.push('Saved business-verification drafts could not be loaded.')
      }

      if (recipeResult.status === 'fulfilled') {
        setBrandRecipes(recipeResult.value)
      } else {
        setBrandRecipes([])
        warnings.push('Brand recipe review could not be loaded.')
      }

      if (settlementResult.status === 'fulfilled') {
        setSettlements(settlementResult.value)
      } else {
        setSettlements([])
        warnings.push('Settlement records could not be loaded.')
      }

      if (hospitalityResult.status === 'fulfilled') {
        setHospitalityApprovals({
          restaurantRecipes: hospitalityResult.value?.restaurantRecipes || [],
          productionRecipes: hospitalityResult.value?.productionRecipes || [],
          dishPassports: hospitalityResult.value?.dishPassports || [],
          changeCases: hospitalityResult.value?.changeCases || [],
          recipeMigrationAudit: hospitalityResult.value?.recipeMigrationAudit || null,
        })
      } else if (isRootSuperAdmin) {
        setHospitalityApprovals({
          restaurantRecipes: [],
          productionRecipes: [],
          dishPassports: [],
          changeCases: [],
          recipeMigrationAudit: null,
        })
        warnings.push('Restaurant approval queue could not be loaded.')
      }

      setLoadWarnings(warnings)
    } catch (loadError) {
      setError(
        getHostOperationsErrorMessage(
          loadError,
          'Unable to load Host Operations & Finance.',
        ),
      )
    } finally {
      setLoading(false)
    }
  }, [isRootSuperAdmin])

  useEffect(() => {
    const nextTab =
      requestedTab === 'recipes' ||
      requestedTab === 'finance' ||
      (requestedTab === 'hospitality' && isRootSuperAdmin)
        ? requestedTab
        : 'kyb'

    setTab(nextTab)
    setSelectedId('')
    setReason('')
    setNotice('')
  }, [requestedTab, isRootSuperAdmin])

  useEffect(() => {
    load()
  }, [load])

  const selected = useMemo(() => {
    if (tab === 'hospitality') {
      return hospitalityQueue.find((item) => item.key === selectedId) || null
    }

    const rows =
      tab === 'kyb' ? kybCases : tab === 'recipes' ? brandRecipes : settlements

    return rows.find((item) => item.id === selectedId) || null
  }, [tab, selectedId, kybCases, brandRecipes, settlements, hospitalityQueue])

  useEffect(() => {
    if (loading) {
      return
    }

    if (tab === 'hospitality') {
      if (requestedFocus && hospitalityQueue.some((item) => item.key === requestedFocus)) {
        setSelectedId(requestedFocus)
        return
      }

      if (!hospitalityQueue.some((item) => item.key === selectedId)) {
        setSelectedId(hospitalityQueue[0]?.key || '')
      }

      return
    }

    const rows =
      tab === 'kyb' ? kybCases : tab === 'recipes' ? brandRecipes : settlements

    if (!rows.some((item) => item.id === selectedId)) {
      setSelectedId(rows[0]?.id || '')
    }
  }, [
    loading,
    tab,
    selectedId,
    requestedFocus,
    kybCases,
    brandRecipes,
    settlements,
    hospitalityQueue,
  ])

  const hospitalityCount = hospitalityQueue.length
  const pendingSettlements = settlements.filter((item) =>
    ['draft', 'pending_approval', 'approved'].includes(item.status),
  ).length

  const tabDefinitions = [
    {
      value: 'kyb',
      label: 'Business approval',
      count: kybCases.length,
      description: 'Check Host business details and go-live requests.',
    },
    {
      value: 'recipes',
      label: 'Brand recipes',
      count: brandRecipes.length,
      description: 'Decide which brand recipes are ready for Recipe Review.',
    },
    ...(isRootSuperAdmin
      ? [
          {
            value: 'hospitality',
            label: 'Restaurant publishing approvals',
            count: hospitalityCount,
            description: 'Review restaurant recipes, dish information and important changes.',
          },
        ]
      : []),
    {
      value: 'finance',
      label: 'Finance & payouts',
      count: pendingSettlements,
      description: 'Prepare, approve and record Host payout settlements.',
    },
  ]

  const activeTab = tabDefinitions.find((item) => item.value === tab) || tabDefinitions[0]

  async function run(action, message) {
    setBusy(true)
    setError('')
    setNotice('')

    try {
      await action()
      setNotice(message)
      setReason('')
      await load()
    } catch (operationError) {
      setError(getHostOperationsErrorMessage(operationError))
    } finally {
      setBusy(false)
    }
  }

  function chooseTab(value) {
    setTab(value)
    setSearchParams(value === 'kyb' ? {} : { tab: value })
    setSelectedId('')
    setReason('')
    setNotice('')
  }

  function chooseStandardItem(item) {
    setSelectedId(item.id)
    setReason('')

    if (tab === 'finance') {
      setSettlementForm((current) => ({
        ...current,
        organizationId: item.organizationId || current.organizationId,
      }))
    }
  }

  function chooseHospitalityItem(item) {
    setSelectedId(item.key)
    setReason('')
  }

  async function approveHospitality() {
    if (!selected || tab !== 'hospitality') {
      return
    }

    const cleanReason = reason.trim()

    if (selected.kind === 'restaurant_recipe') {
      return run(
        () =>
          reviewAdminHospitalityRestaurantRecipe(selected.item.id, {
            decision: 'approve',
            reason: cleanReason,
          }),
        'Restaurant recipe approved and published.',
      )
    }

    if (selected.kind === 'production_recipe') {
      return run(
        () =>
          approveAdminHospitalityProductionRecipe(selected.item.id, {
            reason: cleanReason,
          }),
        'Kitchen recipe approved.',
      )
    }

    if (selected.kind === 'dish_passport') {
      return run(
        () =>
          approveAdminHospitalityDishPassport(selected.item.id, {
            reason: cleanReason,
            evidence: hospitalityApprovalEvidence(cleanReason),
          }),
        'Dish record approved.',
      )
    }

    return run(
      () =>
        approveAdminHospitalityChangeCase(selected.item.id, {
          reason: cleanReason,
          evidence: hospitalityApprovalEvidence(cleanReason),
        }),
      'Restaurant change approved.',
    )
  }

  async function returnHospitalityRecipe() {
    if (!selected || selected.kind !== 'restaurant_recipe') {
      return
    }

    return run(
      () =>
        reviewAdminHospitalityRestaurantRecipe(selected.item.id, {
          decision: 'reject',
          reason: reason.trim(),
        }),
      'Restaurant recipe returned for changes.',
    )
  }

  return (
    <AdminShell
      title="Host Business Operations"
      description="Review Host business approval, brand recipes, restaurant requests and payouts from one place."
      actions={
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="focus-ring inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-700 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          Refresh
        </button>
      }
    >
      <div className="min-h-[100svh] w-full bg-[#f6f4ee] pb-6 sm:pb-8">
        <section className="border-b border-stone-200 bg-[#edf4f1]">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="px-4 py-3 sm:px-7 sm:py-7">
              <p className="text-[11px] font-bold text-emerald-700 sm:text-xs">Host operations workspace</p>
              <h2 className="mt-1 max-w-3xl font-black leading-tight text-stone-950 sm:mt-2 sm:text-3xl">
                <span className="whitespace-nowrap text-[17px] sm:hidden">Review the request. Take action.</span>
                <span className="hidden sm:inline">Review the request, then take the right action.</span>
              </h2>
              <p className="mt-1 whitespace-nowrap text-xs leading-5 text-stone-600 sm:hidden">
                Choose an area, review it, decide.
              </p>
              <p className="mt-2 hidden max-w-2xl text-sm leading-6 text-stone-600 sm:block">
                This page brings Host approvals and payouts together. The summary is for reading; the work-area controls below are where you open a queue and take action.
              </p>
            </div>

            <div className="border-t border-stone-200 bg-white lg:border-l lg:border-t-0">
              <div className="border-b border-stone-200 px-4 py-1.5 sm:px-5 sm:py-2.5">
                <p className="text-[11px] font-bold text-stone-700 sm:text-xs">Queue overview</p>
              </div>
              <div className="grid grid-cols-2">
                {[
                  ['Business checks', kybCases.length],
                  ['Brand recipes', brandRecipes.length],
                  ['Restaurant requests', isRootSuperAdmin ? hospitalityCount : 0],
                  ['Payout records', pendingSettlements],
                ].map(([label, value], index) => (
                  <div
                    key={label}
                    className={`px-4 py-2 sm:px-5 sm:py-4 ${index % 2 === 1 ? 'border-l border-stone-200' : ''} ${index >= 2 ? 'border-t border-stone-200' : ''}`}
                  >
                    <p className="text-lg font-black text-[#123f35] sm:text-2xl">{value}</p>
                    <p className="mt-0.5 text-[9px] font-semibold text-stone-500 sm:text-xs">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 border-t border-stone-200 bg-[#123f35] text-white lg:grid-cols-4">
            {[
              ['01', 'Choose a work area', 'Open the right queue.'],
              ['02', 'Open a request', 'Choose the item to review.'],
              ['03', 'Check the details', 'Confirm what needs attention.'],
              ['04', 'Take action', 'Approve, return or record payment.'],
            ].map(([number, title, copy], index) => (
              <div
                key={number}
                className={`px-4 py-2.5 sm:px-6 sm:py-4 ${index % 2 === 1 ? 'border-l border-white/15' : ''} ${index >= 2 ? 'border-t border-white/15 lg:border-t-0' : ''} ${index === 2 ? 'lg:border-l lg:border-white/15' : ''}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-black text-emerald-100">{number}</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-200" />
                </div>
                <p className="mt-1 text-xs font-bold sm:mt-1.5 sm:text-sm">{title}</p>
                <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-emerald-50/75 sm:text-xs sm:leading-5">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-b border-stone-300 bg-[#f8f7f3]">
          <div className="px-4 py-2.5 sm:hidden">
            <label className="block text-xs font-bold text-stone-700">
              Open a work area
              <select
                value={tab}
                onChange={(event) => chooseTab(event.target.value)}
                className={`${inputClass} mt-1.5 bg-white font-bold text-stone-800`}
              >
                {tabDefinitions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label} ({item.count})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="hidden border-b border-stone-200 px-7 py-4 sm:block">
            <h2 className="text-lg font-black text-stone-950">Open a work area</h2>
          </div>

          <div className="hidden sm:grid sm:grid-cols-2 xl:grid-cols-4">
            {tabDefinitions.map((item, index) => {
              const isActive = tab === item.value
              const Icon = item.value === 'kyb'
                ? ShieldCheck
                : item.value === 'recipes'
                  ? ChefHat
                  : item.value === 'hospitality'
                    ? Store
                    : WalletCards

              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => chooseTab(item.value)}
                  aria-pressed={isActive}
                  className={`focus-ring group relative min-w-0 border-b border-stone-200 px-5 py-5 text-left transition xl:border-b-0 ${index % 2 === 1 ? 'sm:border-l' : ''} ${index > 1 ? 'sm:border-t xl:border-t-0' : ''} ${index > 0 ? 'xl:border-l' : ''} ${isActive ? 'bg-[#123f35] text-white' : 'bg-white text-stone-900 hover:bg-[#eef5f2]'}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center border ${isActive ? 'border-white/20 bg-white/10 text-emerald-100' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
                      <Icon size={18} aria-hidden="true" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-base font-black">{item.label}</span>
                        <span className={`inline-flex min-w-7 shrink-0 items-center justify-center rounded-full px-2 py-1 text-[11px] font-black ${isActive ? 'bg-white text-[#123f35]' : 'bg-stone-100 text-stone-700'}`}>
                          {item.count}
                        </span>
                      </span>
                      <span className={`mt-1.5 block line-clamp-2 text-xs leading-5 ${isActive ? 'text-emerald-50/80' : 'text-stone-500'}`}>
                        {item.description}
                      </span>
                    </span>
                  </div>

                  <span className={`mt-3 inline-flex items-center gap-1.5 text-xs font-black ${isActive ? 'text-white' : 'text-[#315f7a] group-hover:text-emerald-800'}`}>
                    {isActive ? 'Workspace open' : 'Open workspace'}
                    <ArrowRight size={14} aria-hidden="true" />
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {error ? (
          <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 sm:px-7">
            <div className="flex items-start gap-2">
              <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          </div>
        ) : null}

        {loadWarnings.length ? (
          <div className="border-b border-[#c8dbe6] bg-[#edf5f9] px-4 py-2 text-xs font-semibold leading-5 text-[#315f7a] sm:px-7 sm:py-3 sm:text-sm">
            {friendlyLoadWarning(loadWarnings)}
          </div>
        ) : null}

        {notice ? (
          <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 sm:px-7">
            {notice}
          </div>
        ) : null}

        {loading ? (
          <div className="grid min-h-[38svh] place-items-center">
            <div className="flex items-center gap-2 text-sm font-semibold text-stone-600">
              <LoaderCircle className="animate-spin text-emerald-700" size={18} aria-hidden="true" />
              Loading Host operations…
            </div>
          </div>
        ) : tab === 'kyb' ? (
          <section className="border-b border-stone-200 bg-white">
            <div className="border-b border-emerald-900/10 bg-[#e5f1ec] px-4 py-3 sm:px-7 sm:py-5">
              <p className="text-xs font-bold text-emerald-700">Business approval</p>
              <div className="mt-1 flex items-end justify-between gap-4">
                <div>
                  <h2 className="font-black text-stone-950">
                    <span className="text-lg sm:hidden">Review business approval</span>
                    <span className="hidden text-xl sm:inline">Review a Host business before it can go live</span>
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-stone-600 sm:text-sm">
                    <span className="sm:hidden">Check the business, then approve it to go live.</span>
                    <span className="hidden sm:inline">Check the business details first. If the Host later asks to go live, complete that approval here too.</span>
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold text-emerald-800">{kybCases.length} open</p>
              </div>
            </div>

            <div className="grid lg:grid-cols-[360px_minmax(0,1fr)]">
              <aside className="border-b border-stone-200 lg:border-b-0 lg:border-r">
                <div className="px-4 py-3 sm:hidden">
                  <label className="text-xs font-bold text-stone-600">
                    Choose a business
                    <select
                      value={selectedId}
                      onChange={(event) => {
                        const item = kybCases.find((row) => row.id === event.target.value)
                        if (item) chooseStandardItem(item)
                      }}
                      className={`${inputClass} mt-2`}
                    >
                      <option value="">Select business</option>
                      {kybCases.map((item) => (
                        <option key={item.id} value={item.id}>{item.legalEntityName || 'Business verification'}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="hidden sm:block">
                  <QueueRows
                    rows={kybCases}
                    selectedId={selectedId}
                    onSelect={chooseStandardItem}
                    emptyTitle="No business requests need attention."
                    emptyText="Saved business details, submitted reviews and go-live requests appear here when they need attention."
                    getId={(item) => item.id}
                    getTitle={(item) => item.legalEntityName || 'Business verification'}
                    getMeta={(item) => `${businessReviewStatus(item.status)} · ${goLiveStatus(item.activationState)}`}
                  />
                </div>
              </aside>

              <div className="min-w-0 px-4 py-4 sm:px-7 sm:py-6">
                {selected ? (
                  <div className="w-full">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold text-emerald-700">Business under review</p>
                        <h3 className="mt-1 text-2xl font-black text-stone-950">{selected.legalEntityName || 'Business verification'}</h3>
                      </div>
                      <span className="text-xs font-bold text-stone-500">{businessReviewStatus(selected.status)}</span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 border-y border-stone-200 sm:mt-5 sm:grid-cols-4">
                      {[
                        ['Business type', titleize(selected.businessType)],
                        ['Country', selected.jurisdictionCountryCode || 'Not added'],
                        ['Tax registration', selected.taxRegistration?.registrationType || 'Not added'],
                        ['Tax reference', selected.taxRegistration?.last4 ? `•••• ${selected.taxRegistration.last4}` : 'Not added'],
                      ].map(([label, value], index) => (
                        <div key={label} className={`py-3 ${index % 2 === 1 ? 'border-l border-stone-200 pl-3' : ''} ${index >= 2 ? 'border-t border-stone-200 sm:border-t-0' : ''} ${index === 2 ? 'sm:border-l sm:pl-3' : ''}`}>
                          <p className="text-[10px] font-bold text-stone-400">{label}</p>
                          <p className="mt-1 text-sm font-bold text-stone-800">{value}</p>
                        </div>
                      ))}
                    </div>

                    {selected.status === 'draft' ? (
                      <p className="mt-4 border-l-4 border-[#7da9c2] bg-[#edf5f9] px-3 py-2.5 text-xs font-semibold leading-5 text-[#315f7a] sm:text-sm">
                        The Host is still preparing these details. Review actions become available after submission.
                      </p>
                    ) : null}

                    <label className="mt-4 block text-xs font-bold text-stone-700 sm:mt-5">
                      Review note
                      <textarea
                        rows={3}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="Explain the approval or what the Host needs to change"
                        className={`${inputClass} mt-2`}
                      />
                    </label>

                    {canMarketplaceMutate && ['submitted', 'needs_information'].includes(selected.status) ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy || reason.trim().length < 3}
                          onClick={() =>
                            run(
                              () => decideAdminHostKyb(selected.id, { decision: 'approved', reason }),
                              'Business details approved. Go-live will be reviewed when the Host requests it.',
                            )
                          }
                          className="focus-ring rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                        >
                          Approve business details
                        </button>
                        <button
                          type="button"
                          disabled={busy || reason.trim().length < 3}
                          onClick={() =>
                            run(
                              () => decideAdminHostKyb(selected.id, { decision: 'needs_information', reason }),
                              'More business details requested from the Host.',
                            )
                          }
                          className="focus-ring rounded-lg border border-[#bfd3df] bg-[#edf5f9] px-4 py-2.5 text-xs font-bold text-[#315f7a] disabled:opacity-50"
                        >
                          Request more details
                        </button>
                      </div>
                    ) : null}

                    <div className="mt-5 border-t border-stone-200 pt-4 sm:mt-6 sm:pt-5">
                      <div className="flex items-center gap-2 text-[#315f7a]">
                        <ShieldCheck size={16} aria-hidden="true" />
                        <p className="text-sm font-bold">Go-live approval</p>
                      </div>
                      <p className="mt-2 text-sm text-stone-600">
                        Business details: <strong>{businessReviewStatus(selected.status)}</strong> · Access: <strong>{goLiveStatus(selected.activationState)}</strong>
                      </p>
                      {selected.activationReview?.requestedAt ? (
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-stone-500 sm:text-sm">
                          The Host asked to go live. {selected.activationReview?.reason || ''}
                        </p>
                      ) : null}

                      <input
                        value={testOrderReference}
                        onChange={(event) => setTestOrderReference(event.target.value)}
                        placeholder="Verified test order or reference"
                        className={`${inputClass} mt-3 max-w-xl`}
                      />

                      {canMarketplaceMutate && selected.status === 'approved' && selected.activationState === 'pending_review' ? (
                        <button
                          type="button"
                          disabled={busy || reason.trim().length < 3 || !testOrderReference.trim()}
                          onClick={() =>
                            run(
                              () =>
                                decideAdminHostActivation(selected.organizationId, {
                                  decision: 'activate',
                                  reason,
                                  testOrderReference,
                                }),
                              'Host business approved to go live for operations.',
                            )
                          }
                          className="focus-ring mt-3 inline-flex items-center gap-2 rounded-lg bg-[#173b4f] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                        >
                          <ShieldCheck size={14} aria-hidden="true" />
                          Approve go-live
                        </button>
                      ) : selected.activationState === 'active' ? (
                        <p className="mt-3 text-sm font-bold text-emerald-700">This Host business is live and approved.</p>
                      ) : selected.status !== 'approved' ? (
                        <p className="mt-3 text-xs font-semibold text-stone-500">Approve the business details before go-live can be reviewed.</p>
                      ) : (
                        <p className="mt-3 text-xs font-semibold text-stone-500">The business is approved. Waiting for the Host to request go-live.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-4 sm:py-6">
                    <p className="text-sm font-bold text-stone-800">Choose a business to review.</p>
                    <p className="mt-1 text-xs leading-5 text-stone-500">Business requests will appear here when a Host saves, submits or asks to go live.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : tab === 'recipes' ? (
          <section className="bg-white">
            <div className="border-b border-stone-200 bg-[#e8f1f6] px-4 py-3 sm:px-7 sm:py-5">
              <p className="text-xs font-bold text-[#315f7a]">Brand recipe review</p>
              <div className="mt-1 flex items-end justify-between gap-4">
                <div>
                  <h2 className="font-black text-stone-950">
                    <span className="text-lg sm:hidden">Review brand recipes</span>
                    <span className="hidden text-xl sm:inline">Decide which brand recipes can move to Recipe Review</span>
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-stone-600 sm:text-sm">
                    <span className="sm:hidden">Send ready recipes to Recipe Review or return them.</span>
                    <span className="hidden sm:inline">Check what the brand submitted. Send a ready recipe to Recipe Review or return it with clear changes.</span>
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold text-[#315f7a]">{brandRecipes.length} open</p>
              </div>
            </div>

            <div className="grid lg:grid-cols-[360px_minmax(0,1fr)]">
              <aside className="border-b border-stone-200 lg:border-b-0 lg:border-r">
                <div className="px-4 py-3 sm:hidden">
                  <label className="text-xs font-bold text-stone-600">
                    Choose a brand recipe
                    <select
                      value={selectedId}
                      onChange={(event) => {
                        const item = brandRecipes.find((row) => row.id === event.target.value)
                        if (item) chooseStandardItem(item)
                      }}
                      className={`${inputClass} mt-2`}
                    >
                      <option value="">Select brand recipe</option>
                      {brandRecipes.map((item, index) => (
                        <option key={item.id} value={item.id}>Brand recipe {index + 1}{item.marketCode ? ` · ${item.marketCode}` : ''}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="hidden sm:block">
                  <QueueRows
                    rows={brandRecipes}
                    selectedId={selectedId}
                    onSelect={chooseStandardItem}
                    emptyTitle="No brand recipes need review."
                    emptyText="New brand recipes appear here after a brand submits them for Super Admin review."
                    getId={(item) => item.id}
                    getTitle={(item, index) => `Brand recipe submission`}
                    getMeta={(item) => `${brandRecipeStatus(item.status)}${item.marketCode ? ` · ${item.marketCode}` : ''}`}
                  />
                </div>
              </aside>

              <div className="min-w-0 px-4 py-4 sm:px-7 sm:py-6">
                {selected ? (
                  <div className="w-full">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold text-[#315f7a]">Brand recipe under review</p>
                        <h3 className="mt-1 text-2xl font-black text-stone-950">Review the brand recipe</h3>
                        <p className="mt-1 text-xs text-stone-500">Market {selected.marketCode || 'not set'} · {selected.nominatedProductPackIds?.length || 0} linked products</p>
                      </div>
                      <span className="text-xs font-bold text-stone-500">{brandRecipeStatus(selected.status)}</span>
                    </div>

                    <div className="mt-5 border-y border-stone-200 py-4">
                      <p className="text-xs font-bold text-stone-500">What the brand submitted</p>
                      <p className="mt-1 text-sm leading-6 text-stone-800">{selected.nominationDisclosure || 'No disclosure was provided.'}</p>
                    </div>

                    <label className="mt-4 block text-xs font-bold text-stone-700 sm:mt-5">
                      Review note
                      <textarea
                        rows={3}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="Explain why it is ready or what the brand needs to change"
                        className={`${inputClass} mt-2`}
                      />
                    </label>

                    {canRecipeMutate ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy || reason.trim().length < 3}
                          onClick={() =>
                            run(
                              () => reviewAdminBrandRecipe(selected.id, { decision: 'accept_for_governance', reason }),
                              'Brand recipe sent to Recipe Review. It is not published yet.',
                            )
                          }
                          className="focus-ring rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                        >
                          Send to Recipe Review
                        </button>
                        <button
                          type="button"
                          disabled={busy || reason.trim().length < 3}
                          onClick={() =>
                            run(
                              () => reviewAdminBrandRecipe(selected.id, { decision: 'request_changes', reason }),
                              'Brand recipe returned for changes.',
                            )
                          }
                          className="focus-ring rounded-lg border border-[#bfd3df] bg-[#edf5f9] px-4 py-2.5 text-xs font-bold text-[#315f7a] disabled:opacity-50"
                        >
                          Return for changes
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="py-4 sm:py-6">
                    <p className="text-sm font-bold text-stone-800">Choose a brand recipe to review.</p>
                    <p className="mt-1 text-xs leading-5 text-stone-500">Submitted brand recipes will appear here automatically.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : tab === 'hospitality' ? (
          <section className="bg-white">
            <div className="border-b border-stone-200 bg-[#eeeaf7] px-4 py-3 sm:px-7 sm:py-5">
              <p className="text-xs font-bold text-[#5b4b85]">Restaurant publishing approvals</p>
              <div className="mt-1 flex items-end justify-between gap-4">
                <div>
                  <h2 className="font-black text-stone-950">
                    <span className="text-lg sm:hidden">Review restaurant updates</span>
                    <span className="hidden text-xl sm:inline">Review restaurant content before customers can see it</span>
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-stone-600 sm:text-sm">
                    <span className="sm:hidden">Approve restaurant content before customers can see it.</span>
                    <span className="hidden sm:inline">Check restaurant recipes, dish information and important changes when they need Super Admin approval.</span>
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold text-[#5b4b85]">{hospitalityCount} open</p>
              </div>
            </div>

            <div className="grid lg:grid-cols-[360px_minmax(0,1fr)]">
              <aside className="border-b border-stone-200 lg:border-b-0 lg:border-r">
                <div className="px-4 py-3 sm:hidden">
                  <label className="text-xs font-bold text-stone-600">
                    Choose a restaurant request
                    <select
                      value={selectedId}
                      onChange={(event) => {
                        const item = hospitalityQueue.find((row) => row.key === event.target.value)
                        if (item) chooseHospitalityItem(item)
                      }}
                      className={`${inputClass} mt-2`}
                    >
                      <option value="">Select restaurant request</option>
                      {hospitalityQueue.map((item) => (
                        <option key={item.key} value={item.key}>{hospitalityTitle(item)} · {item.label}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="hidden sm:block">
                  <QueueRows
                    rows={hospitalityQueue}
                    selectedId={selectedId}
                    onSelect={chooseHospitalityItem}
                    emptyTitle="No restaurant requests need approval."
                    emptyText="Restaurant recipes, dish information and important changes appear here when they need approval."
                    getId={(item) => item.key}
                    getTitle={hospitalityTitle}
                    getMeta={(item) => `${item.label} · ${hospitalityStatus(item)}`}
                  />
                </div>
              </aside>

              <div className="min-w-0 px-4 py-4 sm:px-7 sm:py-6">
                {selected ? (
                  <div className="w-full">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold text-[#5b4b85]">Restaurant request under review</p>
                        <h3 className="mt-1 text-2xl font-black text-stone-950">{hospitalityTitle(selected)}</h3>
                        <p className="mt-1 text-xs text-stone-500">{selected.item.organizationName || 'Restaurant business'} · {selected.label}</p>
                      </div>
                      <span className="text-xs font-bold text-stone-500">{hospitalityStatus(selected)}</span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 border-y border-stone-200 sm:mt-5 sm:grid-cols-4">
                      {[
                        ['Type', selected.label],
                        ['Restaurant', selected.item.organizationName || 'Not provided'],
                        ['Outlet', selected.item.outletName || selected.item.snapshot?.outlet?.name || 'Not provided'],
                        ['Status', hospitalityStatus(selected)],
                      ].map(([label, value], index) => (
                        <div key={label} className={`py-3 ${index % 2 === 1 ? 'border-l border-stone-200 pl-3' : ''} ${index >= 2 ? 'border-t border-stone-200 sm:border-t-0' : ''} ${index === 2 ? 'sm:border-l sm:pl-3' : ''}`}>
                          <p className="text-[10px] font-bold text-stone-400">{label}</p>
                          <p className="mt-1 line-clamp-2 text-sm font-bold text-stone-800">{value}</p>
                        </div>
                      ))}
                    </div>

                    {selected.kind === 'change_case' && selected.item.status === 'blocked' ? (
                      <p className="mt-4 border-l-4 border-rose-400 bg-rose-50 px-3 py-2.5 text-xs font-semibold leading-5 text-rose-700 sm:text-sm">
                        This change still has a safety or verification problem. The Host must fix it before approval is available.
                      </p>
                    ) : (
                      <>
                        <label className="mt-4 block text-xs font-bold text-stone-700 sm:mt-5">
                          Review note
                          <textarea
                            rows={3}
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            placeholder="Explain why this is approved or what needs to change"
                            className={`${inputClass} mt-2`}
                          />
                        </label>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy || reason.trim().length < 10}
                            onClick={approveHospitality}
                            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                          >
                            <BadgeCheck size={14} aria-hidden="true" />
                            Approve
                          </button>
                          {selected.kind === 'restaurant_recipe' ? (
                            <button
                              type="button"
                              disabled={busy || reason.trim().length < 10}
                              onClick={returnHospitalityRecipe}
                              className="focus-ring rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 disabled:opacity-50"
                            >
                              Return for changes
                            </button>
                          ) : null}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="py-4 sm:py-6">
                    <p className="text-sm font-bold text-stone-800">Choose a restaurant request to review.</p>
                    <p className="mt-1 text-xs leading-5 text-stone-500">Requests appear here when a restaurant needs Super Admin approval.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : (
          <section className="bg-white">
            <div className="border-b border-stone-200 bg-[#eaf0f4] px-4 py-3 sm:px-7 sm:py-5">
              <p className="text-xs font-bold text-[#315f7a]">Host payout review</p>
              <div className="mt-1 flex items-end justify-between gap-4">
                <div>
                  <h2 className="font-black text-stone-950">
                    <span className="text-lg sm:hidden">Review Host payouts</span>
                    <span className="hidden text-xl sm:inline">Prepare and approve Host payouts</span>
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-stone-600 sm:text-sm">
                    <span className="sm:hidden">Create, approve and record Host payouts.</span>
                    <span className="hidden sm:inline">Create a payout proposal from eligible orders, review the amount, then record the payment after it is completed.</span>
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold text-[#315f7a]">{settlements.length} payout records</p>
              </div>
            </div>

            {canFinanceMutate ? (
              <form
                className="border-b border-stone-200 px-4 py-4 sm:px-7 sm:py-5"
                onSubmit={(event) => {
                  event.preventDefault()
                  run(
                    () =>
                      createAdminSettlement({
                        organizationId: settlementForm.organizationId,
                        periodStart: new Date(settlementForm.periodStart).toISOString(),
                        periodEnd: new Date(settlementForm.periodEnd).toISOString(),
                        reason: reason || 'Periodic settlement reconciliation.',
                      }),
                    'Settlement proposal created. A different Finance Admin must approve it.',
                  )
                }}
              >
                <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr]">
                  <label className="text-xs font-bold text-stone-600">
                    Host business ID
                    <input
                      required
                      className={`${inputClass} mt-2`}
                      placeholder="Host business ID"
                      value={settlementForm.organizationId}
                      onChange={(event) => setSettlementForm((current) => ({ ...current, organizationId: event.target.value }))}
                    />
                  </label>
                  <label className="text-xs font-bold text-stone-600">
                    Payout period starts
                    <input
                      required
                      type="date"
                      className={`${inputClass} mt-2`}
                      value={settlementForm.periodStart}
                      onChange={(event) => setSettlementForm((current) => ({ ...current, periodStart: event.target.value }))}
                    />
                  </label>
                  <label className="text-xs font-bold text-stone-600">
                    Payout period ends
                    <input
                      required
                      type="date"
                      className={`${inputClass} mt-2`}
                      value={settlementForm.periodEnd}
                      onChange={(event) => setSettlementForm((current) => ({ ...current, periodEnd: event.target.value }))}
                    />
                  </label>
                </div>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="flex-1 text-xs font-bold text-stone-600">
                    Reason for proposal
                    <input
                      className={`${inputClass} mt-2`}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Explain why this payout is being prepared"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={busy}
                    className="focus-ring min-h-10 rounded-lg bg-[#173b4f] px-4 text-xs font-bold text-white disabled:opacity-50"
                  >
                    Create payout proposal
                  </button>
                </div>
              </form>
            ) : null}

            <div className="grid lg:grid-cols-[360px_minmax(0,1fr)]">
              <aside className="border-b border-stone-200 lg:border-b-0 lg:border-r">
                <div className="px-4 py-3 sm:hidden">
                  <label className="text-xs font-bold text-stone-600">
                    Choose a payout record
                    <select
                      value={selectedId}
                      onChange={(event) => {
                        const item = settlements.find((row) => row.id === event.target.value)
                        if (item) chooseStandardItem(item)
                      }}
                      className={`${inputClass} mt-2`}
                    >
                      <option value="">Select payout record</option>
                      {settlements.map((item, index) => (
                        <option key={item.id} value={item.id}>Payout {index + 1} · {settlementStatus(item.status)}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="hidden sm:block">
                  <QueueRows
                    rows={settlements}
                    selectedId={selectedId}
                    onSelect={chooseStandardItem}
                    emptyTitle="No payout records have been created yet."
                    emptyText="Create a payout proposal when eligible Host orders are ready to be reconciled."
                    getId={(item) => item.id}
                    getTitle={(item) => `Host payout · ${money(item.totals?.netPayableMinor, item.currency)}`}
                    getMeta={(item) => `${settlementStatus(item.status)} · ${item.lineCount || 0} orders`}
                  />
                </div>
              </aside>

              <div className="min-w-0 px-4 py-4 sm:px-7 sm:py-6">
                {selected ? (
                  <div className="w-full">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold text-[#315f7a]">Payout summary</p>
                        <h3 className="mt-1 text-2xl font-black text-stone-950">{money(selected.totals?.netPayableMinor, selected.currency)}</h3>
                        <p className="mt-1 text-xs text-stone-500">{selected.lineCount || 0} eligible orders · {settlementStatus(selected.status)}</p>
                      </div>
                      <WalletCards size={20} className="text-[#315f7a]" aria-hidden="true" />
                    </div>

                    <div className="mt-4 grid grid-cols-2 border-y border-stone-200 sm:mt-5 sm:grid-cols-4">
                      {[
                        ['Status', settlementStatus(selected.status)],
                        ['Orders', selected.lineCount || 0],
                        ['Period start', selected.periodStart ? new Date(selected.periodStart).toLocaleDateString() : '—'],
                        ['Period end', selected.periodEnd ? new Date(selected.periodEnd).toLocaleDateString() : '—'],
                      ].map(([label, value], index) => (
                        <div key={label} className={`py-3 ${index % 2 === 1 ? 'border-l border-stone-200 pl-3' : ''} ${index >= 2 ? 'border-t border-stone-200 sm:border-t-0' : ''} ${index === 2 ? 'sm:border-l sm:pl-3' : ''}`}>
                          <p className="text-[10px] font-bold text-stone-400">{label}</p>
                          <p className="mt-1 text-sm font-bold text-stone-800">{value}</p>
                        </div>
                      ))}
                    </div>

                    <label className="mt-4 block text-xs font-bold text-stone-700 sm:mt-5">
                      Review note
                      <textarea
                        rows={3}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="Explain why this payout is approved or rejected"
                        className={`${inputClass} mt-2`}
                      />
                    </label>

                    {selected.status === 'pending_approval' && canFinanceMutate ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy || reason.trim().length < 3}
                          onClick={() =>
                            run(
                              () => decideAdminSettlement(selected.id, { decision: 'approve', reason }),
                              'Host payout approved by the reviewing Finance Admin.',
                            )
                          }
                          className="focus-ring rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                        >
                          Approve payout
                        </button>
                        <button
                          type="button"
                          disabled={busy || reason.trim().length < 3}
                          onClick={() =>
                            run(
                              () => decideAdminSettlement(selected.id, { decision: 'reject', reason }),
                              'Host payout rejected.',
                            )
                          }
                          className="focus-ring rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 disabled:opacity-50"
                        >
                          Reject payout
                        </button>
                      </div>
                    ) : null}

                    {selected.status === 'approved' && canFinanceMutate ? (
                      <div className="mt-5 border-t border-stone-200 pt-4">
                        <p className="text-sm font-bold text-stone-900">Record the completed payment</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-stone-500 sm:text-sm">
                          After the payment is completed outside this page, add its reference here to mark the payout complete.
                        </p>
                        <input
                          className={`${inputClass} mt-3 max-w-xl`}
                          value={payoutReference}
                          onChange={(event) => setPayoutReference(event.target.value)}
                          placeholder="Payment reference"
                        />
                        <button
                          type="button"
                          disabled={busy || !payoutReference.trim() || reason.trim().length < 3}
                          onClick={() =>
                            run(
                              () => markAdminSettlementPaid(selected.id, { payoutReference, reason }),
                              'Payment recorded and the Host payout marked complete.',
                            )
                          }
                          className="focus-ring mt-3 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                        >
                          Record payment
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="py-4 sm:py-6">
                    <p className="text-sm font-bold text-stone-800">Choose a payout record to review.</p>
                    <p className="mt-1 text-xs leading-5 text-stone-500">Payout records will appear here after a proposal is created.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </AdminShell>
  )
}
