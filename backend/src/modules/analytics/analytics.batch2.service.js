import crypto from 'crypto'

import mongoose from 'mongoose'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  HospitalityMemberGrant,
} from '../hospitality/hospitality.models.js'

import {
  MarketplaceOrganization,
} from '../marketplace/marketplace.models.js'

import {
  AnalyticsEvent,
  AttributionEvent,
  MetricAggregate,
} from './analytics.models.js'

import {
  deriveAnalyticsActorType,
  pseudonymizeAnalyticsIdentifier,
  recordAnalyticsEventBestEffort,
} from './analytics.service.js'

import {
  ExperimentAssignment,
  ExperimentDefinition,
} from './analytics.batch2.models.js'

const MAX_REPORT_DAYS =
  90

const PROHIBITED_EXPERIMENT_TERMS = Object.freeze([
  /allerg/i,
  /unknown[_\s-]*(safe|free)/i,
  /nutrition[_\s-]*safety/i,
  /medical/i,
  /auth(entication|orization)?/i,
  /mfa/i,
  /password/i,
  /payment[_\s-]*(verify|verification)/i,
  /tenant[_\s-]*(scope|isolation)/i,
  /permission/i,
  /role[_\s-]*(gate|access|authorization)/i,
  /super[_\s-]*admin/i,
  /host[_\s-]*access/i,
  /regulatory[_\s-]*(safety|compliance)/i,
])

function id(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null
  }

  return String(
    value?._id ||
      value?.id ||
      value,
  )
}

function actorId(
  actorUser,
) {
  const value =
    actorUser?._id ||
    actorUser?.id

  if (!value) {
    throw new ApiError(
      401,
      'Authenticated EPANTRY identity is required.',
      [
        {
          code:
            'ANALYTICS_ACTOR_REQUIRED',
        },
      ],
    )
  }

  return value
}

function assertRootSuperAdmin(
  adminAuthorization,
) {
  if (
    adminAuthorization?.isRootSuperAdmin ===
    true
  ) {
    return
  }

  throw new ApiError(
    403,
    'Real Super Admin authority is required to configure experiments.',
    [
      {
        code:
          'EXPERIMENT_ROOT_SUPER_ADMIN_REQUIRED',
      },
    ],
  )
}

function adminHasPermission(
  adminAuthorization,
  permissionKey,
) {
  return (
    adminAuthorization?.isRootSuperAdmin ===
      true ||
    (
      adminAuthorization?.permissionKeys ||
      []
    ).includes(
      permissionKey,
    )
  )
}

function normalizeExperimentKey(
  value,
) {
  return String(
    value ||
      '',
  )
    .trim()
    .toLowerCase()
}

function assertExperimentSafety(
  input,
) {
  const inspect = [
    input.experimentKey,
    input.name,
    input.description,
    input.surfaceType,
    input.surfaceKey,
    input.featureFlagKey,
    input.primaryUtilityMetricKey,
    ...(
      input.guardrailMetricKeys ||
      []
    ),
    ...(
      input.variants ||
      []
    ).flatMap(
      (variant) => [
        variant.key,
        variant.label,
      ],
    ),
  ]
    .filter(Boolean)
    .join(' ')

  const prohibited =
    PROHIBITED_EXPERIMENT_TERMS.find(
      (pattern) =>
        pattern.test(
          inspect,
        ),
    )

  if (prohibited) {
    throw new ApiError(
      409,
      'Experiment touches a safety, authorization, payment-verification or tenant-isolation boundary and is prohibited.',
      [
        {
          code:
            'EXPERIMENT_SAFETY_BOUNDARY_PROHIBITED',
        },
      ],
    )
  }

  if (
    input.surfaceType ===
      'notification_utility' &&
    input.holdoutRequired !==
      true
  ) {
    throw new ApiError(
      409,
      'Notification utility experiments require a holdout/control group.',
      [
        {
          code:
            'EXPERIMENT_NOTIFICATION_HOLDOUT_REQUIRED',
        },
      ],
    )
  }

  const utilityMetric =
    String(
      input.primaryUtilityMetricKey ||
        '',
    ).toLowerCase()

  if (
    input.surfaceType ===
      'notification_utility' &&
    !(
      utilityMetric.includes(
        'utility',
      ) ||
      utilityMetric.includes(
        'correction',
      ) ||
      utilityMetric.includes(
        'effort',
      )
    )
  ) {
    throw new ApiError(
      409,
      'Notification experiments must optimize utility, correction or reduced effort rather than clicks alone.',
      [
        {
          code:
            'EXPERIMENT_UTILITY_METRIC_REQUIRED',
        },
      ],
    )
  }
}

