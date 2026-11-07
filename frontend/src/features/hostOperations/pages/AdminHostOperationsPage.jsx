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
  useRef,
  useState,
} from 'react'

import {
  Link,
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
  'focus-ring w-full min-h-12 rounded-md border border-[#D0D9D2] bg-white px-4 py-3 text-[15px] font-medium text-[#202421] outline-none transition focus:border-[#173F35]'

const primaryButton = 'focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#173F35] px-5 py-2.5 text-[15px] font-semibold text-white transition hover:bg-[#255845] disabled:cursor-not-allowed disabled:opacity-45'
const warningButton = 'focus-ring inline-flex min-h-11 items-center justify-center rounded-md border border-[#B9C8BF] bg-white px-5 py-2.5 text-[15px] font-semibold text-[#173F35] transition hover:bg-[#EEF2EC] disabled:cursor-not-allowed disabled:opacity-45'

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
      limit: 50,
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
  const [showAllMobile, setShowAllMobile] = useState(false)

  if (!rows.length) {
    return (
      <div className="flex items-start gap-4 px-5 py-7 sm:px-7">
        <BadgeCheck size={25} className="mt-1 shrink-0 text-[#38715B]" aria-hidden="true" />
        <div>
          <p className="text-[18px] font-semibold leading-6 text-[#173F35]">{emptyTitle}</p>
          <p className="mt-1 max-w-md text-[15px] leading-6 text-[#596B61]">{emptyText}</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="divide-y divide-[#E4E8E1] lg:max-h-[620px] lg:overflow-y-auto lg:overscroll-contain">
        {rows.map((item, index) => {
          const id = getId(item)
          const active = id === selectedId
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(item)}
              aria-pressed={active}
              className={`focus-ring group flex w-full items-center gap-3 border-l-[3px] px-3 py-4 text-left transition sm:gap-4 sm:px-5 ${index >= 5 && !showAllMobile ? 'hidden sm:flex' : ''} ${active ? 'border-[#173F35] bg-[#EEF3ED]' : 'border-transparent bg-white hover:border-[#AFC3B4] hover:bg-[#F7F8F5]'}`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[14px] font-semibold ${active ? 'bg-[#173F35] text-white' : 'bg-[#F0F2EE] text-[#4B6558]'}`}>
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-[16px] font-bold leading-5 text-[#173F35]">{getTitle(item)}</span>
                <span className="mt-1 block text-[13px] leading-5 text-[#526D61]">{getMeta(item)}</span>
              </span>
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${active ? 'bg-[#173F35] text-white' : 'bg-[#EFF2ED] text-[#173F35] group-hover:bg-[#DFE9E1]'}`}>
                <ArrowRight size={17} aria-hidden="true" />
              </span>
            </button>
          )
        })}
      </div>
      {rows.length > 5 ? (
        <button
          type="button"
          onClick={() => setShowAllMobile((current) => !current)}
          className="focus-ring min-h-12 w-full border-t border-[#D9E0D9] bg-[#F5F7F3] px-4 py-3 text-[14px] font-semibold text-[#173F35] sm:hidden"
          aria-expanded={showAllMobile}
        >
          {showAllMobile ? 'Show fewer requests' : `View all ${rows.length} requests`}
        </button>
      ) : null}
    </div>
  )
}

