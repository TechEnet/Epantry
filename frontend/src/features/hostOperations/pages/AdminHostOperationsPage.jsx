import {
  BadgeCheck,
  Building2,
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
  'focus-ring w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-900 outline-none'

function titleize(value) {
  return String(
    value ||
      'unknown',
  )
    .split('_')
    .map(
      (part) =>
        `${part
          .charAt(0)
          .toUpperCase()}${part.slice(1)}`,
    )
    .join(' ')
}

function money(
  amountMinor,
  currency = 'INR',
) {
  return new Intl.NumberFormat(
    'en-IN',
    {
      style:
        'currency',

      currency,

      maximumFractionDigits:
        2,
    },
  ).format(
    Number(
      amountMinor ||
        0,
    ) /
      100,
  )
}

function hospitalityApprovalEvidence(
  reason,
) {
  return [
    {
      type:
        'audit_event',

      label:
        'Super Admin Hospitality approval',

      referenceId:
        '',

      uri:
        '',

      note:
        reason,
    },
  ]
}

function HospitalityApprovalWorkspace({
  approvals,
  selectedKey,
  setSelectedKey,
  reason,
  setReason,
  busy,
  run,
}) {
  const rows = [
    ...(approvals.restaurantRecipes || []).map(
      (item) => ({
        key:
          `restaurant_recipe:${item.id}`,
        kind:
          'restaurant_recipe',
        label:
          'Restaurant recipe',
        item,
      }),
    ),

    ...(approvals.productionRecipes || []).map(
      (item) => ({
        key:
          `production_recipe:${item.id}`,
        kind:
          'production_recipe',
        label:
          'Legacy kitchen recipe',
        item,
      }),
    ),

    ...(approvals.dishPassports || []).map(
      (item) => ({
        key:
          `dish_passport:${item.id}`,
        kind:
          'dish_passport',
        label:
          'Dish record',
        item,
      }),
    ),

    ...(approvals.changeCases || []).map(
      (item) => ({
        key:
          `change_case:${item.id}`,
        kind:
          'change_case',
        label:
          'Change review',
        item,
      }),
    ),
  ]

  const selected =
    rows.find(
      (row) =>
        row.key ===
        selectedKey,
    ) ||
    null

  const total =
    rows.length

  const restaurantRecipeCount =
    approvals.restaurantRecipes?.length ||
    0

  const recipeCount =
    approvals.productionRecipes?.length ||
    0

  const passportCount =
    approvals.dishPassports?.length ||
    0

  const changeCount =
    approvals.changeCases?.length ||
    0

  function rowTitle(
    row,
  ) {
    if (
      row.kind ===
      'restaurant_recipe'
    ) {
      return row.item.title ||
        row.item.dishName ||
        'Restaurant recipe'
    }

    if (
      row.kind ===
      'production_recipe'
    ) {
      return row.item.title ||
        row.item.recipeKey ||
        'Kitchen recipe'
    }

    if (
      row.kind ===
      'dish_passport'
    ) {
      return row.item.snapshot?.dish?.name ||
        row.item.passportKey ||
        'Dish record'
    }

    return row.item.caseKey ||
      'Hospitality change'
  }

  function rowStatus(
    row,
  ) {
    if (
      row.kind ===
      'dish_passport'
    ) {
      return `${titleize(row.item.status)} · ${titleize(row.item.verificationState)}`
    }

    return titleize(
      row.item.status,
    )
  }

  async function approveSelected() {
    if (!selected) {
      return
    }

    const cleanReason =
      reason.trim()

    if (
      selected.kind ===
      'restaurant_recipe'
    ) {
      return run(
        () =>
          reviewAdminHospitalityRestaurantRecipe(
            selected.item.id,
            {
              decision:
                'approve',
              reason:
                cleanReason,
            },
          ),
        'Restaurant Recipe approved and published. It is ready for the customer Restaurant section.',
      )
    }

    if (
      selected.kind ===
      'production_recipe'
    ) {
      return run(
        () =>
          approveAdminHospitalityProductionRecipe(
            selected.item.id,
            {
              reason:
                cleanReason,
            },
          ),
        'Kitchen recipe approved. It is now available to the Host for menus, planning and costing.',
      )
    }

    if (
      selected.kind ===
      'dish_passport'
    ) {
      return run(
        () =>
          approveAdminHospitalityDishPassport(
            selected.item.id,
            {
              reason:
                cleanReason,

              evidence:
                hospitalityApprovalEvidence(
                  cleanReason,
                ),
            },
          ),
        'Dish record approved. The Host can now publish the approved record.',
      )
    }

    return run(
      () =>
        approveAdminHospitalityChangeCase(
          selected.item.id,
          {
            reason:
              cleanReason,

            evidence:
              hospitalityApprovalEvidence(
                cleanReason,
              ),
          },
        ),
      'Hospitality change approved. The Host can now publish the approved update.',
    )
  }

  async function rejectSelected() {
    if (
      !selected ||
      selected.kind !==
        'restaurant_recipe'
    ) {
      return
    }

    const cleanReason =
      reason.trim()

    return run(
      () =>
        reviewAdminHospitalityRestaurantRecipe(
          selected.item.id,
          {
            decision:
              'reject',
            reason:
              cleanReason,
          },
        ),
      'Restaurant Recipe returned to the Host for changes.',
    )
  }

  const selectedBlocked =
    selected?.kind ===
      'change_case' &&
    selected?.item?.status ===
      'blocked'

  const migrationAudit =
    approvals.recipeMigrationAudit ||
    null

  const migrationSummary =
    migrationAudit?.summary ||
    {}

  const migrationVerification =
    migrationAudit?.verification ||
    null

  const releaseGate =
    migrationAudit?.releaseGate ||
    null

  const retirementDecision =
    releaseGate?.duplicateAuthoringRetirement ||
    null

  return (
    <div className="mt-5">
      {migrationAudit ? (
        <section className="mb-5 rounded-[24px] border border-sky-200 bg-sky-50 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-sky-700">
                Restaurant recipe migration safety
              </p>

              <h2 className="mt-2 text-lg font-black text-stone-950">
                Existing Hospitality recipes stay readable while M5 links them to the shared recipe foundation.
              </h2>

              <p className="mt-2 max-w-4xl text-xs font-semibold leading-5 text-stone-600">
                {migrationAudit.migrationRule}
              </p>
            </div>

            <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-sky-700 shadow-sm">
              Read-only audit
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [
                'Hospitality recipes',
                migrationSummary.totalProductionRecipes || 0,
              ],
              [
                'Core recipe linked',
                migrationSummary.coreLinked || 0,
              ],
              [
                'Legacy / bridge',
                (migrationSummary.legacyUnlinked || 0) +
                  (migrationSummary.legacyInternalBridge || 0),
              ],
              [
                'Broken links',
                migrationSummary.brokenLinks || 0,
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl bg-white p-4 shadow-sm"
              >
                <p className="text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">
                  {label}
                </p>

                <p className="mt-2 text-2xl font-black text-stone-950">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[11px] font-bold leading-5 text-sky-800">
            Protected operational references: {migrationSummary.totalOperationalReferences || 0}. M5-A does not delete or rewrite Menu, Production Plan, Costing or Dish Record references.
          </p>

          {migrationVerification ? (
            <p className="mt-2 text-[11px] font-bold leading-5 text-sky-800">
              M7 dry-run: {migrationVerification.writesPerformed ? 'write activity detected' : 'read-only, no writes'} · projected recipe records {migrationVerification.projectedRecordCounts?.beforeProductionRecipeRecords || 0} → {migrationVerification.projectedRecordCounts?.afterProductionRecipeRecords || 0} · ingredient parity gaps {migrationSummary.ingredientParityGaps || 0} · downstream reference gaps {migrationSummary.dependencyParityGaps || 0} · release parity {migrationVerification.releaseReady ? 'verified' : 'blocked'}
            </p>
          ) : null}

          {releaseGate && retirementDecision ? (
            <div
              className={[
                'mt-4 rounded-2xl border p-4',
                releaseGate.dataParityReady
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-amber-200 bg-amber-50',
              ].join(' ')}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-700">
                    M7 final release gate
                  </p>
                  <p className="mt-1 text-xs font-black text-stone-950">
                    {releaseGate.dataParityReady
                      ? 'Data parity verified — final regression still required before duplicate authoring can retire.'
                      : 'Release blocked — legacy Hospitality authoring must remain visible.'}
                  </p>
                </div>

                <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-stone-700 shadow-sm">
                  {retirementDecision.state === 'awaiting_final_regression'
                    ? 'Awaiting regression'
                    : 'Blocked'}
                </span>
              </div>

              <p className="mt-2 text-[11px] font-bold leading-5 text-stone-700">
                {retirementDecision.reason}
              </p>

              <p className="mt-2 text-[10px] font-bold leading-5 text-stone-600">
                Final regression command: <code>{releaseGate.fullArchitectureRegression?.command}</code>
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          [
            'Waiting for approval',
            total,
          ],
          [
            'Restaurant recipes',
            restaurantRecipeCount,
          ],
          [
            'Legacy kitchen recipes',
            recipeCount,
          ],
          [
            'Dish records',
            passportCount,
          ],
          [
            'Changes',
            changeCount,
          ],
        ].map(
          ([
            label,
            value,
          ]) => (
            <div
              key={label}
              className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-500">
                {label}
              </p>

              <p className="mt-2 text-2xl font-black text-stone-950">
                {value}
              </p>
            </div>
          ),
        )}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="rounded-[24px] border border-stone-200 bg-white p-3 shadow-sm">
          {!rows.length ? (
            <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 p-5">
              <p className="text-sm font-black text-emerald-900">
                Nothing is waiting for Super Admin approval.
              </p>

              <p className="mt-2 text-xs font-semibold leading-5 text-emerald-700">
                Host-submitted kitchen recipes, verified dish records and recalculated Hospitality changes will appear here automatically.
              </p>
            </div>
          ) : null}

          {rows.map(
            (row) => (
              <button
                key={row.key}
                type="button"
                onClick={() => {
                  setSelectedKey(
                    row.key,
                  )
                  setReason('')
                }}
                className={[
                  'focus-ring mb-2 block w-full rounded-2xl border p-4 text-left last:mb-0',
                  selectedKey ===
                  row.key
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-stone-200 hover:bg-stone-50',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-stone-900">
                      {rowTitle(
                        row,
                      )}
                    </p>

                    <p className="mt-1 text-xs font-semibold text-stone-500">
                      {row.item.organizationName ||
                        'Hospitality business'}
                    </p>

                    {row.item.hostUser ? (
                      <p className="mt-1 truncate text-[10px] font-bold text-stone-400">
                        Host: {row.item.hostUser.name || row.item.hostUser.email || 'Host owner'}
                        {row.item.hostUser.email && row.item.hostUser.name
                          ? ` · ${row.item.hostUser.email}`
                          : ''}
                      </p>
                    ) : null}
                  </div>

                  <span className="shrink-0 rounded-full bg-violet-50 px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-violet-700">
                    {row.label}
                  </span>
                </div>

                <p className="mt-2 text-[11px] font-bold text-stone-500">
                  {rowStatus(
                    row,
                  )}
                </p>
              </button>
            ),
          )}
        </section>

        <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          {selected ? (
            <div>
              <div className="flex items-center gap-2 text-emerald-700">
                <ShieldCheck
                  size={18}
                />

                <p className="text-xs font-black uppercase tracking-[0.12em]">
                  Super Admin Hospitality approval
                </p>
              </div>

              <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black text-stone-950">
                    {rowTitle(
                      selected,
                    )}
                  </h2>

                  <p className="mt-1 text-sm font-semibold text-stone-500">
                    {selected.item.organizationName ||
                      'Hospitality business'} · {selected.label}
                  </p>

                  {selected.item.hostUser ? (
                    <p className="mt-1 text-xs font-semibold text-stone-400">
                      Host owner: {selected.item.hostUser.name || 'Host'}
                      {selected.item.hostUser.email
                        ? ` · ${selected.item.hostUser.email}`
                        : ''}
                      {selected.item.hostUser.hostWorkspaceType
                        ? ` · ${titleize(selected.item.hostUser.hostWorkspaceType)}`
                        : ''}
                    </p>
                  ) : null}
                </div>

                <span className="rounded-full bg-sky-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-sky-700">
                  {rowStatus(
                    selected,
                  )}
                </span>
              </div>

              {selected.kind ===
              'restaurant_recipe' ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-stone-50 p-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">
                      Outlet
                    </p>
                    <p className="mt-1 text-sm font-black text-stone-900">
                      {selected.item.outletName || 'Outlet'}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-stone-50 p-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">
                      Base servings
                    </p>
                    <p className="mt-1 text-sm font-black text-stone-900">
                      {selected.item.baseServings || 0}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-stone-50 p-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">
                      Customer visibility
                    </p>
                    <p className="mt-1 text-sm font-black text-stone-900">
                      {selected.item.customerVisibility === 'public_candidate'
                        ? 'Customer listing after approval'
                        : 'Kitchen only'}
                    </p>
                  </div>
                </div>
              ) : null}

              {selected.kind ===
              'production_recipe' ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-stone-50 p-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">
                      Recipe code
                    </p>
                    <p className="mt-1 text-sm font-black text-stone-900">
                      {selected.item.recipeKey}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-stone-50 p-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">
                      Version
                    </p>
                    <p className="mt-1 text-sm font-black text-stone-900">
                      {selected.item.versionNumber}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-stone-50 p-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">
                      Batch portions
                    </p>
                    <p className="mt-1 text-sm font-black text-stone-900">
                      {selected.item.baseYieldPortions}
                    </p>
                  </div>
                </div>
              ) : null}

              {selected.kind ===
              'dish_passport' ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-stone-50 p-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">
                      Dish
                    </p>
                    <p className="mt-1 text-sm font-black text-stone-900">
                      {selected.item.snapshot?.dish?.name ||
                        selected.item.passportKey}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-stone-50 p-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">
                      Outlet
                    </p>
                    <p className="mt-1 text-sm font-black text-stone-900">
                      {selected.item.snapshot?.outlet?.name ||
                        selected.item.outletId?.slice(-8) ||
                        'Outlet'}
                    </p>
                  </div>
                </div>
              ) : null}

              {selected.kind ===
              'change_case' ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-stone-50 p-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">
                      Severity
                    </p>
                    <p className="mt-1 text-sm font-black text-stone-900">
                      {titleize(
                        selected.item.severity,
                      )}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-stone-50 p-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">
                      Affected outlets
                    </p>
                    <p className="mt-1 text-sm font-black text-stone-900">
                      {selected.item.impactedOutletIds?.length ||
                        0}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-stone-50 p-4 sm:col-span-2">
                    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">
                      Changed areas
                    </p>
                    <p className="mt-1 text-sm font-black text-stone-900">
                      {(selected.item.changedDomains || [])
                        .map(titleize)
                        .join(', ') ||
                        'Not specified'}
                    </p>
                  </div>
                </div>
              ) : null}

              {selectedBlocked ? (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-800">
                  This change is still blocked by a safety or verification check. The Host must resolve and recalculate it before Super Admin approval becomes available.
                </div>
              ) : (
                <>
                  <textarea
                    rows={4}
                    value={reason}
                    onChange={(event) =>
                      setReason(
                        event.target.value,
                      )
                    }
                    placeholder="Approval note for the audit history"
                    className={`${inputClass} mt-5`}
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={
                        busy ||
                        reason.trim().length <
                          10
                      }
                      onClick={approveSelected}
                      className="focus-ring inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <BadgeCheck size={15} />
                      Approve as Super Admin
                    </button>

                    {selected.kind === 'restaurant_recipe' ? (
                      <button
                        type="button"
                        disabled={
                          busy ||
                          reason.trim().length < 10
                        }
                        onClick={rejectSelected}
                        className="focus-ring inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-black text-rose-700 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Return for changes
                      </button>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-stone-200 bg-stone-50 p-6 text-center">
              <div>
                <ShieldCheck
                  size={28}
                  className="mx-auto text-stone-300"
                />
                <p className="mt-3 text-sm font-black text-stone-700">
                  Select an approval request.
                </p>
                <p className="mt-1 text-xs font-semibold leading-5 text-stone-500">
                  Hosts can submit Hospitality work, but only the real Super Admin can approve it.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default function AdminHostOperationsPage() {
  const {
    hasAdminPermission,
    isRootSuperAdmin,
  } =
    useAdmin()

  const canMarketplaceMutate =
    hasAdminPermission(
      'marketplace.mutate',
    )

  const canFinanceMutate =
    hasAdminPermission(
      'finance.mutate',
    )

  const canRecipeMutate =
    hasAdminPermission(
      'recipe.mutate',
    )

  const [
    searchParams,
    setSearchParams,
  ] =
    useSearchParams()

  const requestedTab =
    searchParams.get(
      'tab',
    )

  const requestedFocus =
    searchParams.get(
      'focus',
    ) ||
    ''

  const initialTab =
    requestedTab === 'recipes' ||
    requestedTab === 'finance' ||
    (requestedTab === 'hospitality' &&
      isRootSuperAdmin)
      ? requestedTab
      : 'kyb'

  const [
    tab,
    setTab,
  ] =
    useState(
      initialTab,
    )

  const [
    loading,
    setLoading,
  ] =
    useState(true)

  const [
    busy,
    setBusy,
  ] =
    useState(false)

  const [
    error,
    setError,
  ] =
    useState('')

  const [
    notice,
    setNotice,
  ] =
    useState('')

  const [
    kybCases,
    setKybCases,
  ] =
    useState([])

  const [
    brandRecipes,
    setBrandRecipes,
  ] =
    useState([])

  const [
    settlements,
    setSettlements,
  ] =
    useState([])

  const [
    hospitalityApprovals,
    setHospitalityApprovals,
  ] =
    useState({
      restaurantRecipes:
        [],
      productionRecipes:
        [],
      dishPassports:
        [],
      changeCases:
        [],
      recipeMigrationAudit:
        null,
    })

  const [
    selectedId,
    setSelectedId,
  ] =
    useState('')

  const [
    reason,
    setReason,
  ] =
    useState('')

  const [
    testOrderReference,
    setTestOrderReference,
  ] =
    useState('')

  const [
    settlementForm,
    setSettlementForm,
  ] =
    useState({
      organizationId:
        '',

      periodStart:
        '',

      periodEnd:
        '',
    })

  const [
    payoutReference,
    setPayoutReference,
  ] =
    useState('')

  const load =
    useCallback(
      async () => {
        setLoading(true)
        setError('')

        try {
          const [
            kybResult,
            draftKybResult,
            recipeResult,
            settlementResult,
            hospitalityResult,
          ] =
            await Promise.allSettled([
              listAdminHostKyb({
                page: 1,
                limit: 50,
              }),

              listAdminHostKyb({
                page: 1,
                limit: 50,
                status: 'draft',
              }),

              listAdminBrandRecipes({
                page: 1,
                limit: 50,
              }),

              listAdminSettlements({
                page: 1,
                limit: 50,
              }),

              isRootSuperAdmin
                ? listAdminHospitalityApprovals()
                : Promise.resolve({
                    restaurantRecipes:
                      [],
                    productionRecipes:
                      [],
                    dishPassports:
                      [],
                    changeCases:
                      [],
                  }),
            ])

          if (
            kybResult.status ===
            'fulfilled'
          ) {
            const pendingCases =
              kybResult.value?.kybCases ||
              []

            const draftCases =
              draftKybResult.status ===
              'fulfilled'
                ? draftKybResult.value?.kybCases ||
                  []
                : []

            const mergedCases =
              [
                ...pendingCases,
                ...draftCases,
              ].filter(
                (item, index, rows) =>
                  rows.findIndex(
                    (candidate) =>
                      candidate.id ===
                      item.id,
                  ) === index,
              )

            setKybCases(
              mergedCases,
            )

            if (
              draftKybResult.status ===
              'rejected'
            ) {
              setError(
                getHostOperationsErrorMessage(
                  draftKybResult.reason,
                  'Submitted KYB cases loaded, but Draft KYB cases could not be loaded.',
                ),
              )
            }
          } else {
            setKybCases([])

            setError(
              getHostOperationsErrorMessage(
                kybResult.reason,
                'Unable to load the Host KYB governance queue.',
              ),
            )
          }

          if (
            recipeResult.status ===
            'fulfilled'
          ) {
            setBrandRecipes(
              recipeResult.value?.submissions ||
                [],
            )
          }

          if (
            settlementResult.status ===
            'fulfilled'
          ) {
            setSettlements(
              settlementResult.value?.settlements ||
                [],
            )
          }


          if (
            hospitalityResult.status ===
            'fulfilled'
          ) {
            setHospitalityApprovals({
              restaurantRecipes:
                hospitalityResult.value?.restaurantRecipes ||
                [],

              productionRecipes:
                hospitalityResult.value?.productionRecipes ||
                [],

              dishPassports:
                hospitalityResult.value?.dishPassports ||
                [],

              changeCases:
                hospitalityResult.value?.changeCases ||
                [],

              recipeMigrationAudit:
                hospitalityResult.value?.recipeMigrationAudit ||
                null,
            })
          } else if (
            isRootSuperAdmin
          ) {
            setHospitalityApprovals({
              restaurantRecipes:
                [],
              productionRecipes:
                [],
              dishPassports:
                [],
              changeCases:
                [],

              recipeMigrationAudit:
                null,
            })

            setError(
              getHostOperationsErrorMessage(
                hospitalityResult.reason,
                'Unable to load the Hospitality approval queue.',
              ),
            )
          }
        } catch (loadError) {
          setError(
            getHostOperationsErrorMessage(
              loadError,
              'Unable to load Host Operations governance.',
            ),
          )
        } finally {
          setLoading(false)
        }
      },
      [
        isRootSuperAdmin,
      ],
    )

  useEffect(
    () => {
      const nextTab =
        requestedTab === 'recipes' ||
        requestedTab === 'finance' ||
        (requestedTab === 'hospitality' &&
          isRootSuperAdmin)
          ? requestedTab
          : 'kyb'

      setTab(
        nextTab,
      )
      setSelectedId('')
      setReason('')
      setNotice('')
    },
    [
      requestedTab,
      isRootSuperAdmin,
    ],
  )

  useEffect(
    () => {
      load()
    },
    [
      load,
    ],
  )

  useEffect(
    () => {
      if (
        loading ||
        tab !==
          'hospitality' ||
        !requestedFocus
      ) {
        return
      }

      const focusKeys =
        new Set([
          ...(hospitalityApprovals.restaurantRecipes || []).map(
            (item) =>
              `restaurant_recipe:${item.id}`,
          ),
          ...(hospitalityApprovals.productionRecipes || []).map(
            (item) =>
              `production_recipe:${item.id}`,
          ),
          ...(hospitalityApprovals.dishPassports || []).map(
            (item) =>
              `dish_passport:${item.id}`,
          ),
          ...(hospitalityApprovals.changeCases || []).map(
            (item) =>
              `change_case:${item.id}`,
          ),
        ])

      if (
        focusKeys.has(
          requestedFocus,
        )
      ) {
        setSelectedId(
          requestedFocus,
        )
      }
    },
    [
      loading,
      tab,
      requestedFocus,
      hospitalityApprovals,
    ],
  )

  const selected =
    useMemo(
      () => {
        const rows =
          tab ===
          'kyb'
            ? kybCases
            : tab ===
                'recipes'
              ? brandRecipes
              : tab ===
                  'finance'
                ? settlements
                : []

        return rows.find(
          (item) =>
            item.id ===
            selectedId,
        ) ||
          null
      },
      [
        tab,
        selectedId,
        kybCases,
        brandRecipes,
        settlements,
      ],
    )

  async function run(
    action,
    message,
  ) {
    setBusy(true)
    setError('')
    setNotice('')

    try {
      await action()

      setNotice(
        message,
      )

      setReason('')

      await load()
    } catch (operationError) {
      setError(
        getHostOperationsErrorMessage(
          operationError,
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminShell
      title="Host Operations & Finance"
      description="A11/A13 governance for KYB, operational activation, Brand Recipe intake and maker-checker settlement reconciliation. Seller/Brand are legacy business concepts; authorization remains Host + M03 permissions."
      actions={
        <button
          type="button"
          onClick={load}
          className="focus-ring inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black text-stone-600 shadow-sm"
        >
          <RefreshCw
            size={14}
          />

          Refresh
        </button>
      }
    >
      <div className="flex flex-wrap gap-2">
        {[
          [
            'kyb',
            'KYB / Activation',
          ],

          [
            'recipes',
            'Brand Recipes',
          ],

          ...(
            isRootSuperAdmin
              ? [
                  [
                    'hospitality',
                    `Hospitality approvals (${
                      (hospitalityApprovals.restaurantRecipes?.length || 0) +
                      (hospitalityApprovals.productionRecipes?.length || 0) +
                      (hospitalityApprovals.dishPassports?.length || 0) +
                      (hospitalityApprovals.changeCases?.length || 0)
                    })`,
                  ],
                ]
              : []
          ),

          [
            'finance',
            'Finance / Settlements',
          ],
        ].map(
          ([
            value,
            label,
          ]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setTab(
                  value,
                )

                setSearchParams(
                  value === 'kyb'
                    ? {}
                    : {
                        tab:
                          value,
                      },
                )

                setSelectedId('')
                setReason('')
                setNotice('')
              }}
              className={[
                'focus-ring rounded-full px-4 py-2 text-xs font-black',

                tab ===
                value
                  ? 'bg-emerald-700 text-white'
                  : 'bg-white text-stone-600',
              ].join(' ')}
            >
              {label}
            </button>
          ),
        )}
      </div>

      {error ? (
        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
          <CircleAlert
            size={17}
            className="mt-0.5"
          />

          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          {notice}
        </div>
      ) : null}

      {loading ? (
        <div className="grid min-h-72 place-items-center">
          <LoaderCircle className="animate-spin text-emerald-700" />
        </div>
      ) : tab ===
        'hospitality' ? (
        <HospitalityApprovalWorkspace
          approvals={hospitalityApprovals}
          selectedKey={selectedId}
          setSelectedKey={setSelectedId}
          reason={reason}
          setReason={setReason}
          busy={busy}
          run={run}
        />
      ) : (
        <div className="mt-5 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <section className="rounded-[24px] border border-stone-200 bg-white p-3 shadow-sm">
            {tab === 'kyb' && !kybCases.length ? (
              <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 p-4">
                <p className="text-sm font-black text-stone-800">
                  No KYB cases exist for governance yet.
                </p>

                <p className="mt-2 text-xs font-semibold leading-5 text-stone-500">
                  Draft and submitted KYB cases are both shown here. Create or save KYB on the Host side first, then refresh this page.
                </p>
              </div>
            ) : null}

            {(tab ===
            'kyb'
              ? kybCases
              : tab ===
                  'recipes'
                ? brandRecipes
                : settlements
            ).map(
              (item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(
                      item.id,
                    )

                    setReason('')

                    if (
                      tab ===
                      'finance'
                    ) {
                      setSettlementForm(
                        (current) => ({
                          ...current,

                          organizationId:
                            item.organizationId ||
                            current.organizationId,
                        }),
                      )
                    }
                  }}
                  className={[
                    'focus-ring mb-2 block w-full rounded-2xl border p-4 text-left last:mb-0',

                    selectedId ===
                    item.id
                      ? 'border-emerald-300 bg-emerald-50'
                      : 'border-stone-200 hover:bg-stone-50',
                  ].join(' ')}
                >
                  <p className="text-sm font-black text-stone-900">
                    {tab ===
                    'kyb'
                      ? item.legalEntityName
                      : tab ===
                          'recipes'
                        ? `RecipeVersion ${item.recipeVersionId?.slice(-8)}`
                        : `Settlement ${item.id?.slice(-8)}`}
                  </p>

                  <p className="mt-1 text-xs font-semibold text-stone-500">
                    {tab ===
                    'kyb'
                      ? `KYB ${titleize(item.status)} · Activation ${titleize(item.activationState)} · Org ${item.organizationId?.slice(-8)}`
                      : `${titleize(item.status)} · Org ${item.organizationId?.slice(-8)}`}
                  </p>
                </button>
              ),
            )}
          </section>

          <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
            {tab ===
            'kyb' ? (
              selected ? (
                <div>
                  <div className="flex items-center gap-2 text-emerald-700">
                    <Building2
                      size={18}
                    />

                    <p className="text-xs font-black uppercase tracking-[0.12em]">
                      A11 Seller / KYB Governance
                    </p>
                  </div>

                  <h2 className="mt-3 text-2xl font-black">
                    {selected.legalEntityName}
                  </h2>

                  <p className="mt-2 text-sm text-stone-500">
                    {selected.businessType} · {selected.jurisdictionCountryCode} · Tax {selected.taxRegistration?.registrationType} ending {selected.taxRegistration?.last4 || '—'}
                  </p>

                  {selected.status ===
                  'draft' ? (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                      This KYB is still a Host draft. It is visible here for troubleshooting, but governance decisions remain disabled until the Host submits it.
                    </div>
                  ) : null}

                  <textarea
                    rows={4}
                    value={reason}
                    onChange={(event) =>
                      setReason(
                        event.target.value,
                      )
                    }
                    placeholder="Governance reason"
                    className={`${inputClass} mt-5`}
                  />

                  {canMarketplaceMutate &&
                  [
                    'submitted',
                    'needs_information',
                  ].includes(
                    selected.status,
                  ) ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        disabled={
                          busy ||
                          reason.length <
                            3
                        }
                        onClick={() =>
                          run(
                            () =>
                              decideAdminHostKyb(
                                selected.id,
                                {
                                  decision:
                                    'approved',

                                  reason,
                                },
                              ),
                            'KYB approved. Operational activation still requires separate readiness/test-order review.',
                          )
                        }
                        className="focus-ring rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white"
                      >
                        Approve KYB
                      </button>

                      <button
                        disabled={
                          busy ||
                          reason.length <
                            3
                        }
                        onClick={() =>
                          run(
                            () =>
                              decideAdminHostKyb(
                                selected.id,
                                {
                                  decision:
                                    'needs_information',

                                  reason,
                                },
                              ),
                            'Additional KYB evidence requested.',
                          )
                        }
                        className="focus-ring rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-black text-amber-800"
                      >
                        Need information
                      </button>
                    </div>
                  ) : null}

                  <div className="mt-6 border-t border-stone-200 pt-5">
                    <p className="text-xs font-black uppercase text-stone-500">
                      Operational activation
                    </p>

                    <p className="mt-2 text-sm font-semibold text-stone-600">
                      KYB {titleize(selected.status)} · Operational state {titleize(selected.activationState)}
                    </p>

                    {selected.activationReview?.requestedAt ? (
                      <p className="mt-1 text-xs font-semibold text-stone-500">
                        Activation review requested. {selected.activationReview?.reason || ''}
                      </p>
                    ) : null}

                    <input
                      value={testOrderReference}
                      onChange={(event) =>
                        setTestOrderReference(
                          event.target.value,
                        )
                      }
                      placeholder="Admin-verified test order reference"
                      className={`${inputClass} mt-2`}
                    />

                    {canMarketplaceMutate &&
                    selected.status ===
                      'approved' &&
                    selected.activationState ===
                      'pending_review' ? (
                      <button
                        disabled={
                          busy ||
                          reason.length <
                            3 ||
                          !testOrderReference
                        }
                        onClick={() =>
                          run(
                            () =>
                              decideAdminHostActivation(
                                selected.organizationId,
                                {
                                  decision:
                                    'activate',

                                  reason,

                                  testOrderReference,
                                },
                              ),
                            'Organization operationally activated.',
                          )
                        }
                        className="focus-ring mt-3 inline-flex items-center gap-2 rounded-xl bg-stone-950 px-4 py-2.5 text-xs font-black text-white"
                      >
                        <ShieldCheck
                          size={14}
                        />

                        Activate after readiness
                      </button>
                    ) : selected.activationState ===
                      'active' ? (
                      <p className="mt-3 text-sm font-black text-emerald-700">
                        Organization is operationally active.
                      </p>
                    ) : selected.status !==
                      'approved' ? (
                      <p className="mt-3 text-xs font-semibold text-amber-700">
                        KYB approval is required before operational activation.
                      </p>
                    ) : (
                      <p className="mt-3 text-xs font-semibold text-stone-500">
                        The Host must request go-live review before activation.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm font-semibold text-stone-400">
                  Select a KYB case.
                </p>
              )
            ) : tab ===
              'recipes' ? (
              selected ? (
                <div>
                  <div className="flex items-center gap-2 text-emerald-700">
                    <BadgeCheck
                      size={18}
                    />

                    <p className="text-xs font-black uppercase tracking-[0.12em]">
                      Brand Recipe intake
                    </p>
                  </div>

                  <h2 className="mt-3 text-2xl font-black">
                    RecipeVersion {selected.recipeVersionId?.slice(-8)}
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-stone-500">
                    Nomination disclosure: {selected.nominationDisclosure}
                  </p>

                  <textarea
                    rows={4}
                    value={reason}
                    onChange={(event) =>
                      setReason(
                        event.target.value,
                      )
                    }
                    placeholder="Review reason"
                    className={`${inputClass} mt-5`}
                  />

                  {canRecipeMutate ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        disabled={
                          busy ||
                          reason.length <
                            3
                        }
                        onClick={() =>
                          run(
                            () =>
                              reviewAdminBrandRecipe(
                                selected.id,
                                {
                                  decision:
                                    'accept_for_governance',

                                  reason,
                                },
                              ),
                            'Brand Recipe accepted into existing M07/M08 governance; not published by M16.',
                          )
                        }
                        className="focus-ring rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white"
                      >
                        Accept for governance
                      </button>

                      <button
                        disabled={
                          busy ||
                          reason.length <
                            3
                        }
                        onClick={() =>
                          run(
                            () =>
                              reviewAdminBrandRecipe(
                                selected.id,
                                {
                                  decision:
                                    'request_changes',

                                  reason,
                                },
                              ),
                            'Brand Recipe changes requested.',
                          )
                        }
                        className="focus-ring rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-black text-amber-800"
                      >
                        Request changes
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm font-semibold text-stone-400">
                  Select a Brand Recipe submission.
                </p>
              )
            ) : (
              <div>
                <div className="flex items-center gap-2 text-emerald-700">
                  <WalletCards
                    size={18}
                  />

                  <p className="text-xs font-black uppercase tracking-[0.12em]">
                    A13 Finance / Settlement Ops
                  </p>
                </div>

                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold leading-5 text-amber-900">
                  Settlement creation is a reconciliation proposal over paid + delivered M11 SellerOrders. Maker and checker must be different Finance Admin identities. No provider payout is executed automatically.
                </div>

                {canFinanceMutate ? (
                  <form
                    className="mt-5 grid gap-3 sm:grid-cols-2"
                    onSubmit={(event) => {
                      event.preventDefault()

                      run(
                        () =>
                          createAdminSettlement({
                            organizationId:
                              settlementForm.organizationId,

                            periodStart:
                              new Date(
                                settlementForm.periodStart,
                              ).toISOString(),

                            periodEnd:
                              new Date(
                                settlementForm.periodEnd,
                              ).toISOString(),

                            reason:
                              reason ||
                              'Periodic settlement reconciliation.',
                          }),
                        'Settlement proposal created for maker-checker approval.',
                      )
                    }}
                  >
                    <input
                      required
                      className={inputClass}
                      placeholder="Organization ID"
                      value={settlementForm.organizationId}
                      onChange={(event) =>
                        setSettlementForm(
                          (current) => ({
                            ...current,

                            organizationId:
                              event.target.value,
                          }),
                        )
                      }
                    />

                    <input
                      required
                      type="date"
                      className={inputClass}
                      value={settlementForm.periodStart}
                      onChange={(event) =>
                        setSettlementForm(
                          (current) => ({
                            ...current,

                            periodStart:
                              event.target.value,
                          }),
                        )
                      }
                    />

                    <input
                      required
                      type="date"
                      className={inputClass}
                      value={settlementForm.periodEnd}
                      onChange={(event) =>
                        setSettlementForm(
                          (current) => ({
                            ...current,

                            periodEnd:
                              event.target.value,
                          }),
                        )
                      }
                    />

                    <textarea
                      rows={2}
                      className={inputClass}
                      placeholder="Reason"
                      value={reason}
                      onChange={(event) =>
                        setReason(
                          event.target.value,
                        )
                      }
                    />

                    <button
                      disabled={busy}
                      className="focus-ring sm:col-span-2 rounded-xl bg-stone-950 px-4 py-2.5 text-xs font-black text-white"
                    >
                      Create settlement proposal
                    </button>
                  </form>
                ) : null}

                {selected ? (
                  <div className="mt-6 border-t border-stone-200 pt-5">
                    <h3 className="text-lg font-black">
                      Settlement {selected.id?.slice(-8)}
                    </h3>

                    <p className="mt-1 text-sm text-stone-500">
                      {titleize(selected.status)} · {selected.lineCount} lines · {money(selected.totals?.netPayableMinor, selected.currency)}
                    </p>

                    {selected.status ===
                      'pending_approval' &&
                    canFinanceMutate ? (
                      <div className="mt-4 flex gap-2">
                        <button
                          disabled={
                            busy ||
                            reason.length <
                              3
                          }
                          onClick={() =>
                            run(
                              () =>
                                decideAdminSettlement(
                                  selected.id,
                                  {
                                    decision:
                                      'approve',

                                    reason,
                                  },
                                ),
                              'Settlement approved by checker.',
                            )
                          }
                          className="focus-ring rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white"
                        >
                          Approve as checker
                        </button>

                        <button
                          disabled={
                            busy ||
                            reason.length <
                              3
                          }
                          onClick={() =>
                            run(
                              () =>
                                decideAdminSettlement(
                                  selected.id,
                                  {
                                    decision:
                                      'reject',

                                    reason,
                                  },
                                ),
                              'Settlement rejected by checker.',
                            )
                          }
                          className="focus-ring rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-black text-red-700"
                        >
                          Reject
                        </button>
                      </div>
                    ) : null}

                    {selected.status ===
                      'approved' &&
                    canFinanceMutate ? (
                      <div className="mt-4">
                        <input
                          className={inputClass}
                          value={payoutReference}
                          onChange={(event) =>
                            setPayoutReference(
                              event.target.value,
                            )
                          }
                          placeholder="External payout reference"
                        />

                        <button
                          disabled={
                            busy ||
                            !payoutReference ||
                            reason.length <
                              3
                          }
                          onClick={() =>
                            run(
                              () =>
                                markAdminSettlementPaid(
                                  selected.id,
                                  {
                                    payoutReference,

                                    reason,
                                  },
                                ),
                              'Settlement marked paid after external payout reconciliation.',
                            )
                          }
                          className="focus-ring mt-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white"
                        >
                          Mark paid
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>
      )}
    </AdminShell>
  )
}