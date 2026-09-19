import {
  BadgeCheck,
  FileWarning,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import AdminShell from '../components/AdminShell'

import {
  useAdmin,
} from '../context/AdminContext'

import {
  approveAdminBrandClaim,
  changeAdminBrandAuthorityLifecycle,
  getAdminBrandClaim,
  listAdminBrandAuthorities,
  listAdminBrandClaims,
  listAdminBrandConflicts,
  listAdminBrandOverrides,
  rejectAdminBrandClaim,
  resolveAdminBrandConflict,
  reviewAdminBrandIdentityCheck,
  reviewAdminBrandOverride,
} from '../../brands/services/brandAuthority.service'

const AUTHORITY_SCOPES = [
  'official_content',
  'regulated_facts',
  'claims_certifications',
  'packaging_media',
  'brand_recipes',
]

function getErrorMessage(
  error,
) {
  return (
    error?.response
      ?.data
      ?.message ||
    error?.message ||
    'Unable to complete Brand governance action.'
  )
}

function StatusPill({
  value,
}) {
  return (
    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-stone-600">
      {
        String(
          value ||
            'unknown',
        ).replaceAll(
          '_',
          ' ',
        )
      }
    </span>
  )
}

export default function AdminBrandAuthorityPage() {
  const {
    hasAdminPermission,
  } =
    useAdmin()

  const canVerify =
    hasAdminPermission(
      'trust_safety.mutate',
    )

  const canCatalogMutate =
    hasAdminPermission(
      'catalog.mutate',
    )

  const canReviewContent =
    canVerify ||
    canCatalogMutate

  const [
    claims,
    setClaims,
  ] =
    useState([])

  const [
    authorities,
    setAuthorities,
  ] =
    useState([])

  const [
    proposals,
    setProposals,
  ] =
    useState([])

  const [
    conflicts,
    setConflicts,
  ] =
    useState([])

  const [
    selectedClaim,
    setSelectedClaim,
  ] =
    useState(null)

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
    useState(null)

  const [
    success,
    setSuccess,
  ] =
    useState(null)

  const [
    reason,
    setReason,
  ] =
    useState(
      'Reviewed against submitted Brand authority evidence.',
    )

  const [
    marketCodes,
    setMarketCodes,
  ] =
    useState('IN')

  const [
    selectedScopes,
    setSelectedScopes,
  ] =
    useState([
      'official_content',
    ])

  const loadAll =
    useCallback(
      async () => {
        setLoading(
          true,
        )

        setError(
          null,
        )

        try {
          const [
            claimResult,
            authorityResult,
            proposalResult,
            conflictResult,
          ] =
            await Promise.all([
              listAdminBrandClaims({
                status:
                  'all',

                limit:
                  100,
              }),

              listAdminBrandAuthorities({
                status:
                  'all',

                limit:
                  100,
              }),

              listAdminBrandOverrides({
                status:
                  'all',

                limit:
                  100,
              }),

              listAdminBrandConflicts({
                status:
                  'all',

                severity:
                  'all',

                limit:
                  100,
              }),
            ])

          setClaims(
            claimResult?.claims ||
            [],
          )

          setAuthorities(
            authorityResult
              ?.authorities ||
            [],
          )

          setProposals(
            proposalResult
              ?.proposals ||
            [],
          )

          setConflicts(
            conflictResult
              ?.conflicts ||
            [],
          )
        } catch (requestError) {
          setError(
            getErrorMessage(
              requestError,
            ),
          )
        } finally {
          setLoading(
            false,
          )
        }
      },
      [],
    )

  useEffect(
    () => {
      loadAll()
    },
    [
      loadAll,
    ],
  )

  async function execute(
    operation,
    message,
  ) {
    if (busy) {
      return
    }

    setBusy(
      true,
    )

    setError(
      null,
    )

    setSuccess(
      null,
    )

    try {
      await operation()

      setSuccess(
        message,
      )

      await loadAll()

      if (
        selectedClaim?.claim
          ?.id
      ) {
        const refreshed =
          await getAdminBrandClaim(
            selectedClaim.claim.id,
          )

        setSelectedClaim(
          refreshed,
        )
      }
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
        ),
      )
    } finally {
      setBusy(
        false,
      )
    }
  }

  async function openClaim(
    claimId,
  ) {
    setBusy(
      true,
    )

    setError(
      null,
    )

    try {
      const result =
        await getAdminBrandClaim(
          claimId,
        )

      setSelectedClaim(
        result,
      )

      setMarketCodes(
        result?.claim
          ?.requestedMarketCodes
          ?.join(
            ', ',
          ) ||
        'IN',
      )
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
        ),
      )
    } finally {
      setBusy(
        false,
      )
    }
  }

  function toggleScope(
    scope,
  ) {
    setSelectedScopes(
      (
        current,
      ) =>
        current.includes(
          scope,
        )
          ? current.filter(
              (
                item,
              ) =>
                item !==
                scope,
            )
          : [
              ...current,
              scope,
            ],
    )
  }

  return (
    <AdminShell
      title="Brand Authority"
      description="Verify Brand claims, review governed content proposals and resolve Brand evidence conflicts."
      actions={
        <button
          type="button"
          onClick={
            loadAll
          }
          className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-full bg-stone-950 px-4 text-xs font-black text-white"
        >
          <RefreshCw
            size={14}
            aria-hidden="true"
          />

          Refresh
        </button>
      }
    >

      {error && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          {success}
        </div>
      )}


      {loading ? (
        <div className="h-[520px] animate-pulse rounded-[26px] border border-stone-200 bg-white" />
      ) : (
        <div className="space-y-6">

          <section className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm">

            <div className="flex items-center gap-3">

              <BadgeCheck
                size={20}
                className="text-emerald-700"
                aria-hidden="true"
              />

              <div>

                <h2 className="font-black text-stone-950">
                  Brand Claim Review
                </h2>

                <p className="text-xs text-stone-400">
                  Authority verification requires Trust & Safety mutation permission.
                </p>

              </div>

            </div>


            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">

              <div className="space-y-3">

                {claims.length >
                0 ? (
                  claims.map(
                    (
                      claim,
                    ) => (
                      <button
                        key={
                          claim.id
                        }
                        type="button"
                        onClick={() =>
                          openClaim(
                            claim.id,
                          )
                        }
                        className="focus-ring w-full rounded-2xl border border-stone-200 p-4 text-left transition hover:border-emerald-300"
                      >

                        <div className="flex items-center justify-between gap-3">

                          <p className="text-sm font-black text-stone-950">
                            {
                              claim.claimType
                            }
                          </p>

                          <StatusPill
                            value={
                              claim.status
                            }
                          />

                        </div>

                        <p className="mt-2 break-all text-xs text-stone-400">
                          Brand: {
                            claim.brandId
                          }
                        </p>

                      </button>
                    ),
                  )
                ) : (
                  <p className="text-sm text-stone-400">
                    No Brand Claims.
                  </p>
                )}

              </div>


              <div className="rounded-2xl bg-[#f7f5ef] p-4">

                {!selectedClaim ? (
                  <p className="text-sm text-stone-500">
                    Select a Brand Claim to review its evidence.
                  </p>
                ) : (
                  <>

                    <div className="flex items-center justify-between gap-3">

                      <div>

                        <p className="text-sm font-black text-stone-950">
                          {
                            selectedClaim.claim
                              ?.claimType
                          } claim
                        </p>

                        <p className="mt-1 break-all text-xs text-stone-400">
                          {
                            selectedClaim.claim
                              ?.brandId
                          }
                        </p>

                      </div>

                      <StatusPill
                        value={
                          selectedClaim.claim
                            ?.status
                        }
                      />

                    </div>


                    <div className="mt-4 space-y-3">

                      {selectedClaim
                        .evidenceChecks
                        ?.map(
                          (
                            check,
                          ) => (
                            <div
                              key={
                                check.id
                              }
                              className="rounded-xl border border-stone-200 bg-white p-3"
                            >

                              <div className="flex items-center justify-between gap-2">

                                <p className="text-xs font-black text-stone-800">
                                  {
                                    check.checkType
                                  }
                                </p>

                                <StatusPill
                                  value={
                                    check.status
                                  }
                                />

                              </div>

                              <p className="mt-2 break-all text-xs text-stone-400">
                                {
                                  check.evidenceReference
                                }
                              </p>


                              {canVerify && (
                                <div className="mt-3 flex flex-wrap gap-2">

                                  {[
                                    'verified',
                                    'rejected',
                                    'conflict',
                                  ].map(
                                    (
                                      decision,
                                    ) => (
                                      <button
                                        key={
                                          decision
                                        }
                                        type="button"
                                        disabled={
                                          busy
                                        }
                                        onClick={() =>
                                          execute(
                                            () =>
                                              reviewAdminBrandIdentityCheck(
                                                check.id,
                                                {
                                                  decision,

                                                  reason,
                                                },
                                              ),
                                            `Evidence marked ${decision}.`,
                                          )
                                        }
                                        className="focus-ring rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase text-stone-600 disabled:opacity-50"
                                      >
                                        {decision}
                                      </button>
                                    ),
                                  )}

                                </div>
                              )}

                            </div>
                          ),
                        )}

                    </div>


                    <textarea
                      value={
                        reason
                      }
                      onChange={(
                        event,
                      ) =>
                        setReason(
                          event.target.value,
                        )
                      }
                      rows={3}
                      className="focus-ring mt-4 w-full rounded-xl border border-stone-200 bg-white p-3 text-sm"
                      placeholder="Controlled review reason"
                    />


                    {canVerify && (
                      <>

                        <input
                          value={
                            marketCodes
                          }
                          onChange={(
                            event,
                          ) =>
                            setMarketCodes(
                              event.target.value,
                            )
                          }
                          className="focus-ring mt-3 h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm"
                          placeholder="Granted markets"
                        />


                        <div className="mt-3 flex flex-wrap gap-2">

                          {AUTHORITY_SCOPES.map(
                            (
                              scope,
                            ) => (
                              <label
                                key={
                                  scope
                                }
                                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-600"
                              >
                                <input
                                  type="checkbox"
                                  checked={
                                    selectedScopes.includes(
                                      scope,
                                    )
                                  }
                                  onChange={() =>
                                    toggleScope(
                                      scope,
                                    )
                                  }
                                />

                                {
                                  scope.replaceAll(
                                    '_',
                                    ' ',
                                  )
                                }
                              </label>
                            ),
                          )}

                        </div>


                        <div className="mt-4 flex flex-wrap gap-2">

                          <button
                            type="button"
                            disabled={
                              busy ||
                              selectedScopes.length ===
                                0
                            }
                            onClick={() =>
                              execute(
                                () =>
                                  approveAdminBrandClaim(
                                    selectedClaim.claim.id,
                                    {
                                      marketCodes:
                                        marketCodes
                                          .split(
                                            ',',
                                          )
                                          .map(
                                            (
                                              item,
                                            ) =>
                                              item.trim(),
                                          )
                                          .filter(
                                            Boolean,
                                          ),

                                      scopes:
                                        selectedScopes,

                                      reason,
                                    },
                                  ),
                                'Brand Authority granted.',
                              )
                            }
                            className="focus-ring rounded-full bg-emerald-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                          >
                            Approve Claim
                          </button>

                          <button
                            type="button"
                            disabled={
                              busy
                            }
                            onClick={() =>
                              execute(
                                () =>
                                  rejectAdminBrandClaim(
                                    selectedClaim.claim.id,
                                    {
                                      reason,
                                    },
                                  ),
                                'Brand Claim rejected.',
                              )
                            }
                            className="focus-ring rounded-full bg-red-50 px-4 py-2 text-xs font-black text-red-700 disabled:opacity-50"
                          >
                            Reject Claim
                          </button>

                        </div>

                      </>
                    )}

                  </>
                )}

              </div>

            </div>

          </section>


          <section className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm">

            <div className="flex items-center gap-3">

              <ShieldAlert
                size={20}
                className="text-amber-600"
                aria-hidden="true"
              />

              <div>

                <h2 className="font-black text-stone-950">
                  Content Override Review
                </h2>

                <p className="text-xs text-stone-400">
                  Critical regulated/safety fields require Trust & Safety authority and maker-checker separation.
                </p>

              </div>

            </div>


            <div className="mt-5 space-y-3">

              {proposals.length >
              0 ? (
                proposals.map(
                  (
                    proposal,
                  ) => (
                    <div
                      key={
                        proposal.id
                      }
                      className="rounded-2xl border border-stone-200 p-4"
                    >

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                        <div>

                          <p className="font-black text-stone-950">
                            {
                              proposal.fieldChanges
                                ?.map(
                                  (
                                    change,
                                  ) =>
                                    change.fieldKey,
                                )
                                .join(
                                  ', ',
                                ) ||
                              'Brand content proposal'
                            }
                          </p>

                          <p className="mt-1 break-all text-xs text-stone-400">
                            Pack: {
                              proposal.packId
                            }
                          </p>

                        </div>

                        <StatusPill
                          value={
                            proposal.status
                          }
                        />

                      </div>


                      {canReviewContent &&
                        [
                          'submitted',
                          'in_review',
                        ].includes(
                          proposal.status,
                        ) && (
                        <div className="mt-4 flex flex-wrap gap-2">

                          {[
                            'approve',
                            'reject',
                            'conflict',
                          ].map(
                            (
                              decision,
                            ) => (
                              <button
                                key={
                                  decision
                                }
                                type="button"
                                disabled={
                                  busy
                                }
                                onClick={() =>
                                  execute(
                                    () =>
                                      reviewAdminBrandOverride(
                                        proposal.id,
                                        {
                                          decision,

                                          reason,
                                        },
                                      ),
                                    `Brand override ${decision} decision recorded.`,
                                  )
                                }
                                className="focus-ring rounded-full border border-stone-200 px-3.5 py-2 text-xs font-black text-stone-700 disabled:opacity-50"
                              >
                                {decision}
                              </button>
                            ),
                          )}

                        </div>
                      )}

                    </div>
                  ),
                )
              ) : (
                <p className="text-sm text-stone-400">
                  No content override proposals.
                </p>
              )}

            </div>

          </section>


          <section className="grid gap-5 xl:grid-cols-2">

            <div className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm">

              <div className="flex items-center gap-3">

                <FileWarning
                  size={20}
                  className="text-red-600"
                  aria-hidden="true"
                />

                <h2 className="font-black text-stone-950">
                  Conflict Queue
                </h2>

              </div>


              <div className="mt-4 space-y-3">

                {conflicts.length >
                0 ? (
                  conflicts.map(
                    (
                      conflict,
                    ) => (
                      <div
                        key={
                          conflict.id
                        }
                        className="rounded-2xl border border-stone-200 p-4"
                      >

                        <div className="flex items-center justify-between gap-3">

                          <p className="text-sm font-black text-stone-950">
                            {
                              conflict.severity
                            }
                          </p>

                          <StatusPill
                            value={
                              conflict.status
                            }
                          />

                        </div>

                        <p className="mt-2 text-xs leading-5 text-stone-500">
                          {
                            conflict.openedReason
                          }
                        </p>


                        {canVerify &&
                          [
                            'open',
                            'in_review',
                          ].includes(
                            conflict.status,
                          ) && (
                          <div className="mt-3 flex flex-wrap gap-2">

                            {conflict.proposalIds
                              ?.[0] && (
                              <button
                                type="button"
                                disabled={
                                  busy
                                }
                                onClick={() =>
                                  execute(
                                    () =>
                                      resolveAdminBrandConflict(
                                        conflict.id,
                                        {
                                          resolution:
                                            'approve_proposal',

                                          selectedProposalId:
                                            conflict.proposalIds[0],

                                          reason,
                                        },
                                      ),
                                    'Conflict resolved with selected proposal.',
                                  )
                                }
                                className="focus-ring rounded-full bg-emerald-700 px-3.5 py-2 text-xs font-black text-white disabled:opacity-50"
                              >
                                Approve proposal
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={
                                busy
                              }
                              onClick={() =>
                                execute(
                                  () =>
                                    resolveAdminBrandConflict(
                                      conflict.id,
                                      {
                                        resolution:
                                          'quarantine',

                                        reason,
                                      },
                                    ),
                                  'Conflict quarantined.',
                                )
                              }
                              className="focus-ring rounded-full bg-red-50 px-3.5 py-2 text-xs font-black text-red-700 disabled:opacity-50"
                            >
                              Quarantine
                            </button>

                          </div>
                        )}

                      </div>
                    ),
                  )
                ) : (
                  <p className="text-sm text-stone-400">
                    No open Brand conflicts.
                  </p>
                )}

              </div>

            </div>


            <div className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm">

              <h2 className="font-black text-stone-950">
                Authority Lifecycle
              </h2>

              <div className="mt-4 space-y-3">

                {authorities.length >
                0 ? (
                  authorities.map(
                    (
                      authority,
                    ) => (
                      <div
                        key={
                          authority.id
                        }
                        className="rounded-2xl border border-stone-200 p-4"
                      >

                        <div className="flex items-center justify-between gap-3">

                          <p className="text-sm font-black text-stone-950">
                            {
                              authority.authorityType
                            }
                          </p>

                          <StatusPill
                            value={
                              authority.status
                            }
                          />

                        </div>

                        <p className="mt-2 break-all text-xs text-stone-400">
                          Brand: {
                            authority.brandId
                          }
                        </p>


                        {canVerify &&
                          authority.status ===
                            'active' && (
                          <div className="mt-3 flex flex-wrap gap-2">

                            {[
                              'suspend',
                              'revoke',
                            ].map(
                              (
                                action,
                              ) => (
                                <button
                                  key={
                                    action
                                  }
                                  type="button"
                                  disabled={
                                    busy
                                  }
                                  onClick={() =>
                                    execute(
                                      () =>
                                        changeAdminBrandAuthorityLifecycle(
                                          authority.id,
                                          {
                                            action,

                                            reason,
                                          },
                                        ),
                                      `Authority ${action} action completed.`,
                                    )
                                  }
                                  className="focus-ring rounded-full border border-stone-200 px-3.5 py-2 text-xs font-black text-stone-700 disabled:opacity-50"
                                >
                                  {action}
                                </button>
                              ),
                            )}

                          </div>
                        )}

                      </div>
                    ),
                  )
                ) : (
                  <p className="text-sm text-stone-400">
                    No Brand Authorities.
                  </p>
                )}

              </div>

            </div>

          </section>


          {busy && (
            <div className="fixed bottom-5 right-5 inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2 text-xs font-black text-white shadow-xl">

              <LoaderCircle
                size={14}
                className="animate-spin"
                aria-hidden="true"
              />

              Processing

            </div>
          )}

        </div>
      )}

    </AdminShell>
  )
}