import crypto from 'crypto'

import mongoose from 'mongoose'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  recordAdminAuditEvent,
} from '../admin/adminAudit.service.js'

import {
  AdminIncident,
} from '../adminGovernance/adminGovernance.models.js'

import {
  listSecurityEvents,
  recordSecurityEventBestEffort,
} from '../hardening/hardening.service.js'

import {
  JobRun,
  LaunchGateRun,
  RecoveryEvidence,
} from './reliability.models.js'

import {
  getDeploymentSecurityOverview,
} from './deploymentSecurity.service.js'

const DEFAULT_PARTNER_TIMEOUT_MS =
  3000

const DEFAULT_CIRCUIT_FAILURE_THRESHOLD =
  3

const DEFAULT_CIRCUIT_RESET_MS =
  60 * 1000

const circuitStates =
  new Map()

function fingerprint(
  value,
) {
  if (
    value === undefined
  ) {
    return ''
  }

  return crypto
    .createHash(
      'sha256',
    )
    .update(
      JSON.stringify(
        value,
      ),
    )
    .digest(
      'hex',
    )
}

function normalizeErrorCode(
  error,
) {
  return String(
    error?.code ||
      error?.name ||
      'JOB_EXECUTION_FAILED',
  ).slice(
    0,
    160,
  )
}

export async function getReadinessStatus() {
  const databaseConnected =
    mongoose.connection.readyState ===
    1

  const openCircuits =
    getPartnerCircuitSnapshot()
      .filter(
        (item) =>
          item.state ===
          'open',
      )

  return {
    ready:
      databaseConnected,

    components: {
      database: {
        required:
          true,

        state:
          databaseConnected
            ? 'connected'
            : 'disconnected',
      },

      partnerCircuits: {
        required:
          false,

        state:
          openCircuits.length
            ? 'degraded'
            : 'healthy',

        openCount:
          openCircuits.length,
      },
    },

    timestamp:
      new Date().toISOString(),
  }
}

export function getLivenessStatus() {
  return {
    live:
      true,

    processUptimeSeconds:
      Math.floor(
        process.uptime(),
      ),

    timestamp:
      new Date().toISOString(),
  }
}

async function recordJobAttempt({
  jobType,
  jobKey,
  idempotencyKey,
  correlationId,
  attemptNumber,
  status,
  startedAt,
  finishedAt,
  retryable,
  errorCode = '',
  result = undefined,
}) {
  return JobRun.create({
    jobVersion:
      1,

    jobType,
    jobKey,
    idempotencyKey,
    correlationId,
    attemptNumber,
    status,
    startedAt,
    finishedAt,

    durationMs:
      Math.max(
        0,
        finishedAt.getTime() -
          startedAt.getTime(),
      ),

    retryable,
    errorCode,

    resultFingerprint:
      fingerprint(
        result,
      ),
  })
}

export async function runRecoverableJob({
  jobType,
  jobKey,
  idempotencyKey,
  correlationId = '',
  maxAttempts = 3,
  safeToRetry = false,
  handler,
}) {
  if (
    typeof handler !==
    'function'
  ) {
    throw new TypeError(
      'runRecoverableJob requires a handler.',
    )
  }

  const succeeded =
    await JobRun.findOne({
      jobType,
      idempotencyKey,
      status:
        'succeeded',
    })
      .sort({
        attemptNumber:
          -1,
      })
      .lean()

  if (succeeded) {
    return {
      deduplicated:
        true,

      jobRunId:
        succeeded.jobRunId,

      result:
        null,
    }
  }

  const previous =
    await JobRun.findOne({
      jobType,
      idempotencyKey,
    })
      .sort({
        attemptNumber:
          -1,
      })
      .lean()

  const allowedAttempts =
    safeToRetry
      ? Math.max(
          1,
          Math.min(
            Number(maxAttempts) ||
              1,
            5,
          ),
        )
      : 1

  let lastError =
    null

  for (
    let offset = 1;
    offset <=
    allowedAttempts;
    offset += 1
  ) {
    const attemptNumber =
      Number(
        previous?.attemptNumber ||
        0,
      ) +
      offset

    const startedAt =
      new Date()

    try {
      const result =
        await handler({
          attemptNumber,
          correlationId,
        })

      const finishedAt =
        new Date()

      const jobRun =
        await recordJobAttempt({
          jobType,
          jobKey,
          idempotencyKey,
          correlationId,
          attemptNumber,

          status:
            'succeeded',

          startedAt,
          finishedAt,

          retryable:
            false,

          result,
        })

      return {
        deduplicated:
          false,

        jobRunId:
          jobRun.jobRunId,

        result,
      }
    } catch (error) {
      lastError =
        error

      const finishedAt =
        new Date()

      const willRetry =
        safeToRetry &&
        offset <
          allowedAttempts

      await recordJobAttempt({
        jobType,
        jobKey,
        idempotencyKey,
        correlationId,
        attemptNumber,

        status:
          'failed',

        startedAt,
        finishedAt,

        retryable:
          willRetry,

        errorCode:
          normalizeErrorCode(
            error,
          ),
      })
    }
  }

  throw lastError
}