function InformationGrid({ items }) {
  return (
    <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-1 border-y border-[#DDE2D9] py-2 sm:gap-x-8 md:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0 py-3">
          <dt className="text-[13px] font-medium text-[#65746A]">{label}</dt>
          <dd className="mt-1 break-words text-[15px] font-semibold leading-5 text-[#173F35]">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function ReviewNote({ value, onChange, placeholder, label = 'Reason for your decision' }) {
  return (
    <label className="mt-6 block text-[15px] font-semibold text-[#173F35]">
      {label}
      <textarea
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`${inputClass} mt-2 resize-y leading-6`}
      />
      <span className="mt-1 block text-[13px] font-normal text-[#65746A]">This note is recorded with the decision.</span>
    </label>
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
  const detailRef = useRef(null)

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

      // Keep any successfully loaded records visible if either queue fails.
      const pendingCases = pendingKybResult.status === 'fulfilled' ? pendingKybResult.value : []
      const draftCases = draftKybResult.status === 'fulfilled' ? draftKybResult.value : []
      setKybCases([...pendingCases, ...draftCases].filter(
        (item, index, rows) => rows.findIndex((candidate) => candidate.id === item.id) === index,
      ))

      if (pendingKybResult.status === 'rejected') {
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
    setTestOrderReference('')
    setPayoutReference('')
  }

  function focusDetail() {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      window.requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
  }

  function chooseStandardItem(item) {
    setSelectedId(item.id)
    setReason('')
    setTestOrderReference('')
    setPayoutReference('')
    focusDetail()

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
    // A notification's focus parameter should not lock the reviewer to one request.
    if (requestedFocus && requestedFocus !== item.key) {
      setSearchParams({ tab: 'hospitality' })
    }
    focusDetail()
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

  const workAreas = [
    {
      value: 'kyb', number: '01', name: 'Business approvals', shortName: 'Business',
      subtitle: 'Verify business details and go-live requests',
      count: kybCases.length, Icon: ShieldCheck,
    },
    {
      value: 'recipes', number: '02', name: 'Brand recipes', shortName: 'Recipes',
      subtitle: 'Review new brand recipe submissions',
      count: brandRecipes.length, Icon: ChefHat,
    },
    ...(isRootSuperAdmin ? [{
      value: 'hospitality', number: '03', name: 'Restaurant requests', shortName: 'Restaurants',
      subtitle: 'Review restaurant recipes and changes',
      count: hospitalityCount, Icon: Store,
    }] : []),
    {
      value: 'finance', number: isRootSuperAdmin ? '04' : '03', name: 'Finance & payouts', shortName: 'Payouts',
      subtitle: 'Approve settlements and record payments',
      count: pendingSettlements, Icon: WalletCards,
    },
  ]

  const currentArea = workAreas.find((item) => item.value === tab) || workAreas[0]
  const nextActiveArea = workAreas.find((item) => item.value !== tab && item.count > 0) || null
  const selectedAreaLoadFailed = loadWarnings.some((warning) => (
    tab === 'kyb' ? /business verification|business-verification drafts/i.test(warning)
      : tab === 'recipes' ? /brand recipe/i.test(warning)
        : tab === 'hospitality' ? /restaurant approval/i.test(warning)
          : /settlement/i.test(warning)
  ))
  const queueRows = tab === 'kyb'
    ? kybCases
    : tab === 'recipes'
      ? brandRecipes
      : tab === 'hospitality'
        ? hospitalityQueue
        : settlements
  const queueTitle = tab === 'kyb'
    ? 'Business requests'
    : tab === 'recipes'
      ? 'Brand submissions'
      : tab === 'hospitality'
        ? 'Restaurant requests'
        : 'Payout records'
  const selectQueueItem = tab === 'hospitality' ? chooseHospitalityItem : chooseStandardItem
  const getQueueId = tab === 'hospitality' ? (item) => item.key : (item) => item.id
  const getQueueTitle = tab === 'kyb'
    ? (item) => item.legalEntityName || 'Business verification'
    : tab === 'recipes'
      ? (item) => `Brand recipe${item.marketCode ? ` · ${item.marketCode}` : ''}`
      : tab === 'hospitality'
        ? hospitalityTitle
        : (item) => `Host payout · ${money(item.totals?.netPayableMinor, item.currency)}`
  const getQueueMeta = tab === 'kyb'
    ? (item) => `${businessReviewStatus(item.status)} · ${goLiveStatus(item.activationState)}`
    : tab === 'recipes'
      ? (item) => `${brandRecipeStatus(item.status)} · ${item.nominatedProductPackIds?.length || 0} linked products`
      : tab === 'hospitality'
        ? (item) => `${item.label} · ${hospitalityStatus(item)}`
        : (item) => `${settlementStatus(item.status)} · ${item.lineCount || 0} orders`

  return (
    <AdminShell
      title="Host Business Operations"
      description="Business approvals, brand recipes, restaurant requests and payouts."
      mobileStackHeader
      actions={
        <button type="button" onClick={load} disabled={loading || busy}
          className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#D9E2D8] bg-white px-4 text-[14px] font-semibold text-[#173F35] hover:bg-[#EEF4EE] disabled:opacity-50">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          Refresh data
        </button>
      }
    >
      <div className="-mx-2.5 -mt-2.5 min-w-0 bg-[#F7F6F2] pb-8 sm:-mx-5 sm:-mt-5 lg:mx-0 lg:mt-0">
        <section className="border-b border-[#D8DED6] bg-[#FFFEFB] px-4 py-7 sm:px-8 sm:py-9 lg:px-9" aria-label="Host operations overview">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(250px,0.55fr)] lg:gap-10">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[13px] font-semibold tracking-[0.04em] text-[#5F7668]">
                <span className="h-2 w-2 rounded-full bg-[#B36948]" aria-hidden="true" /> HOST OPERATIONS / REVIEW DESK
              </p>
              <h2 className="mt-3 max-w-2xl text-[30px] font-semibold leading-[1.13] tracking-[-0.035em] text-[#173F35] sm:text-[38px] lg:text-[40px]">
                Make the next decision with confidence.
              </h2>
              <p className="mt-3 max-w-xl text-[15px] leading-[1.65] text-[#5B6B61] sm:text-[16px]">
                Open a work area, check the request and record your decision.
              </p>
              <Link to="/admin/host-listings"
                className="focus-ring mt-5 inline-flex min-h-11 items-center gap-2 border-b border-[#173F35] py-2 text-[15px] font-semibold text-[#173F35] transition hover:text-[#33745A]">
                Unified listing approvals <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
            <div className="flex flex-col justify-center border-t border-[#DCE3DA] pt-5 lg:border-l lg:border-t-0 lg:pl-9 lg:pt-0">
              <p className="text-[13px] font-semibold tracking-[0.04em] text-[#65786D]">REQUESTS IN YOUR WORKSPACE</p>
              <p className="mt-1 text-[54px] font-semibold leading-none tracking-[-0.06em] text-[#173F35]">
                {workAreas.reduce((total, area) => total + area.count, 0)}
              </p>
              {workAreas.some((area) => area.count > 0) ? (
                <div className="mt-4 border-t border-[#DDE4DB] pt-3">
                  <p className="text-[13px] font-medium text-[#66776C]">Ready to open</p>
                  <button type="button" onClick={() => chooseTab(workAreas.find((area) => area.count > 0).value)}
                    className="focus-ring mt-1 inline-flex min-h-10 items-center gap-2 text-left text-[15px] font-semibold text-[#173F35] underline decoration-[#A9C2B0] underline-offset-4 hover:decoration-[#173F35]">
                    {workAreas.find((area) => area.count > 0).name} <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-[15px] leading-6 text-[#65746A]">No requests are waiting in these queues.</p>
              )}
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#E1E5DE] pt-4 text-[13px] font-medium text-[#526A5D] sm:gap-x-8 sm:text-[14px]" aria-label="Review workflow">
            <span><strong className="mr-2 font-semibold text-[#B36948]">01</strong>Choose an area</span>
            <span><strong className="mr-2 font-semibold text-[#B36948]">02</strong>Check the request</span>
            <span><strong className="mr-2 font-semibold text-[#B36948]">03</strong>Record the decision</span>
          </div>
        </section>

        <section className="px-4 pb-6 pt-8 sm:px-8 sm:pb-8 sm:pt-10 lg:px-9" aria-label="Host operation work areas">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold text-[#A45E40]">01 / WORK AREAS</p>
              <h2 className="mt-1 text-[26px] font-semibold leading-tight tracking-[-0.025em] text-[#173F35] sm:text-[29px]">Choose what to review</h2>
            </div>
            <p className="text-[14px] leading-5 text-[#65746A]">Select a work area to open its queue.</p>
          </div>
          <div className={`grid grid-cols-2 overflow-hidden border border-[#D4DDD4] bg-[#FFFEFB] ${isRootSuperAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`} role="group" aria-label="Choose a review queue">
            {workAreas.map((area, index) => {
              const Icon = area.Icon
              const active = tab === area.value
              return (
                <button key={area.value} type="button" onClick={() => chooseTab(area.value)} aria-pressed={active}
                  className={`focus-ring group relative min-w-0 border-b border-[#E1E6DE] p-4 text-left transition last:border-b-0 sm:p-5 lg:border-b-0 ${index % 2 === 0 && index !== workAreas.length - 1 ? 'border-r border-[#E1E6DE]' : ''} ${index < workAreas.length - 1 ? 'lg:border-r lg:border-[#E1E6DE]' : 'lg:border-r-0'} ${active ? 'bg-[#E8EFE8]' : 'bg-[#FFFEFB] hover:bg-[#F3F5F0]'}`}>
                  <span className={`absolute inset-x-0 top-0 h-[3px] ${active ? 'bg-[#173F35]' : 'bg-transparent'}`} aria-hidden="true" />
                  <span className="flex items-center justify-between gap-2">
                    <Icon size={19} className="text-[#426858]" aria-hidden="true" />
                    <span className={`min-w-9 px-2 py-1 text-center text-[18px] font-semibold tabular-nums ${area.count > 0 ? 'bg-[#173F35] text-white' : 'bg-[#F0F2EE] text-[#516A5C]'}`}>{area.count}</span>
                  </span>
                  <span className="mt-6 block text-[16px] font-semibold leading-5 text-[#173F35] sm:text-[17px]">{area.name}</span>
                  <span className="mt-1.5 hidden text-[13px] leading-5 text-[#67766C] sm:block">{area.subtitle}</span>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#426958]">
                    {active ? 'Currently viewing' : 'Open queue'} <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {error ? (
          <div role="alert" className="mx-3 mb-3 flex items-start gap-2 border-l-4 border-[#BE5541] bg-[#FFF1EB] px-4 py-3 text-[14px] font-medium leading-6 text-[#9F3A30] sm:mx-7 lg:mx-8">
            <CircleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />{error}
          </div>
        ) : null}
        {loadWarnings.length ? (
          <div role="status" className="mx-3 mb-3 flex items-start gap-2 border-l-4 border-[#4E82AA] bg-[#EDF5FB] px-4 py-3 text-[14px] leading-6 text-[#315E4B] sm:mx-7 lg:mx-8">
            <CircleAlert size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{friendlyLoadWarning(loadWarnings)}</span>
          </div>
        ) : null}
        {notice ? (
          <div role="status" className="mx-3 mb-3 flex items-start gap-2 border-l-4 border-[#3B9468] bg-[#E5F4E8] px-4 py-3 text-[14px] font-semibold leading-6 text-[#175D3B] sm:mx-7 lg:mx-8">
            <BadgeCheck size={18} className="mt-0.5 shrink-0" aria-hidden="true" />{notice}
          </div>
        ) : null}

        <section className="px-4 pt-1 sm:px-8 lg:px-9" aria-label="Selected Host operations queue">
          <div className="overflow-hidden border border-[#D4DDD4] bg-[#FFFEFB]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#D5DED5] bg-[#EBF0EA] px-5 py-6 sm:px-7 sm:py-7">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[#597467]">02 / {currentArea.name.toUpperCase()}</p>
                <h2 className="mt-1 text-[25px] font-semibold leading-tight tracking-[-0.03em] text-[#173F35] sm:text-[29px]">
                  {tab === 'kyb' ? 'Check the Host business' : tab === 'recipes' ? 'Review brand submissions' : tab === 'hospitality' ? 'Review restaurant updates' : 'Review Host payouts'}
                </h2>
                <p className="mt-1.5 text-[15px] leading-6 text-[#5F7467]">{currentArea.subtitle}.</p>
              </div>
              <span className="shrink-0 border-l border-[#B7C8BA] pl-4 text-[15px] font-semibold text-[#173F35]">
                {queueRows.length} {queueRows.length === 1 ? 'record' : 'records'}
              </span>
            </div>

            {tab === 'finance' && canFinanceMutate ? (
              <details className="group border-b border-[#DDE5DE] bg-[#F5F7F2]">
                <summary className="focus-ring flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-[15px] font-bold text-[#173F35] sm:px-6 [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-2"><WalletCards size={19} aria-hidden="true" /> Create a payout proposal</span>
                  <span className="text-[23px] leading-none group-open:hidden">+</span><span className="hidden text-[23px] leading-none group-open:block">−</span>
                </summary>
                <form className="border-t border-[#DDE5DE] px-4 py-5 sm:px-6" onSubmit={(event) => {
                  event.preventDefault()
                  run(() => createAdminSettlement({
                    organizationId: settlementForm.organizationId.trim(),
                    periodStart: new Date(settlementForm.periodStart).toISOString(),
                    periodEnd: new Date(settlementForm.periodEnd).toISOString(),
                    reason: reason.trim() || 'Periodic settlement reconciliation.',
                  }), 'Payout proposal created. A different Finance Admin must approve it.')
                }}>
                  <p className="mb-4 max-w-2xl text-[14px] leading-6 text-[#6C655D]">Create a payout from a Host organization and a completed date range. Another Finance Admin must approve it.</p>
                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="text-[14px] font-semibold text-[#173F35]">Host organization ID
                      <input required className={`${inputClass} mt-2`} placeholder="Organization ID" value={settlementForm.organizationId} onChange={(event) => setSettlementForm((current) => ({ ...current, organizationId: event.target.value }))} />
                    </label>
                    <label className="text-[14px] font-semibold text-[#173F35]">From date
                      <input required type="date" className={`${inputClass} mt-2`} value={settlementForm.periodStart} onChange={(event) => setSettlementForm((current) => ({ ...current, periodStart: event.target.value }))} />
                    </label>
                    <label className="text-[14px] font-semibold text-[#173F35]">To date
                      <input required type="date" min={settlementForm.periodStart || undefined} className={`${inputClass} mt-2`} value={settlementForm.periodEnd} onChange={(event) => setSettlementForm((current) => ({ ...current, periodEnd: event.target.value }))} />
                    </label>
                  </div>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="flex-1 text-[14px] font-semibold text-[#173F35]">Reason
                      <input className={`${inputClass} mt-2`} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is this payout being prepared?" />
                    </label>
                    <button type="submit" disabled={busy || !settlementForm.organizationId.trim() || !settlementForm.periodStart || !settlementForm.periodEnd || settlementForm.periodEnd <= settlementForm.periodStart} className={primaryButton}>Create proposal</button>
                  </div>
                </form>
              </details>
            ) : null}

            {loading ? (
              <div className="flex min-h-64 items-center justify-center gap-3 text-[15px] font-medium text-[#496A59]" role="status">
                <LoaderCircle size={22} className="animate-spin" aria-hidden="true" /> Loading Host requests…
              </div>
            ) : !queueRows.length ? (
              <div className="flex flex-col gap-6 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-9">
                <div className="flex min-w-0 items-start gap-4">
                  <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center border border-[#CCDCCF] bg-[#EDF3ED] text-[#3D7458]">
                    <BadgeCheck size={23} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[20px] font-semibold leading-7 text-[#173F35]">
                      {selectedAreaLoadFailed ? 'Unable to confirm this queue' : tab === 'kyb' ? 'No business approvals waiting' : tab === 'recipes' ? 'No brand recipes waiting' : tab === 'hospitality' ? 'No restaurant requests waiting' : 'No payout records yet'}
                    </h3>
                    <p className="mt-1 max-w-xl text-[15px] leading-6 text-[#62756A]">
                      {selectedAreaLoadFailed ? 'Some records may be missing. Refresh to try loading them again.' : tab === 'kyb' ? 'New business checks and go-live requests will appear here.' : tab === 'recipes' ? 'New submissions will appear when Hosts submit brand recipes.' : tab === 'hospitality' ? 'New restaurant changes and recipe requests will appear here.' : 'Create or review payout proposals as they become available.'}
                    </p>
                  </div>
                </div>
                {nextActiveArea ? (
                  <button type="button" onClick={() => chooseTab(nextActiveArea.value)}
                    className="focus-ring inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start border border-[#173F35] bg-[#173F35] px-4 py-2 text-[14px] font-semibold text-white transition hover:bg-[#28624A] sm:self-center">
                    Open {nextActiveArea.shortName.toLowerCase()} ({nextActiveArea.count}) <ArrowRight size={17} aria-hidden="true" />
                  </button>
                ) : (
                  <button type="button" onClick={load} disabled={loading || busy}
                    className="focus-ring inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start border border-[#CBD8CD] px-4 py-2 text-[14px] font-semibold text-[#173F35] hover:bg-[#F1F4EF] disabled:opacity-50 sm:self-center">
                    <RefreshCw size={16} aria-hidden="true" /> Refresh requests
                  </button>
                )}
              </div>
            ) : (
              <div className="grid lg:grid-cols-[minmax(280px,0.83fr)_minmax(0,1.65fr)]">
                <aside className="min-w-0 border-b border-[#DCE3DB] lg:border-b-0 lg:border-r" aria-label={queueTitle}>
                  <div className="flex items-center justify-between gap-3 border-b border-[#DDE5DD] bg-[#F3F5F1] px-4 py-4 sm:px-6">
                    <h3 className="text-[17px] font-bold text-[#173F35]">{queueTitle}</h3>
                    <span className="text-[13px] font-semibold text-[#496F59]">Select a request</span>
                  </div>
                  <QueueRows key={tab} rows={queueRows} selectedId={selectedId} onSelect={selectQueueItem}
                    emptyTitle={tab === 'kyb' ? 'No business requests right now' : tab === 'recipes' ? 'No brand recipes waiting' : tab === 'hospitality' ? 'No restaurant requests right now' : 'No payout records yet'}
                    emptyText={tab === 'kyb' ? 'Submitted business checks and go-live requests appear here.' : tab === 'recipes' ? 'New submissions appear after a brand sends a recipe for review.' : tab === 'hospitality' ? 'Restaurant approvals appear here as they are submitted.' : 'Create a proposal above when eligible Host orders are ready.'}
                    getId={getQueueId} getTitle={getQueueTitle} getMeta={getQueueMeta} />
                </aside>

                <div ref={detailRef} className="min-w-0 scroll-mt-20 bg-[#FFFEFB] px-4 py-6 sm:px-7 sm:py-8 lg:px-9" aria-label="Request review details">
                  {selected ? (
                    <div>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-bold text-[#9B6047]">03 / SELECTED REQUEST</p>
                          <h3 className="mt-1 break-words text-[24px] font-bold leading-tight tracking-[-0.03em] text-[#173F35] sm:text-[28px]">
                            {tab === 'kyb' ? selected.legalEntityName || 'Business verification' : tab === 'recipes' ? 'Brand recipe submission' : tab === 'hospitality' ? hospitalityTitle(selected) : money(selected.totals?.netPayableMinor, selected.currency)}
                          </h3>
                          <p className="mt-1 text-[14px] leading-6 text-[#68766A]">
                            {tab === 'kyb' ? businessReviewStatus(selected.status) : tab === 'recipes' ? brandRecipeStatus(selected.status) : tab === 'hospitality' ? hospitalityStatus(selected) : settlementStatus(selected.status)}
                          </p>
                        </div>
                        <span className="border border-[#D2E1D3] bg-[#EDF4ED] px-3 py-1.5 text-[13px] font-semibold text-[#275A43]">Selected for review</span>
                      </div>

                      {tab === 'kyb' ? (
                        <>
                          <InformationGrid items={[
                            ['Business type', titleize(selected.businessType)],
                            ['Country', selected.jurisdictionCountryCode || 'Not provided'],
                            ['Tax registration', selected.taxRegistration?.registrationType || 'Not provided'],
                            ['Tax reference', selected.taxRegistration?.last4 ? `•••• ${selected.taxRegistration.last4}` : 'Not provided'],
                          ]} />
                          {selected.status === 'draft' ? (
                            <p className="mt-5 rounded-xl bg-[#EDF3EF] px-4 py-3 text-[14px] leading-6 text-[#315E4B]">The Host is still preparing these details. Decisions become available after submission.</p>
                          ) : null}
                          <ReviewNote value={reason} onChange={setReason} placeholder={`Explain the decision for ${selected.legalEntityName || 'this business'}`} />
                          {canMarketplaceMutate && ['submitted', 'needs_information'].includes(selected.status) ? (
                            <div className="mt-4 flex flex-wrap gap-3">
                              <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => run(() => decideAdminHostKyb(selected.id, { decision: 'approved', reason }), 'Business details approved. Go-live requires a separate Host request.')} className={primaryButton}>Approve business details</button>
                              <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => run(() => decideAdminHostKyb(selected.id, { decision: 'needs_information', reason }), 'More business details requested from the Host.')} className={warningButton}>Request more details</button>
                            </div>
                          ) : null}
                          <div className="mt-7 rounded-xl border border-[#CFDCD0] bg-[#EDF3EF] px-4 py-5 sm:px-5">
                            <div className="flex items-center gap-2 text-[#315E4B]"><ShieldCheck size={19} aria-hidden="true" /><h4 className="text-[17px] font-bold">Go-live approval</h4></div>
                            <p className="mt-2 text-[14px] leading-6 text-[#486759]">Business: <strong>{businessReviewStatus(selected.status)}</strong> · Access: <strong>{goLiveStatus(selected.activationState)}</strong></p>
                            {selected.activationReview?.requestedAt ? (
                              <p className="mt-2 text-[14px] leading-6 text-[#5E7165]">Host request: {selected.activationReview?.reason || 'Ready for review.'}</p>
                            ) : null}
                            {canMarketplaceMutate && selected.status === 'approved' && selected.activationState === 'pending_review' ? (
                              <>
                                <label className="mt-4 block text-[14px] font-semibold text-[#173F35]">Verified test order/reference
                                  <input value={testOrderReference} onChange={(event) => setTestOrderReference(event.target.value)} placeholder="Enter the verified reference" className={`${inputClass} mt-2`} />
                                </label>
                                <p className="mt-2 text-[13px] leading-5 text-[#5E7165]">Add a review reason above, then confirm this Host can go live.</p>
                                <button type="button" disabled={busy || reason.trim().length < 3 || !testOrderReference.trim()} onClick={() => run(() => decideAdminHostActivation(selected.organizationId, { decision: 'activate', reason, testOrderReference }), 'Host approved to go live.')} className={`${primaryButton} mt-4`}>Approve go-live</button>
                              </>
                            ) : selected.activationState === 'active' ? (
                              <p className="mt-3 text-[14px] font-bold text-[#246E4C]">This Host business is live.</p>
                            ) : selected.status !== 'approved' ? (
                              <p className="mt-3 text-[14px] text-[#5E7165]">Approve the business details first.</p>
                            ) : (
                              <p className="mt-3 text-[14px] text-[#5E7165]">Waiting for the Host to request go-live.</p>
                            )}
                          </div>
                        </>
                      ) : tab === 'recipes' ? (
                        <>
                          <InformationGrid items={[
                            ['Market', selected.marketCode || 'Not provided'],
                            ['Linked products', selected.nominatedProductPackIds?.length || 0],
                            ['Submission', brandRecipeStatus(selected.status)],
                            ['Review stage', 'Recipe Review'],
                          ]} />
                          <div className="mt-5 border-l-[3px] border-[#AFC8B7] bg-[#F5F5F0] px-4 py-4">
                            <p className="text-[14px] font-bold text-[#3D6651]">What the brand submitted</p>
                            <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-6 text-[#403D38]">{selected.nominationDisclosure || 'No submission description provided.'}</p>
                          </div>
                          <ReviewNote value={reason} onChange={setReason} placeholder="Explain why this recipe is ready, or what must change" />
                          {canRecipeMutate && selected.status === 'submitted' ? (
                            <div className="mt-4 flex flex-wrap gap-3">
                              <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => run(() => reviewAdminBrandRecipe(selected.id, { decision: 'accept_for_governance', reason }), 'Brand recipe sent to Recipe Review. It is not published yet.')} className={primaryButton}>Send to Recipe Review</button>
                              <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => run(() => reviewAdminBrandRecipe(selected.id, { decision: 'request_changes', reason }), 'Brand recipe returned for changes.')} className={warningButton}>Return for changes</button>
                            </div>
                          ) : null}
                        </>
                      ) : tab === 'hospitality' ? (
                        <>
                          <InformationGrid items={[
                            ['Request type', selected.label],
                            ['Restaurant', selected.item.organizationName || 'Not provided'],
                            ['Outlet', selected.item.outletName || selected.item.snapshot?.outlet?.name || 'Not provided'],
                            ['Status', hospitalityStatus(selected)],
                          ]} />
                          {selected.kind === 'change_case' && selected.item.status === 'blocked' ? (
                            <p className="mt-5 rounded-xl border border-[#DDA99E] bg-[#FFF1EB] px-4 py-3 text-[14px] leading-6 text-[#A04139]">This change has a safety or verification issue. The Host must fix it before approval.</p>
                          ) : (
                            <>
                              <ReviewNote value={reason} onChange={setReason} placeholder={`Explain the decision for ${hospitalityTitle(selected)}`} />
                              {isRootSuperAdmin ? (
                                <div className="mt-4 flex flex-wrap gap-3">
                                  <button type="button" disabled={busy || reason.trim().length < 10} onClick={approveHospitality} className={primaryButton}><BadgeCheck size={18} aria-hidden="true" /> Approve request</button>
                                  {selected.kind === 'restaurant_recipe' ? (
                                    <button type="button" disabled={busy || reason.trim().length < 10} onClick={returnHospitalityRecipe} className={warningButton}>Return for changes</button>
                                  ) : null}
                                </div>
                              ) : null}
                              <p className="mt-2 text-[13px] leading-5 text-[#68766A]">Restaurant decisions require a reason of at least 10 characters.</p>
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <InformationGrid items={[
                            ['Status', settlementStatus(selected.status)],
                            ['Eligible orders', selected.lineCount || 0],
                            ['From', selected.periodStart ? new Date(selected.periodStart).toLocaleDateString('en-IN') : 'Not provided'],
                            ['To', selected.periodEnd ? new Date(selected.periodEnd).toLocaleDateString('en-IN') : 'Not provided'],
                          ]} />
                          <ReviewNote value={reason} onChange={setReason} placeholder="Explain the payout decision" />
                          {selected.status === 'pending_approval' && canFinanceMutate ? (
                            <div className="mt-4 flex flex-wrap gap-3">
                              <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => run(() => decideAdminSettlement(selected.id, { decision: 'approve', reason }), 'Host payout approved.')} className={primaryButton}>Approve payout</button>
                              <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => run(() => decideAdminSettlement(selected.id, { decision: 'reject', reason }), 'Host payout rejected.')} className={warningButton}>Reject payout</button>
                            </div>
                          ) : null}
                          {selected.status === 'approved' && canFinanceMutate ? (
                            <div className="mt-6 rounded-xl border border-[#CFDCD0] bg-[#EDF3EF] px-4 py-5 sm:px-5">
                              <h4 className="text-[17px] font-bold text-[#315E4B]">Record completed payment</h4>
                              <p className="mt-1 text-[14px] leading-6 text-[#5E7165]">After making the payment externally, record its reference to mark this payout as paid.</p>
                              <label className="mt-4 block text-[14px] font-semibold text-[#173F35]">Payment reference
                                <input className={`${inputClass} mt-2`} value={payoutReference} onChange={(event) => setPayoutReference(event.target.value)} placeholder="Enter the payment reference" />
                              </label>
                              <button type="button" disabled={busy || payoutReference.trim().length < 3 || reason.trim().length < 3} onClick={() => run(() => markAdminSettlementPaid(selected.id, { payoutReference, reason }), 'Payment recorded. Host payout marked complete.')} className={`${primaryButton} mt-4`}>Record payment</button>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex min-h-64 flex-col items-center justify-center py-8 text-center">
                      <ShieldCheck size={28} className="text-[#6A987E]" aria-hidden="true" />
                      <h3 className="mt-3 text-[20px] font-bold text-[#173F35]">Choose a request to begin</h3>
                      <p className="mt-2 max-w-sm text-[14px] leading-6 text-[#68766A]">Select a record from the queue to see its details and available decisions.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </AdminShell>
  )
}