function serializeExperimentDefinition(
  value,
) {
  const item =
    typeof value?.toObject ===
    'function'
      ? value.toObject()
      : value

  if (!item) {
    return null
  }

  return {
    id:
      id(
        item._id,
      ),
    experimentKey:
      item.experimentKey,
    versionNumber:
      item.versionNumber,
    name:
      item.name,
    description:
      item.description,
    surfaceType:
      item.surfaceType,
    surfaceKey:
      item.surfaceKey,
    featureFlagKey:
      item.featureFlagKey,
    eligibleActorTypes:
      item.eligibleActorTypes ||
      [],
    allocationBasisPoints:
      item.allocationBasisPoints,
    variants:
      item.variants ||
      [],
    primaryUtilityMetricKey:
      item.primaryUtilityMetricKey,
    guardrailMetricKeys:
      item.guardrailMetricKeys ||
      [],
    holdoutRequired:
      item.holdoutRequired ===
      true,
    status:
      item.status,
    activatedAt:
      item.activatedAt ||
      null,
    pausedAt:
      item.pausedAt ||
      null,
    endedAt:
      item.endedAt ||
      null,
    lifecycleReason:
      item.lifecycleReason ||
      '',
    createdAt:
      item.createdAt ||
      null,
  }
}

function serializeExperimentAssignment(
  value,
) {
  const item =
    typeof value?.toObject ===
    'function'
      ? value.toObject()
      : value

  if (!item) {
    return null
  }

  return {
    assignmentId:
      item.assignmentId,
    experimentKey:
      item.experimentKey,
    experimentVersion:
      item.experimentVersion,
    actorType:
      item.actorType,
    variantKey:
      item.variantKey,
    bucket:
      item.bucket,
    assignedAt:
      item.assignedAt,
    exposedAt:
      item.exposedAt ||
      null,
    lastExposedAt:
      item.lastExposedAt ||
      null,
    exposureCount:
      item.exposureCount ||
      0,
  }
}

async function findFeatureFlag(
  featureFlagKey,
) {
  const key =
    normalizeExperimentKey(
      featureFlagKey,
    )

  /*
  | M17 owns the featureFlags collection and its governance lifecycle.
  |
  | M19 only consumes the deployed flag state as an experiment-eligibility
  | gate. It does not import or compile a second M17 persistence model, and it
  | never treats a FeatureFlag as authorization. Using the existing collection
  | directly also keeps M19 compatible with the frozen M17 model export name.
  */
  return mongoose.connection
    .collection(
      'featureFlags',
    )
    .findOne({
      $or: [
        {
          key,
        },
        {
          flagKey:
            key,
        },
        {
          slug:
            key,
        },
      ],
    })
}

function featureFlagEnabled(
  flag,
) {
  if (!flag) {
    return false
  }

  return (
    flag.enabled ===
      true ||
    flag.isEnabled ===
      true ||
    flag.state ===
      'enabled' ||
    flag.status ===
      'enabled' ||
    flag.status ===
      'active'
  )
}

async function assertFeatureFlagEnabled(
  featureFlagKey,
) {
  const flag =
    await findFeatureFlag(
      featureFlagKey,
    )

  if (
    !featureFlagEnabled(
      flag,
    )
  ) {
    throw new ApiError(
      409,
      'Experiment is gated by an M17 feature flag that is not enabled.',
      [
        {
          code:
            'EXPERIMENT_FEATURE_FLAG_DISABLED',
          featureFlagKey,
        },
      ],
    )
  }

  return flag
}

