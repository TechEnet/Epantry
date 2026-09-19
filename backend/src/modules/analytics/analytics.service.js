import crypto from 'crypto'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  AnalyticsEvent,
  AttributionEvent,
  MetricAggregate,
} from './analytics.models.js'

export const ANALYTICS_EVENT_REGISTRY = Object.freeze({
  'search.query_submitted': {
    version: 1,
    allowedPayloadKeys: [
      'queryLength',
      'intentType',
    ],
  },

  'search.results_viewed': {
    version: 1,
    allowedPayloadKeys: [
      'resultCount',
      'zeroResult',
      'reformulated',
    ],
  },

  'search.zero_result': {
    version: 1,
    allowedPayloadKeys: [
      'queryLength',
      'intentType',
    ],
  },

  'recipe.viewed': {
    version: 1,
    allowedPayloadKeys: [
      'source',
    ],
  },

  'recipe.selected': {
    version: 1,
    allowedPayloadKeys: [
      'source',
    ],
  },

  'recipe.servings_changed': {
    version: 1,
    allowedPayloadKeys: [
      'fromServings',
      'toServings',
    ],
  },

  'recipe.cooked': {
    version: 1,
    allowedPayloadKeys: [
      'portions',
      'completionSource',
    ],
  },

  'pantry.marked': {
    version: 1,
    allowedPayloadKeys: [
      'state',
      'source',
    ],
  },

  'pantry.corrected': {
    version: 1,
    allowedPayloadKeys: [
      'correctionType',
      'source',
    ],
  },

  'outcome.readiness_calculated': {
    version: 1,
    allowedPayloadKeys: [
      'readyLineCount',
      'shortageLineCount',
      'unknownLineCount',
    ],
  },

  'outcome.requirements_calculated': {
    version: 1,
    allowedPayloadKeys: [
      'requirementCount',
      'shortageCount',
    ],
  },

  'commerce.basket_created': {
    version: 1,
    allowedPayloadKeys: [
      'lineCount',
      'fulfillmentMode',
    ],
  },

  'commerce.handoff_created': {
    version: 1,
    allowedPayloadKeys: [
      'partnerKey',
      'handoffType',
    ],
  },

  'commerce.order_created': {
    version: 1,
    allowedPayloadKeys: [
      'lineCount',
      'currency',
    ],
  },

  'commerce.order_delivered': {
    version: 1,
    allowedPayloadKeys: [
      'deliveryState',
    ],
  },

  'notification.intent_created': {
    version: 1,
    allowedPayloadKeys: [
      'category',
      'reasonCode',
      'suppressed',
    ],
  },

  'notification.delivered': {
    version: 1,
    allowedPayloadKeys: [
      'category',
      'reasonCode',
      'channel',
    ],
  },

  'notification.actioned': {
    version: 1,
    allowedPayloadKeys: [
      'category',
      'reasonCode',
      'action',
      'domainDelegationRequired',
    ],
  },

  'attribution.recorded': {
    version: 1,
    allowedPayloadKeys: [
      'level',
      'hasRevenue',
      'currency',
    ],
  },

  'experiment.exposed': {
    version: 1,
    allowedPayloadKeys: [
      'experimentKey',
      'variantKey',
      'surface',
    ],
  },

  'trust.correction_recorded': {
    version: 1,
    allowedPayloadKeys: [
      'correctionDomain',
      'correctionType',
    ],
  },
})

const FORBIDDEN_PAYLOAD_KEY_PATTERNS = Object.freeze([
  /email/i,
  /phone/i,
  /mobile/i,
  /password/i,
  /token/i,
  /secret/i,
  /address/i,
  /allerg(y|ies|en)/i,
  /medical/i,
  /pantry(items?|contents?)/i,
  /card/i,
  /cvv/i,
  /upi/i,
  /accountnumber/i,
  /full.?name/i,
  /first.?name/i,
  /last.?name/i,
  /conversation/i,
  /transcript/i,
])

const MAX_PAYLOAD_BYTES =
  8 *
  1024

