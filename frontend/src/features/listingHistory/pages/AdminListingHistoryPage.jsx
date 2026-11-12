import {
  ChefHat,
  CircleAlert,
  ChevronDown,
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

import { Link } from 'react-router-dom'

import AdminShell from '../../admin/components/AdminShell'
import {
  useAdmin,
} from '../../admin/context/AdminContext'

import {
  getAdminCatalogCategories,
  getAdminProductFamilies,
  getAdminProductVariants,
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
      return 'bg-[#E5F0E6] text-[#1A5540]'

    case 'draft':
    case 'in_review':
      return 'bg-[#F8E8D5] text-[#85552F]'

    case 'disabled':
    case 'retired':
      return 'bg-[#ECEBE6] text-[#626D65]'

    default:
      return 'bg-[#E4EAE8] text-[#496459]'
  }
}

function StatusBadge({ status }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${statusClasses(
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

// Host-approved ready-made dishes use a dedicated Catalog category.
// Product Version itself does not carry the category: traverse Version ->
// Variant -> Family -> Category, including retired relationships.
const RECIPE_CATALOG_CATEGORIES = new Set([
  'epantry-ready-made-food',
  'ready-made-food',
  'prepared-food',
  'prepared-meals',
  'ready-to-eat-meals',
  'cooked-meals',
  'restaurant-meals',
  'restaurant-food',
  'kitchen-recipe',
  'recipe',
  'recipes',
  'dishes',
])

function normalizeRecipeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^(homestyle|home style|homemade)\s+/, '')
    .trim()
}

function classifyCatalogVersions(versions, variants, families, categories, knownDishNames) {
  const byId = (rows) => new Map(rows.map((row) => [String(row.id || row._id), row]))
  const variantsById = byId(variants)
  const familiesById = byId(families)
  const categoriesById = byId(categories)
  const grocery = []
  const readyMade = []
  const unresolved = []

  for (const version of versions) {
    const variant = variantsById.get(String(version.variantId || ''))
    const family = familiesById.get(String(variant?.familyId || ''))
    let category = categoriesById.get(String(family?.categoryId || ''))
    const visited = new Set()
    let isRecipeCategory = false
    while (category && !visited.has(String(category.id || category._id))) {
      visited.add(String(category.id || category._id))
      const slug = String(category.slug || '').toLowerCase()
      if (RECIPE_CATALOG_CATEGORIES.has(slug)) {
        isRecipeCategory = true
        break
      }
      category = category.parentId ? categoriesById.get(String(category.parentId)) : null
    }

    // A canonical Dish-title match also identifies legacy sellable recipe packs
    // when their historical category was not as specific as Ready-made Food.
    const dishNameMatch = knownDishNames.has(normalizeRecipeName(version.displayName))
    if (isRecipeCategory || dishNameMatch) {
      readyMade.push(version)
    } else if (variant && family && categoriesById.has(String(family.categoryId))) {
      grocery.push(version)
    } else {
      // Do not silently call an uncategorised item a Grocery product.
      unresolved.push(version)
    }
  }
  return { grocery, readyMade, unresolved }
}

export default function AdminListingHistoryPage() {
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
  const [soldRecipeProducts, setSoldRecipeProducts] = useState([])
  const [unclassifiedProducts, setUnclassifiedProducts] = useState([])
  const [recipes, setRecipes] = useState([])
  const [showAllProducts, setShowAllProducts] = useState(false)
  const [showAllRecipes, setShowAllRecipes] = useState(false)

  // Existing APIs expose pagination.pages; load every page so History is complete.
  const loadHistory = useCallback(async () => {
    setLoading(true)
    setError('')

    const getEveryPage = async (fetchPage, readRows) => {
      const first = await fetchPage(1)
      const rows = [...readRows(first)]
      const reportedPages = Number(first?.pagination?.pages)
      const totalPages = Number.isFinite(reportedPages) && reportedPages > 1
        ? Math.floor(reportedPages)
        : 1

      // Keep concurrent calls bounded; no undocumented backend page size changes.
      for (let page = 2; page <= totalPages; page += 4) {
        const pages = Array.from(
          { length: Math.min(4, totalPages - page + 1) },
          (_, offset) => fetchPage(page + offset),
        )
        const responses = await Promise.all(pages)
        responses.forEach((result) => rows.push(...readRows(result)))
      }
      return rows
    }

    try {
      const catalogRequest = canReadCatalog
        ? Promise.all([
            getEveryPage(
              (page) => getAdminProductVersions({ page, limit: 100 }),
              getProductRows,
            ),
            getEveryPage(
              (page) => getAdminProductVariants({ page, limit: 100, status: 'all' }),
              getProductRows,
            ),
            getEveryPage(
              (page) => getAdminProductFamilies({ page, limit: 100, status: 'all' }),
              getProductRows,
            ),
            getEveryPage(
              (page) => getAdminCatalogCategories({ page, limit: 100, status: 'all' }),
              getProductRows,
            ),
          ])
        : Promise.resolve([[], [], [], []])
      const recipesRequest = canReadRecipes
        ? getEveryPage(
            (page) => listAdminRecipes({ page, limit: 100, status: 'all' }),
            (result) => (Array.isArray(result?.recipes) ? result.recipes : []),
          )
        : Promise.resolve([])
      const [catalogResult, recipeResult] = await Promise.allSettled([
        catalogRequest,
        recipesRequest,
      ])
      const messages = []
      const recipeItems = recipeResult.status === 'fulfilled' ? recipeResult.value : []
      if (recipeResult.status === 'fulfilled') {
        setRecipes(recipeItems)
      } else {
        messages.push('Recipe history could not load')
      }
      if (catalogResult.status === 'fulfilled') {
        const [versions, variants, families, categories] = catalogResult.value
        const knownDishNames = new Set(
          recipeItems.map((item) => normalizeRecipeName(item?.dish?.name)).filter(Boolean),
        )
        const classified = classifyCatalogVersions(
          versions, variants, families, categories, knownDishNames,
        )
        setProducts(classified.grocery)
        setSoldRecipeProducts(classified.readyMade)
        setUnclassifiedProducts(classified.unresolved)
        if (classified.unresolved.length) {
          messages.push(
            `${classified.unresolved.length} catalog records have no category mapping and were not placed in either listing type`,
          )
        }
      } else {
        setProducts([])
        setSoldRecipeProducts([])
        setUnclassifiedProducts([])
        messages.push('Catalog history or category information could not load')
      }
      if (messages.length) {
        setError(`${messages.join('. ')}. Use Refresh to try again.`)
      }
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

  const filteredUnclassifiedProducts = useMemo(() => {
    if (!normalizedSearch) return unclassifiedProducts
    return unclassifiedProducts.filter((version) =>
      [version.displayName, version.gtin, version.packId, version.id, version._id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
    )
  }, [unclassifiedProducts, normalizedSearch])

  const filteredSoldRecipeProducts = useMemo(() => {
    if (!normalizedSearch) return soldRecipeProducts
    return soldRecipeProducts.filter((version) =>
      [version.displayName, version.gtin, version.packId, version.id, version._id, version.publicationStatus]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
    )
  }, [soldRecipeProducts, normalizedSearch])

  const filteredRecipeListings = useMemo(() => [
    ...filteredRecipes.map((item) => ({
      kind: 'recipe',
      key: `dish:${item?.dish?.id || item?.latestVersion?.id}`,
      timestamp: item?.latestVersion?.updatedAt || item?.dish?.updatedAt,
      item,
    })),
    ...filteredSoldRecipeProducts.map((version) => ({
      kind: 'ready-made',
      key: `ready-made:${version.id || version._id}`,
      timestamp: version.updatedAt || version.createdAt,
      version,
    })),
  ].sort((a, b) => (new Date(b.timestamp || 0).getTime() || 0) - (new Date(a.timestamp || 0).getTime() || 0)), [filteredRecipes, filteredSoldRecipeProducts])

  async function deleteProduct(version) {
    const versionId = version?.id || version?._id

    if (!versionId || !canMutateCatalog || version.publicationStatus === 'retired' || busyId) {
      return
    }

    const confirmed = window.confirm(
      `Delete "${version.displayName || 'this catalog listing'}"? The Product Version will be retired so governed history remains intact.`,
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

      setNotice('Catalog listing deleted from current catalog. Governed history is retained.')
      await loadHistory()
    } catch (deleteError) {
      setError(
        deleteError?.response?.data?.message ||
          deleteError?.message ||
          'Unable to delete catalog listing.',
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

  const totalRecords = products.length + soldRecipeProducts.length + unclassifiedProducts.length + recipes.length

  const balanceHistoryRows = filteredProducts.length >= 9 && filteredRecipeListings.length >= 9 && !showAllProducts && !showAllRecipes

  const buttonClass = 'focus-ring inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-[#C9D6CC] bg-white px-3 py-2 text-[14px] font-semibold text-[#173F35] transition hover:bg-[#EFF3EE] disabled:cursor-not-allowed disabled:opacity-50'
  const dangerButtonClass = 'focus-ring inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-[#EDD0CB] bg-[#FFF8F6] px-3 py-2 text-[14px] font-semibold text-[#A43F3C] transition hover:bg-[#FCEDE9] disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <AdminShell
      title="Listing history"
      description=""
      actions={
        <button type="button" onClick={loadHistory} disabled={loading || Boolean(busyId)} className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#C9D6CC] bg-white px-3 py-2 text-[14px] font-semibold text-[#173F35] hover:bg-[#EFF3EE] disabled:opacity-50">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          Refresh
        </button>
      }
    >
      <main className="listing-history-screen min-w-0 bg-[#F7F6F2] text-[#202421]">
        <style>{`
          @media (max-width: 639px) {
            /* Consume the embedded AdminShell gutter; do not change the shell or desktop. */
            .listing-history-screen { margin: -12px -8px -12px; width: calc(100% + 16px); }
            .listing-history-screen .history-banner { border-inline: 0; padding: 12px 12px 14px; }
            .listing-history-screen .history-banner input::placeholder { color: transparent; }
            .listing-history-screen .history-section { border-left: 0; border-right: 0; }
            .listing-history-screen .history-section > header { padding: 13px 14px; }
            .listing-history-screen .history-row {
              padding: 12px 14px 13px;
              gap: 8px;
              background: #FFFDFB;
            }
            .listing-history-screen .history-row-top { gap: 10px; }
            .listing-history-screen .history-row-title { font-size: 15px; line-height: 1.35; }
            .listing-history-screen .history-row-controls {
              display: flex;
              flex-direction: column;
              align-items: stretch;
              gap: 6px;
              padding-top: 4px;
              border-top: 1px solid #ECEDE8;
            }
            .listing-history-screen .history-row-controls > details { width: 100%; }
            .listing-history-screen .history-row-controls summary {
              display: inline-flex;
              min-height: 30px;
              align-items: center;
              font-size: 13px;
            }
            .listing-history-screen .history-row-actions {
              width: 100%;
              justify-content: flex-end;
              gap: 8px;
            }
            .listing-history-screen .history-row-actions button {
              min-height: 36px;
              padding: 6px 11px;
              font-size: 13px;
            }
            .listing-history-screen .history-row-controls details[open] > div {
              margin: 0 0 6px;
              overflow-wrap: anywhere;
            }
          }
        `}</style>

        <section aria-label="Search listing history" className="history-banner border-b border-[#E2D9CF] bg-[#F6F2EC] px-4 py-4 sm:px-5">
          <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
            <div className="relative min-w-0 flex-1">
              <Search size={19} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6F8278]" />
              <input
                type="search"
                aria-label="Search grocery and Recipe history"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setShowAllProducts(false)
                  setShowAllRecipes(false)
                }}
                placeholder="Search grocery, ready-made food or recipe…"
                className="focus-ring h-12 w-full rounded-lg border border-[#DAC8BA] bg-white pl-11 pr-4 text-[15px] text-[#202421] outline-none placeholder:text-[#87918A]"
              />
              {!search ? <span aria-hidden="true" className="pointer-events-none absolute left-11 top-1/2 -translate-y-1/2 text-[14px] text-[#87918A] sm:hidden">Search listings...</span> : null}
            </div>
            <div className="hidden shrink-0 gap-2 text-[13px] font-semibold text-[#173F35] sm:flex" aria-label="Listing totals">
              {canReadCatalog ? <span className="rounded-lg border border-[#DED6CE] bg-white px-3 py-2">{filteredProducts.length} Grocery</span> : null}
              {canReadCatalog || canReadRecipes ? <span className="rounded-lg border border-[#DED6CE] bg-white px-3 py-2">{filteredRecipeListings.length} Recipes & ready-made</span> : null}
            </div>
          </div>
        </section>

        {error ? (
          <div role="alert" className="mt-3 flex items-start gap-2 border-l-[3px] border-[#B44E42] bg-[#FFF1EB] px-4 py-3 text-[14px] leading-6 text-[#763D35]">
            <CircleAlert size={18} className="mt-1 shrink-0" aria-hidden="true" />{error}
          </div>
        ) : null}
        {notice ? (
          <div role="status" className="mt-3 border-l-[3px] border-[#237251] bg-[#E5F1E9] px-4 py-3 text-[14px] font-medium text-[#173F35]">{notice}</div>
        ) : null}

        {loading && !totalRecords ? (
          <div role="status" className="mt-4 flex min-h-40 items-center justify-center gap-3 border border-[#E0E5DD] bg-white text-[15px] text-[#173F35]">
            <LoaderCircle size={24} className="animate-spin" aria-hidden="true" /> Loading listing history…
          </div>
        ) : (
          <div className={`mt-4 grid min-w-0 items-start gap-4 lg:grid-cols-2 lg:gap-5 ${balanceHistoryRows ? 'lg:items-stretch' : ''}`}>
            {canReadCatalog ? (
              <section aria-label="Grocery listing history" className="history-section min-w-0 overflow-hidden border border-[#DCE3DB] bg-white lg:flex lg:flex-col">
                <header className="flex items-center justify-between gap-3 bg-[#E9EFE7] px-4 py-4 sm:px-5">
                  <div className="min-w-0">
                    <p className="hidden text-[12px] font-bold uppercase tracking-[0.04em] text-[#54715E] sm:block">01 / Grocery</p>
                    <h3 className="mt-0.5 text-[23px] font-bold leading-tight tracking-[-0.03em] text-[#173F35] sm:text-[25px]"><span className="sm:hidden">Grocery</span><span className="hidden sm:inline">Grocery listing history</span></h3>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[14px] font-bold tabular-nums text-[#173F35]">{filteredProducts.length}</span>
                </header>
                <div className="divide-y divide-[#EAEDE8] lg:flex lg:flex-1 lg:flex-col">
                  {filteredProducts.length ? filteredProducts.map((version, index) => {
                    const versionId = version?.id || version?._id
                    const canEdit = canMutateCatalog && Boolean(versionId) && version.publicationStatus !== 'retired'
                    const canDelete = canMutateCatalog && version.publicationStatus !== 'retired'
                    const rowVisibility = showAllProducts || index < 5 ? 'flex' : index < 9 ? 'hidden sm:flex' : 'hidden'
                    return (
                      <article key={versionId || `product-${index}`} className={`history-row ${rowVisibility} ${balanceHistoryRows ? 'lg:flex-1 lg:justify-between' : ''} min-w-0 flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-[#FCFBF8] sm:px-5`}>
                        <div className="history-row-top flex min-w-0 items-start gap-3">
                          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#F0E5DB] text-[#173F35]"><Package size={19} aria-hidden="true" /></div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <h4 className="history-row-title min-w-0 break-words text-[16px] font-semibold leading-6 text-[#173F35]">{version.displayName || 'Unnamed product'}</h4>
                              <StatusBadge status={version.publicationStatus} />
                            </div>
                            <p className="mt-1 text-[13px] leading-5 text-[#586C60]">Version {version.version || 1}<span className="hidden sm:inline"> · {version.gtin || 'Barcode not available'}</span></p>
                          </div>
                        </div>
                        <div className="history-row-controls flex flex-wrap items-center justify-between gap-2 pl-0 sm:pl-14">
                          <details className="group min-w-0 flex-1">
                            <summary className="focus-ring inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-semibold text-[#526D5B] [&::-webkit-details-marker]:hidden">
                              Record details <ChevronDown size={14} className="transition group-open:rotate-180" aria-hidden="true" />
                            </summary>
                            <div className="mt-2 space-y-1.5 rounded-lg bg-[#F8F6F2] px-3 py-2.5 text-[13px] leading-5 text-[#586C60]">
                              <p className="sm:hidden">Barcode: {version.gtin || 'Not available'}</p>
                              <p className="break-all">Product version: {versionId || '—'}</p>
                              <p>Updated: {formatDate(version.updatedAt || version.createdAt)}</p>
                            </div>
                          </details>
                          <div className="history-row-actions flex shrink-0 flex-wrap items-center gap-2">
                            {canEdit ? <Link to={`/admin/catalog/products/${encodeURIComponent(versionId)}?edit=1`} aria-label={`Edit ${version.displayName || 'grocery listing'}`} className={buttonClass}><Pencil size={15} aria-hidden="true" /> Edit</Link> : null}
                            {canDelete ? <button type="button" disabled={Boolean(busyId)} className={dangerButtonClass} onClick={() => deleteProduct(version)}>{busyId === `product:${versionId}` ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Trash2 size={15} aria-hidden="true" />} Delete</button> : !canEdit ? <span className="text-[13px] text-[#6A766C]">{version.publicationStatus === 'retired' ? 'Historical record' : 'Read-only'}</span> : null}
                          </div>
                        </div>
                      </article>
                    )
                  }) : <p className="px-5 py-8 text-[15px] text-[#637268]">No grocery records match your search.</p>}
                </div>
                {filteredProducts.length > 5 ? (
                  <div className={`mt-auto border-t border-[#E4E9E1] bg-[#F9F9F6] px-4 py-4 text-center ${!showAllProducts && filteredProducts.length <= 9 ? 'sm:hidden' : ''}`}>
                    <button type="button" aria-expanded={showAllProducts} onClick={() => setShowAllProducts((value) => !value)} className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#173F35] bg-[#173F35] px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-[#285949]">
                      {showAllProducts ? 'Show fewer' : `View all ${filteredProducts.length} records`}
                      <ChevronDown size={17} className={showAllProducts ? 'rotate-180' : ''} aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
              </section>
            ) : null}

            {(canReadRecipes || (canReadCatalog && soldRecipeProducts.length > 0)) ? (
              <section aria-label="Recipe listing history" className="history-section min-w-0 overflow-hidden border border-[#E2D9D1] bg-white lg:flex lg:flex-col">
                <header className="flex items-center justify-between gap-3 bg-[#F0DDD0] px-4 py-4 sm:px-5">
                  <div className="min-w-0">
                    <p className="hidden text-[12px] font-bold uppercase tracking-[0.04em] text-[#9A5D45] sm:block">02 / Recipes</p>
                    <h3 className="mt-0.5 text-[23px] font-bold leading-tight tracking-[-0.03em] text-[#173F35] sm:text-[25px]"><span className="sm:hidden">Recipes</span><span className="hidden sm:inline">Recipe listing history</span></h3>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[14px] font-bold tabular-nums text-[#173F35]">{filteredRecipeListings.length}</span>
                </header>
                <div className="divide-y divide-[#EAEDE8] lg:flex lg:flex-1 lg:flex-col">
                  {filteredRecipeListings.length ? filteredRecipeListings.map((entry, index) => {
                    const item = entry.item || {}
                    const dish = item?.dish || {}
                    const version = item?.latestVersion || {}
                    const product = entry.version || {}
                    const productId = product?.id || product?._id
                    const isSold = entry.kind === 'ready-made'
                    const foodIntelligence = item?.foodIntelligence || {}
                    const canEdit = isSold
                      ? canMutateCatalog && Boolean(productId) && product.publicationStatus !== 'retired'
                      : canMutateRecipes && Boolean(version.id) && dish.status !== 'retired'
                    const canDelete = isSold
                      ? canMutateCatalog && product.publicationStatus !== 'retired'
                      : canMutateRecipes && dish.status !== 'retired'
                    const rowVisibility = showAllRecipes || index < 5 ? 'flex' : index < 9 ? 'hidden sm:flex' : 'hidden'
                    return (
                      <article key={entry.key || `recipe-${index}`} className={`history-row ${rowVisibility} ${balanceHistoryRows ? 'lg:flex-1 lg:justify-between' : ''} min-w-0 flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-[#FCFBF8] sm:px-5`}>
                        <div className="history-row-top flex min-w-0 items-start gap-3">
                          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-[#F1E5DB]">
                            {isSold && product.images?.[0]?.url
                              ? <img src={product.images[0].url} alt="" loading="lazy" className="h-full w-full object-cover" />
                              : !isSold && dish.heroImageUrl
                                ? <img src={dish.heroImageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                                : <div className="grid h-full w-full place-items-center text-[#8E6555]">{isSold ? <Package size={19} aria-hidden="true" /> : <ChefHat size={19} aria-hidden="true" />}</div>}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <h4 className="history-row-title min-w-0 break-words text-[16px] font-semibold leading-6 text-[#173F35]">{isSold ? product.displayName || 'Ready-made food' : dish.name || 'Untitled recipe'}</h4>
                              <StatusBadge status={isSold ? product.publicationStatus : version.status || dish.status} />
                              {isSold ? <span className="rounded-full bg-[#F5E4D9] px-2 py-1 text-[12px] font-semibold text-[#915A43]">Recipe for sale</span> : null}
                            </div>
                            <p className="mt-1 text-[13px] leading-5 text-[#586C60]">
                              {isSold ? <><span className="hidden sm:inline">Ready-made listing · </span>Version {product.version || 1}</> : <>{dish.cuisine || 'Cuisine not set'} · Version {version.versionNumber || '—'}</>}
                            </p>
                            {!isSold ? <p className={`mt-1 text-[13px] font-medium ${foodIntelligence.approved ? 'text-[#2F7950]' : foodIntelligence.status === 'requires_review' ? 'text-[#996332]' : 'text-[#9A5045]'}`}>
                              Food check: {foodIntelligence.approved ? 'Approved' : foodIntelligence.status === 'requires_review' ? 'Needs review' : 'Not approved'}
                            </p> : null}
                          </div>
                        </div>
                        <div className="history-row-controls flex flex-wrap items-center justify-between gap-2 pl-0 sm:pl-14">
                          <details className="group min-w-0 flex-1">
                            <summary className="focus-ring inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-semibold text-[#526D5B] [&::-webkit-details-marker]:hidden">
                              Record details <ChevronDown size={14} className="transition group-open:rotate-180" aria-hidden="true" />
                            </summary>
                            <div className="mt-2 space-y-1.5 rounded-lg bg-[#F8F6F2] px-3 py-2.5 text-[13px] leading-5 text-[#586C60]">
                              <p className="break-all">{isSold ? 'Product version' : 'Recipe version'}: {isSold ? productId || '—' : version.id || '—'}</p>
                              {!isSold ? <p>Course: {dish.course || 'Not set'}</p> : null}
                              <p>Updated: {formatDate(isSold ? product.updatedAt || product.createdAt : version.updatedAt || dish.updatedAt)}</p>
                            </div>
                          </details>
                          <div className="history-row-actions flex shrink-0 flex-wrap items-center gap-2">
                            {canEdit ? <Link to={isSold ? `/admin/catalog/products/${encodeURIComponent(productId)}?edit=1` : `/admin/recipes/${encodeURIComponent(version.id)}?edit=1`} aria-label={`Edit ${isSold ? product.displayName || 'ready-made listing' : dish.name || 'recipe'}`} className={buttonClass}><Pencil size={15} aria-hidden="true" /> Edit</Link> : null}
                            {canDelete ? <button type="button" disabled={Boolean(busyId)} onClick={() => isSold ? deleteProduct(product) : deleteRecipe(dish)} className={dangerButtonClass}>{busyId === `${isSold ? 'product' : 'recipe'}:${isSold ? productId : dish.id}` ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Trash2 size={15} aria-hidden="true" />} Delete</button> : !canEdit ? <span className="text-[13px] text-[#6A766C]">{(isSold ? product.publicationStatus : dish.status) === 'retired' ? 'Historical record' : 'Read-only'}</span> : null}
                          </div>
                        </div>
                      </article>
                    )
                  }) : <p className="px-5 py-8 text-[15px] text-[#637268]">No recipe records match your search.</p>}
                </div>
                {filteredRecipeListings.length > 5 ? (
                  <div className={`mt-auto border-t border-[#E4E9E1] bg-[#F9F9F6] px-4 py-4 text-center ${!showAllRecipes && filteredRecipeListings.length <= 9 ? 'sm:hidden' : ''}`}>
                    <button type="button" aria-expanded={showAllRecipes} onClick={() => setShowAllRecipes((value) => !value)} className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#173F35] bg-[#173F35] px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-[#285949]">
                      {showAllRecipes ? 'Show fewer' : `View all ${filteredRecipeListings.length} records`}
                      <ChevronDown size={17} className={showAllRecipes ? 'rotate-180' : ''} aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
              </section>
            ) : null}
            {!canReadCatalog && !canReadRecipes ? <p className="bg-white p-5 text-[15px] text-[#576B5C]">Your Admin role does not have access to listing history.</p> : null}
          </div>
        )}
        {canReadCatalog && filteredUnclassifiedProducts.length ? (
          <details className="mt-4 border border-[#E0BDAF] bg-[#FFF8F3] text-[#173F35]">
            <summary className="focus-ring cursor-pointer px-4 py-3 text-[15px] font-semibold">
              {filteredUnclassifiedProducts.length} catalog records need category verification
            </summary>
            <div className="divide-y divide-[#EEDCD2] border-t border-[#EEDCD2]">
              {filteredUnclassifiedProducts.map((version, index) => {
                const id = version.id || version._id
                const canEdit = canMutateCatalog && Boolean(id) && version.publicationStatus !== 'retired'
                return <div key={id || `uncategorised-${index}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="break-words text-[15px] font-semibold">{version.displayName || 'Unnamed catalog record'}</p>
                    <p className="text-[13px] text-[#657065]">Category not available · <StatusBadge status={version.publicationStatus} /></p>
                  </div>
                  <div className="flex items-center gap-2">
                    {canEdit ? <Link className={buttonClass} to={`/admin/catalog/products/${encodeURIComponent(id)}?edit=1`}>Edit</Link> : null}
                    {canMutateCatalog && canEdit ? <button type="button" className={dangerButtonClass} disabled={Boolean(busyId)} onClick={() => deleteProduct(version)}>Delete</button> : null}
                  </div>
                </div>
              })}
            </div>
          </details>
        ) : null}
      </main>
    </AdminShell>
  )
}
