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
    'Something went wrong while updating this brand review.'
  )
}

function StatusPill({
  value,
}) {
  return (
    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.06em] text-stone-600 sm:px-2.5 sm:py-1 sm:text-[10px] sm:tracking-[0.08em]">
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


const SCOPE_LABELS = {
  official_content: 'Official brand content',
  regulated_facts: 'Regulated product facts',
  claims_certifications: 'Claims & certifications',
  packaging_media: 'Packaging & images',
  brand_recipes: 'Brand recipes',
}

const DECISION_LABELS = {
  verified: 'Looks verified',
  rejected: 'Reject evidence',
  conflict: 'Flag a conflict',
  approve: 'Approve change',
  reject: 'Reject change',
  suspend: 'Pause access',
  revoke: 'Remove access',
}

function humanize(value) {
  if (!value) {
    return 'Not provided'
  }

  return String(value)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
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
      'Reviewed against the submitted brand evidence.',
    )

  const [
    marketCodes,
    setMarketCodes,
  ] =
    useState(
      'IN',
    )

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
            authorityResult?.authorities ||
              [],
          )

          setProposals(
            proposalResult?.proposals ||
              [],
          )

          setConflicts(
            conflictResult?.conflicts ||
              [],
          )
        } catch (
          requestError
        ) {
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
    if (
      busy
    ) {
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
        selectedClaim
          ?.claim
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
    } catch (
      requestError
    ) {
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
    } catch (
      requestError
    ) {
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
      title="Brand Review & Access"
      description="Review brand ownership requests, approve important content changes, resolve conflicts, and manage active brand access."
      actions={
        <button
          type="button"
          onClick={loadAll}
          className="focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-full bg-stone-950 px-3 text-xs font-bold text-white sm:min-h-10 sm:gap-2 sm:px-4 sm:text-sm"
        >
          <RefreshCw
            size={15}
            aria-hidden="true"
          />
          Refresh
        </button>
      }
    >
      <div className="min-h-[100svh] bg-[#F5F4EF] px-2 py-2 sm:px-5 sm:py-6">
        {error && (
          <div className="mb-2 border-l-4 border-red-500 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 sm:mb-4 sm:px-4 sm:py-3 sm:text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-2 border-l-4 border-emerald-600 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 sm:mb-4 sm:px-4 sm:py-3 sm:text-sm">
            {success}
          </div>
        )}

        {loading ? (
          <div className="min-h-[calc(100svh-12rem)] animate-pulse bg-white/70" />
        ) : (
          <div className="space-y-2.5 sm:space-y-6">
            <section className="overflow-hidden bg-[#0F513F] text-white">
              <div className="grid gap-3 px-4 py-4 sm:gap-5 sm:px-7 sm:py-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)] lg:items-end">
                <div className="max-w-3xl">
                  <p className="text-[10px] font-bold tracking-[0.08em] text-emerald-200 sm:text-xs sm:tracking-[0.12em]">
                    Brand review workspace
                  </p>
                  <h2 className="mt-1.5 max-w-2xl text-xl font-bold leading-tight sm:mt-2 sm:text-3xl">
                    Keep brand ownership, content and access decisions in one clear place.
                  </h2>
                  <p className="mt-2 max-w-2xl text-xs leading-5 text-emerald-50/85 sm:mt-3 sm:text-base sm:leading-6">
                    Start with ownership requests, check proposed brand changes, resolve any conflicts, then review who still has active brand access.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-px overflow-hidden bg-white/20 sm:grid-cols-4 lg:grid-cols-2">
                  {[
                    ['Ownership requests', claims.length],
                    ['Content changes', proposals.length],
                    ['Open conflicts', conflicts.length],
                    ['Active access', authorities.filter((item) => item.status === 'active').length],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-[#154F42] px-3 py-2 sm:px-4 sm:py-3.5">
                      <p className="text-xl font-bold text-white sm:text-2xl">{value}</p>
                      <p className="mt-0.5 text-[10px] font-medium text-emerald-100/80 sm:mt-1 sm:text-xs">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="overflow-hidden bg-[#E7F0F8]">
              <div className="border-b border-[#C8D9E7] px-4 py-3 sm:px-7 sm:py-4">
                <div className="flex items-start gap-2 sm:gap-3">
                  <BadgeCheck size={20} className="mt-0.5 text-[#175A7A] max-sm:h-4 max-sm:w-4" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-bold text-[#175A7A] sm:text-sm">Brand ownership requests</p>
                    <h2 className="mt-0.5 text-lg font-bold text-slate-950 sm:mt-1 sm:text-2xl">Confirm who is allowed to manage a brand.</h2>
                    <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600 sm:text-sm sm:leading-6">
                      Open a request, check the proof that was submitted, then approve or reject access for the right markets and brand areas.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid min-h-0 lg:min-h-[320px] lg:grid-cols-[minmax(260px,0.7fr)_minmax(0,1.3fr)]">
                <div className="border-b border-[#C8D9E7] bg-[#DCEAF5] lg:border-b-0 lg:border-r">
                  <div className="border-b border-[#C8D9E7] px-3 py-2 text-xs font-semibold text-slate-700 sm:px-4 sm:py-3 sm:text-sm">
                    {claims.length} {claims.length === 1 ? 'request' : 'requests'}
                  </div>

                  {claims.length > 0 ? (
                    <div className="max-h-40 divide-y divide-[#C8D9E7] overflow-y-auto sm:max-h-none sm:overflow-visible">
                      {claims.map((claim) => {
                        const selected = selectedClaim?.claim?.id === claim.id
                        return (
                          <button
                            key={claim.id}
                            type="button"
                            onClick={() => openClaim(claim.id)}
                            className={`focus-ring w-full px-3 py-2 text-left transition sm:px-4 sm:py-3 ${selected ? 'bg-white' : 'hover:bg-white/65'}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-slate-950">{humanize(claim.claimType)}</p>
                                <p className="mt-1 truncate text-xs text-slate-500">Brand reference: {claim.brandId}</p>
                              </div>
                              <StatusPill value={claim.status} />
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="px-3 py-4 text-xs text-slate-500 sm:px-4 sm:py-10 sm:text-sm">
                      No ownership requests need review right now.
                    </div>
                  )}
                </div>

                <div className="bg-white px-4 py-3 sm:px-7 sm:py-6">
                  {!selectedClaim ? (
                    <div className="flex min-h-[110px] items-center justify-center text-center sm:min-h-[250px]">
                      <div className="max-w-md">
                        <p className="text-base font-bold text-slate-900 sm:text-lg">Choose an ownership request</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500 sm:mt-2 sm:text-sm sm:leading-6">
                          Select a request from the list to see the submitted proof and make a decision.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col gap-2 border-b border-slate-200 pb-3 sm:gap-3 sm:pb-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#175A7A]">Ownership request</p>
                          <h3 className="mt-0.5 text-lg font-bold text-slate-950 sm:mt-1 sm:text-xl">{humanize(selectedClaim.claim?.claimType)}</h3>
                          <p className="mt-0.5 break-all text-xs text-slate-500 sm:mt-1 sm:text-sm">Brand reference: {selectedClaim.claim?.brandId}</p>
                        </div>
                        <StatusPill value={selectedClaim.claim?.status} />
                      </div>

                      <div className="mt-3 sm:mt-5">
                        <p className="text-sm font-bold text-slate-900">Submitted proof</p>
                        <p className="mt-1 text-sm text-slate-500">Check each item and mark whether it supports the request.</p>

                        <div className="mt-2 divide-y divide-slate-200 border-y border-slate-200 sm:mt-3">
                          {selectedClaim.evidenceChecks?.length > 0 ? (
                            selectedClaim.evidenceChecks.map((check) => (
                              <div key={check.id} className="py-3 sm:py-4">
                                <div className="flex flex-col gap-1.5 sm:gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-900">{humanize(check.checkType)}</p>
                                    <p className="mt-1 break-all text-xs leading-5 text-slate-500">{check.evidenceReference}</p>
                                  </div>
                                  <StatusPill value={check.status} />
                                </div>

                                {canVerify && (
                                  <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-3 sm:gap-2">
                                    {['verified', 'rejected', 'conflict'].map((decision) => (
                                      <button
                                        key={decision}
                                        type="button"
                                        disabled={busy}
                                        onClick={() =>
                                          execute(
                                            () => reviewAdminBrandIdentityCheck(check.id, { decision, reason }),
                                            decision === 'verified'
                                              ? 'Evidence marked as verified.'
                                              : decision === 'rejected'
                                                ? 'Evidence rejected.'
                                                : 'Evidence flagged for conflict review.',
                                          )
                                        }
                                        className="focus-ring rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold sm:px-3 sm:py-2 sm:text-xs text-slate-700 disabled:opacity-50"
                                      >
                                        {DECISION_LABELS[decision]}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="py-3 text-xs text-slate-500 sm:py-6 sm:text-sm">No supporting proof was attached to this request.</div>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 sm:mt-5 grid gap-2.5 sm:gap-4 lg:grid-cols-2">
                        <label className="block">
                          <span className="text-xs font-semibold text-slate-800 sm:text-sm">Reason for your decision</span>
                          <textarea
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            rows={3}
                            className="focus-ring mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800 sm:mt-2 sm:p-3 sm:text-sm"
                            placeholder="Add a short reason for this decision"
                          />
                        </label>

                        {canVerify && (
                          <label className="block">
                            <span className="text-xs font-semibold text-slate-800 sm:text-sm">Markets this approval applies to</span>
                            <input
                              value={marketCodes}
                              onChange={(event) => setMarketCodes(event.target.value)}
                              className="focus-ring mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs sm:mt-2 sm:h-11 sm:px-3 sm:text-sm"
                              placeholder="For example: IN, US"
                            />
                          </label>
                        )}
                      </div>

                      {canVerify && (
                        <>
                          <div className="mt-3 sm:mt-5">
                            <p className="text-xs font-semibold text-slate-800 sm:text-sm">What can this brand manage?</p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5 sm:mt-2 sm:gap-2">
                              {AUTHORITY_SCOPES.map((scope) => (
                                <label
                                  key={scope}
                                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold sm:gap-2 sm:px-3 sm:py-2 sm:text-xs ${selectedScopes.includes(scope) ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600'}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedScopes.includes(scope)}
                                    onChange={() => toggleScope(scope)}
                                  />
                                  {SCOPE_LABELS[scope] || humanize(scope)}
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="mt-3 sm:mt-5 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={busy || selectedScopes.length === 0}
                              onClick={() =>
                                execute(
                                  () =>
                                    approveAdminBrandClaim(selectedClaim.claim.id, {
                                      marketCodes: marketCodes
                                        .split(',')
                                        .map((item) => item.trim())
                                        .filter(Boolean),
                                      scopes: selectedScopes,
                                      reason,
                                    }),
                                  'Brand access approved.',
                                )
                              }
                              className="focus-ring rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold sm:px-4 sm:py-2.5 sm:text-sm text-white disabled:opacity-50"
                            >
                              Approve brand access
                            </button>

                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                execute(
                                  () => rejectAdminBrandClaim(selectedClaim.claim.id, { reason }),
                                  'Brand access request rejected.',
                                )
                              }
                              className="focus-ring rounded-xl bg-red-50 px-3 py-2 text-xs font-bold sm:px-4 sm:py-2.5 sm:text-sm text-red-700 disabled:opacity-50"
                            >
                              Reject request
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </section>

            <section className="overflow-hidden bg-[#E7F4EF]">
              <div className="border-b border-[#CBE3DA] px-4 py-3 sm:px-7 sm:py-4">
                <div className="flex items-start gap-2 sm:gap-3">
                  <ShieldAlert size={20} className="mt-0.5 text-[#17624A] max-sm:h-4 max-sm:w-4" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-bold text-[#17624A] sm:text-sm">Brand content changes</p>
                    <h2 className="mt-0.5 text-lg font-bold text-slate-950 sm:mt-1 sm:text-2xl">Review important changes before they go live.</h2>
                    <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600 sm:text-sm sm:leading-6">
                      These requests change important brand or product information. Approve a change, reject it, or flag it when the evidence does not agree.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white">
                {proposals.length > 0 ? (
                  <div className="divide-y divide-slate-200">
                    {proposals.map((proposal) => (
                      <div key={proposal.id} className="px-4 py-3 sm:px-7 sm:py-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-950">
                              {proposal.fieldChanges?.length
                                ? proposal.fieldChanges.map((change) => humanize(change.fieldKey)).join(', ')
                                : 'Brand content update'}
                            </p>
                            <p className="mt-1 break-all text-xs text-slate-500">Product reference: {proposal.packId}</p>
                          </div>
                          <StatusPill value={proposal.status} />
                        </div>

                        {canReviewContent && ['submitted', 'in_review'].includes(proposal.status) && (
                          <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-3 sm:gap-2">
                            {['approve', 'reject', 'conflict'].map((decision) => (
                              <button
                                key={decision}
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  execute(
                                    () => reviewAdminBrandOverride(proposal.id, { decision, reason }),
                                    decision === 'approve'
                                      ? 'Brand content change approved.'
                                      : decision === 'reject'
                                        ? 'Brand content change rejected.'
                                        : 'Brand content change flagged for conflict review.',
                                  )
                                }
                                className="focus-ring rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold sm:px-3 sm:py-2 sm:text-xs text-slate-700 disabled:opacity-50"
                              >
                                {DECISION_LABELS[decision]}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-4 text-xs text-slate-500 sm:px-7 sm:py-8 sm:text-sm">
                    No brand content changes are waiting for review.
                  </div>
                )}
              </div>
            </section>

            <section className="grid gap-2.5 sm:gap-5 xl:grid-cols-2">
              <div className="overflow-hidden bg-[#F7EDEC]">
                <div className="border-b border-[#E8D1CE] px-4 py-3 sm:px-7 sm:py-4">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <FileWarning size={20} className="mt-0.5 text-[#A34338] max-sm:h-4 max-sm:w-4" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-bold text-[#A34338]">Conflicts that need a decision</p>
                      <h2 className="mt-0.5 text-lg font-bold text-slate-950 sm:mt-1 sm:text-xl">Resolve evidence that does not agree.</h2>
                      <p className="mt-1 text-xs leading-5 text-slate-600 sm:text-sm sm:leading-6">
                        Use the strongest evidence, or hold the item for manual review when the correct answer is still unclear.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white">
                  {conflicts.length > 0 ? (
                    <div className="divide-y divide-slate-200">
                      {conflicts.map((conflict) => (
                        <div key={conflict.id} className="px-4 py-3 sm:px-7 sm:py-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-bold text-slate-950">{humanize(conflict.severity)} priority</p>
                            <StatusPill value={conflict.status} />
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{conflict.openedReason}</p>

                          {canVerify && ['open', 'in_review'].includes(conflict.status) && (
                            <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-3 sm:gap-2">
                              {conflict.proposalIds?.[0] && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    execute(
                                      () =>
                                        resolveAdminBrandConflict(conflict.id, {
                                          resolution: 'approve_proposal',
                                          selectedProposalId: conflict.proposalIds[0],
                                          reason,
                                        }),
                                      'Conflict resolved using the selected change.',
                                    )
                                  }
                                  className="focus-ring rounded-lg bg-emerald-700 px-3 py-1.5 text-[11px] font-bold sm:px-3.5 sm:py-2 sm:text-xs text-white disabled:opacity-50"
                                >
                                  Use selected change
                                </button>
                              )}

                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  execute(
                                    () => resolveAdminBrandConflict(conflict.id, { resolution: 'quarantine', reason }),
                                    'Conflict held for manual review.',
                                  )
                                }
                                className="focus-ring rounded-lg bg-red-50 px-3 py-1.5 text-[11px] font-bold sm:px-3.5 sm:py-2 sm:text-xs text-red-700 disabled:opacity-50"
                              >
                                Hold for manual review
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-4 text-xs text-slate-500 sm:px-7 sm:py-8 sm:text-sm">
                      No brand conflicts need attention right now.
                    </div>
                  )}
                </div>
              </div>

              <div className="overflow-hidden bg-[#ECEAF6]">
                <div className="border-b border-[#D9D5EC] px-4 py-3 sm:px-7 sm:py-4">
                  <div>
                    <p className="text-sm font-bold text-[#514A86]">Active brand access</p>
                    <h2 className="mt-0.5 text-lg font-bold text-slate-950 sm:mt-1 sm:text-xl">See who can currently manage brand information.</h2>
                    <p className="mt-1 text-xs leading-5 text-slate-600 sm:text-sm sm:leading-6">
                      Pause access temporarily or remove it when a brand relationship should no longer be active.
                    </p>
                  </div>
                </div>

                <div className="bg-white">
                  {authorities.length > 0 ? (
                    <div className="divide-y divide-slate-200">
                      {authorities.map((authority) => (
                        <div key={authority.id} className="px-4 py-3 sm:px-7 sm:py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-950">{humanize(authority.authorityType)}</p>
                              <p className="mt-1 break-all text-xs text-slate-500">Brand reference: {authority.brandId}</p>
                            </div>
                            <StatusPill value={authority.status} />
                          </div>

                          {canVerify && authority.status === 'active' && (
                            <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-3 sm:gap-2">
                              {['suspend', 'revoke'].map((action) => (
                                <button
                                  key={action}
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    execute(
                                      () => changeAdminBrandAuthorityLifecycle(authority.id, { action, reason }),
                                      action === 'suspend' ? 'Brand access paused.' : 'Brand access removed.',
                                    )
                                  }
                                  className="focus-ring rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold sm:px-3.5 sm:py-2 sm:text-xs text-slate-700 disabled:opacity-50"
                                >
                                  {DECISION_LABELS[action]}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-4 text-xs text-slate-500 sm:px-7 sm:py-8 sm:text-sm">
                      No active brand access has been granted yet.
                    </div>
                  )}
                </div>
              </div>
            </section>

            {busy && (
              <div className="fixed bottom-3 right-3 z-50 inline-flex items-center gap-1.5 rounded-full bg-stone-950 px-3 py-2 text-xs font-semibold sm:bottom-5 sm:right-5 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm text-white shadow-xl">
                <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
                Saving changes...
              </div>
            )}
          </div>
        )}
      </div>
    </AdminShell>
  )
}