function analyticsSecret() {
  const configured =
    process.env.ANALYTICS_PSEUDONYMIZATION_SECRET

  if (configured) {
    return configured
  }

  if (
    process.env.NODE_ENV ===
    'production'
  ) {
    throw new ApiError(
      500,
      'Analytics pseudonymization secret is not configured.',
      [
        {
          code:
            'ANALYTICS_PSEUDONYMIZATION_SECRET_REQUIRED',
        },
      ],
    )
  }

  return 'epantry-development-analytics-pseudonymization-secret'
}

export function pseudonymizeAnalyticsIdentifier(
  value,
) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() ===
      ''
  ) {
    return ''
  }

  return crypto
    .createHmac(
      'sha256',
      analyticsSecret(),
    )
    .update(
      String(value),
    )
    .digest('hex')
}

function actorId(
  actorUser,
) {
  return (
    actorUser?._id ||
    actorUser?.id ||
    null
  )
}

export function deriveAnalyticsActorType(
  actorUser,
) {
  if (!actorUser) {
    return 'anonymous'
  }

  if (
    actorUser.superAdminEnabled ===
    true
  ) {
    return 'super_admin'
  }

  if (
    actorUser.hostEnabled ===
      true &&
    actorUser.hostAccessStatus ===
      'active'
  ) {
    return 'host'
  }

  return 'customer'
}

function assertNoForbiddenPayloadKeys(
  value,
  path = 'payload',
) {
  if (
    Array.isArray(value)
  ) {
    value.forEach(
      (
        item,
        index,
      ) =>
        assertNoForbiddenPayloadKeys(
          item,
          `${path}[${index}]`,
        ),
    )

    return
  }

  if (
    !value ||
    typeof value !==
      'object'
  ) {
    return
  }

  for (
    const [
      key,
      nested,
    ] of Object.entries(
      value,
    )
  ) {
    if (
      FORBIDDEN_PAYLOAD_KEY_PATTERNS.some(
        (pattern) =>
          pattern.test(
            key,
          ),
      )
    ) {
      throw new ApiError(
        400,
        'Analytics payload contains a field that is not permitted by the privacy-minimization contract.',
        [
          {
            code:
              'ANALYTICS_PAYLOAD_SENSITIVE_FIELD_FORBIDDEN',
            fieldPath:
              `${path}.${key}`,
          },
        ],
      )
    }

    assertNoForbiddenPayloadKeys(
      nested,
      `${path}.${key}`,
    )
  }
}

function sanitizeAnalyticsPayload({
  eventName,
  payload,
}) {
  const definition =
    ANALYTICS_EVENT_REGISTRY[
      eventName
    ]

  if (!definition) {
    throw new ApiError(
      400,
      'Analytics event name is not registered by EPANTRY.',
      [
        {
          code:
            'ANALYTICS_EVENT_NOT_REGISTERED',
          eventName,
        },
      ],
    )
  }

  assertNoForbiddenPayloadKeys(
    payload,
  )

  const sanitized = {}

  for (
    const key of
    definition.allowedPayloadKeys
  ) {
    if (
      Object.prototype.hasOwnProperty.call(
        payload,
        key,
      )
    ) {
      sanitized[key] =
        payload[key]
    }
  }

  const payloadBytes =
    Buffer.byteLength(
      JSON.stringify(
        sanitized,
      ),
      'utf8',
    )

  if (
    payloadBytes >
    MAX_PAYLOAD_BYTES
  ) {
    throw new ApiError(
      413,
      'Analytics payload exceeds the bounded event size.',
      [
        {
          code:
            'ANALYTICS_PAYLOAD_TOO_LARGE',
          maxBytes:
            MAX_PAYLOAD_BYTES,
        },
      ],
    )
  }

  return sanitized
}