export async function createExperimentDefinition({
  input,
  actorUser,
  adminAuthorization,
}) {
  assertRootSuperAdmin(
    adminAuthorization,
  )

  assertExperimentSafety(
    input,
  )

  const experimentKey =
    normalizeExperimentKey(
      input.experimentKey,
    )

  const latest =
    await ExperimentDefinition.findOne({
      experimentKey,
    })
      .sort({
        versionNumber:
          -1,
      })
      .lean()

  if (
    latest &&
    [
      'draft',
      'active',
      'paused',
    ].includes(
      latest.status,
    )
  ) {
    throw new ApiError(
      409,
      'End the current Experiment Definition version before creating another version.',
      [
        {
          code:
            'EXPERIMENT_OPEN_VERSION_EXISTS',
        },
      ],
    )
  }

  const created =
    await ExperimentDefinition.create({
      experimentKey,
      versionNumber:
        Number(
          latest?.versionNumber ||
            0,
        ) +
        1,
      name:
        input.name,
      description:
        input.description,
      surfaceType:
        input.surfaceType,
      surfaceKey:
        normalizeExperimentKey(
          input.surfaceKey,
        ),
      featureFlagKey:
        normalizeExperimentKey(
          input.featureFlagKey,
        ),
      eligibleActorTypes: [
        ...new Set(
          input.eligibleActorTypes,
        ),
      ],
      allocationBasisPoints:
        input.allocationBasisPoints,
      variants:
        input.variants,
      primaryUtilityMetricKey:
        input.primaryUtilityMetricKey,
      guardrailMetricKeys: [
        ...new Set(
          input.guardrailMetricKeys ||
          [],
        ),
      ],
      holdoutRequired:
        input.holdoutRequired,
      status:
        'draft',
      createdByUserId:
        actorId(
          actorUser,
        ),
      lifecycleReason:
        input.reason,
    })

  return {
    experiment:
      serializeExperimentDefinition(
        created,
      ),
  }
}

export async function listExperimentDefinitions({
  adminAuthorization,
}) {
  if (
    !adminHasPermission(
      adminAuthorization,
      'admin.dashboard.read',
    ) &&
    !adminHasPermission(
      adminAuthorization,
      'admin.audit.read',
    )
  ) {
    throw new ApiError(
      403,
      'Administrative analytics access is required.',
      [
        {
          code:
            'ADMIN_ANALYTICS_PERMISSION_REQUIRED',
        },
      ],
    )
  }

  const records =
    await ExperimentDefinition.find({})
      .sort({
        experimentKey:
          1,
        versionNumber:
          -1,
      })
      .limit(300)
      .lean()

  return {
    experiments:
      records.map(
        serializeExperimentDefinition,
      ),
  }
}

export async function changeExperimentStatus({
  experimentId,
  action,
  reason,
  actorUser,
  adminAuthorization,
}) {
  assertRootSuperAdmin(
    adminAuthorization,
  )

  const experiment =
    await ExperimentDefinition.findById(
      experimentId,
    )

  if (!experiment) {
    throw new ApiError(
      404,
      'Experiment Definition was not found.',
      [
        {
          code:
            'EXPERIMENT_NOT_FOUND',
        },
      ],
    )
  }

  const now =
    new Date()

  if (
    action ===
    'activate'
  ) {
    if (
      ![
        'draft',
        'paused',
      ].includes(
        experiment.status,
      )
    ) {
      throw new ApiError(
        409,
        'Experiment cannot be activated from its current state.',
        [
          {
            code:
              'EXPERIMENT_ACTIVATION_STATE_INVALID',
          },
        ],
      )
    }

    await assertFeatureFlagEnabled(
      experiment.featureFlagKey,
    )

    experiment.status =
      'active'
    experiment.activatedAt =
      now
    experiment.activatedByUserId =
      actorId(
        actorUser,
      )
  } else if (
    action ===
    'pause'
  ) {
    if (
      experiment.status !==
      'active'
    ) {
      throw new ApiError(
        409,
        'Only an active experiment can be paused.',
        [
          {
            code:
              'EXPERIMENT_PAUSE_STATE_INVALID',
          },
        ],
      )
    }

    experiment.status =
      'paused'
    experiment.pausedAt =
      now
    experiment.pausedByUserId =
      actorId(
        actorUser,
      )
  } else if (
    action ===
    'end'
  ) {
    if (
      experiment.status ===
      'ended'
    ) {
      throw new ApiError(
        409,
        'Experiment is already ended.',
        [
          {
            code:
              'EXPERIMENT_ALREADY_ENDED',
          },
        ],
      )
    }

    experiment.status =
      'ended'
    experiment.endedAt =
      now
    experiment.endedByUserId =
      actorId(
        actorUser,
      )
  } else {
    throw new ApiError(
      400,
      'Unsupported Experiment lifecycle action.',
      [
        {
          code:
            'EXPERIMENT_ACTION_INVALID',
        },
      ],
    )
  }

  experiment.lifecycleReason =
    reason

  await experiment.save()

  return {
    experiment:
      serializeExperimentDefinition(
        experiment,
      ),
  }
}

