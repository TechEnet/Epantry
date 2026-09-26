import {
  ChefHat,
  CircleAlert,
  History,
  LoaderCircle,
  Package,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  useNavigate,
} from 'react-router-dom'

import {
  deleteHostOffer,
  listHostOffers,
} from '../../marketplace/services/marketplace.service'

import {
  deleteHostRecipeListing,
  getHostOperationsErrorMessage,
  listHostRecipeListingHistory,
} from '../../hostOperations/services/hostOperations.service'

function titleize(value) {
  return String(value || 'unknown')
    .split('_')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function formatDate(value) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toLocaleString()
}

function statusClasses(status) {
  switch (status) {
    case 'active':
    case 'published':
      return 'bg-emerald-100 text-emerald-800'

    case 'draft':
    case 'in_review':
    case 'pending':
      return 'bg-sky-100 text-sky-800'

    case 'retired':
    case 'disabled':
      return 'bg-stone-200 text-stone-600'

    default:
      return 'bg-violet-100 text-violet-800'
  }
}

function StatusBadge({ status }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] sm:px-2.5 sm:py-1 sm:text-[10px] ${statusClasses(
        status,
      )}`}
    >
      {titleize(status)}
    </span>
  )
}

function GroceryListingCard({ offer, busyId, onEdit, onDelete }) {
  const canEdit = offer.status !== 'retired'
  const canDelete = offer.status !== 'retired'

  return (
    <article className="rounded-[15px] border border-emerald-100 bg-white/90 p-3 shadow-[0_4px_12px_rgba(20,83,65,0.05)] sm:rounded-2xl sm:p-4">
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
            <p className="min-w-0 truncate text-[11px] font-black text-stone-950 sm:text-sm">
              {offer.merchantSku || offer.offerKey || 'Grocery listing'}
            </p>
            <StatusBadge status={offer.status} />
          </div>

          <p className="mt-1 truncate text-[9px] font-semibold text-stone-500 sm:text-xs">
            Pack reference: {offer.packId || '—'}
          </p>

          <p className="mt-0.5 text-[8px] font-semibold text-stone-400 sm:mt-1 sm:text-[11px]">
            Last updated {formatDate(offer.updatedAt || offer.createdAt)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {canEdit ? (
            <button
              type="button"
              onClick={() => onEdit(offer)}
              className="focus-ring inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[9px] font-black text-emerald-800 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs"
            >
              <Pencil size={12} aria-hidden="true" className="sm:size-[14px]" />
              Edit
            </button>
          ) : null}

          {canDelete ? (
            <button
              type="button"
              disabled={Boolean(busyId)}
              onClick={() => onDelete(offer)}
              className="focus-ring inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-[9px] font-black text-rose-700 disabled:opacity-50 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs"
            >
              {busyId === `offer:${offer.id}` ? (
                <LoaderCircle size={12} className="animate-spin sm:size-[14px]" aria-hidden="true" />
              ) : (
                <Trash2 size={12} aria-hidden="true" className="sm:size-[14px]" />
              )}
              Delete
            </button>
          ) : (
            <span className="rounded-lg bg-stone-100 px-2 py-1.5 text-[8px] font-bold text-stone-500 sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs">
              History only
            </span>
          )}
        </div>
      </div>
    </article>
  )
}

function RecipeListingCard({ recipe, busyId, onEdit, onDelete }) {
  return (
    <article className="rounded-[15px] border border-sky-100 bg-white/90 p-3 shadow-[0_4px_12px_rgba(14,116,144,0.05)] sm:rounded-2xl sm:p-4">
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
            <p className="min-w-0 truncate text-[11px] font-black text-stone-950 sm:text-sm">
              {recipe.title || 'Untitled recipe'}
            </p>
            <StatusBadge status={recipe.status} />
          </div>

          <p className="mt-1 truncate text-[9px] font-semibold text-stone-500 sm:text-xs">
            Version {recipe.versionNumber || 1} · Sent {formatDate(recipe.submittedAt || recipe.createdAt)}
          </p>

          <p className="mt-0.5 truncate text-[8px] font-semibold text-stone-400 sm:mt-1 sm:text-[11px]">
            Reference: {recipe.id}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {recipe.canEdit ? (
            <button
              type="button"
              onClick={() => onEdit(recipe)}
              className="focus-ring inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[9px] font-black text-emerald-800 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs"
            >
              <Pencil size={12} aria-hidden="true" className="sm:size-[14px]" />
              Edit
            </button>
          ) : null}

          {recipe.canDelete ? (
            <button
              type="button"
              disabled={Boolean(busyId)}
              onClick={() => onDelete(recipe)}
              className="focus-ring inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-[9px] font-black text-rose-700 disabled:opacity-50 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs"
            >
              {busyId === `recipe:${recipe.id}` ? (
                <LoaderCircle size={12} className="animate-spin sm:size-[14px]" aria-hidden="true" />
              ) : (
                <Trash2 size={12} aria-hidden="true" className="sm:size-[14px]" />
              )}
              Delete
            </button>
          ) : null}

          {!recipe.canEdit && !recipe.canDelete ? (
            <span className="rounded-lg bg-stone-100 px-2 py-1.5 text-[8px] font-bold text-stone-500 sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs">
              History only
            </span>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export default function HostListingHistoryPage() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [offers, setOffers] = useState([])
  const [recipes, setRecipes] = useState([])
  const [viewAllType, setViewAllType] = useState('')

  const loadHistory = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [offerResult, recipeResult] = await Promise.all([
        listHostOffers({
          page: 1,
          limit: 100,
          status: 'all',
        }),
        listHostRecipeListingHistory(),
      ])

      setOffers(
        offerResult?.offers ||
          offerResult?.hostOffers ||
          [],
      )

      setRecipes(
        recipeResult?.recipes ||
          [],
      )
    } catch (loadError) {
      setError(
        getHostOperationsErrorMessage(
          loadError,
          'Unable to load your listing history.',
        ),
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const normalizedSearch = search.trim().toLowerCase()

  const filteredOffers = useMemo(() => {
    if (!normalizedSearch) {
      return offers
    }

    return offers.filter((offer) =>
      [
        offer.merchantSku,
        offer.offerKey,
        offer.packId,
        offer.status,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(normalizedSearch),
        ),
    )
  }, [offers, normalizedSearch])

  const filteredRecipes = useMemo(() => {
    if (!normalizedSearch) {
      return recipes
    }

    return recipes.filter((recipe) =>
      [
        recipe.title,
        recipe.id,
        recipe.dishId,
        recipe.status,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(normalizedSearch),
        ),
    )
  }, [recipes, normalizedSearch])

  async function deleteOffer(offer) {
    if (!offer?.id || offer.status === 'retired' || busyId) {
      return
    }

    const confirmed = window.confirm(
      `Delete grocery listing "${
        offer.merchantSku || offer.offerKey || 'this listing'
      }"? It will stop being active, but its history will remain available here.`,
    )

    if (!confirmed) {
      return
    }

    setBusyId(`offer:${offer.id}`)
    setError('')
    setNotice('')

    try {
      await deleteHostOffer(offer.id)
      setNotice('Grocery listing removed from active use. Its history is still available.')
      await loadHistory()
    } catch (deleteError) {
      setError(
        getHostOperationsErrorMessage(
          deleteError,
          'Unable to delete this grocery listing.',
        ),
      )
    } finally {
      setBusyId('')
    }
  }

  async function deleteRecipe(recipe) {
    if (!recipe?.id || !recipe.canDelete || busyId) {
      return
    }

    const confirmed = window.confirm(
      recipe.status === 'published'
        ? `Delete "${recipe.title || 'this recipe'}"? The published listing will stop being active, but its history will remain available here.`
        : `Delete "${recipe.title || 'this recipe'}"? It will be removed from the active review flow, but its history will remain available here.`,
    )

    if (!confirmed) {
      return
    }

    setBusyId(`recipe:${recipe.id}`)
    setError('')
    setNotice('')

    try {
      await deleteHostRecipeListing(recipe.id)
      setNotice('Recipe listing removed from active use. Its history is still available.')
      await loadHistory()
    } catch (deleteError) {
      setError(
        getHostOperationsErrorMessage(
          deleteError,
          'Unable to delete this recipe listing.',
        ),
      )
    } finally {
      setBusyId('')
    }
  }

  function editOffer(offer) {
    navigate(
      `/host/marketplace?editOffer=${encodeURIComponent(offer.id)}`,
    )
  }

  function editRecipe(recipe) {
    navigate(
      `/host/brand-recipes?editRecipe=${encodeURIComponent(recipe.id)}`,
    )
  }

  const mobileOffers = filteredOffers.slice(0, 4)
  const desktopOffers = filteredOffers.slice(0, 8)
  const mobileRecipes = filteredRecipes.slice(0, 4)
  const desktopRecipes = filteredRecipes.slice(0, 8)

  return (
    <main className="min-h-screen bg-[#f7f5ef] px-2 pb-4 pt-2 sm:px-4 sm:pb-6 sm:pt-3 lg:px-5 lg:pb-7 lg:pt-3">
      <section className="rounded-[22px] border border-emerald-100 bg-[linear-gradient(135deg,#e6f7ef_0%,#edf7fb_58%,#f2effb_100%)] p-3 shadow-[0_10px_28px_rgba(31,63,53,0.07)] sm:rounded-[28px] sm:p-5 lg:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/75 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.13em] text-emerald-800 sm:gap-2 sm:px-3 sm:py-1.5 sm:text-[10px]">
              <History size={12} aria-hidden="true" className="sm:size-[14px]" />
              Listing manager
            </div>

            <h1 className="mt-2 text-[22px] font-black tracking-[-0.035em] text-stone-950 sm:mt-3 sm:text-3xl lg:text-[34px]">
              Listing History
            </h1>

            <p className="mt-1 max-w-3xl text-[9px] font-semibold leading-4 text-stone-600 sm:mt-2 sm:text-sm sm:leading-6">
              See every grocery and recipe listing you have submitted, check its status, and open the right page when something needs updating.
            </p>
          </div>

          <button
            type="button"
            onClick={loadHistory}
            disabled={loading}
            className="focus-ring inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-white/90 px-2.5 py-2 text-[9px] font-black text-emerald-800 shadow-sm disabled:opacity-60 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm"
          >
            <RefreshCw
              size={13}
              className={loading ? 'animate-spin sm:size-4' : 'sm:size-4'}
              aria-hidden="true"
            />
            Refresh
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3 lg:grid-cols-4">
          <div className="rounded-[14px] border border-emerald-100 bg-[#e7f7ef] p-2.5 sm:rounded-[20px] sm:p-4">
            <div className="flex items-start gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-900 text-[8px] font-black text-white sm:h-7 sm:w-7 sm:text-[9px]">
                01
              </span>
              <div className="min-w-0">
                <p className="text-[9px] font-black leading-3 text-stone-950 sm:text-xs sm:leading-4">Review your listings</p>
                <p className="mt-1 text-[7px] font-semibold leading-3 text-stone-600 sm:text-[10px] sm:leading-4">See grocery and recipe records in one place.</p>
              </div>
            </div>
          </div>

          <div className="rounded-[14px] border border-sky-100 bg-[#e8f5fb] p-2.5 sm:rounded-[20px] sm:p-4">
            <div className="flex items-start gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sky-800 text-[8px] font-black text-white sm:h-7 sm:w-7 sm:text-[9px]">
                02
              </span>
              <div className="min-w-0">
                <p className="text-[9px] font-black leading-3 text-stone-950 sm:text-xs sm:leading-4">Find what you need</p>
                <p className="mt-1 text-[7px] font-semibold leading-3 text-stone-600 sm:text-[10px] sm:leading-4">Search by SKU, title, reference or status.</p>
              </div>
            </div>
          </div>

          <div className="rounded-[14px] border border-violet-100 bg-[#f0edfa] p-2.5 sm:rounded-[20px] sm:p-4">
            <div className="flex items-start gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-violet-800 text-[8px] font-black text-white sm:h-7 sm:w-7 sm:text-[9px]">
                03
              </span>
              <div className="min-w-0">
                <p className="text-[9px] font-black leading-3 text-stone-950 sm:text-xs sm:leading-4">Update or remove</p>
                <p className="mt-1 text-[7px] font-semibold leading-3 text-stone-600 sm:text-[10px] sm:leading-4">Use Edit for changes or Delete when a listing should stop.</p>
              </div>
            </div>
          </div>

          <div className="rounded-[14px] border border-emerald-100 bg-[#e4f4ef] p-2.5 sm:rounded-[20px] sm:p-4">
            <div className="flex items-start gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-900 text-[8px] font-black text-white sm:h-7 sm:w-7 sm:text-[9px]">
                04
              </span>
              <div className="min-w-0">
                <p className="text-[9px] font-black leading-3 text-stone-950 sm:text-xs sm:leading-4">Continue in the right area</p>
                <p className="mt-1 text-[7px] font-semibold leading-3 text-stone-600 sm:text-[10px] sm:leading-4">Grocery edits open Pricing &amp; Stock; recipes open Recipe Listings.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-3">
          <div className="rounded-[14px] border border-white/80 bg-white/75 px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3.5">
            <p className="text-[7px] font-black uppercase tracking-[0.11em] text-emerald-800 sm:text-[10px]">Grocery records</p>
            <p className="mt-0.5 text-lg font-black text-stone-950 sm:text-2xl">{offers.length}</p>
          </div>

          <div className="rounded-[14px] border border-white/80 bg-white/75 px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3.5">
            <p className="text-[7px] font-black uppercase tracking-[0.11em] text-sky-800 sm:text-[10px]">Recipe records</p>
            <p className="mt-0.5 text-lg font-black text-stone-950 sm:text-2xl">{recipes.length}</p>
          </div>
        </div>
      </section>

      <div className="mt-2.5 rounded-[17px] border border-stone-200 bg-white p-2.5 shadow-sm sm:mt-4 sm:rounded-[22px] sm:p-4">
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 sm:left-3.5 sm:size-4"
            aria-hidden="true"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by product SKU, recipe name or status..."
            className="focus-ring h-9 w-full rounded-xl border border-stone-200 bg-stone-50 pl-9 pr-3 text-[10px] font-semibold outline-none sm:h-11 sm:pl-10 sm:text-sm"
          />
        </div>
      </div>

      {error ? (
        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-[10px] font-semibold text-rose-800 sm:mt-5 sm:gap-3 sm:p-4 sm:text-sm">
          <CircleAlert size={16} className="mt-0.5 shrink-0 sm:size-[18px]" aria-hidden="true" />
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-[10px] font-semibold text-emerald-800 sm:mt-5 sm:p-4 sm:text-sm">
          {notice}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-3 grid min-h-44 place-items-center rounded-[20px] border border-stone-200 bg-white sm:mt-6 sm:min-h-64 sm:rounded-[26px]">
          <LoaderCircle size={26} className="animate-spin text-emerald-700" aria-label="Loading listing history" />
        </div>
      ) : (
        <div className="mt-3 space-y-3 sm:mt-5 sm:space-y-5">
          <section className="rounded-[20px] border border-emerald-100 bg-[#edf8f3] p-3 shadow-[0_8px_24px_rgba(20,83,65,0.05)] sm:rounded-[26px] sm:p-5 lg:p-6">
            <div className="flex items-start gap-2.5 sm:gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[12px] bg-white text-emerald-700 shadow-sm sm:h-10 sm:w-10 sm:rounded-2xl">
                <Package size={15} aria-hidden="true" className="sm:size-[18px]" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-black text-stone-950 sm:text-lg">Grocery listings</h2>
                <p className="mt-0.5 text-[8px] font-semibold leading-3.5 text-stone-500 sm:mt-1 sm:text-xs sm:leading-5">
                  See current and retired grocery listings. Use Edit to update price, stock or selling details.
                </p>
              </div>
            </div>

            {filteredOffers.length ? (
              <>
                <div className="mt-3 space-y-2 sm:hidden">
                  {mobileOffers.map((offer) => (
                    <GroceryListingCard
                      key={offer.id}
                      offer={offer}
                      busyId={busyId}
                      onEdit={editOffer}
                      onDelete={deleteOffer}
                    />
                  ))}
                </div>

                <div className="mt-4 hidden space-y-3 sm:block">
                  {desktopOffers.map((offer) => (
                    <GroceryListingCard
                      key={offer.id}
                      offer={offer}
                      busyId={busyId}
                      onEdit={editOffer}
                      onDelete={deleteOffer}
                    />
                  ))}
                </div>

                {filteredOffers.length > 4 ? (
                  <button
                    type="button"
                    onClick={() => setViewAllType('grocery')}
                    className="focus-ring mt-3 inline-flex w-full items-center justify-center rounded-xl border border-emerald-200 bg-white px-3 py-2 text-[9px] font-black text-emerald-800 shadow-sm sm:hidden"
                  >
                    View all {filteredOffers.length} grocery listings
                  </button>
                ) : null}

                {filteredOffers.length > 8 ? (
                  <div className="mt-4 hidden justify-end sm:flex">
                    <button
                      type="button"
                      onClick={() => setViewAllType('grocery')}
                      className="focus-ring inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-xs font-black text-emerald-800 shadow-sm hover:bg-emerald-50"
                    >
                      View all {filteredOffers.length} grocery listings
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="mt-3 rounded-xl bg-white/75 p-3 text-[10px] font-semibold text-stone-500 sm:mt-5 sm:p-4 sm:text-sm">
                No grocery listings match your search.
              </p>
            )}
          </section>

          <section className="rounded-[20px] border border-sky-100 bg-[#edf7fb] p-3 shadow-[0_8px_24px_rgba(14,116,144,0.05)] sm:rounded-[26px] sm:p-5 lg:p-6">
            <div className="flex items-start gap-2.5 sm:gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[12px] bg-white text-sky-700 shadow-sm sm:h-10 sm:w-10 sm:rounded-2xl">
                <ChefHat size={15} aria-hidden="true" className="sm:size-[18px]" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-black text-stone-950 sm:text-lg">Recipe listings</h2>
                <p className="mt-0.5 text-[8px] font-semibold leading-3.5 text-stone-500 sm:mt-1 sm:text-xs sm:leading-5">
                  See recipe submissions and their current status. Editable recipes reopen in Recipe Listings.
                </p>
              </div>
            </div>

            {filteredRecipes.length ? (
              <>
                <div className="mt-3 space-y-2 sm:hidden">
                  {mobileRecipes.map((recipe) => (
                    <RecipeListingCard
                      key={recipe.id}
                      recipe={recipe}
                      busyId={busyId}
                      onEdit={editRecipe}
                      onDelete={deleteRecipe}
                    />
                  ))}
                </div>

                <div className="mt-4 hidden space-y-3 sm:block">
                  {desktopRecipes.map((recipe) => (
                    <RecipeListingCard
                      key={recipe.id}
                      recipe={recipe}
                      busyId={busyId}
                      onEdit={editRecipe}
                      onDelete={deleteRecipe}
                    />
                  ))}
                </div>

                {filteredRecipes.length > 4 ? (
                  <button
                    type="button"
                    onClick={() => setViewAllType('recipe')}
                    className="focus-ring mt-3 inline-flex w-full items-center justify-center rounded-xl border border-sky-200 bg-white px-3 py-2 text-[9px] font-black text-sky-800 shadow-sm sm:hidden"
                  >
                    View all {filteredRecipes.length} recipe listings
                  </button>
                ) : null}

                {filteredRecipes.length > 8 ? (
                  <div className="mt-4 hidden justify-end sm:flex">
                    <button
                      type="button"
                      onClick={() => setViewAllType('recipe')}
                      className="focus-ring inline-flex items-center justify-center rounded-xl border border-sky-200 bg-white px-4 py-2.5 text-xs font-black text-sky-800 shadow-sm hover:bg-sky-50"
                    >
                      View all {filteredRecipes.length} recipe listings
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="mt-3 rounded-xl bg-white/75 p-3 text-[10px] font-semibold text-stone-500 sm:mt-5 sm:p-4 sm:text-sm">
                No recipe listings match your search.
              </p>
            )}
          </section>
        </div>
      )}

      {viewAllType ? (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center bg-stone-950/30 p-3 backdrop-blur-md sm:p-6"
          onClick={() => setViewAllType('')}
        >
          <section
            className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[22px] border border-white/70 bg-white/88 shadow-2xl backdrop-blur-2xl sm:rounded-[30px]"
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className={[
                'flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6 sm:py-4',
                viewAllType === 'grocery'
                  ? 'border-emerald-100 bg-emerald-50/90'
                  : 'border-sky-100 bg-sky-50/90',
              ].join(' ')}
            >
              <div className="min-w-0">
                <p
                  className={[
                    'text-[8px] font-black uppercase tracking-[0.13em] sm:text-[10px]',
                    viewAllType === 'grocery' ? 'text-emerald-700' : 'text-sky-700',
                  ].join(' ')}
                >
                  Listing history
                </p>
                <h2 className="mt-0.5 truncate text-sm font-black text-stone-950 sm:text-xl">
                  {viewAllType === 'grocery' ? 'All grocery listings' : 'All recipe listings'}
                </h2>
                <p className="mt-0.5 text-[8px] font-semibold text-stone-500 sm:text-[11px]">
                  {viewAllType === 'grocery' ? filteredOffers.length : filteredRecipes.length} items match your current search.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setViewAllType('')}
                className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm hover:text-stone-950"
                aria-label="Close listing history"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
              <div className="space-y-2 sm:space-y-3">
                {viewAllType === 'grocery'
                  ? filteredOffers.map((offer) => (
                      <GroceryListingCard
                        key={offer.id}
                        offer={offer}
                        busyId={busyId}
                        onEdit={(item) => {
                          setViewAllType('')
                          editOffer(item)
                        }}
                        onDelete={deleteOffer}
                      />
                    ))
                  : filteredRecipes.map((recipe) => (
                      <RecipeListingCard
                        key={recipe.id}
                        recipe={recipe}
                        busyId={busyId}
                        onEdit={(item) => {
                          setViewAllType('')
                          editRecipe(item)
                        }}
                        onDelete={deleteRecipe}
                      />
                    ))}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}