function validateEventContract(
  input,
) {
  const definition =
    ANALYTICS_EVENT_REGISTRY[
      input.eventName
    ]

  if (!definition) {
    throw new ApiError(
      400,
      'Analytics event name is not registered by EPANTRY.',
      [
        {
          code:
            'ANALYTICS_EVENT_NOT_REGISTERED',
          eventName:
            input.eventName,
        },
      ],
    )
  }

  if (
    input.eventVersion !==
    definition.version
  ) {
    throw new ApiError(
      409,
      'Analytics event version does not match the deployed EPANTRY event contract.',
      [
        {
          code:
            'ANALYTICS_EVENT_VERSION_MISMATCH',
          eventName:
            input.eventName,
          expectedVersion:
            definition.version,
          receivedVersion:
            input.eventVersion,
        },
      ],
    )
  }
}

function serializeAnalyticsEvent(
  event,
) {
  const item =
    typeof event?.toObject ===
    'function'
      ? event.toObject()
      : event

  return {
    eventId:
      item.eventId,
    clientEventId:
      item.clientEventId ||
      null,
    eventName:
      item.eventName,
    eventVersion:
      item.eventVersion,
    occurredAt:
      item.occurredAt,
    receivedAt:
      item.receivedAt,
    correlationId:
      item.correlationId,
    sourceDomain:
      item.sourceDomain,
    sourceVersion:
      item.sourceVersion,
    decisionContext:
      item.decisionContext,
    confidenceTier:
      item.confidenceTier,
  }
}

export async function recordAnalyticsEvent({
  input,
  actorUser = null,
  requestId = '',
  organizationId = null,
}) {
  validateEventContract(
    input,
  )

  const sanitizedPayload =
    sanitizeAnalyticsPayload({
      eventName:
        input.eventName,
      payload:
        input.payload ||
        {},
    })

  if (
    input.clientEventId
  ) {
    const existing =
      await AnalyticsEvent.findOne({
        clientEventId:
          input.clientEventId,
      }).lean()

    if (existing) {
      return {
        analyticsEvent:
          serializeAnalyticsEvent(
            existing,
          ),
        deduplicated:
          true,
      }
    }
  }

  const occurredAt =
    input.occurredAt instanceof Date
      ? input.occurredAt
      : new Date(
          input.occurredAt,
        )

  const now =
    Date.now()

  if (
    Number.isNaN(
      occurredAt.getTime(),
    ) ||
    occurredAt.getTime() >
      now +
        5 * 60 * 1000 ||
    occurredAt.getTime() <
      now -
        30 *
          24 *
          60 *
          60 *
          1000
  ) {
    throw new ApiError(
      400,
      'Analytics occurredAt is outside the accepted ingestion window.',
      [
        {
          code:
            'ANALYTICS_OCCURRED_AT_OUT_OF_RANGE',
        },
      ],
    )
  }

  const created =
    await AnalyticsEvent.create({
      clientEventId:
        input.clientEventId ||
        null,
      eventName:
        input.eventName,
      eventVersion:
        input.eventVersion,
      occurredAt,
      receivedAt:
        new Date(),
      correlationId:
        input.correlationId ||
        requestId ||
        `corr_${crypto.randomUUID()}`,
      sessionId:
        input.sessionId ||
        '',
      actorType:
        deriveAnalyticsActorType(
          actorUser,
        ),
      actorPseudonym:
        pseudonymizeAnalyticsIdentifier(
          actorId(
            actorUser,
          ),
        ),
      householdPseudonym:
        pseudonymizeAnalyticsIdentifier(
          input.householdId,
        ),
      organizationPseudonym:
        pseudonymizeAnalyticsIdentifier(
          organizationId,
        ),
      entities:
        input.entities ||
        [],
      sourceDomain:
        input.sourceDomain,
      sourceVersion:
        input.sourceVersion ||
        '',
      decisionContext:
        input.decisionContext ||
        'not_applicable',
      confidenceTier:
        input.confidenceTier ||
        'not_applicable',
      featureFlags:
        input.featureFlags ||
        [],
      experiments:
        input.experiments ||
        [],
      payload:
        sanitizedPayload,
    })

  return {
    analyticsEvent:
      serializeAnalyticsEvent(
        created,
      ),
    deduplicated:
      false,
  }
}