function deterministicBucket({
  experimentKey,
  experimentVersion,
  actorPseudonym,
}) {
  const digest =
    crypto
      .createHash(
        'sha256',
      )
      .update(
        `${experimentKey}:${experimentVersion}:${actorPseudonym}`,
      )
      .digest()

  return digest.readUInt32BE(
    0,
  ) %
    10000
}

function chooseVariant({
  variants,
  bucket,
  allocationBasisPoints,
}) {
  const normalizedBucket =
    Math.floor(
      bucket *
        10000 /
        allocationBasisPoints,
    )

  let cumulative =
    0

  for (
    const variant of
    variants
  ) {
    cumulative +=
      variant.weightBasisPoints

    if (
      normalizedBucket <
      cumulative
    ) {
      return variant.key
    }
  }

  return variants[
    variants.length - 1
  ].key
}

async function resolveHostOrganization({
  actorUser,
  organizationIdHint = null,
}) {
  const userId =
    actorId(
      actorUser,
    )

  if (
    organizationIdHint
  ) {
    const organization =
      await MarketplaceOrganization.findOne({
        _id:
          organizationIdHint,
        status:
          'active',
      })

    if (!organization) {
      throw new ApiError(
        404,
        'Active Host organization was not found.',
        [
          {
            code:
              'HOST_ANALYTICS_ORGANIZATION_NOT_FOUND',
          },
        ],
      )
    }

    if (
      id(
        organization.ownerUserId,
      ) ===
      id(
        userId,
      )
    ) {
      return organization
    }

    const hospitalityGrant =
      await HospitalityMemberGrant.findOne({
        organizationId:
          organization._id,
        userId,
        status:
          'active',
      }).lean()

    if (
      hospitalityGrant
    ) {
      return organization
    }

    throw new ApiError(
      403,
      'Host does not have analytics access to the selected organization.',
      [
        {
          code:
            'HOST_ANALYTICS_ORGANIZATION_SCOPE_REQUIRED',
        },
      ],
    )
  }

  const owned =
    await MarketplaceOrganization.findOne({
      ownerUserId:
        userId,
      status:
        'active',
    })

  if (owned) {
    return owned
  }

  const grants =
    await HospitalityMemberGrant.find({
      userId,
      status:
        'active',
    })
      .select(
        'organizationId',
      )
      .limit(2)
      .lean()

  if (
    grants.length ===
    1
  ) {
    const organization =
      await MarketplaceOrganization.findOne({
        _id:
          grants[0].organizationId,
        status:
          'active',
      })

    if (organization) {
      return organization
    }
  }

  if (
    grants.length >
    1
  ) {
    throw new ApiError(
      409,
      'Select a Host organization before viewing analytics.',
      [
        {
          code:
            'HOST_ANALYTICS_ORGANIZATION_SELECTION_REQUIRED',
          header:
            'x-epantry-organization-id',
        },
      ],
    )
  }

  throw new ApiError(
    404,
    'Active Host organization was not found.',
    [
      {
        code:
          'HOST_ANALYTICS_ORGANIZATION_NOT_FOUND',
      },
    ],
  )
}

async function organizationIdForActor({
  actorUser,
  organizationIdHint,
}) {
  if (
    deriveAnalyticsActorType(
      actorUser,
    ) !==
    'host'
  ) {
    return null
  }

  try {
    const organization =
      await resolveHostOrganization({
        actorUser,
        organizationIdHint,
      })

    return organization._id
  } catch {
    return null
  }
}