function circuitKey({
  partnerKey,
  operationKey,
}) {
  return `${partnerKey}:${operationKey}`
}

function currentCircuitState(
  key,
) {
  const existing =
    circuitStates.get(
      key,
    ) ||
    {
      state:
        'closed',

      failureCount:
        0,

      openedAt:
        null,

      lastFailureAt:
        null,

      lastSuccessAt:
        null,
    }

  return existing
}

function saveCircuitState(
  key,
  state,
) {
  circuitStates.set(
    key,
    state,
  )

  return state
}

function staleFallback({
  data,
  observedAt,
  freshnessTtlMs,
  reason,
}) {
  return {
    data,

    authoritative:
      false,

    freshnessState:
      'stale_non_authoritative',

    observedAt:
      observedAt ||
      null,

    freshnessTtlMs:
      freshnessTtlMs ||
      null,

    fallbackReason:
      reason,
  }
}

async function withTimeout(
  operation,
  timeoutMs,
) {
  let timer =
    null

  try {
    return await Promise.race([
      operation(),

      new Promise(
        (
          resolve,
          reject,
        ) => {
          timer =
            setTimeout(
              () => {
                const error =
                  new Error(
                    'Partner operation timed out.',
                  )

                error.code =
                  'PARTNER_TIMEOUT'

                reject(
                  error,
                )
              },
              timeoutMs,
            )
        },
      ),
    ])
  } finally {
    if (timer) {
      clearTimeout(
        timer,
      )
    }
  }
}

export async function executePartnerOperation({
  partnerKey,
  operationKey,
  handler,
  timeoutMs = DEFAULT_PARTNER_TIMEOUT_MS,
  safeToRetry = false,
  maxAttempts = 2,
  failureThreshold = DEFAULT_CIRCUIT_FAILURE_THRESHOLD,
  resetAfterMs = DEFAULT_CIRCUIT_RESET_MS,
  allowStaleFallback = false,
  lastKnownData = null,
  lastKnownObservedAt = null,
  freshnessTtlMs = null,
  correlationId = '',
}) {
  if (
    typeof handler !==
    'function'
  ) {
    throw new TypeError(
      'executePartnerOperation requires a handler.',
    )
  }

  const key =
    circuitKey({
      partnerKey,
      operationKey,
    })

  const state =
    currentCircuitState(
      key,
    )

  const now =
    Date.now()

  if (
    state.state ===
      'open' &&
    state.openedAt &&
    now -
      new Date(
        state.openedAt,
      ).getTime() <
      resetAfterMs
  ) {
    if (
      allowStaleFallback &&
      lastKnownData !==
        null
    ) {
      return staleFallback({
        data:
          lastKnownData,

        observedAt:
          lastKnownObservedAt,

        freshnessTtlMs,

        reason:
          'circuit_open',
      })
    }

    throw new ApiError(
      503,
      'External partner is temporarily unavailable.',
      [
        {
          code:
            'PARTNER_CIRCUIT_OPEN',

          partnerKey,
          operationKey,
        },
      ],
    )
  }

  if (
    state.state ===
      'open'
  ) {
    state.state =
      'half_open'
  }

  const attempts =
    safeToRetry
      ? Math.max(
          1,
          Math.min(
            Number(maxAttempts) ||
              1,
            3,
          ),
        )
      : 1

  let lastError =
    null

  for (
    let attempt = 1;
    attempt <=
    attempts;
    attempt += 1
  ) {
    try {
      const data =
        await withTimeout(
          handler,
          Math.max(
            100,
            Number(timeoutMs) ||
              DEFAULT_PARTNER_TIMEOUT_MS,
          ),
        )

      saveCircuitState(
        key,
        {
          state:
            'closed',

          failureCount:
            0,

          openedAt:
            null,

          lastFailureAt:
            state.lastFailureAt,

          lastSuccessAt:
            new Date(),
        },
      )

      return {
        data,

        authoritative:
          true,

        freshnessState:
          'fresh',

        observedAt:
          new Date(),

        freshnessTtlMs:
          freshnessTtlMs ||
          null,
      }
    } catch (error) {
      lastError =
        error
    }
  }

  const nextFailureCount =
    Number(
      state.failureCount ||
      0,
    ) +
    1

  const shouldOpen =
    nextFailureCount >=
    failureThreshold

  saveCircuitState(
    key,
    {
      state:
        shouldOpen
          ? 'open'
          : 'closed',

      failureCount:
        nextFailureCount,

      openedAt:
        shouldOpen
          ? new Date()
          : null,

      lastFailureAt:
        new Date(),

      lastSuccessAt:
        state.lastSuccessAt,
    },
  )

  await recordSecurityEventBestEffort({
    eventType:
      shouldOpen
        ? 'partner_circuit_opened'
        : 'partner_operation_failed',

    severity:
      shouldOpen
        ? 'warning'
        : 'info',

    sourceDomain:
      'reliability',

    correlationId,

    metadata: {
      partnerKey,
      operationKey,

      failureCount:
        nextFailureCount,

      errorCode:
        normalizeErrorCode(
          lastError,
        ),
    },
  })

  if (
    allowStaleFallback &&
    lastKnownData !==
      null
  ) {
    return staleFallback({
      data:
        lastKnownData,

      observedAt:
        lastKnownObservedAt,

      freshnessTtlMs,

      reason:
        'partner_failure',
    })
  }

  throw new ApiError(
    503,
    'External partner request failed.',
    [
      {
        code:
          'PARTNER_OPERATION_FAILED',

        partnerKey,
        operationKey,

        causeCode:
          normalizeErrorCode(
            lastError,
          ),
      },
    ],
  )
}

