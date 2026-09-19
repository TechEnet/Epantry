import {
  ClipboardCheck,
  FileClock,
  RefreshCw,
  Scale,
  ShieldCheck,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import AdminShell from '../../admin/components/AdminShell'

import MediaPrivacyReviewQueue from '../components/MediaPrivacyReviewQueue'

import {
  createRegulatoryProfile,
  createRetentionPolicy,
  getHardeningErrorMessage,
  listPrivacyRequests,
  listRegulatoryProfiles,
  listRetentionPolicies,
  transitionRegulatoryProfile,
  transitionRetentionPolicy,
  updatePrivacyRequest,
} from '../services/hardening.service'

const inputClass =
  'focus-ring w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-900 outline-none'

const buttonClass =
  'focus-ring inline-flex items-center justify-center rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50'

function formatDate(
  value,
) {
  if (!value) {
    return '—'
  }

  return new Intl.DateTimeFormat(
    'en-IN',
    {
      dateStyle:
        'medium',

      timeStyle:
        'short',
    },
  ).format(
    new Date(
      value,
    ),
  )
}

function titleize(
  value,
) {
  return String(
    value ||
      '',
  )
    .split('_')
    .filter(Boolean)
    .map(
      (part) =>
        `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
    )
    .join(' ')
}

function LifecycleButtons({
  record,
  onAction,
  busy,
}) {
  const actions =
    []

  if (
    record.status ===
    'draft'
  ) {
    actions.push(
      'submit',
    )
  }

  if (
    record.status ===
    'in_review'
  ) {
    actions.push(
      'approve',
    )
  }

  if (
    record.status ===
    'approved'
  ) {
    actions.push(
      'activate',
    )
  }

  if (!actions.length) {
    return (
      <span className="text-xs font-semibold text-stone-400">
        No lifecycle action pending
      </span>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map(
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
              onAction(
                record,
                action,
              )
            }
            className="focus-ring rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-black text-stone-700 disabled:opacity-50"
          >
            {titleize(
              action,
            )}
          </button>
        ),
      )}
    </div>
  )
}

export default function AdminPrivacyOpsPage() {
  const [
    privacyRequests,
    setPrivacyRequests,
  ] = useState([])

  const [
    retentionPolicies,
    setRetentionPolicies,
  ] = useState([])

  const [
    regulatoryProfiles,
    setRegulatoryProfiles,
  ] = useState([])

  const [
    selectedPrivacyId,
    setSelectedPrivacyId,
  ] = useState('')

  const [
    workflowStatus,
    setWorkflowStatus,
  ] = useState(
    'in_review',
  )

  const [
    blockedReasonCode,
    setBlockedReasonCode,
  ] = useState('')

  const [
    exportArtifactStatus,
    setExportArtifactStatus,
  ] = useState(
    'not_generated',
  )

  const [
    workflowReason,
    setWorkflowReason,
  ] = useState(
    'M20 governed privacy operations review.',
  )

  const [
    busy,
    setBusy,
  ] = useState(false)

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    notice,
    setNotice,
  ] = useState('')

  const [
    error,
    setError,
  ] = useState('')

  const [
    retentionForm,
    setRetentionForm,
  ] = useState({
    policyKey:
      '',

    dataClass:
      '',

    purpose:
      '',

    retentionDays:
      '365',

    dispositionAction:
      'delete',

    effectiveFrom:
      new Date()
        .toISOString()
        .slice(
          0,
          10,
        ),

    evidenceRef:
      '',

    reason:
      'Create a governed M20 retention policy version.',
  })

  const [
    regulatoryForm,
    setRegulatoryForm,
  ] = useState({
    profileKey:
      '',

    jurisdiction:
      'IN',

    operatorApplicability:
      'platform_operator',

    effectiveFrom:
      new Date()
        .toISOString()
        .slice(
          0,
          10,
        ),

    methodologyVersion:
      'v1',

    evidenceRef:
      '',

    reason:
      'Create an effective-dated M20 regulatory profile version.',
  })

  const selectedPrivacy =
    useMemo(
      () =>
        privacyRequests.find(
          (
            item,
          ) =>
            item.id ===
            selectedPrivacyId,
        ) ||
        null,

      [
        privacyRequests,
        selectedPrivacyId,
      ],
    )

  const load =
    useCallback(
      async () => {
        setLoading(
          true,
        )

        setError(
          '',
        )

        try {
          const [
            privacy,
            retention,
            regulatory,
          ] =
            await Promise.all([
              listPrivacyRequests({
                limit:
                  100,
              }),

              listRetentionPolicies(),

              listRegulatoryProfiles(),
            ])

          setPrivacyRequests(
            privacy
              ?.privacyRequests ||
              [],
          )

          setRetentionPolicies(
            retention
              ?.policies ||
              [],
          )

          setRegulatoryProfiles(
            regulatory
              ?.profiles ||
              [],
          )
        } catch (
          requestError
        ) {
          setError(
            getHardeningErrorMessage(
              requestError,
              'Unable to load privacy and regulatory operations.',
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
      load()
    },
    [
      load,
    ],
  )

  useEffect(
    () => {
      if (
        !selectedPrivacy
      ) {
        return
      }

      setWorkflowStatus(
        selectedPrivacy.status ===
          'submitted'
          ? 'in_review'
          : selectedPrivacy.status,
      )

      setBlockedReasonCode(
        selectedPrivacy
          .blockedReasonCode ||
          '',
      )

      setExportArtifactStatus(
        selectedPrivacy
          .exportArtifactStatus ||
          'not_generated',
      )
    },
    [
      selectedPrivacy,
    ],
  )

  async function savePrivacyWorkflow() {
    if (
      !selectedPrivacy
    ) {
      return
    }

    setBusy(
      true,
    )

    setError(
      '',
    )

    setNotice(
      '',
    )

    try {
      await updatePrivacyRequest(
        selectedPrivacy.id,
        {
          status:
            workflowStatus,

          blockedReasonCode,

          exportArtifactStatus,

          reason:
            workflowReason,
        },
      )

      setNotice(
        'Privacy request workflow updated and immutably audited through M03.',
      )

      await load()
    } catch (
      requestError
    ) {
      setError(
        getHardeningErrorMessage(
          requestError,
          'Unable to update the privacy workflow.',
        ),
      )
    } finally {
      setBusy(
        false,
      )
    }
  }

  async function runLifecycle(
    kind,
    record,
    action,
  ) {
    setBusy(
      true,
    )

    setError(
      '',
    )

    setNotice(
      '',
    )

    const reason =
      `M20 maker-checker ${action} action for ${kind}.`

    try {
      if (
        kind ===
        'retention policy'
      ) {
        await transitionRetentionPolicy(
          record.id,
          action,
          reason,
        )
      } else {
        await transitionRegulatoryProfile(
          record.id,
          action,
          reason,
        )
      }

      setNotice(
        `${titleize(action)} completed for ${kind}.`,
      )

      await load()
    } catch (
      requestError
    ) {
      setError(
        getHardeningErrorMessage(
          requestError,
          `Unable to ${action} ${kind}.`,
        ),
      )
    } finally {
      setBusy(
        false,
      )
    }
  }

  async function submitRetentionVersion(
    event,
  ) {
    event.preventDefault()

    setBusy(
      true,
    )

    setError(
      '',
    )

    setNotice(
      '',
    )

    try {
      await createRetentionPolicy({
        policyKey:
          retentionForm.policyKey,

        dataClass:
          retentionForm.dataClass,

        purpose:
          retentionForm.purpose,

        retentionDays:
          retentionForm
            .dispositionAction ===
          'retain'
            ? null
            : Number(
                retentionForm
                  .retentionDays,
              ),

        dispositionAction:
          retentionForm
            .dispositionAction,

        immutableRecordClass:
          false,

        applicability: [
          'platform_operator',
        ],

        effectiveFrom:
          new Date(
            retentionForm
              .effectiveFrom,
          ).toISOString(),

        effectiveTo:
          null,

        evidenceRefs: [
          {
            referenceType:
              'policy_source',

            reference:
              retentionForm
                .evidenceRef,

            note:
              'M20 retention evidence source.',
          },
        ],

        reason:
          retentionForm.reason,
      })

      setNotice(
        'Retention policy draft version created.',
      )

      setRetentionForm(
        (
          value,
        ) => ({
          ...value,

          policyKey:
            '',

          dataClass:
            '',

          purpose:
            '',

          evidenceRef:
            '',
        }),
      )

      await load()
    } catch (
      requestError
    ) {
      setError(
        getHardeningErrorMessage(
          requestError,
          'Unable to create the retention policy version.',
        ),
      )
    } finally {
      setBusy(
        false,
      )
    }
  }

  async function submitRegulatoryVersion(
    event,
  ) {
    event.preventDefault()

    setBusy(
      true,
    )

    setError(
      '',
    )

    setNotice(
      '',
    )

    try {
      await createRegulatoryProfile({
        profileKey:
          regulatoryForm
            .profileKey,

        jurisdiction:
          regulatoryForm
            .jurisdiction,

        operatorApplicability: [
          regulatoryForm
            .operatorApplicability,
        ],

        effectiveFrom:
          new Date(
            regulatoryForm
              .effectiveFrom,
          ).toISOString(),

        effectiveTo:
          null,

        requiredFields:
          [],

        calculationMethodologyVersion:
          regulatoryForm
            .methodologyVersion,

        presentationRules:
          {},

        evidenceRefs: [
          {
            referenceType:
              'regulatory_source',

            reference:
              regulatoryForm
                .evidenceRef,

            note:
              'M20 regulatory profile source.',
          },
        ],

        reason:
          regulatoryForm
            .reason,
      })

      setNotice(
        'Effective-dated regulatory profile draft created.',
      )

      setRegulatoryForm(
        (
          value,
        ) => ({
          ...value,

          profileKey:
            '',

          evidenceRef:
            '',
        }),
      )

      await load()
    } catch (
      requestError
    ) {
      setError(
        getHardeningErrorMessage(
          requestError,
          'Unable to create the regulatory profile version.',
        ),
      )
    } finally {
      setBusy(
        false,
      )
    }
  }

  return (
    <AdminShell
      title="A18 Privacy / Consent Ops"
      description="Govern customer privacy requests, effective retention policies and effective-dated regulatory profiles. M02 remains consent authority and M03 remains privileged authorization/audit authority."
      actions={
        <button
          type="button"
          onClick={
            load
          }
          className="focus-ring inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-black text-stone-700"
        >
          <RefreshCw
            size={16}
            aria-hidden="true"
          />

          Refresh
        </button>
      }
    >
      <div
        className="mb-5 min-h-6 text-sm font-semibold"
        aria-live="polite"
      >
        {error ? (
          <p className="text-red-700">
            {error}
          </p>
        ) : notice ? (
          <p className="text-emerald-700">
            {notice}
          </p>
        ) : null}
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldCheck
              className="text-emerald-700"
              size={20}
              aria-hidden="true"
            />

            <div>
              <h2 className="text-base font-black text-stone-950">
                Customer privacy requests
              </h2>

              <p className="text-xs font-semibold text-stone-500">
                No blind deletion cascades. Retention decisions remain
                visible per request.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {loading ? (
              <p className="text-sm font-semibold text-stone-500">
                Loading requests…
              </p>
            ) : privacyRequests.length ? (
              privacyRequests.map(
                (
                  request,
                ) => (
                  <button
                    key={
                      request.id
                    }
                    type="button"
                    onClick={() =>
                      setSelectedPrivacyId(
                        request.id,
                      )
                    }
                    className={`focus-ring w-full rounded-2xl border p-4 text-left ${
                      selectedPrivacyId ===
                      request.id
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'border-stone-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-stone-950">
                          {titleize(
                            request.requestType,
                          )}
                        </p>

                        <p className="mt-1 text-xs font-semibold text-stone-500">
                          {request.user
                            ?.email ||
                            request.userId}
                          {' · '}
                          {formatDate(
                            request.requestedAt,
                          )}
                        </p>
                      </div>

                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-black uppercase text-stone-600">
                        {titleize(
                          request.status,
                        )}
                      </span>
                    </div>

                    <p className="mt-2 text-xs font-semibold text-stone-500">
                      Retention decisions:{' '}
                      {request
                        .retentionEvaluation
                        ?.length ||
                        0}
                    </p>
                  </button>
                ),
              )
            ) : (
              <p className="rounded-2xl bg-stone-50 p-4 text-sm font-semibold text-stone-500">
                No privacy requests in queue.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-black text-stone-950">
            Workflow decision
          </h2>

          {selectedPrivacy ? (
            <div className="mt-4 space-y-3">
              <select
                className={
                  inputClass
                }
                value={
                  workflowStatus
                }
                onChange={
                  (
                    event,
                  ) =>
                    setWorkflowStatus(
                      event.target
                        .value,
                    )
                }
              >
                {[
                  'submitted',
                  'in_review',
                  'blocked',
                  'processing',
                  'completed',
                  'rejected',
                  'cancelled',
                ].map(
                  (
                    value,
                  ) => (
                    <option
                      key={
                        value
                      }
                      value={
                        value
                      }
                    >
                      {titleize(
                        value,
                      )}
                    </option>
                  ),
                )}
              </select>

              <input
                className={
                  inputClass
                }
                value={
                  blockedReasonCode
                }
                onChange={
                  (
                    event,
                  ) =>
                    setBlockedReasonCode(
                      event.target
                        .value,
                    )
                }
                placeholder="Blocked reason code when required"
              />

              <select
                className={
                  inputClass
                }
                value={
                  exportArtifactStatus
                }
                onChange={
                  (
                    event,
                  ) =>
                    setExportArtifactStatus(
                      event.target
                        .value,
                    )
                }
              >
                {[
                  'not_generated',
                  'available',
                  'expired',
                ].map(
                  (
                    value,
                  ) => (
                    <option
                      key={
                        value
                      }
                      value={
                        value
                      }
                    >
                      {titleize(
                        value,
                      )}
                    </option>
                  ),
                )}
              </select>

              <textarea
                className={
                  inputClass
                }
                rows={4}
                value={
                  workflowReason
                }
                onChange={
                  (
                    event,
                  ) =>
                    setWorkflowReason(
                      event.target
                        .value,
                    )
                }
              />

              <button
                type="button"
                disabled={
                  busy
                }
                onClick={
                  savePrivacyWorkflow
                }
                className={
                  buttonClass
                }
              >
                Save governed decision
              </button>
            </div>
          ) : (
            <p className="mt-4 text-sm font-semibold text-stone-500">
              Select a privacy request to process.
            </p>
          )}
        </div>
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-2">
        <div className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <FileClock
              className="text-emerald-700"
              size={20}
              aria-hidden="true"
            />

            <div>
              <h2 className="text-base font-black text-stone-950">
                Retention policy versions
              </h2>

              <p className="text-xs font-semibold text-stone-500">
                Maker-checker lifecycle: draft → submit → approve → activate.
              </p>
            </div>
          </div>

          <form
            className="mt-4 grid gap-3 sm:grid-cols-2"
            onSubmit={
              submitRetentionVersion
            }
          >
            <input
              required
              className={
                inputClass
              }
              value={
                retentionForm.policyKey
              }
              onChange={
                (
                  event,
                ) =>
                  setRetentionForm(
                    (
                      value,
                    ) => ({
                      ...value,

                      policyKey:
                        event
                          .target
                          .value,
                    }),
                  )
              }
              placeholder="policy key"
            />

            <input
              required
              className={
                inputClass
              }
              value={
                retentionForm.dataClass
              }
              onChange={
                (
                  event,
                ) =>
                  setRetentionForm(
                    (
                      value,
                    ) => ({
                      ...value,

                      dataClass:
                        event
                          .target
                          .value,
                    }),
                  )
              }
              placeholder="data class"
            />

            <input
              required
              className={`${inputClass} sm:col-span-2`}
              value={
                retentionForm.purpose
              }
              onChange={
                (
                  event,
                ) =>
                  setRetentionForm(
                    (
                      value,
                    ) => ({
                      ...value,

                      purpose:
                        event
                          .target
                          .value,
                    }),
                  )
              }
              placeholder="purpose (10+ characters)"
            />

            <input
              className={
                inputClass
              }
              type="number"
              min="0"
              value={
                retentionForm.retentionDays
              }
              onChange={
                (
                  event,
                ) =>
                  setRetentionForm(
                    (
                      value,
                    ) => ({
                      ...value,

                      retentionDays:
                        event
                          .target
                          .value,
                    }),
                  )
              }
            />

            <select
              className={
                inputClass
              }
              value={
                retentionForm
                  .dispositionAction
              }
              onChange={
                (
                  event,
                ) =>
                  setRetentionForm(
                    (
                      value,
                    ) => ({
                      ...value,

                      dispositionAction:
                        event
                          .target
                          .value,
                    }),
                  )
              }
            >
              {[
                'delete',
                'anonymize',
                'restrict',
                'retain',
              ].map(
                (
                  value,
                ) => (
                  <option
                    key={
                      value
                    }
                    value={
                      value
                    }
                  >
                    {titleize(
                      value,
                    )}
                  </option>
                ),
              )}
            </select>

            <input
              required
              className={
                inputClass
              }
              type="date"
              value={
                retentionForm.effectiveFrom
              }
              onChange={
                (
                  event,
                ) =>
                  setRetentionForm(
                    (
                      value,
                    ) => ({
                      ...value,

                      effectiveFrom:
                        event
                          .target
                          .value,
                    }),
                  )
              }
            />

            <input
              required
              className={
                inputClass
              }
              value={
                retentionForm.evidenceRef
              }
              onChange={
                (
                  event,
                ) =>
                  setRetentionForm(
                    (
                      value,
                    ) => ({
                      ...value,

                      evidenceRef:
                        event
                          .target
                          .value,
                    }),
                  )
              }
              placeholder="evidence reference"
            />

            <textarea
              required
              className={`${inputClass} sm:col-span-2`}
              rows={3}
              value={
                retentionForm.reason
              }
              onChange={
                (
                  event,
                ) =>
                  setRetentionForm(
                    (
                      value,
                    ) => ({
                      ...value,

                      reason:
                        event
                          .target
                          .value,
                    }),
                  )
              }
            />

            <button
              type="submit"
              disabled={
                busy
              }
              className={`${buttonClass} sm:col-span-2`}
            >
              Create retention draft
            </button>
          </form>

          <div className="mt-5 space-y-3">
            {retentionPolicies
              .slice(
                0,
                12,
              )
              .map(
                (
                  policy,
                ) => (
                  <article
                    key={
                      policy.id
                    }
                    className="rounded-2xl border border-stone-200 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-stone-950">
                          {policy.policyKey}
                          {' · v'}
                          {policy.versionNumber}
                        </p>

                        <p className="mt-1 text-xs font-semibold text-stone-500">
                          {policy.dataClass}
                          {' · effective '}
                          {formatDate(
                            policy.effectiveFrom,
                          )}
                        </p>
                      </div>

                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-black uppercase text-stone-600">
                        {titleize(
                          policy.status,
                        )}
                      </span>
                    </div>

                    <div className="mt-3">
                      <LifecycleButtons
                        record={
                          policy
                        }
                        busy={
                          busy
                        }
                        onAction={(
                          record,
                          action,
                        ) =>
                          runLifecycle(
                            'retention policy',
                            record,
                            action,
                          )
                        }
                      />
                    </div>
                  </article>
                ),
              )}
          </div>
        </div>

        <div className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Scale
              className="text-emerald-700"
              size={20}
              aria-hidden="true"
            />

            <div>
              <h2 className="text-base font-black text-stone-950">
                Regulatory admin UI
              </h2>

              <p className="text-xs font-semibold text-stone-500">
                Effective-dated applicability and methodology; no timeless
                compliance boolean.
              </p>
            </div>
          </div>

          <form
            className="mt-4 grid gap-3 sm:grid-cols-2"
            onSubmit={
              submitRegulatoryVersion
            }
          >
            <input
              required
              className={
                inputClass
              }
              value={
                regulatoryForm.profileKey
              }
              onChange={
                (
                  event,
                ) =>
                  setRegulatoryForm(
                    (
                      value,
                    ) => ({
                      ...value,

                      profileKey:
                        event
                          .target
                          .value,
                    }),
                  )
              }
              placeholder="profile key"
            />

            <input
              required
              className={
                inputClass
              }
              value={
                regulatoryForm.jurisdiction
              }
              onChange={
                (
                  event,
                ) =>
                  setRegulatoryForm(
                    (
                      value,
                    ) => ({
                      ...value,

                      jurisdiction:
                        event
                          .target
                          .value,
                    }),
                  )
              }
              placeholder="jurisdiction"
            />

            <select
              className={
                inputClass
              }
              value={
                regulatoryForm
                  .operatorApplicability
              }
              onChange={
                (
                  event,
                ) =>
                  setRegulatoryForm(
                    (
                      value,
                    ) => ({
                      ...value,

                      operatorApplicability:
                        event
                          .target
                          .value,
                    }),
                  )
              }
            >
              {[
                'consumer_service',
                'marketplace_operator',
                'brand_content_operator',
                'hospitality_operator',
                'platform_operator',
              ].map(
                (
                  value,
                ) => (
                  <option
                    key={
                      value
                    }
                    value={
                      value
                    }
                  >
                    {titleize(
                      value,
                    )}
                  </option>
                ),
              )}
            </select>

            <input
              required
              className={
                inputClass
              }
              type="date"
              value={
                regulatoryForm.effectiveFrom
              }
              onChange={
                (
                  event,
                ) =>
                  setRegulatoryForm(
                    (
                      value,
                    ) => ({
                      ...value,

                      effectiveFrom:
                        event
                          .target
                          .value,
                    }),
                  )
              }
            />

            <input
              required
              className={
                inputClass
              }
              value={
                regulatoryForm.methodologyVersion
              }
              onChange={
                (
                  event,
                ) =>
                  setRegulatoryForm(
                    (
                      value,
                    ) => ({
                      ...value,

                      methodologyVersion:
                        event
                          .target
                          .value,
                    }),
                  )
              }
              placeholder="methodology version"
            />

            <input
              required
              className={
                inputClass
              }
              value={
                regulatoryForm.evidenceRef
              }
              onChange={
                (
                  event,
                ) =>
                  setRegulatoryForm(
                    (
                      value,
                    ) => ({
                      ...value,

                      evidenceRef:
                        event
                          .target
                          .value,
                    }),
                  )
              }
              placeholder="regulatory evidence reference"
            />

            <textarea
              required
              className={`${inputClass} sm:col-span-2`}
              rows={3}
              value={
                regulatoryForm.reason
              }
              onChange={
                (
                  event,
                ) =>
                  setRegulatoryForm(
                    (
                      value,
                    ) => ({
                      ...value,

                      reason:
                        event
                          .target
                          .value,
                    }),
                  )
              }
            />

            <button
              type="submit"
              disabled={
                busy
              }
              className={`${buttonClass} sm:col-span-2`}
            >
              Create regulatory draft
            </button>
          </form>

          <div className="mt-5 space-y-3">
            {regulatoryProfiles
              .slice(
                0,
                12,
              )
              .map(
                (
                  profile,
                ) => (
                  <article
                    key={
                      profile.id
                    }
                    className="rounded-2xl border border-stone-200 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-stone-950">
                          {profile.profileKey}
                          {' · v'}
                          {profile.versionNumber}
                        </p>

                        <p className="mt-1 text-xs font-semibold text-stone-500">
                          {profile.jurisdiction}
                          {' · '}
                          {profile
                            .calculationMethodologyVersion}
                          {' · '}
                          {formatDate(
                            profile.effectiveFrom,
                          )}
                        </p>
                      </div>

                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-black uppercase text-stone-600">
                        {titleize(
                          profile.status,
                        )}
                      </span>
                    </div>

                    <p className="mt-2 text-xs font-semibold text-stone-500">
                      Applicability:{' '}
                      {(
                        profile
                          .operatorApplicability ||
                        []
                      )
                        .map(
                          titleize,
                        )
                        .join(
                          ', ',
                        ) ||
                        '—'}
                    </p>

                    <div className="mt-3">
                      <LifecycleButtons
                        record={
                          profile
                        }
                        busy={
                          busy
                        }
                        onAction={(
                          record,
                          action,
                        ) =>
                          runLifecycle(
                            'regulatory profile',
                            record,
                            action,
                          )
                        }
                      />
                    </div>
                  </article>
                ),
              )}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-[24px] border border-emerald-200 bg-emerald-50 p-5 text-sm font-semibold leading-6 text-emerald-950">
        <div className="flex gap-3">
          <ClipboardCheck
            className="mt-0.5 shrink-0"
            size={20}
            aria-hidden="true"
          />

          <p>
            Privacy, retention and regulatory mutations remain subject
            to M03 permissions, MFA, CSRF, recent-MFA and immutable
            admin audit evidence. Frontend controls are UX only;
            backend authorization is final.
          </p>
        </div>
      </section>

      <MediaPrivacyReviewQueue />
    </AdminShell>
  )
}