export async function getExperimentAssignment({
  experimentKey,
  actorUser,
  organizationIdHint = null,
}) {
  const normalizedKey =
    normalizeExperimentKey(
      experimentKey,
    )

  const experiment =
    await ExperimentDefinition.findOne({
      experimentKey:
        normalizedKey,
      status:
        'active',
    })
      .sort({
        versionNumber:
          -1,
      })
      .lean()

  if (!experiment) {
    return {
      eligible:
        false,
      reason:
        'experiment_not_active',
      assignment:
        null,
    }
  }

  const actorType =
    deriveAnalyticsActorType(
      actorUser,
    )

  if (
    !experiment.eligibleActorTypes.includes(
      actorType,
    )
  ) {
    return {
      eligible:
        false,
      reason:
        'actor_not_eligible',
      assignment:
        null,
    }
  }

  const flag =
    await findFeatureFlag(
      experiment.featureFlagKey,
    )

  if (
    !featureFlagEnabled(
      flag,
    )
  ) {
    return {
      eligible:
        false,
      reason:
        'feature_flag_disabled',
      assignment:
        null,
    }
  }

  const actorPseudonym =
    pseudonymizeAnalyticsIdentifier(
      actorId(
        actorUser,
      ),
    )

  const organizationId =
    await organizationIdForActor({
      actorUser,
      organizationIdHint,
    })

  const organizationPseudonym =
    pseudonymizeAnalyticsIdentifier(
      organizationId,
    )

  const existing =
    await ExperimentAssignment.findOne({
      experimentKey:
        experiment.experimentKey,
      experimentVersion:
        experiment.versionNumber,
      actorPseudonym,
    }).lean()

  if (existing) {
    return {
      eligible:
        true,
      reason:
        'persisted_assignment',
      assignment:
        serializeExperimentAssignment(
          existing,
        ),
    }
  }

  const bucket =
    deterministicBucket({
      experimentKey:
        experiment.experimentKey,
      experimentVersion:
        experiment.versionNumber,
      actorPseudonym,
    })

  if (
    bucket >=
    experiment.allocationBasisPoints
  ) {
    return {
      eligible:
        false,
      reason:
        'outside_allocation',
      assignment:
        null,
    }
  }

  const variantKey =
    chooseVariant({
      variants:
        experiment.variants,
      bucket,
      allocationBasisPoints:
        experiment.allocationBasisPoints,
    })

  try {
    const assignment =
      await ExperimentAssignment.create({
        experimentDefinitionId:
          experiment._id,
        experimentKey:
          experiment.experimentKey,
        experimentVersion:
          experiment.versionNumber,
        actorType,
        actorPseudonym,
        organizationPseudonym,
        bucket,
        variantKey,
        featureFlagKey:
          experiment.featureFlagKey,
        featureFlagEnabledAtAssignment:
          true,
        assignedAt:
          new Date(),
      })

    return {
      eligible:
        true,
      reason:
        'new_assignment',
      assignment:
        serializeExperimentAssignment(
          assignment,
        ),
    }
  } catch (error) {
    if (
      error?.code ===
      11000
    ) {
      const assignment =
        await ExperimentAssignment.findOne({
          experimentKey:
            experiment.experimentKey,
          experimentVersion:
            experiment.versionNumber,
          actorPseudonym,
        }).lean()

      return {
        eligible:
          true,
        reason:
          'persisted_assignment',
        assignment:
          serializeExperimentAssignment(
            assignment,
          ),
      }
    }

    throw error
  }
}

export async function recordExperimentExposure({
  experimentKey,
  surface,
  actorUser,
  organizationIdHint = null,
  correlationId = '',
}) {
  const assignmentResult =
    await getExperimentAssignment({
      experimentKey,
      actorUser,
      organizationIdHint,
    })

  if (
    !assignmentResult.eligible ||
    !assignmentResult.assignment
  ) {
    return assignmentResult
  }

  const actorPseudonym =
    pseudonymizeAnalyticsIdentifier(
      actorId(
        actorUser,
      ),
    )

  const assignment =
    await ExperimentAssignment.findOne({
      assignmentId:
        assignmentResult.assignment.assignmentId,
      actorPseudonym,
    })

  if (!assignment) {
    throw new ApiError(
      404,
      'Experiment assignment was not found.',
      [
        {
          code:
            'EXPERIMENT_ASSIGNMENT_NOT_FOUND',
        },
      ],
    )
  }

  const now =
    new Date()

  assignment.exposedAt =
    assignment.exposedAt ||
    now
  assignment.lastExposedAt =
    now
  assignment.exposureCount =
    Number(
      assignment.exposureCount ||
        0,
    ) +
    1

  await assignment.save()

  const organizationId =
    await organizationIdForActor({
      actorUser,
      organizationIdHint,
    })

  await recordAnalyticsEventBestEffort({
    input: {
      eventName:
        'experiment.exposed',
      eventVersion:
        1,
      occurredAt:
        now,
      correlationId,
      sessionId:
        '',
      householdId:
        '',
      entities: [],
      sourceDomain:
        'experiments',
      sourceVersion:
        'm19-v1',
      decisionContext:
        'not_applicable',
      confidenceTier:
        'verified',
      featureFlags: [
        {
          key:
            assignment.featureFlagKey,
          value:
            'enabled',
        },
      ],
      experiments: [
        {
          experimentKey:
            assignment.experimentKey,
          variantKey:
            assignment.variantKey,
        },
      ],
      payload: {
        experimentKey:
          assignment.experimentKey,
        variantKey:
          assignment.variantKey,
        surface:
          String(
            surface ||
              '',
          ).slice(
            0,
            120,
          ),
      },
    },
    actorUser,
    organizationId,
  })

  return {
    eligible:
      true,
    reason:
      'exposure_recorded',
    assignment:
      serializeExperimentAssignment(
        assignment,
      ),
  }
}