export function getPartnerCircuitSnapshot() {
  return [
    ...circuitStates.entries(),
  ].map(
    ([
      key,
      state,
    ]) => ({
      key,
      ...state,
    }),
  )
}

export async function listJobRuns({
  limit = 100,
  status = null,
}) {
  const filter = {}

  if (status) {
    filter.status =
      status
  }

  const records =
    await JobRun.find(
      filter,
    )
      .sort({
        finishedAt:
          -1,
      })
      .limit(
        Math.min(
          Math.max(
            Number(limit) ||
              100,
            1,
          ),
          200,
        ),
      )
      .lean()

  return {
    jobRuns:
      records.map(
        (record) => ({
          id:
            String(
              record._id,
            ),

          jobRunId:
            record.jobRunId,

          jobType:
            record.jobType,

          jobKey:
            record.jobKey,

          correlationId:
            record.correlationId,

          attemptNumber:
            record.attemptNumber,

          status:
            record.status,

          startedAt:
            record.startedAt,

          finishedAt:
            record.finishedAt,

          durationMs:
            record.durationMs,

          retryable:
            record.retryable,

          errorCode:
            record.errorCode,
        }),
      ),
  }
}

export async function getReliabilityOverview() {
  const [
    readiness,
    failedJobCount,
    security,
    deploymentSecurity,
  ] = await Promise.all([
    getReadinessStatus(),

    JobRun.countDocuments({
      status:
        'failed',

      finishedAt: {
        $gte:
          new Date(
            Date.now() -
            24 *
              60 *
              60 *
              1000,
          ),
      },
    }),

    listSecurityEvents({
      limit:
        20,
    }),

    getDeploymentSecurityOverview(),
  ])

  return {
    readiness,

    failedJobsLast24Hours:
      failedJobCount,

    partnerCircuits:
      getPartnerCircuitSnapshot(),

    recentSecurityEvents:
      security.securityEvents,

    deploymentSecurity,

    policy: {
      stalePartnerDataMayBeUsedOnlyWhenExplicitlyNonAuthoritative:
        true,

      unsafeEconomicRetriesAllowed:
        false,

      queueProviderRequiredForCurrentBatch:
        false,
    },
  }
}

const RECENT_RESTORE_EVIDENCE_REQUIRED =
  Object.freeze({
    code:
      'RECENT_RESTORE_EVIDENCE_REQUIRED',

    maximumAgeDays:
      90,
  })