export async function recordAnalyticsEventBestEffort(
  options,
) {
  try {
    return await recordAnalyticsEvent(
      options,
    )
  } catch {
    /*
    | Analytics is observational infrastructure.
    |
    | A canonical transaction must never fail merely because analytics
    | ingestion/export is unavailable. Durable outbox instrumentation for
    | frozen domains is wired in M19 Batch 2 Part 6.
    */
    return null
  }
}

export async function recordAttributionEvent({
  organizationId,
  actorUser = null,
  correlationId,
  level,
  sourceEntity,
  targetEntity,
  orderId = null,
  revenueMinor = null,
  currency = null,
  evidenceReferences = [],
}) {
  if (!organizationId) {
    throw new ApiError(
      400,
      'Attribution requires an owning Host organization.',
      [
        {
          code:
            'ATTRIBUTION_ORGANIZATION_REQUIRED',
        },
      ],
    )
  }

  if (
    revenueMinor !== null &&
    level !==
      'transaction_attributed'
  ) {
    throw new ApiError(
      409,
      'Revenue cannot be claimed from an assisted attribution touchpoint.',
      [
        {
          code:
            'ATTRIBUTION_REVENUE_EVIDENCE_INSUFFICIENT',
        },
      ],
    )
  }

  const created =
    await AttributionEvent.create({
      eventVersion:
        1,
      occurredAt:
        new Date(),
      correlationId:
        correlationId ||
        `corr_${crypto.randomUUID()}`,
      organizationId,
      organizationPseudonym:
        pseudonymizeAnalyticsIdentifier(
          organizationId,
        ),
      actorPseudonym:
        pseudonymizeAnalyticsIdentifier(
          actorId(
            actorUser,
          ),
        ),
      level,
      sourceEntity,
      targetEntity,
      orderId,
      revenueMinor,
      currency:
        currency
          ? String(
              currency,
            ).toUpperCase()
          : null,
      evidenceReferences:
        [
          ...new Set(
            evidenceReferences
              .map(String)
              .filter(Boolean),
          ),
        ].slice(
          0,
          30,
        ),
    })

  await recordAnalyticsEventBestEffort({
    input: {
      eventName:
        'attribution.recorded',
      eventVersion:
        1,
      occurredAt:
        created.occurredAt,
      correlationId:
        created.correlationId,
      sessionId:
        '',
      householdId:
        '',
      entities: [
        sourceEntity,
        targetEntity,
      ],
      sourceDomain:
        'analytics_attribution',
      sourceVersion:
        'm19-v1',
      decisionContext:
        'not_applicable',
      confidenceTier:
        level ===
        'transaction_attributed'
          ? 'verified'
          : 'high',
      featureFlags:
        [],
      experiments:
        [],
      payload: {
        level,
        hasRevenue:
          revenueMinor !==
          null,
        currency:
          currency ||
          '',
      },
    },
    actorUser,
    organizationId,
  })

  return created
}

function startOfUtcDay(
  value,
) {
  const date =
    new Date(
      value,
    )

  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    ),
  )
}

function nextUtcDay(
  value,
) {
  return new Date(
    value.getTime() +
      24 *
        60 *
        60 *
        1000,
  )
}

async function eventCount({
  eventName,
  start,
  end,
  organizationPseudonym = '',
}) {
  const filter = {
    eventName,
    occurredAt: {
      $gte:
        start,
      $lt:
        end,
    },
  }

  if (
    organizationPseudonym
  ) {
    filter.organizationPseudonym =
      organizationPseudonym
  }

  return AnalyticsEvent.countDocuments(
    filter,
  )
}