function normalizeDateRange({
  start,
  end,
}) {
  const endDate =
    end
      ? new Date(
          end,
        )
      : new Date()

  const startDate =
    start
      ? new Date(
          start,
        )
      : new Date(
          endDate.getTime() -
            29 *
              24 *
              60 *
              60 *
              1000,
        )

  if (
    Number.isNaN(
      startDate.getTime(),
    ) ||
    Number.isNaN(
      endDate.getTime(),
    ) ||
    startDate >
      endDate
  ) {
    throw new ApiError(
      400,
      'Analytics date range is invalid.',
      [
        {
          code:
            'ANALYTICS_DATE_RANGE_INVALID',
        },
      ],
    )
  }

  const days =
    (
      endDate.getTime() -
      startDate.getTime()
    ) /
    (
      24 *
      60 *
      60 *
      1000
    )

  if (
    days >
    MAX_REPORT_DAYS
  ) {
    throw new ApiError(
      400,
      `Analytics range is limited to ${MAX_REPORT_DAYS} days.`,
      [
        {
          code:
            'ANALYTICS_DATE_RANGE_TOO_LARGE',
          maxDays:
            MAX_REPORT_DAYS,
        },
      ],
    )
  }

  return {
    start:
      startDate,
    end:
      endDate,
  }
}

async function eventCounts({
  start,
  end,
  organizationPseudonym = '',
}) {
  const match = {
    occurredAt: {
      $gte:
        start,
      $lte:
        end,
    },
  }

  if (
    organizationPseudonym
  ) {
    match.organizationPseudonym =
      organizationPseudonym
  }

  const rows =
    await AnalyticsEvent.aggregate([
      {
        $match:
          match,
      },
      {
        $group: {
          _id:
            '$eventName',
          count: {
            $sum:
              1,
          },
        },
      },
      {
        $sort: {
          count:
            -1,
        },
      },
    ])

  return Object.fromEntries(
    rows.map(
      (row) => [
        row._id,
        row.count,
      ],
    ),
  )
}

async function decisionContextCounts({
  start,
  end,
  organizationPseudonym = '',
}) {
  const match = {
    occurredAt: {
      $gte:
        start,
      $lte:
        end,
    },
  }

  if (
    organizationPseudonym
  ) {
    match.organizationPseudonym =
      organizationPseudonym
  }

  const rows =
    await AnalyticsEvent.aggregate([
      {
        $match:
          match,
      },
      {
        $group: {
          _id:
            '$decisionContext',
          count: {
            $sum:
              1,
          },
        },
      },
    ])

  return Object.fromEntries(
    rows.map(
      (row) => [
        row._id,
        row.count,
      ],
    ),
  )
}

function ratio(
  numerator,
  denominator,
) {
  return denominator
    ? Number(
        (
          numerator /
          denominator
        ).toFixed(
          4,
        ),
      )
    : 0
}

function buildCoreFunnel(
  counts,
) {
  const search =
    counts[
      'search.query_submitted'
    ] ||
    0

  const recipe =
    counts[
      'recipe.selected'
    ] ||
    0

  const readiness =
    counts[
      'outcome.readiness_calculated'
    ] ||
    0

  const requirements =
    counts[
      'outcome.requirements_calculated'
    ] ||
    0

  const basket =
    counts[
      'commerce.basket_created'
    ] ||
    0

  const handoff =
    counts[
      'commerce.handoff_created'
    ] ||
    0

  const orders =
    counts[
      'commerce.order_created'
    ] ||
    0

  return {
    counts: {
      search,
      recipe,
      readiness,
      requirements,
      basket,
      handoff,
      orders,
    },

    rates: {
      recipeToRequirements:
        ratio(
          requirements,
          recipe,
        ),

      requirementsToBasket:
        ratio(
          basket,
          requirements,
        ),

      basketToHandoff:
        ratio(
          handoff,
          basket,
        ),

      basketToOrder:
        ratio(
          orders,
          basket,
        ),
    },
  }
}