const LAUNCH_GATE_EVIDENCE_CONTRACT =
  Object.freeze([
    [
      'security_regression',
      'securityRegression',
    ],

    [
      'recipe_scaling',
      'recipeScaling',
    ],

    [
      'pantry_exclusion',
      'pantryExclusion',
    ],

    [
      'landed_cost',
      'landedCost',
    ],

    [
      'nutrition_traceability',
      'nutritionTraceability',
    ],

    [
      'allergen_fail_closed',
      'allergenFailClosed',
    ],

    [
      'ai_adversarial',
      'aiAdversarial',
    ],

    [
      'economic_idempotency',
      'economicIdempotency',
    ],

    [
      'tenant_isolation',
      'tenantIsolation',
    ],

    [
      'dish_passport_reproducibility',
      'dishPassportReproducibility',
    ],

    [
      'privileged_audit',
      'privilegedAudit',
    ],

    [
      'privacy_jurisdiction_review',
      'privacyJurisdictionReview',
    ],

    [
      'load_regression',
      'loadRegression',
    ],

    [
      'browser_accessibility',
      'browserAccessibility',
    ],
  ])

function reliabilityActorId(
  actorUser,
) {
  const value =
    actorUser?._id ||
    actorUser?.id

  if (!value) {
    throw new ApiError(
      401,
      'Authenticated administrative identity is required.',
      [
        {
          code:
            'M20_RELIABILITY_ACTOR_REQUIRED',
        },
      ],
    )
  }

  return value
}

function serializeRecoveryEvidence(
  value,
) {
  const item =
    typeof value?.toObject ===
      'function'
      ? value.toObject()
      : value

  return {
    id:
      String(
        item._id,
      ),

    recoveryEvidenceId:
      item.recoveryEvidenceId,

    evidenceType:
      item.evidenceType,

    environment:
      item.environment,

    sourceSnapshotRef:
      item.sourceSnapshotRef,

    restoredTargetRef:
      item.restoredTargetRef,

    recoveryPointAt:
      item.recoveryPointAt,

    startedAt:
      item.startedAt,

    completedAt:
      item.completedAt,

    verificationChecks:
      item.verificationChecks,

    verified:
      item.verified ===
      true,

    evidenceRefs:
      item.evidenceRefs ||
      [],

    notes:
      item.notes ||
      '',

    recordedByUserId:
      item.recordedByUserId
        ? String(
            item.recordedByUserId,
          )
        : null,
  }
}

function serializeLaunchGateRun(
  value,
) {
  const item =
    typeof value?.toObject ===
      'function'
      ? value.toObject()
      : value

  return {
    id:
      String(
        item._id,
      ),

    launchGateRunId:
      item.launchGateRunId,

    releaseRef:
      item.releaseRef,

    environment:
      item.environment,

    inputFingerprint:
      item.inputFingerprint,

    status:
      item.status,

    gateResults:
      item.gateResults ||
      [],

    blockerCodes:
      item.blockerCodes ||
      [],

    activeIncidentRefs:
      item.activeIncidentRefs ||
      [],

    recoveryEvidenceRef:
      item.recoveryEvidenceRef ||
      '',

    startedAt:
      item.startedAt,

    completedAt:
      item.completedAt,

    executedByUserId:
      item.executedByUserId
        ? String(
            item.executedByUserId,
          )
        : null,
  }
}

function normalizedEvidenceItem(
  value,
) {
  if (!value) {
    return {
      status:
        'not_run',

      evidenceRef:
        '',

      observedAt:
        null,

      summary:
        '',
    }
  }

  return {
    status:
      value.status,

    evidenceRef:
      value.evidenceRef ||
      '',

    observedAt:
      value.observedAt ||
      null,

    summary:
      value.summary ||
      '',
  }
}

function evidenceGateResult({
  gateKey,
  evidence,
}) {
  const normalized =
    normalizedEvidenceItem(
      evidence,
    )

  const passed =
    normalized.status ===
      'pass' &&
    Boolean(
      normalized.evidenceRef,
    )

  return {
    gateKey,
    passed,

    blockerCode:
      passed
        ? ''
        : `${gateKey.toUpperCase()}_EVIDENCE_REQUIRED`,

    evidence:
      normalized,
  }
}

async function findActiveLaunchBlockingIncidents() {
  const records =
    await AdminIncident.find({
      severity: {
        $in: [
          'high',
          'critical',
        ],
      },

      status: {
        $in: [
          'investigating',
          'monitoring',
        ],
      },
    })
      .sort({
        startedAt:
          1,

        incidentKey:
          1,
      })
      .select(
        '_id incidentKey severity status domain title startedAt',
      )
      .lean()

  return records.map(
    (item) => ({
      id:
        String(
          item._id,
        ),

      incidentKey:
        item.incidentKey,

      severity:
        item.severity,

      status:
        item.status,

      domain:
        item.domain,

      title:
        item.title,

      startedAt:
        item.startedAt,
    }),
  )
}

