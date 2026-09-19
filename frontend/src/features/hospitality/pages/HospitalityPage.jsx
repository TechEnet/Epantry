import {
  AlertTriangle,
  BookOpenCheck,
  Building2,
  Calculator,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  FileSearch,
  FlagTriangleRight,
  LoaderCircle,
  PackageSearch,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  ShoppingCart,
  Truck,
  UsersRound,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  Link,
} from 'react-router-dom'

import {
  addHospitalityMenuItem,
  approveDishPassportSnapshot,
  approveHospitalityProductionRecipe,
  calculateHospitalityRecipeCost,
  createHospitalityMenu,
  createHospitalityOutlet,
  createHospitalityProcurementPlan,
  createHospitalityProductionPlan,
  createHospitalityProductionRecipe,
  createHospitalityStockObservation,
  createHospitalitySupplier,
  createHospitalitySupplierProduct,
  decideHospitalityChangeCase,
  detectHospitalityChangeImpact,
  generateDishPassportSnapshot,
  generateGreyBookSnapshot,
  getHospitalityContext,
  getHospitalityErrorMessage,
  getSelectedHospitalityOrganizationId,
  greyBookExportUrl,
  initializeHospitalityProfile,
  listDishPassportSnapshots,
  listGreyBookSnapshots,
  listHospitalityChangeCases,
  listHospitalityMemberGrants,
  listHospitalityMenus,
  listHospitalityOutlets,
  listHospitalityProductionPlans,
  listHospitalityProductionRecipes,
  listHospitalitySupplierProducts,
  listHospitalitySuppliers,
  publishDishPassportSnapshot,
  publishHospitalityChangeCase,
  recalculateHospitalityChangeCase,
  setSelectedHospitalityOrganizationId,
  submitHospitalityProductionRecipe,
  upsertHospitalityMemberGrant,
} from '../services/hospitality.service'

const inputClass =
  'focus-ring w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-900 outline-none placeholder:text-stone-400'

const primaryButtonClass =
  'focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50'

const secondaryButtonClass =
  'focus-ring inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-black text-stone-700 disabled:cursor-not-allowed disabled:opacity-50'

const SECTION_CONFIG = Object.freeze({
  dashboard: {
    code: 'B01',
    title: 'B2B Dashboard',
    icon: FlagTriangleRight,
    description:
      'Organization-scoped Hospitality operations across outlets, suppliers, production recipes, procurement, Dish Passports and change governance.',
  },
  outlets: {
    code: 'B02',
    title: 'Organization / Outlets',
    icon: Building2,
    description:
      'Hospitality overlays the existing Host MarketplaceOrganization. Outlet and member scope never create a fourth application role.',
  },
  suppliers: {
    code: 'B03',
    title: 'Supplier Master',
    icon: Truck,
    description:
      'Organization supplier relationships and outlet service scope. Supplier commercial data remains separate from canonical catalog truth.',
  },
  products: {
    code: 'B04',
    title: 'Ingredient / Product Master',
    icon: PackageSearch,
    description:
      'Versioned supplier SKU/pack/cost overlays linked to canonical M04 Pack or Ingredient identity.',
  },
  recipes: {
    code: 'B05',
    title: 'Production Recipes',
    icon: ChefHat,
    description:
      'Versioned operational recipes with canonical Ingredient lines and optional M07 Dish/Recipe lineage.',
  },
  menus: {
    code: 'B06',
    title: 'Menus',
    icon: ClipboardList,
    description:
      'Outlet menus pin approved Production Recipe Versions instead of mutable recipe drafts.',
  },
  procurement: {
    code: 'B07',
    title: 'Procurement',
    icon: ShoppingCart,
    description:
      'Production demand, append-only outlet stock observations, net shortages and deterministic supplier comparison.',
  },
  costing: {
    code: 'B08',
    title: 'Costing',
    icon: Calculator,
    description:
      'Cost snapshots use supplier contract minor-unit pricing. Marketplace Offer prices and silent FX conversion are not used.',
  },
  passports: {
    code: 'B09',
    title: 'Dish Passport',
    icon: FileSearch,
    description:
      'Generated versioned projection from approved Production Recipe + published M07 Recipe + approved M08 Food Calculation.',
  },
  greyBook: {
    code: 'B10',
    title: 'Grey Book',
    icon: BookOpenCheck,
    description:
      'Immutable outlet evidence snapshots that pin the exact published verified Dish Passport versions in effect.',
  },
  changeManagement: {
    code: 'B11',
    title: 'Change Management / Audit',
    icon: ScrollText,
    description:
      'Detect source impact, recalculate candidate Passports, route approval and publish new effective history without rewriting old outputs.',
  },
})