async function attributionSummary({
  start,
  end,
  organizationId = null,
}) {
  const match = {
    occurredAt: {
      $gte:
        start,
      $lte:
        end,
    },
  }

  if (
    organizationId
  ) {
    match.organizationId =
      organizationId
  }

  const rows =
    await AttributionEvent.aggregate([
      {
        $match:
          match,
      },
      {
        $group: {
          _id:
            '$level',
          count: {
            $sum:
              1,
          },
          revenueMinor: {
            $sum: {
              $ifNull: [
                '$revenueMinor',
                0,
              ],
            },
          },
        },
      },
    ])

  return rows.map(
    (row) => ({
      level:
        row._id,
      count:
        row.count,
      revenueMinor:
        row.revenueMinor,
    }),
  )
}

async function experimentSummary({
  start,
  end,
  organizationPseudonym = '',
}) {
  const match = {
    assignedAt: {
      $gte:
        start,
      $lte:
        end,
    },
  }

  if (
    organizationPseudonym
  ) {
    match.organizationPseudonym =
      organizationPseudonym
  }

  const rows =
    await ExperimentAssignment.aggregate([
      {
        $match:
          match,
      },
      {
        $group: {
          _id: {
            experimentKey:
              '$experimentKey',
            variantKey:
              '$variantKey',
          },

          assignments: {
            $sum:
              1,
          },

          exposures: {
            $sum:
              '$exposureCount',
          },
        },
      },
      {
        $sort: {
          '_id.experimentKey':
            1,
          '_id.variantKey':
            1,
        },
      },
    ])

  return rows.map(
    (row) => ({
      experimentKey:
        row._id.experimentKey,

      variantKey:
        row._id.variantKey,

      assignments:
        row.assignments,

      exposures:
        row.exposures,
    }),
  )
}

function buildNotificationUtility(
  counts,
) {
  const intents =
    counts[
      'notification.intent_created'
    ] ||
    0

  const delivered =
    counts[
      'notification.delivered'
    ] ||
    0

  const actions =
    counts[
      'notification.actioned'
    ] ||
    0

  return {
    intents,
    delivered,
    actions,

    actionRate:
      ratio(
        actions,
        intents,
      ),
  }
}

export async function getHostAnalyticsDashboard({
  actorUser,
  organizationIdHint = null,
  start,
  end,
}) {
  const organization =
    await resolveHostOrganization({
      actorUser,
      organizationIdHint,
    })

  const range =
    normalizeDateRange({
      start,
      end,
    })

  const organizationPseudonym =
    pseudonymizeAnalyticsIdentifier(
      organization._id,
    )

  const [
    counts,
    contexts,
    attribution,
    experiments,
  ] = await Promise.all([
    eventCounts({
      ...range,
      organizationPseudonym,
    }),

    decisionContextCounts({
      ...range,
      organizationPseudonym,
    }),

    attributionSummary({
      ...range,

      organizationId:
        organization._id,
    }),

    experimentSummary({
      ...range,
      organizationPseudonym,
    }),
  ])

  return {
    organization: {
      id:
        id(
          organization._id,
        ),

      displayName:
        organization.displayName,

      organizationType:
        organization.organizationType,
    },

    range,

    funnel:
      buildCoreFunnel(
        counts,
      ),

    notificationUtility:
      buildNotificationUtility(
        counts,
      ),

    organicSponsored: {
      organic:
        contexts.organic ||
        0,

      sponsored:
        contexts.sponsored ||
        0,

      mixed:
        contexts.mixed ||
        0,
    },

    lenses: {
      commerce: {
        basketCreated:
          counts[
            'commerce.basket_created'
          ] ||
          0,

        handoffCreated:
          counts[
            'commerce.handoff_created'
          ] ||
          0,

        orderCreated:
          counts[
            'commerce.order_created'
          ] ||
          0,

        orderDelivered:
          counts[
            'commerce.order_delivered'
          ] ||
          0,
      },

      recipes: {
        viewed:
          counts[
            'recipe.viewed'
          ] ||
          0,

        selected:
          counts[
            'recipe.selected'
          ] ||
          0,

        cooked:
          counts[
            'recipe.cooked'
          ] ||
          0,
      },

      hospitality: {
        trustCorrections:
          counts[
            'trust.correction_recorded'
          ] ||
          0,
      },
    },

    attribution,
    experiments,

    policy: {
      organizationScoped:
        true,

      sellerBrandB2bAreHostLenses:
        true,

      uxModeAuthorizes:
        false,

      sponsoredSeparated:
        true,
    },
  }
}

