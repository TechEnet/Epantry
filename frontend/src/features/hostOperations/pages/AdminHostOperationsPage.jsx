import {
  ArrowRight,
  BadgeCheck,
  CircleAlert,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
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
  'focus-ring w-full min-h-12 rounded-md border border-[#C9D5CF] bg-white px-4 py-3 text-[16px] font-medium leading-6 text-[#202421] outline-none transition focus:border-[#173F35]'

const primaryButton = 'focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#173F35] px-5 py-3 text-[16px] font-semibold text-white transition hover:bg-[#255845] disabled:cursor-not-allowed disabled:opacity-45'
const warningButton = 'focus-ring inline-flex min-h-12 items-center justify-center rounded-md border border-[#B9C8BF] bg-white px-5 py-3 text-[16px] font-semibold text-[#173F35] transition hover:bg-[#EEF2EC] disabled:cursor-not-allowed disabled:opacity-45'

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
      <div className="divide-y divide-[#E4E8E1] lg:max-h-[360px] lg:overflow-y-auto lg:overscroll-contain xl:max-h-[650px]">
        {rows.map((item, index) => {
          const id = getId(item)
          const active = id === selectedId
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(item)}
              aria-pressed={active}
              className={`focus-ring group flex w-full items-center gap-3 border-l-[3px] px-3 py-4 text-left transition sm:gap-4 sm:px-5 ${index >= 5 && !showAllMobile ? 'hidden sm:flex' : ''} ${active ? 'border-[#386B53] bg-[#E8EFE8]' : 'border-transparent bg-[#FFFEFB] hover:border-[#AFC3B4] hover:bg-[#F4F6F0]'}`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center text-[14px] font-bold tabular-nums ${active ? 'bg-[#173F35] text-white' : 'bg-[#EBF0EA] text-[#4B6558]'}`}>
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-[17px] font-bold leading-6 text-[#173F35]">{getTitle(item)}</span>
                <span className="mt-1 block text-[15px] leading-[1.5] text-[#526D61]">{getMeta(item)}</span>
              </span>
              <span className={`grid h-8 w-8 shrink-0 place-items-center ${active ? 'bg-[#173F35] text-white' : 'text-[#173F35] group-hover:bg-[#DFE9E1]'}`}>
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
          className="focus-ring min-h-12 w-full border-t border-[#D9E0D9] bg-[#F5F7F3] px-4 py-3 text-[15px] font-semibold text-[#173F35] sm:hidden"
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
    <dl data-hostops-information className="mt-6 grid grid-cols-2 gap-x-5 gap-y-1 border-y border-[#D7E0D6] py-2 sm:gap-x-8 md:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0 py-3">
          <dt className="text-[15px] font-medium text-[#65746A]">{label}</dt>
          <dd className="mt-1 break-words text-[16px] font-semibold leading-6 text-[#173F35]">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function ReviewNote({ value, onChange, placeholder, label = 'Record the reason for this decision' }) {
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
      <span className="mt-1 block text-[15px] font-normal text-[#65746A]">This note is recorded with the decision.</span>
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
  const manualAreaSelectionRef = useRef(false)
  const explicitRouteTabRef = useRef(Boolean(requestedTab))

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

      // On an unfiltered visit, prioritize actual work rather than opening an empty queue.
      // Never override an explicit ?tab= link or the reviewer's manual choice.
      if (!manualAreaSelectionRef.current && !explicitRouteTabRef.current &&
          pendingKybResult.status === 'fulfilled' && draftKybResult.status === 'fulfilled' &&
          pendingCases.length + draftCases.length === 0) {
        if (isRootSuperAdmin && hospitalityResult.status === 'fulfilled' &&
            hospitalityRows(hospitalityResult.value || {}).length > 0) {
          setTab('hospitality')
        } else if (recipeResult.status === 'fulfilled' && recipeResult.value.length > 0) {
          setTab('recipes')
        } else if (settlementResult.status === 'fulfilled' && settlementResult.value.length > 0) {
          setTab('finance')
        }
      }
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
    explicitRouteTabRef.current = Boolean(requestedTab)
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
    manualAreaSelectionRef.current = true
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
      count: kybCases.length,
    },
    {
      value: 'recipes', number: '02', name: 'Brand recipes', shortName: 'Recipes',
      subtitle: 'Review new brand recipe submissions',
      count: brandRecipes.length,
    },
    ...(isRootSuperAdmin ? [{
      value: 'hospitality', number: '03', name: 'Restaurant requests', shortName: 'Restaurants',
      subtitle: 'Review restaurant recipes and changes',
      count: hospitalityCount,
    }] : []),
    {
      value: 'finance', number: isRootSuperAdmin ? '04' : '03', name: 'Finance & payouts', shortName: 'Payouts',
      subtitle: 'Approve settlements and record payments',
      count: pendingSettlements,
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

  const totalRequests = workAreas.reduce((total, area) => total + area.count, 0)
  const priorityArea = workAreas.find((area) => area.count > 0) || null
  // No requests: the full-height desktop review columns are unnecessary.
  const compactEmptyQueue = !loading && queueRows.length === 0

  return (
    <AdminShell
      title="Host Business Operations"
      description="Review Host approvals, restaurant updates, brand recipes and payouts."
      mobileStackHeader
      actions={
        <button type="button" onClick={load} disabled={loading || busy}
          className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#D9E2D8] bg-white px-4 text-[15px] font-semibold text-[#173F35] hover:bg-[#EEF4EE] disabled:opacity-50">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          Refresh data
        </button>
      }
    >
      <div
        data-hostops-page className="-mx-2.5 -mt-2.5 min-w-0 bg-[#F7F6F2] pb-7 sm:-mx-5 sm:-mt-5 lg:mx-0 lg:mt-0"
        style={{ fontFamily: '"Plus Jakarta Sans", Inter, ui-sans-serif, system-ui, sans-serif' }}
      >
        {/* Page-scoped mobile refinements; no shared shell files or desktop rules change. */}
        <style>{`
          @media screen and (max-width: 639px) {
            .page-shell:has([data-hostops-page]) {
              width: 100% !important;
              max-width: none !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .page-shell:has([data-hostops-page]) > div {
              border: 0 !important;
              border-radius: 0 !important;
              box-shadow: none !important;
            }
            .page-shell:has([data-hostops-page]) .epantry-workspace-canvas > div:last-child {
              padding: 0 !important;
            }
            .page-shell:has([data-hostops-page]) .epantry-workspace-canvas > header {
              padding: 13px 16px 14px;
            }
            .page-shell:has([data-hostops-page]) .epantry-workspace-canvas > header > .grid > div:first-child > h1 {
              font-size: 25px !important;
              line-height: 1.15 !important;
              letter-spacing: -0.035em;
            }
            .page-shell:has([data-hostops-page]) .epantry-workspace-canvas > header > .grid > div:first-child > p {
              font-size: 13px !important;
              line-height: 1.5 !important;
            }
            [data-hostops-page] {
              width: 100%;
              max-width: 100%;
              margin: 0 !important;
              padding: 0 0 18px !important;
              overflow: clip;
              border-radius: 0;
            }
            [data-hostops-hero] { border-bottom: 0; }
            [data-hostops-intro] { padding: 19px 17px 16px; }
            [data-hostops-intro] > p:first-child {
              font-size: 11px;
              line-height: 1.4;
              letter-spacing: 0.025em;
            }
            [data-hostops-intro] > h2 {
              margin-top: 9px;
              font-size: 25px;
              line-height: 1.2;
              letter-spacing: -0.03em;
            }
            [data-hostops-intro] > p:nth-of-type(2) {
              margin-top: 8px;
              font-size: 14px;
              line-height: 1.5;
            }
            [data-hostops-intro] > a {
              margin-top: 10px;
              min-height: 39px;
              padding: 6px 0;
              font-size: 14px;
            }
            [data-hostops-count] {
              padding: 11px 17px 12px;
              gap: 12px;
              align-items: center;
            }
            [data-hostops-count] > div {
              display: grid;
              grid-template-columns: auto minmax(0, 1fr);
              align-items: center;
              column-gap: 10px;
              row-gap: 1px;
            }
            [data-hostops-count] > div > p:first-child {
              grid-column: 2;
              grid-row: 1;
              font-size: 11px;
              line-height: 1.2;
              letter-spacing: 0;
            }
            [data-hostops-count] > div > p:nth-child(2) {
              grid-column: 1;
              grid-row: 1 / span 2;
              margin-top: 0;
              font-size: 31px;
              line-height: 1;
            }
            [data-hostops-count] > div > p:nth-child(3) {
              grid-column: 2;
              grid-row: 2;
              margin-top: 0;
              font-size: 12px;
              line-height: 1.25;
            }
            [data-hostops-count] > button {
              flex-shrink: 0;
              min-height: 40px;
              font-size: 13px;
              white-space: nowrap;
            }
            [data-hostops-workspace] {
              margin-top: 0;
              padding: 0;
            }
            [data-hostops-workbench] {
              border: 0;
              border-radius: 0;
            }
            [data-hostops-directory] {
              border-bottom: 0;
              background: #F7F6F2;
            }
            [data-hostops-directory-heading] {
              padding: 14px 17px 9px;
              border-color: #DFE4DB;
            }
            [data-hostops-directory-heading] > p:first-child {
              font-size: 11px;
              line-height: 1.4;
            }
            [data-hostops-directory-heading] > h2 {
              margin-top: 3px;
              font-size: 21px;
              line-height: 1.2;
            }
            [data-hostops-directory-heading] > p:last-child { display: none; }
            /* Mobile: present each review area as a readable full-width row. */
            [data-hostops-tabs] {
              grid-template-columns: minmax(0, 1fr);
              gap: 0;
              padding: 6px 14px 14px;
              background: #F7F6F2;
            }
            [data-hostops-tab] {
              position: relative;
              flex-direction: row;
              align-items: center;
              justify-content: space-between;
              min-height: 66px;
              gap: 14px;
              padding: 13px 16px;
              border-left-width: 4px;
              border-bottom: 1px solid #DDE5DC;
            }
            [data-hostops-tab]:last-child { border-bottom: 0; }
            [data-hostops-tab] > span:first-child {
              min-width: 0;
              padding-right: 0;
            }
            [data-hostops-tab] > span:first-child > span:first-child {
              display: none;
            }
            [data-hostops-tab] > span:first-child > span:nth-child(2) {
              margin-top: 0;
              font-size: 16px;
              line-height: 1.4;
              letter-spacing: -0.012em;
            }
            [data-hostops-tab] > span:last-child {
              position: static;
              min-height: 30px;
              min-width: 30px;
              padding: 4px 9px;
              font-size: 14px;
              line-height: 1.4;
            }
            [data-hostops-queue] { border-top: 8px solid #F7F6F2; }
            [data-hostops-queue-heading] {
              padding: 15px 17px;
              align-items: start;
              flex-wrap: nowrap;
              gap: 8px;
            }
            [data-hostops-queue-heading] > div:first-child { min-width: 0; }
            [data-hostops-queue-heading] p:first-child {
              font-size: 11px;
              line-height: 1.4;
              letter-spacing: 0.02em;
            }
            [data-hostops-queue-heading] h2 {
              margin-top: 5px;
              font-size: 22px;
              line-height: 1.16;
              letter-spacing: -0.025em;
            }
            [data-hostops-queue-heading] p:last-child {
              margin-top: 5px;
              font-size: 13px;
              line-height: 1.4;
            }
            [data-hostops-queue-heading] > span {
              margin-top: 2px;
              padding: 5px 7px;
              font-size: 12px;
              white-space: nowrap;
            }
            [data-hostops-request-list] > div:first-child { display: none; }
            [data-hostops-request-list] button[aria-pressed] {
              min-height: 66px;
              padding: 11px 13px;
              gap: 10px;
            }
            [data-hostops-request-list] button[aria-pressed] > span:first-child {
              width: 29px;
              height: 29px;
              font-size: 12px;
            }
            [data-hostops-request-list] button[aria-pressed] > span:nth-child(2) > span:first-child {
              font-size: 15px;
              line-height: 1.35;
            }
            [data-hostops-request-list] button[aria-pressed] > span:nth-child(2) > span:last-child {
              margin-top: 2px;
              font-size: 12px;
              line-height: 1.35;
            }
            [data-hostops-request-list] button[aria-pressed] > span:last-child {
              width: 30px;
              height: 30px;
            }
            [data-hostops-detail] {
              padding: 17px 17px 22px;
              border-top: 8px solid #F7F6F2;
              scroll-margin-top: 60px;
            }
            [data-hostops-detail] > div > div:first-child {
              flex-direction: column;
              align-items: flex-start;
              gap: 9px;
            }
            [data-hostops-detail] h3 {
              margin-top: 5px;
              font-size: 23px;
              line-height: 1.18;
              letter-spacing: -0.025em;
            }
            [data-hostops-review-status] {
              padding: 6px 10px;
              font-size: 12px;
            }
            [data-hostops-information] {
              margin-top: 15px;
              padding: 3px 0;
              gap: 0 14px;
            }
            [data-hostops-information] > div { padding: 9px 0; }
            [data-hostops-information] dt { font-size: 12px; line-height: 1.4; }
            [data-hostops-information] dd {
              font-size: 14px;
              line-height: 1.5;
              overflow-wrap: anywhere;
            }
            [data-hostops-detail] label { font-size: 14px; }
            [data-hostops-detail] label textarea {
              width: 100%;
              min-width: 0;
              min-height: 96px;
              font-size: 15px;
              line-height: 1.5;
            }
            [data-hostops-detail] label > span:last-child {
              font-size: 12px;
              line-height: 1.5;
            }
            [data-hostops-detail] button { max-width: 100%; min-height: 44px; }
            [data-hostops-detail] button:not([aria-pressed]) {
              width: 100%;
            }
            [data-hostops-queue] input, [data-hostops-queue] textarea {
              max-width: 100%;
              box-sizing: border-box;
            }
          }
        `}</style>

        {/* A single editorial introduction replaces the old split hero and metric tiles. */}
        <header data-hostops-hero className="border-b border-[#CCD8CE] bg-[#F0F1EA]" aria-label="Host review overview">
          <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div data-hostops-intro className="min-w-0 px-5 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-10">
              <p className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-[0.06em] text-[#3B6854]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#173F35]" aria-hidden="true" />
                Host governance / Review workspace
              </p>
              <h2 className="mt-3 max-w-[760px] text-[29px] font-bold leading-[1.16] tracking-[-0.035em] text-[#173F35] sm:text-[38px] lg:text-[42px]">
                Review requests. Make the next decision.
              </h2>
              <p className="mt-3 max-w-[640px] text-[16px] leading-[1.6] text-[#526157] sm:text-[17px]">
                Select a work area, inspect the submitted information, then record the decision.
              </p>
              <Link
                to="/admin/host-listings"
                className="focus-ring mt-5 inline-flex min-h-11 items-center gap-2 border-b-2 border-[#173F35] py-2 text-[16px] font-bold text-[#173F35] transition hover:border-[#2D6A52] hover:text-[#2D6A52]"
              >
                Open unified listing approvals <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
            <div data-hostops-count className="flex min-w-0 flex-row items-center justify-between gap-5 border-t border-[#CDD9CE] bg-[#F1D8C8] px-5 py-5 sm:px-8 lg:flex-col lg:items-start lg:justify-center lg:border-l lg:border-t-0 lg:px-8">
              <div>
                <p className="text-[13px] font-bold uppercase tracking-[0.05em] text-[#4B6855]">Records in workspace</p>
                <p className="mt-1 text-[42px] font-bold leading-none tabular-nums tracking-[-0.05em] text-[#173F35] sm:text-[52px]">
                  {loading ? '–' : totalRequests}
                </p>
                <p className="mt-2 text-[15px] leading-5 text-[#4C6254]">{totalRequests === 1 ? 'record across your work areas' : 'records across your work areas'}</p>
              </div>
              {priorityArea && !loading ? (
                <button type="button" onClick={() => chooseTab(priorityArea.value)} className="focus-ring inline-flex min-h-11 shrink-0 items-center gap-1.5 border-b border-[#7C9987] py-2 text-[15px] font-bold text-[#173F35] hover:text-[#2D6A52]">
                  Open next <ArrowRight size={17} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>
        </header>

        {/* Status is kept outside the review workspace so it remains visible on area changes. */}
        {error ? (
          <div role="alert" className="mx-4 mt-5 flex items-start gap-3 border-l-[3px] border-[#AD4B41] bg-[#FBEAE5] px-4 py-3 text-[15px] leading-6 text-[#973F38] sm:mx-8">
            <CircleAlert size={20} className="mt-0.5 shrink-0" aria-hidden="true" /> {error}
          </div>
        ) : null}
        {loadWarnings.length ? (
          <div role="status" className="mx-4 mt-5 flex items-start gap-3 border-l-[3px] border-[#4C8292] bg-[#E7F0F2] px-4 py-3 text-[15px] leading-6 text-[#305764] sm:mx-8">
            <CircleAlert size={20} className="mt-0.5 shrink-0" aria-hidden="true" /> {friendlyLoadWarning(loadWarnings)}
          </div>
        ) : null}
        {notice ? (
          <div role="status" className="mx-4 mt-5 flex items-start gap-3 border-l-[3px] border-[#377C59] bg-[#E6F1E7] px-4 py-3 text-[15px] font-semibold leading-6 text-[#173F35] sm:mx-8">
            <BadgeCheck size={20} className="mt-0.5 shrink-0" aria-hidden="true" /> {notice}
          </div>
        ) : null}

        {/* Work-area directory and active queue now form one operational workspace, not card rows. */}
        <section data-hostops-workspace className="mt-6 min-w-0 px-0 sm:px-5 lg:px-8" aria-label="Host review workspace">
          <div data-hostops-workbench className={`grid min-w-0 border-y border-[#D7DED5] bg-[#FFFEFB] lg:border lg:border-[#D6DED7] ${compactEmptyQueue ? 'lg:grid-cols-1' : 'lg:grid-cols-[280px_minmax(0,1fr)]'}`}>
            <aside data-hostops-directory className={`min-w-0 border-b border-[#D6DED7] bg-[#F1F3ED] ${compactEmptyQueue ? 'lg:border-b lg:border-r-0' : 'lg:border-b-0 lg:border-r'}`} aria-label="Choose a Host work area">
              <div data-hostops-directory-heading className={`border-b border-[#CBD7CD] px-5 py-5 sm:px-6 ${compactEmptyQueue ? 'lg:py-4 lg:px-7' : 'lg:py-7'}`}>
                <p className="text-[13px] font-bold uppercase tracking-[0.065em] text-[#47705B]">01 / Choose an area</p>
                <h2 className="mt-1.5 text-[24px] font-bold leading-[1.18] tracking-[-0.025em] text-[#173F35] sm:text-[27px]">Your work areas</h2>
                <p className={`mt-2 text-[15px] leading-6 text-[#576B5D] ${compactEmptyQueue ? 'lg:hidden' : ''}`}>Open a queue to review its requests.</p>
              </div>
              <nav data-hostops-tabs className={`grid grid-cols-2 gap-px bg-[#D6DED7] ${compactEmptyQueue ? (workAreas.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3') : 'lg:block'}`} aria-label="Host review categories">
                {workAreas.map((area) => {
                  const active = tab === area.value
                  return (
                    <button
                      key={area.value}
                      type="button"
                      onClick={() => chooseTab(area.value)}
                      aria-pressed={active}
                      data-hostops-tab className={`focus-ring group flex min-h-[94px] min-w-0 flex-col justify-between gap-2 border-l-[4px] px-3 py-3 text-left transition sm:px-5 lg:flex-row lg:items-center lg:gap-3 ${compactEmptyQueue ? 'lg:min-h-[76px] lg:border-b-0 lg:py-3' : 'lg:min-h-[100px] lg:border-b lg:border-[#D3DDD3] lg:py-4'} ${active ? 'border-[#173F35] bg-[#173F35] text-white' : 'border-transparent bg-[#F6F7F2] text-[#173F35] hover:bg-[#E7EDE5]'}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[12px] font-bold uppercase tracking-[0.05em] ${active ? 'text-[#D5E6D9]' : 'text-[#47705B]'}`}>{area.number} / {active ? 'Selected' : 'Review area'}</span>
                        <span className="mt-1 block text-[16px] font-bold leading-[1.35] sm:text-[17px]">{area.name}</span>
                        <span className={`mt-1 hidden text-[13px] leading-5 ${compactEmptyQueue ? 'lg:hidden' : 'lg:block'} ${active ? 'text-[#D4E4D7]' : 'text-[#617166]'}`}>{area.subtitle}</span>
                      </span>
                      <span className={`inline-flex min-h-[30px] w-fit min-w-[30px] shrink-0 items-center justify-center px-2 text-[17px] font-extrabold tabular-nums ${active ? 'bg-[#376657] text-white' : area.count ? 'bg-[#E0ECE3] text-[#275740]' : 'bg-[#E5ECE3] text-[#385846]'}`}>
                        {loading ? '–' : area.count}
                      </span>
                    </button>
                  )
                })}
              </nav>
              <div className={`hidden border-t border-[#D0DCD1] px-6 py-6 ${compactEmptyQueue ? 'lg:hidden' : 'lg:block'}`}>
                <p className="text-[13px] font-bold uppercase tracking-[0.065em] text-[#47705B]">Review flow</p>
                <ol className="mt-3 space-y-3 text-[15px] font-medium leading-5 text-[#3D5848]">
                  <li><strong className="mr-2 text-[#47705B]">01</strong> Open a request</li>
                  <li><strong className="mr-2 text-[#47705B]">02</strong> Inspect the details</li>
                  <li><strong className="mr-2 text-[#47705B]">03</strong> Record your decision</li>
                </ol>
              </div>
            </aside>

            <div data-hostops-queue className="min-w-0 bg-[#FFFEFB]">
              <div data-hostops-queue-heading className={`flex flex-wrap items-start justify-between gap-4 border-b px-5 py-6 sm:px-7 ${compactEmptyQueue ? 'border-[#CAD9D4] bg-[#E8F0EE] lg:px-7 lg:py-5' : 'border-[#CAD9D4] bg-[#E8F0EE] lg:px-8 lg:py-7'}`}>
                <div className="min-w-0 flex-1">
                  <p className={`text-[13px] font-extrabold uppercase tracking-[0.06em] ${compactEmptyQueue ? 'text-[#4B6C68]' : 'text-[#4B6C68]'}`}>02 / Active review queue</p>
                  <h2 className="mt-2 text-[26px] font-bold leading-tight tracking-[-0.03em] text-[#173F35] sm:text-[32px]">
                    {tab === 'kyb' ? 'Business approval requests' : tab === 'recipes' ? 'Brand recipe submissions' : tab === 'hospitality' ? 'Restaurant requests' : 'Finance & payouts'}
                  </h2>
                  <p className="mt-2 text-[15px] leading-6 text-[#536A63] sm:text-[16px]">{currentArea.subtitle}.</p>
                </div>
                <span className={`shrink-0 border px-3 py-2 text-[15px] font-bold tabular-nums ${compactEmptyQueue ? 'border-[#BFD1CA] bg-[#FFFEFB] text-[#173F35]' : 'border-[#BFD1CA] bg-[#FFFEFB] text-[#173F35]'}`}>
                  {loading ? '–' : queueRows.length} {queueRows.length === 1 ? 'record' : 'records'}
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
                  <p className="mb-4 max-w-2xl text-[15px] leading-6 text-[#6C655D]">Create a payout from a Host organization and a completed date range. Another Finance Admin must approve it.</p>
                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="text-[15px] font-semibold text-[#173F35]">Host organization ID
                      <input required className={`${inputClass} mt-2`} placeholder="Organization ID" value={settlementForm.organizationId} onChange={(event) => setSettlementForm((current) => ({ ...current, organizationId: event.target.value }))} />
                    </label>
                    <label className="text-[15px] font-semibold text-[#173F35]">From date
                      <input required type="date" className={`${inputClass} mt-2`} value={settlementForm.periodStart} onChange={(event) => setSettlementForm((current) => ({ ...current, periodStart: event.target.value }))} />
                    </label>
                    <label className="text-[15px] font-semibold text-[#173F35]">To date
                      <input required type="date" min={settlementForm.periodStart || undefined} className={`${inputClass} mt-2`} value={settlementForm.periodEnd} onChange={(event) => setSettlementForm((current) => ({ ...current, periodEnd: event.target.value }))} />
                    </label>
                  </div>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="flex-1 text-[15px] font-semibold text-[#173F35]">Reason
                      <input className={`${inputClass} mt-2`} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is this payout being prepared?" />
                    </label>
                    <button type="submit" disabled={busy || !settlementForm.organizationId.trim() || !settlementForm.periodStart || !settlementForm.periodEnd || settlementForm.periodEnd <= settlementForm.periodStart} className={primaryButton}>Create proposal</button>
                  </div>
                </form>
              </details>
            ) : null}

            {loading ? (
              <div className="flex min-h-48 items-center justify-center gap-3 px-5 py-8 text-[16px] font-medium text-[#496A59]" role="status">
                <LoaderCircle size={22} className="animate-spin" aria-hidden="true" /> Loading Host requests…
              </div>
            ) : !queueRows.length ? (
              <div className="flex flex-col gap-5 bg-[#FFFEFB] px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-7 lg:py-6">
                <div className="flex min-w-0 items-start gap-4">
                  <span className="mt-0.5 block h-10 w-[3px] shrink-0 bg-[#6D9D85]" aria-hidden="true" />
                  <div className="min-w-0">
                    <h3 className="text-[22px] font-bold leading-7 text-[#173F35]">
                      {selectedAreaLoadFailed ? 'Unable to confirm this queue' : tab === 'kyb' ? 'No business approvals waiting' : tab === 'recipes' ? 'No brand recipes waiting' : tab === 'hospitality' ? 'No restaurant requests waiting' : 'No payout records yet'}
                    </h3>
                    <p className="mt-1 max-w-xl text-[16px] leading-7 text-[#62756A]">
                      {selectedAreaLoadFailed ? 'Some records may be missing. Refresh to try loading them again.' : tab === 'kyb' ? 'New business checks and go-live requests will appear here.' : tab === 'recipes' ? 'New submissions will appear when Hosts submit brand recipes.' : tab === 'hospitality' ? 'New restaurant changes and recipe requests will appear here.' : 'Create or review payout proposals as they become available.'}
                    </p>
                  </div>
                </div>
                {nextActiveArea ? (
                  <button type="button" onClick={() => chooseTab(nextActiveArea.value)}
                    className="focus-ring inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start border border-[#173F35] bg-[#173F35] px-4 py-2 text-[15px] font-semibold text-white transition hover:bg-[#28624A] sm:self-center">
                    Open {nextActiveArea.shortName.toLowerCase()} ({nextActiveArea.count}) <ArrowRight size={17} aria-hidden="true" />
                  </button>
                ) : (
                  <button type="button" onClick={load} disabled={loading || busy}
                    className="focus-ring inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start border border-[#CBD8CD] px-4 py-2 text-[15px] font-semibold text-[#173F35] hover:bg-[#F1F4EF] disabled:opacity-50 sm:self-center">
                    <RefreshCw size={16} aria-hidden="true" /> Refresh requests
                  </button>
                )}
              </div>
            ) : (
              <div className="grid min-w-0 xl:grid-cols-[minmax(255px,0.78fr)_minmax(0,1.2fr)]">
                <aside data-hostops-request-list className="min-w-0 border-b border-[#DDE2DB] bg-[#FBFBF8] xl:border-b-0 xl:border-r" aria-label={queueTitle}>
                  <div className="flex items-center justify-between gap-3 border-b border-[#DDE5DD] px-5 py-4 sm:px-6">
                    <h3 className="text-[18px] font-bold text-[#173F35]">{queueTitle}</h3>
                    <span className="text-[14px] font-medium text-[#617466]">Select to review</span>
                  </div>
                  <QueueRows key={tab} rows={queueRows} selectedId={selectedId} onSelect={selectQueueItem}
                    emptyTitle={tab === 'kyb' ? 'No business requests right now' : tab === 'recipes' ? 'No brand recipes waiting' : tab === 'hospitality' ? 'No restaurant requests right now' : 'No payout records yet'}
                    emptyText={tab === 'kyb' ? 'Submitted business checks and go-live requests appear here.' : tab === 'recipes' ? 'New submissions appear after a brand sends a recipe for review.' : tab === 'hospitality' ? 'Restaurant approvals appear here as they are submitted.' : 'Create a proposal above when eligible Host orders are ready.'}
                    getId={getQueueId} getTitle={getQueueTitle} getMeta={getQueueMeta} />
                </aside>

                <div data-hostops-detail ref={detailRef} className="min-w-0 scroll-mt-20 bg-[#FFFEFB] px-5 py-6 sm:px-7 sm:py-8 lg:px-8" aria-label="Request review details">
                  {selected ? (
                    <div>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-extrabold uppercase tracking-[0.065em] text-[#47705B]">03 / Inspect & decide</p>
                          <h3 className="mt-2 break-words text-[26px] font-bold leading-tight tracking-[-0.03em] text-[#173F35] sm:text-[31px]">
                            {tab === 'kyb' ? selected.legalEntityName || 'Business verification' : tab === 'recipes' ? 'Brand recipe submission' : tab === 'hospitality' ? hospitalityTitle(selected) : money(selected.totals?.netPayableMinor, selected.currency)}
                          </h3>
                          <p className="mt-1 text-[15px] leading-6 text-[#68766A]">
                            {tab === 'kyb' ? businessReviewStatus(selected.status) : tab === 'recipes' ? brandRecipeStatus(selected.status) : tab === 'hospitality' ? hospitalityStatus(selected) : settlementStatus(selected.status)}
                          </p>
                        </div>
                        <span data-hostops-review-status className="border-l-[3px] border-[#6D9D85] bg-[#F1F3EB] px-3 py-2 text-[14px] font-semibold text-[#275A43]">Reviewing this request</span>
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
                            <p className="mt-5 rounded-xl bg-[#EDF3EF] px-4 py-3 text-[15px] leading-6 text-[#315E4B]">The Host is still preparing these details. Decisions become available after submission.</p>
                          ) : null}
                          <ReviewNote value={reason} onChange={setReason} placeholder={`Explain the decision for ${selected.legalEntityName || 'this business'}`} />
                          {canMarketplaceMutate && ['submitted', 'needs_information'].includes(selected.status) ? (
                            <div className="mt-4 flex flex-wrap gap-3">
                              <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => run(() => decideAdminHostKyb(selected.id, { decision: 'approved', reason }), 'Business details approved. Go-live requires a separate Host request.')} className={primaryButton}>Approve business details</button>
                              <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => run(() => decideAdminHostKyb(selected.id, { decision: 'needs_information', reason }), 'More business details requested from the Host.')} className={warningButton}>Request more details</button>
                            </div>
                          ) : null}
                          <section className="mt-7 border-t-[3px] border-[#8DB6A0] bg-[#EEF2EC] px-4 py-5 sm:px-5">
                            <div className="flex items-center gap-2 text-[#315E4B]"><ShieldCheck size={19} aria-hidden="true" /><h4 className="text-[17px] font-bold">Go-live approval</h4></div>
                            <p className="mt-2 text-[15px] leading-6 text-[#486759]">Business: <strong>{businessReviewStatus(selected.status)}</strong> · Access: <strong>{goLiveStatus(selected.activationState)}</strong></p>
                            {selected.activationReview?.requestedAt ? (
                              <p className="mt-2 text-[15px] leading-6 text-[#5E7165]">Host request: {selected.activationReview?.reason || 'Ready for review.'}</p>
                            ) : null}
                            {canMarketplaceMutate && selected.status === 'approved' && selected.activationState === 'pending_review' ? (
                              <>
                                <label className="mt-4 block text-[15px] font-semibold text-[#173F35]">Verified test order/reference
                                  <input value={testOrderReference} onChange={(event) => setTestOrderReference(event.target.value)} placeholder="Enter the verified reference" className={`${inputClass} mt-2`} />
                                </label>
                                <p className="mt-2 text-[14px] leading-5 text-[#5E7165]">Add a review reason above, then confirm this Host can go live.</p>
                                <button type="button" disabled={busy || reason.trim().length < 3 || !testOrderReference.trim()} onClick={() => run(() => decideAdminHostActivation(selected.organizationId, { decision: 'activate', reason, testOrderReference }), 'Host approved to go live.')} className={`${primaryButton} mt-4`}>Approve go-live</button>
                              </>
                            ) : selected.activationState === 'active' ? (
                              <p className="mt-3 text-[15px] font-bold text-[#246E4C]">This Host business is live.</p>
                            ) : selected.status !== 'approved' ? (
                              <p className="mt-3 text-[15px] text-[#5E7165]">Approve the business details first.</p>
                            ) : (
                              <p className="mt-3 text-[15px] text-[#5E7165]">Waiting for the Host to request go-live.</p>
                            )}
                          </section>
                        </>
                      ) : tab === 'recipes' ? (
                        <>
                          <InformationGrid items={[
                            ['Market', selected.marketCode || 'Not provided'],
                            ['Linked products', selected.nominatedProductPackIds?.length || 0],
                            ['Submission', brandRecipeStatus(selected.status)],
                            ['Review stage', 'Recipe Review'],
                          ]} />
                          <div className="mt-5 border-l-[3px] border-[#8CAB99] bg-[#F1F4EE] px-4 py-4">
                            <p className="text-[15px] font-bold text-[#3D6651]">What the brand submitted</p>
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
                            <p className="mt-5 rounded-xl border border-[#DDA99E] bg-[#FFF1EB] px-4 py-3 text-[15px] leading-6 text-[#A04139]">This change has a safety or verification issue. The Host must fix it before approval.</p>
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
                              <p className="mt-2 text-[14px] leading-5 text-[#68766A]">Restaurant decisions require a reason of at least 10 characters.</p>
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
                            <section className="mt-6 border-t-[3px] border-[#8DB6A0] bg-[#EEF2EC] px-4 py-5 sm:px-5">
                              <h4 className="text-[17px] font-bold text-[#315E4B]">Record completed payment</h4>
                              <p className="mt-1 text-[15px] leading-6 text-[#5E7165]">After making the payment externally, record its reference to mark this payout as paid.</p>
                              <label className="mt-4 block text-[15px] font-semibold text-[#173F35]">Payment reference
                                <input className={`${inputClass} mt-2`} value={payoutReference} onChange={(event) => setPayoutReference(event.target.value)} placeholder="Enter the payment reference" />
                              </label>
                              <button type="button" disabled={busy || payoutReference.trim().length < 3 || reason.trim().length < 3} onClick={() => run(() => markAdminSettlementPaid(selected.id, { payoutReference, reason }), 'Payment recorded. Host payout marked complete.')} className={`${primaryButton} mt-4`}>Record payment</button>
                            </section>
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="border-l-[3px] border-[#BACBC0] bg-[#F2F5F0] px-5 py-7">
                      <h3 className="text-[19px] font-bold text-[#173F35]">Choose a request to review</h3>
                      <p className="mt-2 text-[15px] leading-6 text-[#68766A]">Open a row from the queue to inspect the evidence and record your decision.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  )
}