function titleize(value) {
  return String(value || '')
    .split('_')
    .filter(Boolean)
    .map(
      (part) =>
        `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
    )
    .join(' ')
}

function parseJsonArray(
  value,
  fallback = [],
) {
  const parsed =
    JSON.parse(
      value,
    )

  if (
    !Array.isArray(parsed)
  ) {
    throw new Error(
      'Expected a JSON array.',
    )
  }

  return parsed
}

function Notice({
  children,
  tone = 'stone',
}) {
  const classes = {
    stone:
      'border-stone-200 bg-white text-stone-600',
    amber:
      'border-amber-200 bg-amber-50 text-amber-900',
    emerald:
      'border-emerald-200 bg-emerald-50 text-emerald-800',
    red:
      'border-red-200 bg-red-50 text-red-700',
  }

  return (
    <div className={`rounded-2xl border p-4 text-sm font-semibold leading-6 ${classes[tone]}`}>
      {children}
    </div>
  )
}

function Card({
  title,
  children,
}) {
  return (
    <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-black text-stone-950">
        {title}
      </h2>
      <div className="mt-4">
        {children}
      </div>
    </section>
  )
}

function Metric({
  label,
  value,
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-stone-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-stone-950">
        {value ?? 0}
      </p>
    </div>
  )
}

function evidenceFrom(
  label,
  referenceId,
) {
  if (
    !String(label || '').trim()
  ) {
    return []
  }

  return [
    {
      type: 'external_reference',
      label:
        String(label).trim(),
      referenceId:
        String(referenceId || '').trim(),
      uri: '',
      note: '',
    },
  ]
}

export default function HospitalityPage({
  section = 'dashboard',
}) {
  const config =
    SECTION_CONFIG[section] ||
    SECTION_CONFIG.dashboard

  const Icon =
    config.icon

  const [organizationId, setOrganizationId] =
    useState(
      () =>
        getSelectedHospitalityOrganizationId(),
    )

  const [contextData, setContextData] =
    useState(null)
  const [outlets, setOutlets] =
    useState([])
  const [memberGrants, setMemberGrants] =
    useState([])
  const [suppliers, setSuppliers] =
    useState([])
  const [supplierProducts, setSupplierProducts] =
    useState([])
  const [recipes, setRecipes] =
    useState([])
  const [menus, setMenus] =
    useState([])
  const [productionPlans, setProductionPlans] =
    useState([])
  const [passports, setPassports] =
    useState([])
  const [greyBooks, setGreyBooks] =
    useState([])
  const [changeCases, setChangeCases] =
    useState([])

  const [loading, setLoading] =
    useState(true)
  const [busy, setBusy] =
    useState(false)
  const [error, setError] =
    useState('')
  const [notice, setNotice] =
    useState('')

  const [reason, setReason] =
    useState('Operational review completed with supporting evidence.')
  const [evidenceLabel, setEvidenceLabel] =
    useState('Hospitality operator review')
  const [evidenceReferenceId, setEvidenceReferenceId] =
    useState('')

  const [profileCurrency, setProfileCurrency] =
    useState('INR')

  const [outletForm, setOutletForm] =
    useState({
      outletCode: '',
      name: '',
      kitchenName: '',
      costCenterCode: '',
    })

  const [memberForm, setMemberForm] =
    useState({
      userId: '',
      permissionKeys: 'hospitality.read,hospitality.recipes.read',
      outletIds: '',
    })

  const [supplierForm, setSupplierForm] =
    useState({
      supplierCode: '',
      name: '',
      leadTimeDays: 0,
      serviceOutletIds: '',
    })

  const [supplierProductForm, setSupplierProductForm] =
    useState({
      supplierId: '',
      supplierSku: '',
      canonicalPackId: '',
      canonicalIngredientId: '',
      localDescription: '',
      packQuantity: 1,
      packUnit: 'kg',
      amountMinor: 0,
      currency: 'INR',
      minimumOrderPacks: 1,
      leadTimeDays: 0,
    })

  const [recipeForm, setRecipeForm] =
    useState({
      recipeKey: '',
      dishId: '',
      sourceRecipeVersionId: '',
      title: '',
      baseYieldPortions: 1,
      ingredientsJson:
        '[\n  {\n    "lineNumber": 1,\n    "canonicalIngredientId": "",\n    "quantity": 1,\n    "unit": "kg",\n    "expectedWastePercentage": 0,\n    "preferredSupplierProductId": null,\n    "optional": false,\n    "notes": ""\n  }\n]',
    })

  const [menuForm, setMenuForm] =
    useState({
      outletId: '',
      menuCode: '',
      name: '',
    })

  const [menuItemForm, setMenuItemForm] =
    useState({
      menuId: '',
      productionRecipeVersionId: '',
      displayName: '',
      sellingPriceMinor: '',
      currency: 'INR',
    })

  const [stockForm, setStockForm] =
    useState({
      outletId: '',
      canonicalIngredientId: '',
      quantity: 0,
      unit: 'kg',
    })

  const [productionPlanForm, setProductionPlanForm] =
    useState({
      outletId: '',
      planDate: new Date().toISOString().slice(0, 10),
      itemsJson:
        '[\n  {\n    "productionRecipeVersionId": "",\n    "portions": 140\n  }\n]',
    })

  const [procurementPlanIds, setProcurementPlanIds] =
    useState('')

  const [costForm, setCostForm] =
    useState({
      recipeId: '',
      outletId: '',
    })
  const [lastCost, setLastCost] =
    useState(null)

  const [passportForm, setPassportForm] =
    useState({
      outletId: '',
      productionRecipeVersionId: '',
    })

  const [greyBookOutletId, setGreyBookOutletId] =
    useState('')

  const [changeForm, setChangeForm] =
    useState({
      sourceType: 'product_version',
      sourceId: '',
      sourceVersion: '',
      changedDomains: 'formulation,allergen',
    })

  const permissions =
    contextData?.context?.permissionKeys ||
    []

  const isOwner =
    contextData?.context?.isOrganizationOwner ===
    true

  const can =
    useCallback(
      (permissionKey) =>
        isOwner ||
        permissions.includes(
          permissionKey,
        ),
      [
        isOwner,
        permissions,
      ],
    )

  const load =
    useCallback(
      async () => {
        setLoading(true)
        setError('')

        try {
          const common =
            await Promise.allSettled([
              getHospitalityContext(),
              listHospitalityOutlets(),
            ])

          if (
            common[0].status ===
            'rejected'
          ) {
            throw common[0].reason
          }

          setContextData(
            common[0].value,
          )

          setOutlets(
            common[1].status ===
            'fulfilled'
              ? common[1].value?.outlets || []
              : [],
          )

          const tasks = []

          if (
            ['dashboard', 'outlets'].includes(section)
          ) {
            tasks.push([
              'memberGrants',
              listHospitalityMemberGrants(),
            ])
          }

          if (
            ['dashboard', 'suppliers', 'products', 'recipes', 'costing', 'procurement'].includes(section)
          ) {
            tasks.push([
              'suppliers',
              listHospitalitySuppliers(),
            ])
            tasks.push([
              'supplierProducts',
              listHospitalitySupplierProducts(),
            ])
          }

          if (
            ['dashboard', 'recipes', 'menus', 'costing', 'procurement', 'passports'].includes(section)
          ) {
            tasks.push([
              'recipes',
              listHospitalityProductionRecipes(),
            ])
          }

          if (
            ['dashboard', 'menus'].includes(section)
          ) {
            tasks.push([
              'menus',
              listHospitalityMenus(),
            ])
          }

          if (
            ['dashboard', 'procurement'].includes(section)
          ) {
            tasks.push([
              'productionPlans',
              listHospitalityProductionPlans(),
            ])
          }

          if (
            ['dashboard', 'passports', 'greyBook', 'changeManagement'].includes(section)
          ) {
            tasks.push([
              'passports',
              listDishPassportSnapshots(),
            ])
          }

          if (
            ['dashboard', 'greyBook', 'changeManagement'].includes(section)
          ) {
            tasks.push([
              'greyBooks',
              listGreyBookSnapshots(),
            ])
          }

          if (
            ['dashboard', 'changeManagement'].includes(section)
          ) {
            tasks.push([
              'changeCases',
              listHospitalityChangeCases(),
            ])
          }

          const results =
            await Promise.allSettled(
              tasks.map(
                ([, promise]) => promise,
              ),
            )

          tasks.forEach(
            ([key], index) => {
              const result =
                results[index]

              const value =
                result.status ===
                'fulfilled'
                  ? result.value
                  : null

              if (key === 'memberGrants') {
                setMemberGrants(value?.grants || [])
              }
              if (key === 'suppliers') {
                setSuppliers(value?.suppliers || [])
              }
              if (key === 'supplierProducts') {
                setSupplierProducts(value?.supplierProducts || [])
              }
              if (key === 'recipes') {
                setRecipes(value?.productionRecipes || [])
              }
              if (key === 'menus') {
                setMenus(value?.menus || [])
              }
              if (key === 'productionPlans') {
                setProductionPlans(value?.productionPlans || [])
              }
              if (key === 'passports') {
                setPassports(value?.dishPassports || [])
              }
              if (key === 'greyBooks') {
                setGreyBooks(value?.greyBooks || [])
              }
              if (key === 'changeCases') {
                setChangeCases(value?.changeCases || [])
              }
            },
          )
        } catch (requestError) {
          setError(
            getHospitalityErrorMessage(
              requestError,
              'Unable to load the Hospitality workspace.',
            ),
          )
        } finally {
          setLoading(false)
        }
      },
      [section],
    )

  useEffect(
    () => {
      load()
    },
    [load],
  )

  const metrics =
    useMemo(
      () => [
        ['Outlets', outlets.length],
        ['Suppliers', suppliers.length],
        ['Supplier products', supplierProducts.length],
        ['Production recipes', recipes.length],
        ['Production plans', productionPlans.length],
        ['Published Passports', passports.filter((item) => item.status === 'published').length],
        ['Grey Books', greyBooks.length],
        ['Open change cases', changeCases.filter((item) => !['published', 'dismissed'].includes(item.status)).length],
      ],
      [
        outlets,
        suppliers,
        supplierProducts,
        recipes,
        productionPlans,
        passports,
        greyBooks,
        changeCases,
      ],
    )

  async function run(
    action,
    successMessage,
  ) {
    setBusy(true)
    setError('')
    setNotice('')

    try {
      const result =
        await action()

      setNotice(
        successMessage,
      )

      await load()

      return result
    } catch (requestError) {
      setError(
        getHospitalityErrorMessage(
          requestError,
        ),
      )

      return null
    } finally {
      setBusy(false)
    }
  }

  const decisionEvidence =
    () =>
      evidenceFrom(
        evidenceLabel,
        evidenceReferenceId,
      )

  return (
    <div className="p-4 sm:p-6 lg:p-7">
      <header className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-800">
              <Icon size={14} />
              {config.code}
            </div>

            <h1 className="mt-3 text-2xl font-black tracking-tight text-stone-950 sm:text-3xl">
              {config.title}
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
              {config.description}
            </p>
          </div>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className={secondaryButtonClass}
          >
            <RefreshCw
              size={15}
              className={loading ? 'animate-spin' : ''}
            />
            Refresh
          </button>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <input
            className={inputClass}
            value={organizationId}
            onChange={(event) =>
              setOrganizationId(
                event.target.value,
              )
            }
            placeholder="Organization ObjectId — only needed when you belong to multiple Hospitality organizations"
          />

          <button
            type="button"
            onClick={() => {
              setSelectedHospitalityOrganizationId(
                organizationId,
              )
              load()
            }}
            className={secondaryButtonClass}
          >
            Use organization
          </button>
        </div>
      </header>

      {error ? (
        <div className="mt-4">
          <Notice tone="red">
            {error}
          </Notice>
        </div>
      ) : null}

      {notice ? (
        <div className="mt-4">
          <Notice tone="emerald">
            {notice}
          </Notice>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-5 grid min-h-72 place-items-center rounded-[24px] border border-stone-200 bg-white">
          <LoaderCircle className="animate-spin text-emerald-700" />
        </div>
      ) : (
        <>
          <div className="mt-5">
            <Notice tone="stone">
              Backend authority is final. Hospitality authorization uses Host capability, organization membership, outlet scope and permission keys; UI mode selection is never an authority source.
            </Notice>
          </div>

          {section === 'dashboard' ? (
            <div className="mt-5 space-y-5">
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {metrics.map(
                  ([label, value]) => (
                    <Metric
                      key={label}
                      label={label}
                      value={value}
                    />
                  ),
                )}
              </section>

              <div className="grid gap-5 lg:grid-cols-2">
                <Card title="Organization context">
                  <p className="text-sm font-black text-stone-950">
                    {contextData?.context?.organization?.displayName || 'Hospitality organization'}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-stone-500">
                    {isOwner
                      ? 'Organization owner — full Hospitality permission surface.'
                      : `${permissions.length} delegated Hospitality permissions.`}
                  </p>
                </Card>

                <Card title="Trust boundary">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 shrink-0 text-emerald-700" size={18} />
                    <p className="text-sm leading-6 text-stone-600">
                      Dish Passport publication requires approved source lineage and verified M08 food intelligence. Grey Book pins published Passport versions. Source changes create new downstream history rather than rewriting old evidence.
                    </p>
                  </div>
                </Card>
              </div>
            </div>
          ) : null}

          {section === 'outlets' ? (
            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <Card title="Hospitality profile">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    className={inputClass}
                    value={profileCurrency}
                    onChange={(event) => setProfileCurrency(event.target.value.toUpperCase())}
                    placeholder="INR"
                  />

                  <button
                    type="button"
                    disabled={busy || !isOwner}
                    onClick={() =>
                      run(
                        () =>
                          initializeHospitalityProfile({
                            defaultCurrency: profileCurrency,
                            notes: 'Hospitality workspace initialized from B02.',
                          }),
                        'Hospitality profile initialized.',
                      )
                    }
                    className={primaryButtonClass}
                  >
                    Initialize / refresh profile
                  </button>
                </div>
              </Card>

              <Card title="Create outlet">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className={inputClass} placeholder="Outlet code" value={outletForm.outletCode} onChange={(event) => setOutletForm((current) => ({ ...current, outletCode: event.target.value }))} />
                  <input className={inputClass} placeholder="Outlet name" value={outletForm.name} onChange={(event) => setOutletForm((current) => ({ ...current, name: event.target.value }))} />
                  <input className={inputClass} placeholder="Kitchen name" value={outletForm.kitchenName} onChange={(event) => setOutletForm((current) => ({ ...current, kitchenName: event.target.value }))} />
                  <input className={inputClass} placeholder="Cost center" value={outletForm.costCenterCode} onChange={(event) => setOutletForm((current) => ({ ...current, costCenterCode: event.target.value }))} />
                </div>
                <button
                  type="button"
                  disabled={busy || !can('hospitality.outlets.manage') || !outletForm.outletCode.trim() || !outletForm.name.trim()}
                  onClick={() =>
                    run(
                      () =>
                        createHospitalityOutlet({
                          ...outletForm,
                          inheritanceMode: 'inherit_org_defaults',
                          timezone: 'Asia/Kolkata',
                          address: {},
                        }),
                      'Outlet created.',
                    )
                  }
                  className={`${primaryButtonClass} mt-3`}
                >
                  Create outlet
                </button>
              </Card>

              <Card title="Outlet register">
                <div className="space-y-2">
                  {outlets.map((outlet) => (
                    <div key={outlet.id} className="rounded-2xl border border-stone-200 p-4">
                      <p className="font-black">{outlet.name}</p>
                      <p className="mt-1 text-xs text-stone-500">{outlet.outletCode} · {titleize(outlet.status)}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Hospitality member grant">
                <Notice tone="amber">
                  Member grants require an already active Host identity. Chef/Procurement/Compliance labels are operational profiles only; authorization is permissionKeys + outletIds.
                </Notice>

                <div className="mt-3 grid gap-3">
                  <input className={inputClass} placeholder="Host User ObjectId" value={memberForm.userId} onChange={(event) => setMemberForm((current) => ({ ...current, userId: event.target.value }))} />
                  <input className={inputClass} placeholder="permission keys, comma separated" value={memberForm.permissionKeys} onChange={(event) => setMemberForm((current) => ({ ...current, permissionKeys: event.target.value }))} />
                  <input className={inputClass} placeholder="Outlet ObjectIds, comma separated; empty = org-wide" value={memberForm.outletIds} onChange={(event) => setMemberForm((current) => ({ ...current, outletIds: event.target.value }))} />
                </div>

                <button
                  type="button"
                  disabled={busy || !isOwner || !memberForm.userId.trim()}
                  onClick={() =>
                    run(
                      () =>
                        upsertHospitalityMemberGrant({
                          userId: memberForm.userId.trim(),
                          permissionKeys: memberForm.permissionKeys.split(',').map((value) => value.trim()).filter(Boolean),
                          outletIds: memberForm.outletIds.split(',').map((value) => value.trim()).filter(Boolean),
                          reason: 'Hospitality membership configured by organization owner.',
                        }),
                      'Hospitality member grant saved.',
                    )
                  }
                  className={`${primaryButtonClass} mt-3`}
                >
                  Save grant
                </button>

                <p className="mt-4 text-xs text-stone-500">
                  Existing grants: {memberGrants.length}
                </p>
              </Card>
            </div>
          ) : null}

          {section === 'suppliers' ? (
            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <Card title="Create supplier">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className={inputClass} placeholder="Supplier code" value={supplierForm.supplierCode} onChange={(event) => setSupplierForm((current) => ({ ...current, supplierCode: event.target.value }))} />
                  <input className={inputClass} placeholder="Supplier name" value={supplierForm.name} onChange={(event) => setSupplierForm((current) => ({ ...current, name: event.target.value }))} />
                  <input className={inputClass} type="number" min="0" placeholder="Lead time days" value={supplierForm.leadTimeDays} onChange={(event) => setSupplierForm((current) => ({ ...current, leadTimeDays: Number(event.target.value) }))} />
                  <input className={inputClass} placeholder="Service outlet IDs, comma separated" value={supplierForm.serviceOutletIds} onChange={(event) => setSupplierForm((current) => ({ ...current, serviceOutletIds: event.target.value }))} />
                </div>

                <button
                  type="button"
                  disabled={busy || !can('hospitality.suppliers.manage') || !supplierForm.supplierCode.trim() || !supplierForm.name.trim()}
                  onClick={() =>
                    run(
                      () =>
                        createHospitalitySupplier({
                          supplierCode: supplierForm.supplierCode,
                          name: supplierForm.name,
                          leadTimeDays: Number(supplierForm.leadTimeDays) || 0,
                          serviceOutletIds: supplierForm.serviceOutletIds.split(',').map((value) => value.trim()).filter(Boolean),
                          contact: {},
                          notes: '',
                        }),
                      'Supplier created.',
                    )
                  }
                  className={`${primaryButtonClass} mt-3`}
                >
                  Create supplier
                </button>
              </Card>

              <Card title="Supplier master">
                <div className="space-y-2">
                  {suppliers.map((supplier) => (
                    <div key={supplier.id} className="rounded-2xl border border-stone-200 p-4">
                      <p className="font-black">{supplier.name}</p>
                      <p className="mt-1 text-xs text-stone-500">{supplier.supplierCode} · lead {supplier.leadTimeDays} days · {titleize(supplier.status)}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ) : null}

          {section === 'products' ? (
            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <Card title="Create supplier contract version">
                <Notice tone="amber">
                  New commercial terms create a new SupplierProduct version. Existing contract cost/pack/MOQ facts are not price-overwritten.
                </Notice>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input className={inputClass} placeholder="Supplier ObjectId" value={supplierProductForm.supplierId} onChange={(event) => setSupplierProductForm((current) => ({ ...current, supplierId: event.target.value }))} />
                  <input className={inputClass} placeholder="Supplier SKU" value={supplierProductForm.supplierSku} onChange={(event) => setSupplierProductForm((current) => ({ ...current, supplierSku: event.target.value }))} />
                  <input className={inputClass} placeholder="Canonical Pack ObjectId (optional)" value={supplierProductForm.canonicalPackId} onChange={(event) => setSupplierProductForm((current) => ({ ...current, canonicalPackId: event.target.value }))} />
                  <input className={inputClass} placeholder="Canonical Ingredient ObjectId (optional)" value={supplierProductForm.canonicalIngredientId} onChange={(event) => setSupplierProductForm((current) => ({ ...current, canonicalIngredientId: event.target.value }))} />
                  <input className={inputClass} type="number" min="0.000001" step="0.001" placeholder="Pack quantity" value={supplierProductForm.packQuantity} onChange={(event) => setSupplierProductForm((current) => ({ ...current, packQuantity: Number(event.target.value) }))} />
                  <input className={inputClass} placeholder="Pack unit" value={supplierProductForm.packUnit} onChange={(event) => setSupplierProductForm((current) => ({ ...current, packUnit: event.target.value }))} />
                  <input className={inputClass} type="number" min="0" placeholder="Contract cost minor units" value={supplierProductForm.amountMinor} onChange={(event) => setSupplierProductForm((current) => ({ ...current, amountMinor: Number(event.target.value) }))} />
                  <input className={inputClass} placeholder="Currency" value={supplierProductForm.currency} onChange={(event) => setSupplierProductForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} />
                </div>

                <button
                  type="button"
                  disabled={busy || !can('hospitality.suppliers.manage') || !supplierProductForm.supplierId.trim() || !supplierProductForm.supplierSku.trim()}
                  onClick={() =>
                    run(
                      () =>
                        createHospitalitySupplierProduct({
                          supplierId: supplierProductForm.supplierId.trim(),
                          supplierSku: supplierProductForm.supplierSku.trim(),
                          canonicalPackId: supplierProductForm.canonicalPackId.trim() || null,
                          canonicalIngredientId: supplierProductForm.canonicalIngredientId.trim() || null,
                          localDescription: supplierProductForm.localDescription,
                          packQuantity: Number(supplierProductForm.packQuantity),
                          packUnit: supplierProductForm.packUnit,
                          contractCost: {
                            amountMinor: Number(supplierProductForm.amountMinor),
                            currency: supplierProductForm.currency,
                          },
                          minimumOrderPacks: Number(supplierProductForm.minimumOrderPacks) || 1,
                          leadTimeDays: Number(supplierProductForm.leadTimeDays) || 0,
                          effectiveFrom: null,
                          effectiveTo: null,
                        }),
                      'Supplier Product contract version created.',
                    )
                  }
                  className={`${primaryButtonClass} mt-3`}
                >
                  Create version
                </button>
              </Card>

              <Card title="Supplier Product versions">
                <div className="space-y-2">
                  {supplierProducts.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-stone-200 p-4">
                      <div className="flex justify-between gap-3">
                        <p className="font-black">{item.supplierSku}</p>
                        <span className="text-xs font-black text-emerald-700">v{item.versionNumber}</span>
                      </div>
                      <p className="mt-1 text-xs text-stone-500">
                        {item.packQuantity} {item.packUnit} · {item.contractCost?.amountMinor ?? 0} {item.contractCost?.currency} minor units
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ) : null}

          {section === 'recipes' ? (
            <div className="mt-5 space-y-5">
              <Card title="Create Production Recipe draft">
                <Notice tone="amber">
                  Production Recipe is a tenant operational overlay. It may retain M07 Dish/Recipe lineage, but it never edits the canonical M07 RecipeVersion.
                </Notice>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input className={inputClass} placeholder="recipe_key" value={recipeForm.recipeKey} onChange={(event) => setRecipeForm((current) => ({ ...current, recipeKey: event.target.value }))} />
                  <input className={inputClass} placeholder="Title" value={recipeForm.title} onChange={(event) => setRecipeForm((current) => ({ ...current, title: event.target.value }))} />
                  <input className={inputClass} placeholder="M07 Dish ObjectId (optional for draft)" value={recipeForm.dishId} onChange={(event) => setRecipeForm((current) => ({ ...current, dishId: event.target.value }))} />
                  <input className={inputClass} placeholder="M07 RecipeVersion ObjectId (required later for Passport)" value={recipeForm.sourceRecipeVersionId} onChange={(event) => setRecipeForm((current) => ({ ...current, sourceRecipeVersionId: event.target.value }))} />
                  <input className={inputClass} type="number" min="1" placeholder="Base yield portions" value={recipeForm.baseYieldPortions} onChange={(event) => setRecipeForm((current) => ({ ...current, baseYieldPortions: Number(event.target.value) }))} />
                </div>

                <textarea
                  className={`${inputClass} mt-3 min-h-64 font-mono text-xs`}
                  value={recipeForm.ingredientsJson}
                  onChange={(event) => setRecipeForm((current) => ({ ...current, ingredientsJson: event.target.value }))}
                  aria-label="Production Recipe ingredients JSON"
                />

                <button
                  type="button"
                  disabled={busy || !can('hospitality.recipes.manage') || !recipeForm.recipeKey.trim() || !recipeForm.title.trim()}
                  onClick={() =>
                    run(
                      () =>
                        createHospitalityProductionRecipe({
                          recipeKey: recipeForm.recipeKey.trim(),
                          dishId: recipeForm.dishId.trim() || null,
                          sourceRecipeVersionId: recipeForm.sourceRecipeVersionId.trim() || null,
                          title: recipeForm.title.trim(),
                          baseYieldPortions: Number(recipeForm.baseYieldPortions),
                          finishedYield: null,
                          productionUnit: 'portion',
                          changeReason: 'New Hospitality Production Recipe version.',
                          ingredients: parseJsonArray(recipeForm.ingredientsJson),
                        }),
                      'Production Recipe draft created.',
                    )
                  }
                  className={`${primaryButtonClass} mt-3`}
                >
                  Create draft
                </button>
              </Card>

              <Card title="Production Recipe versions">
                <div className="space-y-3">
                  {recipes.map((recipe) => (
                    <div key={recipe.id} className="rounded-2xl border border-stone-200 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-black">{recipe.title}</p>
                          <p className="mt-1 text-xs text-stone-500">{recipe.recipeKey} · v{recipe.versionNumber} · {titleize(recipe.status)}</p>
                        </div>
                        <div className="flex gap-2">
                          {recipe.status === 'draft' && can('hospitality.recipes.manage') ? (
                            <button type="button" disabled={busy} onClick={() => run(() => submitHospitalityProductionRecipe(recipe.id, { reason: 'Production Recipe submitted for operational review.' }), 'Production Recipe submitted.')} className={secondaryButtonClass}>Submit</button>
                          ) : null}
                          {recipe.status === 'in_review' && can('hospitality.recipes.approve') ? (
                            <button type="button" disabled={busy} onClick={() => run(() => approveHospitalityProductionRecipe(recipe.id, { reason: 'Production Recipe independently checked and approved.' }), 'Production Recipe approved.')} className={primaryButtonClass}>Approve</button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ) : null}

          {section === 'menus' ? (
            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <Card title="Create outlet menu">
                <div className="grid gap-3">
                  <input className={inputClass} placeholder="Outlet ObjectId" value={menuForm.outletId} onChange={(event) => setMenuForm((current) => ({ ...current, outletId: event.target.value }))} />
                  <input className={inputClass} placeholder="Menu code" value={menuForm.menuCode} onChange={(event) => setMenuForm((current) => ({ ...current, menuCode: event.target.value }))} />
                  <input className={inputClass} placeholder="Menu name" value={menuForm.name} onChange={(event) => setMenuForm((current) => ({ ...current, name: event.target.value }))} />
                </div>
                <button type="button" disabled={busy || !can('hospitality.recipes.manage')} onClick={() => run(() => createHospitalityMenu({ outletId: menuForm.outletId.trim(), menuCode: menuForm.menuCode.trim(), name: menuForm.name.trim(), effectiveFrom: null, effectiveTo: null }), 'Menu created.')} className={`${primaryButtonClass} mt-3`}>Create menu</button>
              </Card>

              <Card title="Add approved recipe to menu">
                <div className="grid gap-3">
                  <input className={inputClass} placeholder="Menu ObjectId" value={menuItemForm.menuId} onChange={(event) => setMenuItemForm((current) => ({ ...current, menuId: event.target.value }))} />
                  <input className={inputClass} placeholder="Approved ProductionRecipeVersion ObjectId" value={menuItemForm.productionRecipeVersionId} onChange={(event) => setMenuItemForm((current) => ({ ...current, productionRecipeVersionId: event.target.value }))} />
                  <input className={inputClass} placeholder="Display name" value={menuItemForm.displayName} onChange={(event) => setMenuItemForm((current) => ({ ...current, displayName: event.target.value }))} />
                  <input className={inputClass} placeholder="Selling price minor units (optional)" value={menuItemForm.sellingPriceMinor} onChange={(event) => setMenuItemForm((current) => ({ ...current, sellingPriceMinor: event.target.value }))} />
                </div>
                <button type="button" disabled={busy || !can('hospitality.recipes.manage')} onClick={() => run(() => addHospitalityMenuItem(menuItemForm.menuId.trim(), { productionRecipeVersionId: menuItemForm.productionRecipeVersionId.trim(), displayName: menuItemForm.displayName.trim(), sellingPrice: menuItemForm.sellingPriceMinor === '' ? null : { amountMinor: Number(menuItemForm.sellingPriceMinor), currency: menuItemForm.currency } }), 'Menu item added.')} className={`${primaryButtonClass} mt-3`}>Add item</button>
              </Card>

              <div className="xl:col-span-2">
                <Card title="Menus">
                  <div className="grid gap-3 md:grid-cols-2">
                    {menus.map((menu) => (
                      <div key={menu.id} className="rounded-2xl border border-stone-200 p-4">
                        <p className="font-black">{menu.name}</p>
                        <p className="mt-1 text-xs text-stone-500">{menu.menuCode} · {menu.items?.length || 0} items</p>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          ) : null}

          {section === 'procurement' ? (
            <div className="mt-5 space-y-5">
              <div className="grid gap-5 xl:grid-cols-2">
                <Card title="Record outlet stock observation">
                  <Notice tone="amber">
                    Stock observations are append-only operational evidence. They do not mutate M05 InventorySnapshot.
                  </Notice>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input className={inputClass} placeholder="Outlet ObjectId" value={stockForm.outletId} onChange={(event) => setStockForm((current) => ({ ...current, outletId: event.target.value }))} />
                    <input className={inputClass} placeholder="Canonical Ingredient ObjectId" value={stockForm.canonicalIngredientId} onChange={(event) => setStockForm((current) => ({ ...current, canonicalIngredientId: event.target.value }))} />
                    <input className={inputClass} type="number" min="0" step="0.001" placeholder="Quantity" value={stockForm.quantity} onChange={(event) => setStockForm((current) => ({ ...current, quantity: Number(event.target.value) }))} />
                    <input className={inputClass} placeholder="Unit" value={stockForm.unit} onChange={(event) => setStockForm((current) => ({ ...current, unit: event.target.value }))} />
                  </div>
                  <button type="button" disabled={busy || !can('hospitality.procurement.manage')} onClick={() => run(() => createHospitalityStockObservation({ outletId: stockForm.outletId.trim(), canonicalIngredientId: stockForm.canonicalIngredientId.trim(), quantity: Number(stockForm.quantity), unit: stockForm.unit, source: 'manual_count', observedAt: new Date().toISOString(), note: 'Hospitality outlet count.' }), 'Stock observation recorded.')} className={`${primaryButtonClass} mt-3`}>Record observation</button>
                </Card>

                <Card title="Create Production Plan">
                  <input className={inputClass} placeholder="Outlet ObjectId" value={productionPlanForm.outletId} onChange={(event) => setProductionPlanForm((current) => ({ ...current, outletId: event.target.value }))} />
                  <input className={`${inputClass} mt-3`} type="date" value={productionPlanForm.planDate} onChange={(event) => setProductionPlanForm((current) => ({ ...current, planDate: event.target.value }))} />
                  <textarea className={`${inputClass} mt-3 min-h-36 font-mono text-xs`} value={productionPlanForm.itemsJson} onChange={(event) => setProductionPlanForm((current) => ({ ...current, itemsJson: event.target.value }))} />
                  <button type="button" disabled={busy || !can('hospitality.procurement.manage')} onClick={() => run(() => createHospitalityProductionPlan({ outletId: productionPlanForm.outletId.trim(), planDate: new Date(`${productionPlanForm.planDate}T00:00:00.000Z`).toISOString(), items: parseJsonArray(productionPlanForm.itemsJson) }), 'Production Plan calculated.')} className={`${primaryButtonClass} mt-3`}>Calculate plan</button>
                </Card>
              </div>

              <Card title="Create consolidated Procurement Plan">
                <input className={inputClass} placeholder="Production Plan ObjectIds, comma separated" value={procurementPlanIds} onChange={(event) => setProcurementPlanIds(event.target.value)} />
                <button type="button" disabled={busy || !can('hospitality.procurement.manage')} onClick={() => run(() => createHospitalityProcurementPlan({ productionPlanIds: procurementPlanIds.split(',').map((value) => value.trim()).filter(Boolean) }), 'Procurement Plan created. No supplier PO was submitted automatically.')} className={`${primaryButtonClass} mt-3`}>Compare suppliers</button>
                <p className="mt-3 text-xs text-stone-500">Existing Production Plans: {productionPlans.length}. Supplier selection is lowest known eligible contract cost; RFQ auction and automatic PO submission remain disabled.</p>
              </Card>
            </div>
          ) : null}

          {section === 'costing' ? (
            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <Card title="Calculate Recipe Cost snapshot">
                <input className={inputClass} placeholder="Approved ProductionRecipeVersion ObjectId" value={costForm.recipeId} onChange={(event) => setCostForm((current) => ({ ...current, recipeId: event.target.value }))} />
                <input className={`${inputClass} mt-3`} placeholder="Outlet ObjectId (required for outlet-scoped operators)" value={costForm.outletId} onChange={(event) => setCostForm((current) => ({ ...current, outletId: event.target.value }))} />
                <button type="button" disabled={busy || !can('hospitality.costing.read')} onClick={async () => {
                  const result = await run(() => calculateHospitalityRecipeCost(costForm.recipeId.trim(), { outletId: costForm.outletId.trim() || null }), 'Recipe Cost snapshot calculated.')
                  if (result?.recipeCost) setLastCost(result.recipeCost)
                }} className={`${primaryButtonClass} mt-3`}>Calculate cost</button>
              </Card>

              <Card title="Latest calculation">
                {lastCost ? (
                  <div>
                    <p className="text-3xl font-black">{lastCost.totalCostMinor} <span className="text-sm text-stone-500">{lastCost.currency} minor units</span></p>
                    <p className="mt-2 text-sm text-stone-500">Cost / portion: {lastCost.costPerPortionMinor} minor units</p>
                  </div>
                ) : (
                  <p className="text-sm text-stone-500">No cost snapshot calculated in this browser session.</p>
                )}
              </Card>
            </div>
          ) : null}

          {section === 'passports' ? (
            <div className="mt-5 space-y-5">
              <Notice tone="amber">
                Dish Passport is not an editable safety record. Generation requires approved M18 Production Recipe + active Dish + published M07 RecipeVersion + approved M08 FoodCalculation. Any `unknown_review_required` safety evidence blocks approval/publication.
              </Notice>

              <Card title="Generate Dish Passport candidate">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className={inputClass} placeholder="Outlet ObjectId" value={passportForm.outletId} onChange={(event) => setPassportForm((current) => ({ ...current, outletId: event.target.value }))} />
                  <input className={inputClass} placeholder="Approved ProductionRecipeVersion ObjectId" value={passportForm.productionRecipeVersionId} onChange={(event) => setPassportForm((current) => ({ ...current, productionRecipeVersionId: event.target.value }))} />
                </div>
                <button type="button" disabled={busy || !can('hospitality.passports.generate')} onClick={() => run(() => generateDishPassportSnapshot({ outletId: passportForm.outletId.trim(), productionRecipeVersionId: passportForm.productionRecipeVersionId.trim(), changeCaseId: null }), 'Dish Passport candidate generated.')} className={`${primaryButtonClass} mt-3`}>Generate candidate</button>
              </Card>

              <Card title="Governance reason / evidence">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className={inputClass} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason" />
                  <input className={inputClass} value={evidenceLabel} onChange={(event) => setEvidenceLabel(event.target.value)} placeholder="Evidence label" />
                  <input className={`${inputClass} sm:col-span-2`} value={evidenceReferenceId} onChange={(event) => setEvidenceReferenceId(event.target.value)} placeholder="Evidence reference ID" />
                </div>
              </Card>

              <Card title="Dish Passport versions">
                <div className="space-y-3">
                  {passports.map((passport) => (
                    <div key={passport.id} className="rounded-2xl border border-stone-200 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="font-black">{passport.snapshot?.dish?.name || passport.passportKey}</p>
                          <p className="mt-1 text-xs text-stone-500">v{passport.versionNumber} · {titleize(passport.status)} · {titleize(passport.verificationState)}</p>
                          <p className="mt-1 text-[10px] text-stone-400">{passport.passportKey}</p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {passport.status === 'draft' && passport.verificationState === 'verified' && can('hospitality.passports.approve') ? (
                            <button type="button" disabled={busy || decisionEvidence().length === 0 || reason.trim().length < 10} onClick={() => run(() => approveDishPassportSnapshot(passport.id, { reason: reason.trim(), evidence: decisionEvidence() }), 'Dish Passport approved by independent checker.')} className={secondaryButtonClass}>Approve</button>
                          ) : null}
                          {passport.status === 'approved' && can('hospitality.passports.approve') ? (
                            <button type="button" disabled={busy || decisionEvidence().length === 0 || reason.trim().length < 10} onClick={() => run(() => publishDishPassportSnapshot(passport.id, { reason: reason.trim(), evidence: decisionEvidence() }), 'Dish Passport published; previous version retained.')} className={primaryButtonClass}>Publish</button>
                          ) : null}
                          {passport.status === 'published' ? (
                            <Link className={secondaryButtonClass} target="_blank" rel="noreferrer" to={`/dish-passports/${passport.publicId}`}>Public view</Link>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ) : null}

          {section === 'greyBook' ? (
            <div className="mt-5 space-y-5">
              <Notice tone="amber">
                Grey Book generation includes only published + effective + verified Dish Passports. It pins exact Passport snapshot IDs and never updates old Grey Book history.
              </Notice>

              <Card title="Generate outlet Grey Book">
                <input className={inputClass} placeholder="Outlet ObjectId" value={greyBookOutletId} onChange={(event) => setGreyBookOutletId(event.target.value)} />
                <button type="button" disabled={busy || !can('hospitality.grey_book.generate') || !greyBookOutletId.trim()} onClick={() => run(() => generateGreyBookSnapshot({ outletId: greyBookOutletId.trim(), effectiveAt: new Date().toISOString(), changeCaseId: null }), 'Grey Book snapshot generated.')} className={`${primaryButtonClass} mt-3`}>Generate snapshot</button>
              </Card>

              <Card title="Grey Book history">
                <div className="space-y-3">
                  {greyBooks.map((greyBook) => (
                    <div key={greyBook.id} className="flex flex-col gap-3 rounded-2xl border border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-black">{greyBook.snapshot?.outlet?.name || greyBook.greyBookKey}</p>
                        <p className="mt-1 text-xs text-stone-500">v{greyBook.versionNumber} · {greyBook.passportSnapshotIds?.length || 0} pinned Passports</p>
                      </div>
                      <div className="flex gap-2">
                        <a href={greyBookExportUrl(greyBook.id, 'csv')} className={secondaryButtonClass}>CSV</a>
                        <a href={greyBookExportUrl(greyBook.id, 'json')} className={secondaryButtonClass}>JSON</a>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ) : null}

          {section === 'changeManagement' ? (
            <div className="mt-5 space-y-5">
              <Notice tone="amber">
                Change detection never mutates ProductVersion, RecipeVersion, ProductionRecipeVersion, Dish Passport or Grey Book history. It identifies downstream nodes first, then generates new candidates under approval control.
              </Notice>

              <div className="grid gap-5 xl:grid-cols-2">
                <Card title="Detect upstream change impact">
                  <div className="grid gap-3">
                    <select className={inputClass} value={changeForm.sourceType} onChange={(event) => setChangeForm((current) => ({ ...current, sourceType: event.target.value }))}>
                      <option value="product_version">ProductVersion</option>
                      <option value="canonical_ingredient">CanonicalIngredient</option>
                      <option value="recipe_version">M07 RecipeVersion</option>
                      <option value="production_recipe_version">ProductionRecipeVersion</option>
                      <option value="supplier_product">SupplierProduct</option>
                    </select>
                    <input className={inputClass} placeholder="Source ObjectId" value={changeForm.sourceId} onChange={(event) => setChangeForm((current) => ({ ...current, sourceId: event.target.value }))} />
                    <input className={inputClass} placeholder="Source version / label" value={changeForm.sourceVersion} onChange={(event) => setChangeForm((current) => ({ ...current, sourceVersion: event.target.value }))} />
                    <input className={inputClass} placeholder="Changed domains, comma separated" value={changeForm.changedDomains} onChange={(event) => setChangeForm((current) => ({ ...current, changedDomains: event.target.value }))} />
                  </div>

                  <button type="button" disabled={busy || !can('hospitality.change.manage') || !changeForm.sourceId.trim() || decisionEvidence().length === 0} onClick={() => run(() => detectHospitalityChangeImpact({ sourceType: changeForm.sourceType, sourceId: changeForm.sourceId.trim(), sourceVersion: changeForm.sourceVersion.trim(), changedDomains: changeForm.changedDomains.split(',').map((value) => value.trim()).filter(Boolean), reason: reason.trim(), evidence: decisionEvidence() }), 'Change impact graph created.')} className={`${primaryButtonClass} mt-3`}>Detect impact</button>
                </Card>

                <Card title="Governance context">
                  <input className={inputClass} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason" />
                  <input className={`${inputClass} mt-3`} value={evidenceLabel} onChange={(event) => setEvidenceLabel(event.target.value)} placeholder="Evidence label" />
                  <input className={`${inputClass} mt-3`} value={evidenceReferenceId} onChange={(event) => setEvidenceReferenceId(event.target.value)} placeholder="Evidence reference ID" />
                </Card>
              </div>

              <Card title="Change cases">
                <div className="space-y-3">
                  {changeCases.map((changeCase) => (
                    <div key={changeCase.id} className="rounded-2xl border border-stone-200 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-black text-emerald-700">{changeCase.caseKey}</span>
                            <span className="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-black">{titleize(changeCase.severity)}</span>
                            <span className="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-black">{titleize(changeCase.status)}</span>
                          </div>
                          <p className="mt-2 text-sm font-black">{titleize(changeCase.source?.type)} · {changeCase.source?.id}</p>
                          <p className="mt-1 text-xs text-stone-500">{changeCase.impactedProductionRecipeVersionIds?.length || 0} recipes · {changeCase.impactedOutletIds?.length || 0} outlets · {changeCase.candidatePassportSnapshotIds?.length || 0} candidates</p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {['detected', 'blocked'].includes(changeCase.status) && can('hospitality.change.manage') ? (
                            <button type="button" disabled={busy || decisionEvidence().length === 0 || reason.trim().length < 10} onClick={() => run(() => recalculateHospitalityChangeCase(changeCase.id, { reason: reason.trim(), evidence: decisionEvidence() }), 'Change Case recalculation completed.')} className={secondaryButtonClass}>Recalculate</button>
                          ) : null}
                          {changeCase.status === 'recalculated' && can('hospitality.change.approve') ? (
                            <button type="button" disabled={busy || decisionEvidence().length === 0 || reason.trim().length < 10} onClick={() => run(() => decideHospitalityChangeCase(changeCase.id, { decision: 'approve', reason: reason.trim(), evidence: decisionEvidence() }), 'Change Case approved by checker.')} className={secondaryButtonClass}>Approve</button>
                          ) : null}
                          {changeCase.status === 'approved' && can('hospitality.change.approve') && can('hospitality.passports.approve') && can('hospitality.grey_book.generate') ? (
                            <button type="button" disabled={busy || decisionEvidence().length === 0 || reason.trim().length < 10} onClick={() => run(() => publishHospitalityChangeCase(changeCase.id, { reason: reason.trim(), evidence: decisionEvidence() }), 'New effective Passport and Grey Book history published.')} className={primaryButtonClass}>Publish</button>
                          ) : null}
                        </div>
                      </div>

                      {(changeCase.recalculationNotes || []).length ? (
                        <div className="mt-3 rounded-xl bg-stone-50 p-3 text-xs text-stone-500">
                          {(changeCase.recalculationNotes || []).map((note, index) => (
                            <p key={`${changeCase.id}:${index}`}>{titleize(note.state)} · {note.productionRecipeVersionId || ''} {note.message ? `· ${note.message}` : ''}</p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ) : null}

          <section className="mt-5 rounded-[24px] border border-stone-200 bg-stone-950 p-5 text-white shadow-sm">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 shrink-0 text-emerald-400" size={18} />
              <div>
                <h2 className="text-sm font-black">M18 authority boundary</h2>
                <p className="mt-2 text-xs leading-5 text-stone-400">
                  Host capability → organization membership → outlet scope → Hospitality permission → owning domain truth. AI may help summarize or extract provisional facts but cannot approve a Dish Passport, clear allergen uncertainty, publish a Grey Book, or approve a change case.
                </p>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}