export async function getAdminAnalyticsDashboard({
  adminAuthorization,
  start,
  end,
}) {
  const canDashboard =
    adminHasPermission(
      adminAuthorization,
      'admin.dashboard.read',
    )

  const canAudit =
    adminHasPermission(
      adminAuthorization,
      'admin.audit.read',
    )

  const canMarketplace =
    adminHasPermission(
      adminAuthorization,
      'marketplace.read',
    )

  const canTrust =
    adminHasPermission(
      adminAuthorization,
      'trust_safety.read',
    )

  if (
    !(
      canDashboard ||
      canAudit ||
      canMarketplace ||
      canTrust
    )
  ) {
    throw new ApiError(
      403,
      'Administrative analytics permission is required.',
      [
        {
          code:
            'ADMIN_ANALYTICS_PERMISSION_REQUIRED',
        },
      ],
    )
  }

  const range =
    normalizeDateRange({
      start,
      end,
    })

  const [
    counts,
    contexts,
    experiments,
    aggregateRows,
  ] = await Promise.all([
    eventCounts(
      range,
    ),

    decisionContextCounts(
      range,
    ),

    experimentSummary(
      range,
    ),

    MetricAggregate.find({
      organizationId:
        null,

      periodStart: {
        $gte:
          range.start,

        $lte:
          range.end,
      },
    })
      .sort({
        periodStart:
          -1,
      })
      .limit(
        200,
      )
      .lean(),
  ])

  const response = {
    range,

    permissionsApplied:
      true,

    policy: {
      metricSource:
        'analytics_events_and_server_aggregates',

      organicSponsoredSeparated:
        true,

      aiIsMetricAuthority:
        false,

      superAdminCreatesHostTenantAuthority:
        false,
    },
  }

  if (
    canDashboard ||
    canAudit
  ) {
    response.funnel =
      buildCoreFunnel(
        counts,
      )

    response.searchQuality = {
      queries:
        counts[
          'search.query_submitted'
        ] ||
        0,

      zeroResults:
        counts[
          'search.zero_result'
        ] ||
        0,

      zeroResultRate:
        ratio(
          counts[
            'search.zero_result'
          ] ||
            0,

          counts[
            'search.query_submitted'
          ] ||
            0,
        ),
    }

    response.notificationUtility =
      buildNotificationUtility(
        counts,
      )

    response.experiments =
      experiments

    response.metricAggregates =
      aggregateRows.map(
        (row) => ({
          metricKey:
            row.metricKey,

          period:
            row.period,

          periodStart:
            row.periodStart,

          value:
            row.value,

          numerator:
            row.numerator,

          denominator:
            row.denominator,
        }),
      )
  }

  if (
    canMarketplace ||
    canDashboard
  ) {
    response.organicSponsored = {
      organic:
        contexts.organic ||
        0,

      sponsored:
        contexts.sponsored ||
        0,

      mixed:
        contexts.mixed ||
        0,
    }

    response.attribution =
      await attributionSummary(
        range,
      )
  }

  if (
    canTrust ||
    canDashboard
  ) {
    response.trust = {
      corrections:
        counts[
          'trust.correction_recorded'
        ] ||
        0,

      pantryCorrections:
        counts[
          'pantry.corrected'
        ] ||
        0,
    }
  }

  if (
    canAudit
  ) {
    response.eventHealth = {
      totalEvents:
        Object.values(
          counts,
        ).reduce(
          (
            total,
            count,
          ) =>
            total +
            count,
          0,
        ),

      eventNames:
        Object.keys(
          counts,
        ).length,
    }
  }

  return response
}

export {
  resolveHostOrganization,
}