export async function rebuildDailyCoreMetrics({
  periodStart = new Date(),
  organizationId = null,
}) {
  const start =
    startOfUtcDay(
      periodStart,
    )

  const end =
    nextUtcDay(
      start,
    )

  const organizationPseudonym =
    pseudonymizeAnalyticsIdentifier(
      organizationId,
    )

  const [
    searchQueries,
    zeroResults,
    recipeSelections,
    requirementsCalculated,
    basketsCreated,
    handoffsCreated,
    notificationIntents,
    notificationActions,
  ] = await Promise.all([
    eventCount({
      eventName:
        'search.query_submitted',
      start,
      end,
      organizationPseudonym,
    }),
    eventCount({
      eventName:
        'search.zero_result',
      start,
      end,
      organizationPseudonym,
    }),
    eventCount({
      eventName:
        'recipe.selected',
      start,
      end,
      organizationPseudonym,
    }),
    eventCount({
      eventName:
        'outcome.requirements_calculated',
      start,
      end,
      organizationPseudonym,
    }),
    eventCount({
      eventName:
        'commerce.basket_created',
      start,
      end,
      organizationPseudonym,
    }),
    eventCount({
      eventName:
        'commerce.handoff_created',
      start,
      end,
      organizationPseudonym,
    }),
    eventCount({
      eventName:
        'notification.intent_created',
      start,
      end,
      organizationPseudonym,
    }),
    eventCount({
      eventName:
        'notification.actioned',
      start,
      end,
      organizationPseudonym,
    }),
  ])

  const metrics = [
    {
      metricKey:
        'search.query_count',
      value:
        searchQueries,
      numerator:
        searchQueries,
      denominator:
        null,
    },
    {
      metricKey:
        'search.zero_result_rate',
      value:
        searchQueries
          ? zeroResults /
            searchQueries
          : 0,
      numerator:
        zeroResults,
      denominator:
        searchQueries,
    },
    {
      metricKey:
        'recipe.selection_to_requirement_rate',
      value:
        recipeSelections
          ? requirementsCalculated /
            recipeSelections
          : 0,
      numerator:
        requirementsCalculated,
      denominator:
        recipeSelections,
    },
    {
      metricKey:
        'requirement_to_basket_rate',
      value:
        requirementsCalculated
          ? basketsCreated /
            requirementsCalculated
          : 0,
      numerator:
        basketsCreated,
      denominator:
        requirementsCalculated,
    },
    {
      metricKey:
        'basket_to_handoff_rate',
      value:
        basketsCreated
          ? handoffsCreated /
            basketsCreated
          : 0,
      numerator:
        handoffsCreated,
      denominator:
        basketsCreated,
    },
    {
      metricKey:
        'notification.utility_action_rate',
      value:
        notificationIntents
          ? notificationActions /
            notificationIntents
          : 0,
      numerator:
        notificationActions,
      denominator:
        notificationIntents,
    },
  ]

  const operations =
    metrics.map(
      (metric) => ({
        updateOne: {
          filter: {
            metricKey:
              metric.metricKey,
            metricVersion:
              1,
            period:
              'day',
            periodStart:
              start,
            organizationId:
              organizationId ||
              null,
            organizationPseudonym,
          },
          update: {
            $set: {
              ...metric,
              metricVersion:
                1,
              period:
                'day',
              periodStart:
                start,
              organizationId:
                organizationId ||
                null,
              organizationPseudonym,
              dimensions: {
                decisionScope:
                  'organic_and_unsponsored_core',
              },
              sourceEventVersion:
                1,
              computedAt:
                new Date(),
            },
          },
          upsert:
            true,
        },
      }),
    )

  if (
    operations.length
  ) {
    await MetricAggregate.bulkWrite(
      operations,
      {
        ordered:
          false,
      },
    )
  }

  return {
    periodStart:
      start,
    metrics,
  }
}

export async function getMetricAggregates({
  start,
  end,
  organizationId = null,
}) {
  const filter = {
    period:
      'day',
    periodStart: {
      $gte:
        startOfUtcDay(
          start,
        ),
      $lt:
        nextUtcDay(
          startOfUtcDay(
            end,
          ),
        ),
    },
    organizationId:
      organizationId ||
      null,
  }

  return MetricAggregate.find(
    filter,
  )
    .sort({
      periodStart:
        1,
      metricKey:
        1,
    })
    .lean()
}