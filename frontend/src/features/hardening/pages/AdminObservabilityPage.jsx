import {
  Activity,
  DatabaseBackup,
  RefreshCw,
  Rocket,
  ShieldAlert,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import AdminShell from '../../admin/components/AdminShell'

import {
  getDeploymentSecurityOverview,
  getHardeningErrorMessage,
  listJobRuns,
  listLaunchGateRuns,
  listRecoveryEvidence,
  listSecurityEvents,
  recordRecoveryEvidence,
  runLaunchGate,
} from '../services/hardening.service'

const inputClass =
  'focus-ring w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-900 outline-none'

const buttonClass =
  'focus-ring inline-flex items-center justify-center rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50'

const GATE_FIELDS =
  Object.freeze([
    [
      'securityRegression',
      'Security regression',
    ],

    [
      'recipeScaling',
      'Recipe scaling',
    ],

    [
      'pantryExclusion',
      'Pantry exclusion',
    ],

    [
      'landedCost',
      'Landed cost',
    ],

    [
      'nutritionTraceability',
      'Nutrition traceability',
    ],

    [
      'allergenFailClosed',
      'Allergen fail-closed',
    ],

    [
      'aiAdversarial',
      'AI-adversarial',
    ],

    [
      'economicIdempotency',
      'Economic idempotency',
    ],

    [
      'tenantIsolation',
      'Tenant isolation',
    ],

    [
      'dishPassportReproducibility',
      'Dish Passport reproducibility',
    ],

    [
      'privilegedAudit',
      'Privileged audit',
    ],

    [
      'privacyJurisdictionReview',
      'Privacy jurisdiction review',
    ],

    [
      'loadRegression',
      'Load regression',
    ],

    [
      'browserAccessibility',
      'Browser + accessibility',
    ],
  ])

function emptyEvidence() {
  return Object.fromEntries(
    GATE_FIELDS.map(
      (
        [
          key,
        ],
      ) => [
        key,

        {
          status:
            'not_run',

          evidenceRef:
            '',

          summary:
            '',
        },
      ],
    ),
  )
}

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

export default function AdminObservabilityPage() {
  const [
    securityEvents,
    setSecurityEvents,
  ] = useState([])

  const [
    deploymentSecurity,
    setDeploymentSecurity,
  ] = useState(null)

  const [
    jobRuns,
    setJobRuns,
  ] = useState([])

  const [
    launchRuns,
    setLaunchRuns,
  ] = useState([])

  const [
    recoveryEvidence,
    setRecoveryEvidence,
  ] = useState([])

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    busy,
    setBusy,
  ] = useState(false)

  const [
    notice,
    setNotice,
  ] = useState('')

  const [
    error,
    setError,
  ] = useState('')

  const [
    launchForm,
    setLaunchForm,
  ] = useState({
    releaseRef:
      '',

    environment:
      'staging',

    reason:
      'Run deterministic M20 release launch gates with captured evidence.',

    evidence:
      emptyEvidence(),
  })

  const now =
    useMemo(
      () =>
        new Date()
          .toISOString()
          .slice(
            0,
            16,
          ),
      [],
    )

  const [
    recoveryForm,
    setRecoveryForm,
  ] = useState({
    evidenceType:
      'restore_drill',

    environment:
      'staging',

    sourceSnapshotRef:
      '',

    restoredTargetRef:
      '',

    recoveryPointAt:
      now,

    startedAt:
      now,

    completedAt:
      now,

    evidenceRef:
      '',

    notes:
      '',

    reason:
      'Record verified M20 recovery drill evidence for launch governance.',

    integrityCheckPassed:
      false,

    applicationSmokePassed:
      false,

    tenantIsolationPassed:
      false,
  })

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
            security,
            jobs,
            launches,
            recovery,
            deployment,
          ] =
            await Promise.all([
              listSecurityEvents({
                limit:
                  30,
              }),

              listJobRuns({
                limit:
                  30,
              }),

              listLaunchGateRuns({
                limit:
                  30,
              }),

              listRecoveryEvidence({
                limit:
                  30,
              }),

              getDeploymentSecurityOverview(),
            ])

          setSecurityEvents(
            security
              ?.securityEvents ||
              [],
          )

          setJobRuns(
            jobs
              ?.jobRuns ||
              [],
          )

          setLaunchRuns(
            launches
              ?.launchGateRuns ||
              [],
          )

          setRecoveryEvidence(
            recovery
              ?.recoveryEvidence ||
              [],
          )

          setDeploymentSecurity(
            deployment ||
              null,
          )
        } catch (
          requestError
        ) {
          setError(
            getHardeningErrorMessage(
              requestError,
              'Unable to load observability evidence.',
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

  function updateGate(
    key,
    patch,
  ) {
    setLaunchForm(
      (
        value,
      ) => ({
        ...value,

        evidence: {
          ...value.evidence,

          [key]: {
            ...value.evidence[
              key
            ],

            ...patch,
          },
        },
      }),
    )
  }

  async function submitLaunchGate(
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
      const evidence =
        Object.fromEntries(
          Object.entries(
            launchForm.evidence,
          ).map(
            (
              [
                key,
                value,
              ],
            ) => [
              key,

              {
                ...value,

                observedAt:
                  new Date()
                    .toISOString(),
              },
            ],
          ),
        )

      const result =
        await runLaunchGate({
          ...launchForm,

          evidence,
        })

      setNotice(
        result
          ?.launchGateRun
          ?.status ===
        'passed'
          ? 'Launch Gate passed and append-only release evidence was recorded.'
          : `Launch Gate blocked: ${(
              result
                ?.launchGateRun
                ?.blockerCodes ||
              []
            ).join(', ')}`,
      )

      await load()
    } catch (
      requestError
    ) {
      setError(
        getHardeningErrorMessage(
          requestError,
          'Unable to run the Launch Gate.',
        ),
      )
    } finally {
      setBusy(
        false,
      )
    }
  }

  async function submitRecoveryEvidence(
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
      const result =
        await recordRecoveryEvidence({
          evidenceType:
            recoveryForm
              .evidenceType,

          environment:
            recoveryForm
              .environment,

          sourceSnapshotRef:
            recoveryForm
              .sourceSnapshotRef,

          restoredTargetRef:
            recoveryForm
              .restoredTargetRef,

          recoveryPointAt:
            new Date(
              recoveryForm
                .recoveryPointAt,
            ).toISOString(),

          startedAt:
            new Date(
              recoveryForm
                .startedAt,
            ).toISOString(),

          completedAt:
            new Date(
              recoveryForm
                .completedAt,
            ).toISOString(),

          verificationChecks: {
            integrityCheckPassed:
              recoveryForm
                .integrityCheckPassed,

            applicationSmokePassed:
              recoveryForm
                .applicationSmokePassed,

            tenantIsolationPassed:
              recoveryForm
                .tenantIsolationPassed,
          },

          evidenceRefs: [
            recoveryForm
              .evidenceRef,
          ],

          notes:
            recoveryForm.notes,

          reason:
            recoveryForm.reason,
        })

      setNotice(
        result
          ?.recoveryEvidence
          ?.verified
          ? 'Verified recovery evidence recorded.'
          : 'Recovery evidence recorded, but verification requirements are not fully satisfied.',
      )

      await load()
    } catch (
      requestError
    ) {
      setError(
        getHardeningErrorMessage(
          requestError,
          'Unable to record recovery evidence.',
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
      title="A19 Audit / Observability"
      description="Security telemetry, JobRun evidence, deterministic release gates and restore/rollback evidence. M03 remains the privileged audit and permission authority."
      actions={
        <button
          type="button"
          onClick={
            load
          }
          aria-label="Refresh observability evidence"
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
        ) : loading ? (
          <p className="text-stone-500">
            Loading observability evidence…
          </p>
        ) : null}
      </div>

      <section className="mb-6 rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
              M26 deployment protection
            </p>
            <h2 className="mt-1 text-xl font-black text-stone-950">
              Runtime deployment security boundary
            </h2>
            <p className="mt-1 max-w-3xl text-sm font-medium text-stone-600">
              Operator view only. Secret values, WAF credentials and CI implementation secrets are never returned to this screen.
            </p>
          </div>

          <div
            className={`rounded-full px-3 py-1 text-xs font-black ${
              deploymentSecurity?.deploymentReady
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-900'
            }`}
          >
            {deploymentSecurity?.deploymentReady
              ? 'Deployment controls ready'
              : 'Controls need attention'}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(deploymentSecurity?.checks || []).map(
            (check) => (
              <div
                key={check.key}
                className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-black text-stone-900">
                    {check.label}
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 text-[11px] font-black ${
                      check.passed
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {check.passed ? 'PASS' : 'BLOCK'}
                  </span>
                </div>

                <p className="mt-2 text-xs font-semibold text-stone-600">
                  State: {titleize(check.state)}
                </p>
              </div>
            ),
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [
            'Security events',
            securityEvents.length,
            ShieldAlert,
          ],

          [
            'Job runs',
            jobRuns.length,
            Activity,
          ],

          [
            'Launch runs',
            launchRuns.length,
            Rocket,
          ],

          [
            'Recovery evidence',
            recoveryEvidence.length,
            DatabaseBackup,
          ],
        ].map(
          (
            [
              label,
              value,
              Icon,
            ],
          ) => (
            <article
              key={
                label
              }
              className="rounded-[22px] border border-stone-200 bg-white p-5 shadow-sm"
            >
              <Icon
                size={18}
                className="text-emerald-700"
                aria-hidden="true"
              />

              <p className="mt-4 text-2xl font-black text-stone-950">
                {value}
              </p>

              <p className="mt-1 text-xs font-black uppercase tracking-wide text-stone-400">
                {label}
              </p>
            </article>
          ),
        )}
      </section>

      <section className="mt-6 rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <Rocket
            className="mt-0.5 shrink-0 text-emerald-700"
            size={22}
            aria-hidden="true"
          />

          <div>
            <h2 className="text-lg font-black text-stone-950">
              M17 incident-aware launch gates
            </h2>

            <p className="mt-1 text-sm font-semibold leading-6 text-stone-600">
              High or critical M17 incidents in investigating/monitoring
              state block release. A recent independently verified restore
              drill is also required. Regression evidence includes security,
              tenant, restore, loadRegression, allergen, AI-adversarial,
              browser and accessibility contracts.
            </p>
          </div>
        </div>

        <form
          className="mt-5"
          onSubmit={
            submitLaunchGate
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              required
              className={
                inputClass
              }
              value={
                launchForm.releaseRef
              }
              onChange={
                (
                  event,
                ) =>
                  setLaunchForm(
                    (
                      value,
                    ) => ({
                      ...value,

                      releaseRef:
                        event
                          .target
                          .value,
                    }),
                  )
              }
              placeholder="Release ref / commit / build"
              aria-label="Release reference"
            />

            <select
              className={
                inputClass
              }
              value={
                launchForm.environment
              }
              onChange={
                (
                  event,
                ) =>
                  setLaunchForm(
                    (
                      value,
                    ) => ({
                      ...value,

                      environment:
                        event
                          .target
                          .value,
                    }),
                  )
              }
              aria-label="Launch environment"
            >
              <option value="staging">
                Staging
              </option>

              <option value="production">
                Production
              </option>
            </select>

            <input
              required
              className={
                inputClass
              }
              value={
                launchForm.reason
              }
              onChange={
                (
                  event,
                ) =>
                  setLaunchForm(
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
              aria-label="Launch gate audit reason"
            />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {GATE_FIELDS.map(
              (
                [
                  key,
                  label,
                ],
              ) => {
                const item =
                  launchForm
                    .evidence[
                    key
                  ]

                return (
                  <fieldset
                    key={
                      key
                    }
                    className="rounded-2xl border border-stone-200 p-4"
                  >
                    <legend className="px-1 text-xs font-black uppercase tracking-wide text-stone-600">
                      {label}
                    </legend>

                    <select
                      className={
                        inputClass
                      }
                      value={
                        item.status
                      }
                      onChange={
                        (
                          event,
                        ) =>
                          updateGate(
                            key,
                            {
                              status:
                                event
                                  .target
                                  .value,
                            },
                          )
                      }
                      aria-label={`${label} status`}
                    >
                      <option value="not_run">
                        Not run
                      </option>

                      <option value="pass">
                        Pass
                      </option>

                      <option value="fail">
                        Fail
                      </option>
                    </select>

                    <input
                      className={`${inputClass} mt-2`}
                      value={
                        item.evidenceRef
                      }
                      onChange={
                        (
                          event,
                        ) =>
                          updateGate(
                            key,
                            {
                              evidenceRef:
                                event
                                  .target
                                  .value,
                            },
                          )
                      }
                      placeholder="Evidence reference"
                      aria-label={`${label} evidence reference`}
                    />

                    <input
                      className={`${inputClass} mt-2`}
                      value={
                        item.summary
                      }
                      onChange={
                        (
                          event,
                        ) =>
                          updateGate(
                            key,
                            {
                              summary:
                                event
                                  .target
                                  .value,
                            },
                          )
                      }
                      placeholder="Short evidence summary"
                      aria-label={`${label} evidence summary`}
                    />
                  </fieldset>
                )
              },
            )}
          </div>

          <button
            type="submit"
            disabled={
              busy
            }
            className={`${buttonClass} mt-4`}
          >
            Run deterministic Launch Gate
          </button>
        </form>
      </section>

      <section className="mt-6 rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <DatabaseBackup
            className="text-emerald-700"
            size={22}
            aria-hidden="true"
          />

          <div>
            <h2 className="text-lg font-black text-stone-950">
              Rollback / restore evidence
            </h2>

            <p className="text-xs font-semibold text-stone-500">
              Append-only evidence. Restore verification is launch-blocking
              independently of other checks.
            </p>
          </div>
        </div>

        <form
          className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3"
          onSubmit={
            submitRecoveryEvidence
          }
        >
          <select
            className={
              inputClass
            }
            value={
              recoveryForm.evidenceType
            }
            onChange={
              (
                event,
              ) =>
                setRecoveryForm(
                  (
                    value,
                  ) => ({
                    ...value,

                    evidenceType:
                      event
                        .target
                        .value,
                  }),
                )
            }
            aria-label="Recovery evidence type"
          >
            <option value="restore_drill">
              Restore drill
            </option>

            <option value="rollback_drill">
              Rollback drill
            </option>
          </select>

          <select
            className={
              inputClass
            }
            value={
              recoveryForm.environment
            }
            onChange={
              (
                event,
              ) =>
                setRecoveryForm(
                  (
                    value,
                  ) => ({
                    ...value,

                    environment:
                      event
                        .target
                        .value,
                  }),
                )
            }
            aria-label="Recovery environment"
          >
            <option value="staging">
              Staging
            </option>

            <option value="production">
              Production
            </option>
          </select>

          <input
            required
            className={
              inputClass
            }
            value={
              recoveryForm.sourceSnapshotRef
            }
            onChange={
              (
                event,
              ) =>
                setRecoveryForm(
                  (
                    value,
                  ) => ({
                    ...value,

                    sourceSnapshotRef:
                      event
                        .target
                        .value,
                  }),
                )
            }
            placeholder="Source snapshot ref"
            aria-label="Source snapshot reference"
          />

          <input
            required
            className={
              inputClass
            }
            value={
              recoveryForm.restoredTargetRef
            }
            onChange={
              (
                event,
              ) =>
                setRecoveryForm(
                  (
                    value,
                  ) => ({
                    ...value,

                    restoredTargetRef:
                      event
                        .target
                        .value,
                  }),
                )
            }
            placeholder="Restored target ref"
            aria-label="Restored target reference"
          />

          <input
            required
            className={
              inputClass
            }
            type="datetime-local"
            value={
              recoveryForm.recoveryPointAt
            }
            onChange={
              (
                event,
              ) =>
                setRecoveryForm(
                  (
                    value,
                  ) => ({
                    ...value,

                    recoveryPointAt:
                      event
                        .target
                        .value,
                  }),
                )
            }
            aria-label="Recovery point time"
          />

          <input
            required
            className={
              inputClass
            }
            type="datetime-local"
            value={
              recoveryForm.startedAt
            }
            onChange={
              (
                event,
              ) =>
                setRecoveryForm(
                  (
                    value,
                  ) => ({
                    ...value,

                    startedAt:
                      event
                        .target
                        .value,
                  }),
                )
            }
            aria-label="Recovery start time"
          />

          <input
            required
            className={
              inputClass
            }
            type="datetime-local"
            value={
              recoveryForm.completedAt
            }
            onChange={
              (
                event,
              ) =>
                setRecoveryForm(
                  (
                    value,
                  ) => ({
                    ...value,

                    completedAt:
                      event
                        .target
                        .value,
                  }),
                )
            }
            aria-label="Recovery completion time"
          />

          <input
            required
            className={
              inputClass
            }
            value={
              recoveryForm.evidenceRef
            }
            onChange={
              (
                event,
              ) =>
                setRecoveryForm(
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
            placeholder="Evidence reference"
            aria-label="Recovery evidence reference"
          />

          <input
            required
            className={
              inputClass
            }
            value={
              recoveryForm.reason
            }
            onChange={
              (
                event,
              ) =>
                setRecoveryForm(
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
            aria-label="Recovery audit reason"
          />

          <div className="md:col-span-2 xl:col-span-3 grid gap-2 sm:grid-cols-3">
            {[
              [
                'integrityCheckPassed',
                'Integrity check passed',
              ],

              [
                'applicationSmokePassed',
                'Application smoke passed',
              ],

              [
                'tenantIsolationPassed',
                'Tenant isolation passed',
              ],
            ].map(
              (
                [
                  key,
                  label,
                ],
              ) => (
                <label
                  key={
                    key
                  }
                  className="flex items-center gap-2 rounded-xl border border-stone-200 p-3 text-sm font-bold text-stone-700"
                >
                  <input
                    type="checkbox"
                    checked={
                      recoveryForm[
                        key
                      ]
                    }
                    onChange={
                      (
                        event,
                      ) =>
                        setRecoveryForm(
                          (
                            value,
                          ) => ({
                            ...value,

                            [key]:
                              event
                                .target
                                .checked,
                          }),
                        )
                    }
                  />

                  {label}
                </label>
              ),
            )}
          </div>

          <textarea
            className={`${inputClass} md:col-span-2 xl:col-span-3`}
            rows={3}
            value={
              recoveryForm.notes
            }
            onChange={
              (
                event,
              ) =>
                setRecoveryForm(
                  (
                    value,
                  ) => ({
                    ...value,

                    notes:
                      event
                        .target
                        .value,
                  }),
                )
            }
            placeholder="Recovery notes"
            aria-label="Recovery notes"
          />

          <button
            type="submit"
            disabled={
              busy
            }
            className={`${buttonClass} md:col-span-2 xl:col-span-3`}
          >
            Record recovery evidence
          </button>
        </form>
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-2">
        <div className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-black text-stone-950">
            Recent Launch Gate runs
          </h2>

          <div className="mt-4 space-y-3">
            {launchRuns
              .slice(
                0,
                10,
              )
              .map(
                (
                  run,
                ) => (
                  <article
                    key={
                      run.id
                    }
                    className="rounded-2xl border border-stone-200 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-stone-950">
                          {run.releaseRef}
                        </p>

                        <p className="mt-1 text-xs font-semibold text-stone-500">
                          {run.environment}
                          {' · '}
                          {formatDate(
                            run.completedAt,
                          )}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                          run.status ===
                          'passed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {titleize(
                          run.status,
                        )}
                      </span>
                    </div>

                    {run.blockerCodes
                      ?.length ? (
                      <p className="mt-2 text-xs font-semibold text-red-700">
                        {run.blockerCodes.join(
                          ', ',
                        )}
                      </p>
                    ) : null}
                  </article>
                ),
              )}
          </div>
        </div>

        <div className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-black text-stone-950">
            Recent recovery evidence
          </h2>

          <div className="mt-4 space-y-3">
            {recoveryEvidence
              .slice(
                0,
                10,
              )
              .map(
                (
                  item,
                ) => (
                  <article
                    key={
                      item.id
                    }
                    className="rounded-2xl border border-stone-200 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-stone-950">
                          {titleize(
                            item.evidenceType,
                          )}
                          {' · '}
                          {item.environment}
                        </p>

                        <p className="mt-1 text-xs font-semibold text-stone-500">
                          {formatDate(
                            item.completedAt,
                          )}
                          {' · '}
                          {item.sourceSnapshotRef}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                          item.verified
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.verified
                          ? 'Verified'
                          : 'Unverified'}
                      </span>
                    </div>
                  </article>
                ),
              )}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-2">
        <div className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-black text-stone-950">
            Security telemetry
          </h2>

          <div className="mt-4 space-y-2">
            {securityEvents
              .slice(
                0,
                10,
              )
              .map(
                (
                  event,
                ) => (
                  <p
                    key={
                      event.id ||
                      event.securityEventId
                    }
                    className="rounded-xl bg-stone-50 p-3 text-xs font-semibold text-stone-600"
                  >
                    {titleize(
                      event.eventType,
                    )}
                    {' · '}
                    {event.severity}
                    {' · '}
                    {formatDate(
                      event.occurredAt,
                    )}
                  </p>
                ),
              )}
          </div>
        </div>

        <div className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-black text-stone-950">
            Job recovery evidence
          </h2>

          <div className="mt-4 space-y-2">
            {jobRuns
              .slice(
                0,
                10,
              )
              .map(
                (
                  job,
                ) => (
                  <p
                    key={
                      job.id
                    }
                    className="rounded-xl bg-stone-50 p-3 text-xs font-semibold text-stone-600"
                  >
                    {job.jobType}
                    {' · attempt '}
                    {job.attemptNumber}
                    {' · '}
                    {titleize(
                      job.status,
                    )}
                    {' · '}
                    {job.durationMs}
                    ms
                  </p>
                ),
              )}
          </div>
        </div>
      </section>
    </AdminShell>
  )
}