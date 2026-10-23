import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Boxes,
  CalendarDays,
  Check,
  Clock3,
  EyeOff,
  MapPin,
  PackageX,
  RefreshCw,
  Save,
  ShoppingBag,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { getPantryStatePresentation } from '../components/PantryStateBadge'
import { getCatalogProducts } from '../../grocery/services/catalog.service'
import {
  correctPantryQuantity,
  getPantryErrorMessage,
  getPantryItemHistory,
  markPantryItemBoughtElsewhere,
  markPantryItemFinished,
  stopTrackingPantryItem,
  updatePantryStorage,
  updatePantryUseSoon,
} from '../services/pantry.service'

const FOREST_BUTTON =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#173F35] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#285A47] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173F35] disabled:cursor-not-allowed disabled:opacity-60'

const OUTLINE_BUTTON =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#BDCBC0] bg-[#FAFCF8] px-5 py-3 text-sm font-semibold text-[#173F35] transition-colors hover:border-[#173F35] hover:bg-[#EEF3ED] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173F35] disabled:cursor-not-allowed disabled:opacity-60'

const FIELD_CLASS =
  'mt-2 min-h-12 w-full min-w-0 rounded-lg border border-[#D6DAD1] bg-white px-3.5 py-2.5 text-base text-[#202421] outline-none transition-colors placeholder:text-[#8B9188] focus:border-[#173F35] focus:ring-2 focus:ring-[#173F35]/15'

const OBSERVATION_LABELS = Object.freeze({
  i_have_this: 'Added to your pantry',
  manual_have: 'Marked as available',
  manual_quantity_correction: 'Quantity corrected',
  finished: 'Marked as finished',
  bought_elsewhere: 'Bought elsewhere',
  storage_update: 'Storage location updated',
  use_soon: 'Use reminder updated',
  do_not_track: 'Tracking stopped',
  opened: 'Marked as opened',
  recipe_cooked: 'Used in a recipe',
  marketplace_purchase: 'Purchased through EPANTRY',
  commerce_email_history: 'Purchase recorded',
  inference: 'Pantry availability updated',
})

const OBSERVATION_STATES = Object.freeze({
  confirmed_available: 'Available',
  inferred_available: 'Likely available',
  running_low: 'Running low',
  uncertain: 'Needs checking',
  out: 'Out of stock at home',
  replenished_elsewhere: 'Bought elsewhere',
  do_not_track: 'Not being tracked',
})

function formatDate(value) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not recorded'
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatDateOnly(value) {
  if (!value) return 'Not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not set'
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(date)
}