async function findRecentVerifiedRestoreEvidence({
  environment,

  maximumAgeDays =
    RECENT_RESTORE_EVIDENCE_REQUIRED
      .maximumAgeDays,
}) {
  const cutoff =
    new Date(
      Date.now() -
        maximumAgeDays *
          24 *
          60 *
          60 *
          1000,
    )

  return RecoveryEvidence.findOne({
    evidenceType:
      'restore_drill',

    environment,

    verified:
      true,

    completedAt: {
      $gte:
        cutoff,
    },
  })
    .sort({
      completedAt:
        -1,
    })
    .lean()
}

async function auditReliabilityMutation({
  actorUser,
  adminAuthorization,
  entityType,
  entityId,
  reason,
  afterSnapshot,
  requestId,
}) {
  return recordAdminAuditEvent({
    actorUser,
    adminAuthorization,

    action:
      'trust_safety.mutate',

    permissionKey:
      'trust_safety.mutate',

    entityType,
    entityId,

    outcome:
      'success',

    reasonCode:
      'trust_safety.enforcement',

    reasonDetails:
      reason,

    afterSnapshot,

    metadata: {
      m20LaunchGovernance:
        true,
    },

    requestId,
  })
}

export async function recordRecoveryEvidence({
  input,
  actorUser,
  adminAuthorization,
  requestId = '',
}) {
  const userId =
    reliabilityActorId(
      actorUser,
    )

  const startedAt =
    new Date(
      input.startedAt,
    )

  const completedAt =
    new Date(
      input.completedAt,
    )

  const recoveryPointAt =
    new Date(
      input.recoveryPointAt,
    )

  if (
    completedAt <
    startedAt
  ) {
    throw new ApiError(
      400,
      'Recovery completion cannot precede its start.',
      [
        {
          code:
            'RECOVERY_TIME_RANGE_INVALID',
        },
      ],
    )
  }

  if (
    recoveryPointAt >
    completedAt
  ) {
    throw new ApiError(
      400,
      'Recovery point cannot be later than verification completion.',
      [
        {
          code:
            'RECOVERY_POINT_INVALID',
        },
      ],
    )
  }

  const verified =
    input.verificationChecks
      .integrityCheckPassed ===
      true &&
    input.verificationChecks
      .applicationSmokePassed ===
      true &&
    input.verificationChecks
      .tenantIsolationPassed ===
      true &&
    input.evidenceRefs.length >
      0

  const record =
    await RecoveryEvidence.create({
      evidenceType:
        input.evidenceType,

      environment:
        input.environment,

      sourceSnapshotRef:
        input.sourceSnapshotRef,

      restoredTargetRef:
        input.restoredTargetRef,

      recoveryPointAt,
      startedAt,
      completedAt,

      verificationChecks:
        input.verificationChecks,

      verified,

      evidenceRefs:
        input.evidenceRefs,

      notes:
        input.notes ||
        '',

      recordedByUserId:
        userId,
    })

  const serialized =
    serializeRecoveryEvidence(
      record,
    )

  await auditReliabilityMutation({
    actorUser,
    adminAuthorization,

    entityType:
      'recovery_evidence',

    entityId:
      record._id,

    reason:
      input.reason,

    afterSnapshot:
      serialized,

    requestId,
  })

  return {
    recoveryEvidence:
      serialized,
  }
}

export async function listRecoveryEvidence({
  limit = 100,
  evidenceType = null,
  environment = null,
} = {}) {
  const filter = {}

  if (evidenceType) {
    filter.evidenceType =
      evidenceType
  }

  if (environment) {
    filter.environment =
      environment
  }

  const records =
    await RecoveryEvidence.find(
      filter,
    )
      .sort({
        completedAt:
          -1,
      })
      .limit(
        Math.min(
          Math.max(
            Number(
              limit,
            ) ||
              100,
            1,
          ),
          200,
        ),
      )
      .lean()

  return {
    recoveryEvidence:
      records.map(
        serializeRecoveryEvidence,
      ),

    launchRequirement: {
      code:
        RECENT_RESTORE_EVIDENCE_REQUIRED
          .code,

      maximumAgeDays:
        90,
    },
  }
}

