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
      return 'bg-emerald-50 text-emerald-800'

    case 'draft':
    case 'in_review':
    case 'pending':
      return 'bg-amber-50 text-amber-800'

    case 'retired':
    case 'disabled':
      return 'bg-stone-200 text-stone-600'

    default:
      return 'bg-blue-50 text-blue-800'
  }
}

function StatusBadge({ status }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${statusClasses(
        status,
      )}`}
    >
      {titleize(status)}
    </span>
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
          'Unable to load Host listing history.',
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
        offer.merchantSku || offer.offerKey || 'this Offer'
      }"? The listing will be retired and retained in history.`,
    )

    if (!confirmed) {
      return
    }

    setBusyId(`offer:${offer.id}`)
    setError('')
    setNotice('')

    try {
      await deleteHostOffer(offer.id)
      setNotice('Grocery listing deleted. Governed history is retained.')
      await loadHistory()
    } catch (deleteError) {
      setError(
        getHostOperationsErrorMessage(
          deleteError,
          'Unable to delete grocery listing.',
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
        ? `Delete "${recipe.title || 'this Recipe'}"? The published version will be retired while governed history remains available.`
        : `Delete "${recipe.title || 'this Recipe'}"? The Host submission will be removed from the active queue while governed history remains available.`,
    )

    if (!confirmed) {
      return
    }

    setBusyId(`recipe:${recipe.id}`)
    setError('')
    setNotice('')

    try {
      await deleteHostRecipeListing(recipe.id)
      setNotice('Recipe listing deleted. Governed history is retained.')
      await loadHistory()
    } catch (deleteError) {
      setError(
        getHostOperationsErrorMessage(
          deleteError,
          'Unable to delete Recipe listing.',
        ),
      )
    } finally {
      setBusyId('')
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f5ef] p-4 sm:p-6 lg:p-7">
      <section className="rounded-[28px] bg-stone-950 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
              <History size={14} aria-hidden="true" />
              Host listing archive
            </div>

            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              Listing History
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-400">
              Grocery Offers and Recipe listings are managed from one place. Edit opens the correct governed editor; Delete retires or disables the listing without erasing historical evidence.
            </p>
          </div>

          <button
            type="button"
            onClick={loadHistory}
            disabled={loading}
            className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-stone-950 disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={loading ? 'animate-spin' : ''}
              aria-hidden="true"
            />
            Refresh
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-white/5 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-500">
              Grocery listings
            </p>
            <p className="mt-1 text-2xl font-black">{offers.length}</p>
          </div>

          <div className="rounded-2xl bg-white/5 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-500">
              Recipe listings
            </p>
            <p className="mt-1 text-2xl font-black">{recipes.length}</p>
          </div>
        </div>
      </section>

      <div className="mt-5 rounded-[22px] border border-stone-200 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
            aria-hidden="true"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search grocery or Recipe history..."
            className="focus-ring h-11 w-full rounded-xl border border-stone-200 bg-stone-50 pl-10 pr-3 text-sm font-semibold outline-none"
          />
        </div>
      </div>

      {error ? (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
          <CircleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          {notice}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 grid min-h-64 place-items-center rounded-[26px] border border-stone-200 bg-white">
          <LoaderCircle size={28} className="animate-spin text-emerald-700" aria-label="Loading listing history" />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <section className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Package size={18} aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-lg font-black text-stone-950">Grocery listing history</h2>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  Active and retired Host Offers. Pricing and inventory remain separate commercial state.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {filteredOffers.length ? (
                filteredOffers.map((offer) => {
                  const canEdit = offer.status !== 'retired'
                  const canDelete = offer.status !== 'retired'

                  return (
                    <article key={offer.id} className="rounded-2xl border border-stone-200 p-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-black text-stone-950">
                              {offer.merchantSku || offer.offerKey || 'Grocery listing'}
                            </p>
                            <StatusBadge status={offer.status} />
                          </div>
                          <p className="mt-1 break-all text-xs text-stone-500">
                            Pack: {offer.packId || '—'}
                          </p>
                          <p className="mt-1 text-[11px] font-semibold text-stone-400">
                            Updated {formatDate(offer.updatedAt || offer.createdAt)}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2">
                          {canEdit ? (
                            <button
                              type="button"
                              onClick={() =>
                                navigate(
                                  `/host/marketplace?editOffer=${encodeURIComponent(offer.id)}`,
                                )
                              }
                              className="focus-ring inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800"
                            >
                              <Pencil size={14} aria-hidden="true" />
                              Edit
                            </button>
                          ) : null}

                          {canDelete ? (
                            <button
                              type="button"
                              disabled={Boolean(busyId)}
                              onClick={() => deleteOffer(offer)}
                              className="focus-ring inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 disabled:opacity-50"
                            >
                              {busyId === `offer:${offer.id}` ? (
                                <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
                              ) : (
                                <Trash2 size={14} aria-hidden="true" />
                              )}
                              Delete
                            </button>
                          ) : (
                            <span className="rounded-xl bg-stone-50 px-3 py-2 text-xs font-bold text-stone-500">
                              Historical record
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  )
                })
              ) : (
                <p className="rounded-xl bg-stone-50 p-4 text-sm font-semibold text-stone-500">
                  No grocery listing history matches this search.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <ChefHat size={18} aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-lg font-black text-stone-950">Recipe listing history</h2>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  Draft, review, published, disabled and retired versions submitted by this Host organization.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {filteredRecipes.length ? (
                filteredRecipes.map((recipe) => (
                  <article key={recipe.id} className="rounded-2xl border border-stone-200 p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-black text-stone-950">
                            {recipe.title || 'Untitled Recipe'}
                          </p>
                          <StatusBadge status={recipe.status} />
                        </div>
                        <p className="mt-1 text-xs text-stone-500">
                          Version {recipe.versionNumber || 1} · Submitted {formatDate(recipe.submittedAt || recipe.createdAt)}
                        </p>
                        <p className="mt-1 break-all text-[11px] font-semibold text-stone-400">
                          RecipeVersion ID: {recipe.id}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        {recipe.canEdit ? (
                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                `/host/brand-recipes?editRecipe=${encodeURIComponent(recipe.id)}`,
                              )
                            }
                            className="focus-ring inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800"
                          >
                            <Pencil size={14} aria-hidden="true" />
                            Edit
                          </button>
                        ) : null}

                        {recipe.canDelete ? (
                          <button
                            type="button"
                            disabled={Boolean(busyId)}
                            onClick={() => deleteRecipe(recipe)}
                            className="focus-ring inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 disabled:opacity-50"
                          >
                            {busyId === `recipe:${recipe.id}` ? (
                              <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
                            ) : (
                              <Trash2 size={14} aria-hidden="true" />
                            )}
                            Delete
                          </button>
                        ) : null}

                        {!recipe.canEdit && !recipe.canDelete ? (
                          <span className="rounded-xl bg-stone-50 px-3 py-2 text-xs font-bold text-stone-500">
                            Historical record
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <p className="rounded-xl bg-stone-50 p-4 text-sm font-semibold text-stone-500">
                  No Recipe listing history matches this search.
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
