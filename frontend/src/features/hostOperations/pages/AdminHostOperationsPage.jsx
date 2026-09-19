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

import AdminShell from '../../admin/components/AdminShell'
import { useAdmin } from '../../admin/context/AdminContext'

import {
  createAdminSettlement,
  decideAdminHostActivation,
  decideAdminHostKyb,
  decideAdminSettlement,
  getHostOperationsErrorMessage,
  listAdminBrandRecipes,
  listAdminHostKyb,
  listAdminSettlements,
  markAdminSettlementPaid,
  reviewAdminBrandRecipe,
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

export default function AdminHostOperationsPage() {
  const {
    hasAdminPermission,
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
    tab,
    setTab,
  ] =
    useState(
      'kyb',
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
      [],
    )

  useEffect(
    () => {
      load()
    },
    [
      load,
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
              : settlements

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