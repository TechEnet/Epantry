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

import AdminShell from '../../admin/components/AdminShell'
import {
  useAdmin,
} from '../../admin/context/AdminContext'

import {
  getAdminProductVersions,
  retireAdminProductVersion,
} from '../../admin/services/catalogAdmin.service'

import {
  changeAdminDishLifecycle,
  listAdminRecipes,
} from '../../recipes/services/recipe.service'

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
      return 'bg-amber-50 text-amber-800'

    case 'disabled':
    case 'retired':
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

function getProductRows(result) {
  if (Array.isArray(result?.items)) {
    return result.items
  }

  if (Array.isArray(result?.productVersions)) {
    return result.productVersions
  }

  if (Array.isArray(result?.versions)) {
    return result.versions
  }

  return []
}

export default function AdminListingHistoryPage() {
  const navigate = useNavigate()

  const {
    hasAdminPermission,
  } = useAdmin()

  const canReadCatalog = hasAdminPermission('catalog.read')
  const canMutateCatalog = hasAdminPermission('catalog.mutate')
  const canReadRecipes = hasAdminPermission('recipe.read')
  const canMutateRecipes = hasAdminPermission('recipe.mutate')

  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState([])
  const [recipes, setRecipes] = useState([])

  const loadHistory = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const requests = []
      const requestKeys = []

      if (canReadCatalog) {
        requests.push(
          getAdminProductVersions({
            page: 1,
            limit: 100,
          }),
        )
        requestKeys.push('products')
      }

      if (canReadRecipes) {
        requests.push(
          listAdminRecipes({
            page: 1,
            limit: 100,
            status: 'all',
          }),
        )
        requestKeys.push('recipes')
      }

      const results = await Promise.all(requests)

      requestKeys.forEach((key, index) => {
        const result = results[index]

        if (key === 'products') {
          setProducts(getProductRows(result))
        }

        if (key === 'recipes') {
          setRecipes(result?.recipes || [])
        }
      })
    } catch (loadError) {
      setError(
        loadError?.response?.data?.message ||
          loadError?.message ||
          'Unable to load Super Admin listing history.',
      )
    } finally {
      setLoading(false)
    }
  }, [canReadCatalog, canReadRecipes])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const normalizedSearch = search.trim().toLowerCase()

  const filteredProducts = useMemo(() => {
    if (!normalizedSearch) {
      return products
    }

    return products.filter((version) =>
      [
        version.displayName,
        version.gtin,
        version.packId,
        version.id,
        version._id,
        version.publicationStatus,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(normalizedSearch),
        ),
    )
  }, [products, normalizedSearch])

  const filteredRecipes = useMemo(() => {
    if (!normalizedSearch) {
      return recipes
    }

    return recipes.filter((item) => {
      const dish = item?.dish || {}
      const version = item?.latestVersion || {}

      return [
        dish.name,
        dish.cuisine,
        dish.course,
        dish.id,
        dish.status,
        version.id,
        version.status,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(normalizedSearch),
        )
    })
  }, [recipes, normalizedSearch])

  async function deleteProduct(version) {
    const versionId = version?.id || version?._id

    if (!versionId || !canMutateCatalog || version.publicationStatus === 'retired' || busyId) {
      return
    }

    const confirmed = window.confirm(
      `Delete "${version.displayName || 'this grocery listing'}"? The Product Version will be retired so governed history remains intact.`,
    )

    if (!confirmed) {
      return
    }

    setBusyId(`product:${versionId}`)
    setError('')
    setNotice('')

    try {
      await retireAdminProductVersion(versionId, {
        reasonCode: 'catalog.deleted_by_admin',
        reasonDetails:
          'Deleted from Super Admin Listing History. Canonical history is retained as a retired Product Version.',
      })

      setNotice('Grocery listing deleted from current catalog. Governed history is retained.')
      await loadHistory()
    } catch (deleteError) {
      setError(
        deleteError?.response?.data?.message ||
          deleteError?.message ||
          'Unable to delete grocery listing.',
      )
    } finally {
      setBusyId('')
    }
  }

  async function deleteRecipe(dish) {
    if (!dish?.id || !canMutateRecipes || dish.status === 'retired' || busyId) {
      return
    }

    const confirmed = window.confirm(
      `Delete "${dish.name || 'this Recipe'}"? The Dish will be retired so governed Recipe history remains available for audit.`,
    )

    if (!confirmed) {
      return
    }

    setBusyId(`recipe:${dish.id}`)
    setError('')
    setNotice('')

    try {
      await changeAdminDishLifecycle(dish.id, {
        action: 'retire',
        reason:
          'Deleted from Super Admin Listing History. Governed Recipe history is retained as retired.',
      })

      setNotice('Recipe deleted from current listings. Governed history is retained.')
      await loadHistory()
    } catch (deleteError) {
      setError(
        deleteError?.response?.data?.message ||
          deleteError?.message ||
          'Unable to delete Recipe listing.',
      )
    } finally {
      setBusyId('')
    }
  }

  return (
    <AdminShell
      title="Listing History"
      description="One governed history workspace for Super Admin grocery Product Versions and Recipe listings. Edit opens the canonical editor; Delete retires history-sensitive records rather than erasing them."
      actions={
        <button
          type="button"
          onClick={loadHistory}
          disabled={loading}
          className="focus-ring inline-flex items-center gap-2 rounded-xl bg-stone-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"
        >
          <RefreshCw
            size={15}
            className={loading ? 'animate-spin' : ''}
            aria-hidden="true"
          />
          Refresh
        </button>
      }
    >
      <section className="rounded-[22px] border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
            <History size={18} aria-hidden="true" />
          </div>

          <div className="min-w-0 flex-1">
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
        </div>
      </section>

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
          {canReadCatalog ? (
            <section className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <Package size={18} aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-stone-950">Grocery listing history</h2>
                  <p className="mt-1 text-xs leading-5 text-stone-500">
                    Canonical Product Versions across draft, review, published and retired states.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {filteredProducts.length ? (
                  filteredProducts.map((version) => {
                    const versionId = version.id || version._id
                    const canEdit = Boolean(versionId) && version.publicationStatus !== 'retired'
                    const canDelete = canMutateCatalog && version.publicationStatus !== 'retired'

                    return (
                      <article key={versionId} className="rounded-2xl border border-stone-200 p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-black text-stone-950">
                                {version.displayName || 'Unnamed product'}
                              </p>
                              <StatusBadge status={version.publicationStatus} />
                            </div>
                            <p className="mt-1 text-xs text-stone-500">
                              Version {version.version || 1} · {version.gtin || 'No GTIN'}
                            </p>
                            <p className="mt-1 break-all text-[11px] font-semibold text-stone-400">
                              ProductVersion ID: {versionId || '—'}
                            </p>
                            <p className="mt-1 text-[11px] font-semibold text-stone-400">
                              Updated {formatDate(version.updatedAt || version.createdAt)}
                            </p>
                          </div>

                          <div className="flex shrink-0 flex-wrap gap-2">
                            {canEdit ? (
                              <button
                                type="button"
                                onClick={() =>
                                  navigate(
                                    `/admin/catalog/products/${encodeURIComponent(versionId)}`,
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
                                onClick={() => deleteProduct(version)}
                                className="focus-ring inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 disabled:opacity-50"
                              >
                                {busyId === `product:${versionId}` ? (
                                  <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
                                ) : (
                                  <Trash2 size={14} aria-hidden="true" />
                                )}
                                Delete
                              </button>
                            ) : (
                              <span className="rounded-xl bg-stone-50 px-3 py-2 text-xs font-bold text-stone-500">
                                {version.publicationStatus === 'retired'
                                  ? 'Historical record'
                                  : 'Read-only permission'}
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
          ) : null}

          {canReadRecipes ? (
            <section className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <ChefHat size={18} aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-stone-950">Recipe listing history</h2>
                  <p className="mt-1 text-xs leading-5 text-stone-500">
                    Canonical Dishes with their latest governed Recipe Version and Food Intelligence state.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {filteredRecipes.length ? (
                  filteredRecipes.map((item) => {
                    const dish = item?.dish || {}
                    const version = item?.latestVersion || {}
                    const foodIntelligence = item?.foodIntelligence || {}
                    const canEdit = Boolean(version.id) && dish.status !== 'retired'
                    const canDelete = canMutateRecipes && dish.status !== 'retired'

                    return (
                      <article key={dish.id} className="rounded-2xl border border-stone-200 p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-black text-stone-950">
                                {dish.name || 'Untitled Recipe'}
                              </p>
                              <StatusBadge status={version.status || dish.status} />
                              <span
                                className={[
                                  'rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em]',
                                  foodIntelligence.approved
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                    : foodIntelligence.status === 'requires_review'
                                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                                      : 'border-rose-200 bg-rose-50 text-rose-700',
                                ].join(' ')}
                              >
                                Food: {foodIntelligence.approved
                                  ? 'approved'
                                  : foodIntelligence.status === 'requires_review'
                                    ? 'review required'
                                    : 'missing'}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-stone-500">
                              {dish.cuisine || 'Cuisine not set'} · {dish.course || 'Course not set'} · Version {version.versionNumber || '—'}
                            </p>
                            <p className="mt-1 break-all text-[11px] font-semibold text-stone-400">
                              RecipeVersion ID: {version.id || '—'}
                            </p>
                            <p className="mt-1 text-[11px] font-semibold text-stone-400">
                              Updated {formatDate(version.updatedAt || dish.updatedAt)}
                            </p>
                          </div>

                          <div className="flex shrink-0 flex-wrap gap-2">
                            {canEdit ? (
                              <button
                                type="button"
                                onClick={() =>
                                  navigate(
                                    `/admin/recipes/${encodeURIComponent(version.id)}`,
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
                                onClick={() => deleteRecipe(dish)}
                                className="focus-ring inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 disabled:opacity-50"
                              >
                                {busyId === `recipe:${dish.id}` ? (
                                  <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
                                ) : (
                                  <Trash2 size={14} aria-hidden="true" />
                                )}
                                Delete
                              </button>
                            ) : (
                              <span className="rounded-xl bg-stone-50 px-3 py-2 text-xs font-bold text-stone-500">
                                {dish.status === 'retired'
                                  ? 'Historical record'
                                  : 'Read-only permission'}
                              </span>
                            )}
                          </div>
                        </div>
                      </article>
                    )
                  })
                ) : (
                  <p className="rounded-xl bg-stone-50 p-4 text-sm font-semibold text-stone-500">
                    No Recipe listing history matches this search.
                  </p>
                )}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </AdminShell>
  )
}