export async function runLaunchGate({
  input,
  actorUser,
  adminAuthorization,
  requestId = '',
}) {
  const userId =
    reliabilityActorId(
      actorUser,
    )

  const startedAt =
    new Date()

  const [
    activeIncidents,
    restoreEvidence,
  ] = await Promise.all([
    findActiveLaunchBlockingIncidents(),

    findRecentVerifiedRestoreEvidence({
      environment:
        input.environment,
    }),
  ])

  const suppliedGateResults =
    LAUNCH_GATE_EVIDENCE_CONTRACT.map(
      ([
        gateKey,
        inputKey,
      ]) =>
        evidenceGateResult({
          gateKey,

          evidence:
            input.evidence[
              inputKey
            ],
        }),
    )

  const incidentGate = {
    gateKey:
      'm17_incident_blockers',

    passed:
      activeIncidents.length ===
      0,

    blockerCode:
      activeIncidents.length
        ? 'ACTIVE_HIGH_CRITICAL_INCIDENT'
        : '',

    incidents:
      activeIncidents,
  }

  const restoreGate = {
    gateKey:
      'verified_restore_drill',

    passed:
      Boolean(
        restoreEvidence,
      ),

    blockerCode:
      restoreEvidence
        ? ''
        : RECENT_RESTORE_EVIDENCE_REQUIRED
            .code,

    maximumAgeDays:
      90,

    recoveryEvidenceRef:
      restoreEvidence
        ?.recoveryEvidenceId ||
      '',
  }

  const gateResults = [
    ...suppliedGateResults,
    incidentGate,
    restoreGate,
  ]

  const blockerCodes =
    gateResults
      .filter(
        (gate) =>
          gate.passed !==
          true,
      )
      .map(
        (gate) =>
          gate.blockerCode,
      )
      .filter(
        Boolean,
      )

  const deterministicInput = {
    releaseRef:
      input.releaseRef,

    environment:
      input.environment,

    evidence:
      Object.fromEntries(
        LAUNCH_GATE_EVIDENCE_CONTRACT.map(
          ([
            gateKey,
            inputKey,
          ]) => [
            gateKey,

            normalizedEvidenceItem(
              input.evidence[
                inputKey
              ],
            ),
          ],
        ),
      ),

    activeIncidents,

    restoreEvidence:
      restoreEvidence
        ? serializeRecoveryEvidence(
            restoreEvidence,
          )
        : null,
  }

  const completedAt =
    new Date()

  const record =
    await LaunchGateRun.create({
      releaseRef:
        input.releaseRef,

      environment:
        input.environment,

      inputFingerprint:
        fingerprint(
          deterministicInput,
        ),

      status:
        blockerCodes.length
          ? 'blocked'
          : 'passed',

      gateResults,
      blockerCodes,

      activeIncidentRefs:
        activeIncidents.map(
          (incident) =>
            incident.incidentKey,
        ),

      recoveryEvidenceRef:
        restoreEvidence
          ?.recoveryEvidenceId ||
        '',

      deterministicInput,

      startedAt,
      completedAt,

      executedByUserId:
        userId,
    })

  const serialized =
    serializeLaunchGateRun(
      record,
    )

  await auditReliabilityMutation({
    actorUser,
    adminAuthorization,

    entityType:
      'launch_gate_run',

    entityId:
      record._id,

    reason:
      input.reason,

    afterSnapshot:
      serialized,

    requestId,
  })

  await recordSecurityEventBestEffort({
    eventType:
      blockerCodes.length
        ? 'launch_gate_blocked'
        : 'launch_gate_passed',

    severity:
      blockerCodes.length
        ? 'warning'
        : 'info',

    sourceDomain:
      'reliability',

    requestId,

    actorUserId:
      userId,

    metadata: {
      launchGateRunId:
        record.launchGateRunId,

      releaseRef:
        input.releaseRef,

      blockerCodes,
    },
  })

  return {
    launchGateRun:
      serialized,
  }
}

export async function listLaunchGateRuns({
  limit = 100,
  status = null,
  environment = null,
} = {}) {
  const filter = {}

  if (status) {
    filter.status =
      status
  }

  if (environment) {
    filter.environment =
      environment
  }

  const records =
    await LaunchGateRun.find(
      filter,
    )
      .sort({
        completedAt:
          -1,
      })
      .limit(
        Math.min(
          Math.max(
            Number(
              limit,
            ) ||
              100,
            1,
          ),
          200,
        ),
      )
      .lean()

  return {
    launchGateRuns:
      records.map(
        serializeLaunchGateRun,
      ),
  }
}