function toDateInputValue(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatQuantity(quantity) {
  if (!quantity) return 'Not recorded'
  if (
    quantity.mode === 'exact' &&
    quantity.value !== undefined &&
    quantity.value !== null
  ) {
    return `${quantity.value} ${quantity.unit || ''}`.trim()
  }
  if (
    quantity.mode === 'range' &&
    quantity.min !== undefined &&
    quantity.min !== null &&
    quantity.max !== undefined &&
    quantity.max !== null
  ) {
    return `${quantity.min}–${quantity.max} ${quantity.unit || ''}`.trim()
  }
  return 'Not recorded'
}

function getItemIdentity(item) {
  return (
    item?.displayName ||
    item?.canonicalIngredient?.canonicalName ||
    item?.canonicalIngredient?.name ||
    item?.canonicalPack?.displayName ||
    item?.canonicalPack?.name ||
    'Pantry item'
  )
}

// Reuse only a real, publicly listed EPANTRY Grocery product photo. A name
// search alone is NOT proof of identity: a pack ID or exact food name must
// match, so e.g. an onion-powder photo cannot appear for a pantry onion.
function normalizeFoodName(value) {
  return String(value || '')
    .toLocaleLowerCase('en')
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:kg|g|gm|ml|l|litre|liter|pcs|pieces|pack)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function findListedItemPhoto(item, products) {
  const pantryName = normalizeFoodName(getItemIdentity(item))
  const pantryPackId = String(item?.canonicalPackId || item?.canonicalPack?.id || '')
  if (!pantryName) return null

  const matchedProduct = (products || []).find((product) => {
    const url = product?.image?.url
    if (typeof url !== 'string' || !/^(https?:\/\/|\/)/i.test(url.trim())) {
      return false
    }
    if (pantryPackId && pantryPackId === String(product.packId || '')) {
      return true
    }
    return (
      normalizeFoodName(product.family?.name) === pantryName ||
      normalizeFoodName(product.displayName) === pantryName
    )
  })

  return matchedProduct?.image?.url || null
}

function getHistoryTitle(observation) {
  return (
    OBSERVATION_LABELS[observation?.sourceType] ||
    'Pantry update'
  )
}

function SummaryFact({ Icon, title, value }) {
  return (
    <div className="flex min-w-0 flex-col justify-center gap-1 border-b border-r border-[#E3E8DE] px-4 py-4 last:border-b-0 sm:px-5 sm:py-5">
      <div className="flex min-w-0 items-center gap-2 text-[#69746A]">
        <Icon size={16} strokeWidth={1.8} className="shrink-0 text-[#A46041]" aria-hidden="true" />
        <span className="text-[13px] leading-snug">{title}</span>
      </div>
      <p className="min-w-0 break-words pl-6 text-[16px] font-bold leading-snug text-[#203A2E]">{value}</p>
    </div>
  )
}

export default function PantryItemHistoryPage() {
  const { itemId } = useParams()

  const [item, setItem] = useState(null)
  const [observations, setObservations] = useState([])
  const [pagination, setPagination] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [actionPending, setActionPending] = useState('')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [quantityValue, setQuantityValue] = useState('')
  const [quantityUnit, setQuantityUnit] = useState('')
  const [storageZone, setStorageZone] = useState('')
  const [useSoonDate, setUseSoonDate] = useState('')
  const [listedPhoto, setListedPhoto] = useState(null)
  const [photoUnavailable, setPhotoUnavailable] = useState(false)

  const loadHistory = useCallback(async ({ refresh = false } = {}) => {
    if (!itemId) {
      setError('This pantry item could not be found.')
      setLoading(false)
      return
    }
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')

    try {
      const result = await getPantryItemHistory(itemId, { page: 1, limit: 50 })
      setItem(result.item || null)
      setObservations(result.observations || [])
      setPagination(result.pagination || null)

      const currentQuantity = result.item?.quantity
      if (currentQuantity?.mode === 'exact') {
        setQuantityValue(String(currentQuantity.value ?? ''))
        setQuantityUnit(currentQuantity.unit || '')
      } else {
        setQuantityValue('')
        setQuantityUnit(currentQuantity?.unit || '')
      }
      setStorageZone(result.item?.storageZone || '')
      setUseSoonDate(toDateInputValue(result.item?.useSoonAt))
    } catch (loadError) {
      setError(getPantryErrorMessage(loadError, 'Unable to load this pantry item.'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [itemId])

  useEffect(() => { loadHistory() }, [loadHistory])

  // Listing-only, read-only catalog lookup. No placeholder/photo is fabricated.
  // Keep this independent of the item-history request and all save actions.
  useEffect(() => {
    let cancelled = false
    const name = getItemIdentity(item)
    setListedPhoto(null)
    setPhotoUnavailable(false)

    if (!item || name === 'Pantry item') return () => { cancelled = true }

    async function loadListedPhoto() {
      try {
        const result = await getCatalogProducts({
          search: name,
          page: 1,
          limit: 24,
          listedOnly: true,
        })
        if (!cancelled) {
          setListedPhoto(findListedItemPhoto(item, result.products))
        }
      } catch {
        // Catalog unavailable or no public listing: display the name only.
        if (!cancelled) setListedPhoto(null)
      }
    }
    loadListedPhoto()
    return () => { cancelled = true }
  }, [item?.id, item?.canonicalPackId, item?.displayName, item?.canonicalIngredientId])

  const runAction = useCallback(async (actionKey, action, message) => {
    if (!itemId || actionPending) return
    setActionPending(actionKey)
    setError('')
    setSuccessMessage('')
    try {
      await action()
      setSuccessMessage(message)
      await loadHistory({ refresh: true })
    } catch (actionError) {
      setError(getPantryErrorMessage(actionError))
    } finally {
      setActionPending('')
    }
  }, [actionPending, itemId, loadHistory])

  const handleQuantityCorrection = async (event) => {
    event.preventDefault()
    await runAction(
      'quantity',
      () => correctPantryQuantity(itemId, { value: quantityValue, unit: quantityUnit }),
      'Quantity updated. Your previous updates are still saved in the activity history.',
    )
  }

  const handleStorageUpdate = async (event) => {
    event.preventDefault()
    await runAction(
      'storage',
      () => updatePantryStorage(itemId, storageZone),
      'Storage location updated.',
    )
  }

  const handleUseSoonUpdate = async (event) => {
    event.preventDefault()
    await runAction(
      'use-soon',
      () => updatePantryUseSoon(itemId, useSoonDate),
      'Your use reminder was updated.',
    )
  }

  const observationCountLabel = useMemo(() => {
    const total = pagination?.total
    const count = Number.isFinite(total) ? total : observations.length
    return `${count} update${count === 1 ? '' : 's'}`
  }, [observations.length, pagination])

  const itemState = getPantryStatePresentation(item?.state || 'uncertain')
  const StatusIcon = itemState.Icon
  const showPhoto = Boolean(listedPhoto && !photoUnavailable)

  return (
    <main className="min-h-screen w-full min-w-0 bg-[#F7F6F2] px-4 pb-10 pt-5 text-[#202421] sm:px-6 sm:pt-7 lg:px-8 xl:px-10">
      <div className="w-full min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/pantry"
            className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-[#173F35] transition-colors hover:text-[#A95B38] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173F35]"
          >
            <ArrowLeft size={18} aria-hidden="true" /> Back to pantry
          </Link>
          <button
            type="button"
            onClick={() => loadHistory({ refresh: true })}
            disabled={refreshing || Boolean(actionPending)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#D8DAD0] bg-[#FFFDF9] px-4 text-sm font-semibold text-[#173F35] transition-colors hover:border-[#A7B5AA] hover:bg-[#EEF1E9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173F35] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" /> Refresh
          </button>
        </div>

        <header className="mb-5 mt-4 sm:mb-7 sm:mt-5">
          <h1 className="text-[29px] font-bold leading-[1.18] tracking-[-0.035em] sm:text-[34px]">
            Pantry item history
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-[1.6] text-[#697069] sm:text-base">
            Check what you have at home, make an update and see what's changed.
          </p>
        </header>

        {error && (
          <div role="alert" className="mb-5 rounded-lg border-l-4 border-rose-600 bg-rose-50 px-4 py-3 text-[15px] text-rose-900">
            {error}
          </div>
        )}
        {successMessage && (
          <div role="status" className="mb-5 flex items-start gap-2 rounded-lg border-l-4 border-[#173F35] bg-[#E7EFE6] px-4 py-3 text-[15px] text-[#173F35]">
            <Check size={18} className="mt-0.5 shrink-0" aria-hidden="true" /> {successMessage}
          </div>
        )}

        {loading ? (
          <div className="h-52 animate-pulse rounded-2xl bg-[#E7EAE1]" aria-label="Loading pantry item" />
        ) : item ? (
          <>
            {/* Photo is shown ONLY after the existing exact-match, listed-only
                EPANTRY catalog lookup succeeds. Otherwise this stays text-only. */}
            <section aria-label="Current pantry item" className="overflow-hidden rounded-[18px] border border-[#D8DDD3] bg-[#EDF0E8]">
              <div className="grid min-w-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                <div className="flex min-w-0 flex-col sm:flex-row sm:items-stretch">
                  {showPhoto && (
                    <div className="h-44 w-full shrink-0 overflow-hidden bg-[#DCE0CF] sm:h-auto sm:w-[180px] xl:w-[220px]">
                      <img
                        src={listedPhoto}
                        alt={getItemIdentity(item)}
                        loading="lazy"
                        decoding="async"
                        onError={() => setPhotoUnavailable(true)}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex min-h-[174px] min-w-0 flex-1 flex-col justify-center px-5 py-6 sm:px-6 lg:px-7">
                    <p className="flex items-center gap-2 text-sm font-semibold text-[#9F5837]">
                      <span className="h-2 w-2 rounded-full bg-[#C86C42]" aria-hidden="true" /> In your pantry
                    </p>
                    <h2 className="mt-2 min-w-0 break-words text-[29px] font-bold leading-tight tracking-[-0.035em] text-[#173F35] sm:text-[35px]">
                      {getItemIdentity(item)}
                    </h2>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${itemState.className}`}>
                        <StatusIcon size={16} aria-hidden="true" /> {itemState.label}
                      </span>
                      {item.trackingPaused && <span className="text-sm font-medium text-[#7E5A46]">Tracking is off</span>}
                    </div>
                  </div>
                </div>
                <div className="grid min-w-0 grid-cols-2 border-t border-[#D6DDD3] bg-[#F8F9F4] lg:border-l lg:border-t-0">
                  <SummaryFact Icon={Boxes} title="Amount at home" value={formatQuantity(item.quantity)} />
                  <SummaryFact Icon={MapPin} title="Stored in" value={item.storageZone || 'Not set'} />
                  <SummaryFact Icon={CalendarDays} title="Use reminder" value={formatDateOnly(item.useSoonAt)} />
                  <SummaryFact Icon={Clock3} title="Last update" value={formatDate(item.lastObservationAt)} />
                </div>
              </div>
            </section>

            {/* One quiet editing surface, three clear tasks. No nested card grid. */}
            <section aria-labelledby="update-item-heading" className="mt-6 min-w-0 overflow-hidden rounded-[16px] border border-[#E2E0D8] bg-[#FFFEFB] xl:mt-8">
              <div className="flex flex-col gap-1 border-b border-[#ECE7DD] px-5 py-5 sm:px-7 sm:py-6 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
                <div className="flex items-start gap-3">
                  <span className="mt-1.5 h-9 w-1 shrink-0 rounded-full bg-[#C86C42]" aria-hidden="true" />
                  <div>
                    <h2 id="update-item-heading" className="text-[23px] font-bold leading-snug tracking-[-0.02em] sm:text-[26px]">Keep it up to date</h2>
                    <p className="mt-1 text-[15px] leading-relaxed text-[#697069]">Change only what you need. Your earlier updates stay in the history.</p>
                  </div>
                </div>
              </div>
              <div className="grid min-w-0 divide-y divide-[#E9E7DF] lg:grid-cols-3 lg:divide-x lg:divide-y-0">
                <form onSubmit={handleQuantityCorrection} className="flex min-w-0 flex-col justify-between gap-5 px-5 py-6 sm:px-7 sm:py-7">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#E6EDE5] text-[#173F35]"><Boxes size={21} aria-hidden="true" /></span>
                      <div className="min-w-0">
                        <h3 className="text-[18px] font-bold leading-snug">Quantity</h3>
                        <p className="text-sm leading-relaxed text-[#697069]">How much is left?</p>
                      </div>
                    </div>
                    <div className="mt-5 grid min-w-0 grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-3">
                      <label className="min-w-0 text-sm font-semibold text-[#384138]">
                        Amount
                        <input type="number" min="0" step="any" value={quantityValue}
                          onChange={(event) => setQuantityValue(event.target.value)} required className={FIELD_CLASS} />
                      </label>
                      <label className="min-w-0 text-sm font-semibold text-[#384138]">
                        Unit
                        <input type="text" value={quantityUnit} onChange={(event) => setQuantityUnit(event.target.value)}
                          placeholder="g, ml, pcs" required className={FIELD_CLASS} />
                      </label>
                    </div>
                  </div>
                  <button type="submit" disabled={Boolean(actionPending)} className={`${FOREST_BUTTON} w-full`}>
                    <Save size={17} aria-hidden="true" /> {actionPending === 'quantity' ? 'Saving…' : 'Save quantity'}
                  </button>
                </form>
                <form onSubmit={handleUseSoonUpdate} className="flex min-w-0 flex-col justify-between gap-5 px-5 py-6 sm:px-7 sm:py-7">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#F6E5D9] text-[#A65A39]"><CalendarDays size={21} aria-hidden="true" /></span>
                      <div className="min-w-0">
                        <h3 className="text-[18px] font-bold leading-snug">Use reminder</h3>
                        <p className="text-sm leading-relaxed text-[#697069]">Your preferred use date</p>
                      </div>
                    </div>
                    <label className="mt-5 block text-sm font-semibold text-[#384138]">
                      Remind me by
                      <input type="date" value={useSoonDate} onChange={(event) => setUseSoonDate(event.target.value)}
                        required className={FIELD_CLASS} />
                    </label>
                    <p className="mt-2 text-[13px] leading-relaxed text-[#77746D]">This is not an expiry date.</p>
                  </div>
                  <button type="submit" disabled={Boolean(actionPending)} className={`${OUTLINE_BUTTON} w-full`}>
                    <CalendarDays size={17} aria-hidden="true" /> {actionPending === 'use-soon' ? 'Saving…' : 'Save reminder'}
                  </button>
                </form>
                <form onSubmit={handleStorageUpdate} className="flex min-w-0 flex-col justify-between gap-5 px-5 py-6 sm:px-7 sm:py-7">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#E6EDE5] text-[#173F35]"><MapPin size={21} aria-hidden="true" /></span>
                      <div className="min-w-0">
                        <h3 className="text-[18px] font-bold leading-snug">Storage</h3>
                        <p className="text-sm leading-relaxed text-[#697069]">Where do you keep it?</p>
                      </div>
                    </div>
                    <label className="mt-5 block text-sm font-semibold text-[#384138]">
                      Location
                      <input type="text" value={storageZone} onChange={(event) => setStorageZone(event.target.value)}
                        placeholder="Pantry shelf, fridge, freezer" required className={FIELD_CLASS} />
                    </label>
                  </div>
                  <button type="submit" disabled={Boolean(actionPending)} className={`${OUTLINE_BUTTON} w-full`}>
                    <MapPin size={17} aria-hidden="true" /> {actionPending === 'storage' ? 'Saving…' : 'Save location'}
                  </button>
                </form>
              </div>
            </section>

            {/* Simple horizontal history ledger: original API order and all update fields preserved. */}
            <section aria-labelledby="activity-heading" className="mt-6 min-w-0 overflow-hidden rounded-[16px] border border-[#DEDED5] bg-[#FFFEFA] xl:mt-8">
              <div className="flex flex-wrap items-end justify-between gap-3 px-5 pb-5 pt-6 sm:px-7 sm:pb-6 sm:pt-7">
                <div className="min-w-0">
                  <h2 id="activity-heading" className="text-[24px] font-bold leading-tight tracking-[-0.025em] text-[#202421] sm:text-[28px]">
                    Recent activity
                  </h2>
                  <p className="mt-1 text-[15px] leading-relaxed text-[#667066]">Updates to this item, newest first.</p>
                </div>
                <span className="text-[14px] font-medium text-[#697168]">{observationCountLabel}</span>
              </div>

              {observations.length === 0 ? (
                <p className="border-t border-[#E9E8E1] px-5 py-8 text-[15px] leading-relaxed text-[#626C63] sm:px-7">
                  No activity yet. When you update this item, the changes will appear here.
                </p>
              ) : (
                <>
                  <div
                    role="region"
                    aria-label="Recent pantry activity, arranged horizontally. Scroll to view more updates."
                    tabIndex={0}
                    className="min-w-0 overflow-x-auto overscroll-x-contain focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#173F35]"
                  >
                    <ol className="flex w-max min-w-full items-stretch border-t border-[#E4E2DA]">
                      {observations.map((observation, index) => (
                        <li
                          key={observation.id || `${observation.sourceType || 'update'}-${observation.observedAt || index}`}
                          className="flex w-[278px] shrink-0 flex-col gap-4 border-r border-[#E4E2DA] bg-[#F8F8F3] px-5 py-6 last:border-r-0 sm:w-[330px] sm:px-6 lg:w-[350px]"
                        >
                          <div className="min-w-0">
                            <time className="text-[13px] font-medium leading-snug text-[#747B72]">
                              {formatDate(observation.observedAt || observation.createdAt)}
                            </time>
                            <h3 className="mt-2 break-words border-l-[3px] border-[#C86C42] pl-3 text-[18px] font-bold leading-snug text-[#20392E]">
                              {getHistoryTitle(observation)}
                            </h3>
                            {observation.customerCorrection && (
                              <p className="mt-2 pl-4 text-[13px] font-medium text-[#9C5335]">Updated by you</p>
                            )}
                          </div>

                          <dl className="mt-auto space-y-2 border-t border-[#E1E1D8] pt-3.5 text-[14px] leading-[1.55] text-[#4E5B51]">
                            {observation.stateSignal && (
                              <div className="flex flex-wrap gap-x-2"><dt className="font-semibold text-[#344A39]">Availability</dt><dd>{OBSERVATION_STATES[observation.stateSignal] || 'Updated'}</dd></div>
                            )}
                            {observation.quantity && (
                              <div className="flex flex-wrap gap-x-2"><dt className="font-semibold text-[#344A39]">Quantity</dt><dd>{formatQuantity(observation.quantity)}</dd></div>
                            )}
                            {observation.storageZone && (
                              <div className="flex flex-wrap gap-x-2"><dt className="font-semibold text-[#344A39]">Stored in</dt><dd className="min-w-0 break-words">{observation.storageZone}</dd></div>
                            )}
                            {observation.useSoonAt && (
                              <div className="flex flex-wrap gap-x-2"><dt className="font-semibold text-[#344A39]">Use reminder</dt><dd>{formatDateOnly(observation.useSoonAt)}</dd></div>
                            )}
                            {!observation.projectionApplied && (
                              <div className="text-[#916044]">Saved in history; your current pantry details didn't change.</div>
                            )}
                            {observation.note && (
                              <div className="break-words border-t border-[#E1E1D8] pt-2.5 text-[#5D675E]">{observation.note}</div>
                            )}
                          </dl>
                        </li>
                      ))}
                    </ol>
                  </div>
                  {Number(pagination?.pages) > 1 && (
                    <p className="border-t border-[#E4E2DA] px-5 py-3 text-[13px] text-[#687067] sm:px-7">
                      Showing the latest {observations.length} of {pagination.total} updates.
                    </p>
                  )}
                </>
              )}
            </section>

            <section aria-labelledby="quick-actions-heading" className="mt-6 overflow-hidden rounded-[16px] border border-[#E8DDD4] bg-[#F7EEE6] px-5 py-5 sm:px-7 sm:py-6 xl:mt-8">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between xl:gap-8">
                <div className="min-w-0">
                  <h2 id="quick-actions-heading" className="text-[21px] font-bold leading-snug tracking-[-0.02em]">Other updates</h2>
                  <p className="mt-1 text-[15px] leading-relaxed text-[#745F52]">Used it up, bought more or no longer want to track it?</p>
                </div>
                <div className="grid min-w-0 gap-2.5 sm:grid-cols-3 xl:min-w-[590px]">
                  <button
                    type="button"
                    onClick={() => runAction('finished', () => markPantryItemFinished(itemId), 'Item marked as finished.')}
                    disabled={Boolean(actionPending)}
                    className="inline-flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-lg border border-[#E5C5C5] bg-[#FFF9F8] px-4 py-3 text-sm font-semibold text-[#9B3341] transition-colors hover:bg-[#FBE5E7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9B3341] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <PackageX size={18} className="shrink-0" aria-hidden="true" /> Finished / used up
                  </button>
                  <button
                    type="button"
                    onClick={() => runAction('bought-elsewhere', () => markPantryItemBoughtElsewhere(itemId), 'Purchase made elsewhere has been recorded.')}
                    disabled={Boolean(actionPending)}
                    className="inline-flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-lg border border-[#D8D2E7] bg-[#FCFBFF] px-4 py-3 text-sm font-semibold text-[#5B467E] transition-colors hover:bg-[#F0ECFA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B467E] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <ShoppingBag size={18} className="shrink-0" aria-hidden="true" /> Bought elsewhere
                  </button>
                  <button
                    type="button"
                    onClick={() => runAction('do-not-track', () => stopTrackingPantryItem(itemId), 'Tracking has been stopped for this item.')}
                    disabled={Boolean(actionPending)}
                    className="inline-flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-lg border border-[#CFAC97] bg-[#FFFBF8] px-4 py-3 text-sm font-semibold text-[#8D4B2F] transition-colors hover:bg-[#FBE2D2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8D4B2F] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <EyeOff size={18} className="shrink-0" aria-hidden="true" /> Stop tracking
                  </button>
                </div>
              </div>
            </section>
          </>
        ) : !error ? (
          <div className="rounded-xl border border-[#E0DED5] bg-white px-6 py-10 text-center text-base text-[#59645D]">
            This item is not available in your pantry.
          </div>
        ) : null}
      </div>
    </main>
  )
}
