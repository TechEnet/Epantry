import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const __filename =
  fileURLToPath(
    import.meta.url,
  )

const __dirname =
  path.dirname(
    __filename,
  )

const backendRoot =
  path.resolve(
    __dirname,
    '..',
  )

function read(
  relativePath,
) {
  return fs.readFileSync(
    path.join(
      backendRoot,
      relativePath,
    ),
    'utf8',
  )
}

test(
  'M19 Batch 1 registers analytics attribution metric notification preference notification and action collections',
  () => {
    const analytics =
      read(
        'src/modules/analytics/analytics.models.js',
      )

    const notifications =
      read(
        'src/modules/notifications/notification.models.js',
      )

    for (const collection of [
      'analyticsEvents',
      'attributionEvents',
      'metricAggregates',
    ]) {
      assert.match(
        analytics,
        new RegExp(
          `collection:\\s*['"]${collection}['"]`,
        ),
      )
    }

    for (const collection of [
      'notificationPreferences',
      'notifications',
      'notificationActions',
    ]) {
      assert.match(
        notifications,
        new RegExp(
          `collection:\\s*['"]${collection}['"]`,
        ),
      )
    }
  },
)

test(
  'M19 Analytics events use stable event name version correlation and pseudonymous identifiers',
  () => {
    const source =
      read(
        'src/modules/analytics/analytics.models.js',
      )

    for (const token of [
      'eventName',
      'eventVersion',
      'correlationId',
      'sessionId',
      'actorPseudonym',
      'householdPseudonym',
      'organizationPseudonym',
      'confidenceTier',
    ]) {
      assert.equal(
        source.includes(token),
        true,
        `${token} must remain in AnalyticsEvent.`,
      )
    }
  },
)

test(
  'M19 analytics event names are EPANTRY-owned registry contracts',
  () => {
    const source =
      read(
        'src/modules/analytics/analytics.service.js',
      )

    assert.match(
      source,
      /ANALYTICS_EVENT_REGISTRY/,
    )

    assert.match(
      source,
      /ANALYTICS_EVENT_NOT_REGISTERED/,
    )

    assert.match(
      source,
      /ANALYTICS_EVENT_VERSION_MISMATCH/,
    )
  },
)

test(
  'M19 analytics payload privacy rejects sensitive keys and only stores allow-listed fields',
  () => {
    const source =
      read(
        'src/modules/analytics/analytics.service.js',
      )

    assert.match(
      source,
      /FORBIDDEN_PAYLOAD_KEY_PATTERNS/,
    )

    assert.match(
      source,
      /allerg\(y\|ies\|en\)/,
    )

    assert.match(
      source,
      /pantry\(items\?\|contents\?\)/,
    )

    assert.match(
      source,
      /allowedPayloadKeys/,
    )

    assert.match(
      source,
      /MAX_PAYLOAD_BYTES/,
    )
  },
)

test(
  'M19 backend derives Customer Host Super Admin analytics actor type and does not trust activeMode',
  () => {
    const source =
      read(
        'src/modules/analytics/analytics.service.js',
      )

    assert.match(
      source,
      /superAdminEnabled ===/,
    )

    assert.match(
      source,
      /hostEnabled ===/,
    )

    assert.match(
      source,
      /hostAccessStatus ===/,
    )

    assert.doesNotMatch(
      source,
      /activeMode/,
    )
  },
)

test(
  'M19 analytics best-effort recorder cannot fail a canonical transaction',
  () => {
    const source =
      read(
        'src/modules/analytics/analytics.service.js',
      )

    assert.match(
      source,
      /recordAnalyticsEventBestEffort/,
    )

    assert.match(
      source,
      /catch \{/,
    )

    assert.match(
      source,
      /return null/,
    )
  },
)

test(
  'M19 attribution distinguishes assisted touchpoints from transaction revenue evidence',
  () => {
    const models =
      read(
        'src/modules/analytics/analytics.models.js',
      )

    const service =
      read(
        'src/modules/analytics/analytics.service.js',
      )

    for (const level of [
      'view_assisted',
      'selection_assisted',
      'basket_assisted',
      'transaction_attributed',
    ]) {
      assert.equal(
        models.includes(level),
        true,
      )
    }

    assert.match(
      service,
      /ATTRIBUTION_REVENUE_EVIDENCE_INSUFFICIENT/,
    )

    assert.match(
      models,
      /Revenue may only be attached to transaction-attributed evidence/,
    )
  },
)

test(
  'M19 metric aggregation derives launch funnel metrics from AnalyticsEvent instead of UI calculations',
  () => {
    const source =
      read(
        'src/modules/analytics/analytics.service.js',
      )

    assert.match(
      source,
      /rebuildDailyCoreMetrics/,
    )

    assert.match(
      source,
      /AnalyticsEvent\.countDocuments/,
    )

    assert.match(
      source,
      /search\.zero_result_rate/,
    )

    assert.match(
      source,
      /requirement_to_basket_rate/,
    )

    assert.match(
      source,
      /notification\.utility_action_rate/,
    )
  },
)

test(
  'M19 preserves organic sponsored decision context as reportable analytics state',
  () => {
    const models =
      read(
        'src/modules/analytics/analytics.models.js',
      )

    assert.match(
      models,
      /'organic'/,
    )

    assert.match(
      models,
      /'sponsored'/,
    )

    assert.match(
      models,
      /decisionContext/,
    )
  },
)

test(
  'M19 notification intent stores explainable reason source entity and customer actions',
  () => {
    const source =
      read(
        'src/modules/notifications/notification.models.js',
      )

    for (const token of [
      'reasonCode',
      'explanation',
      'relatedEntityType',
      'relatedEntityId',
      'sourceDomain',
      'actions',
    ]) {
      assert.equal(
        source.includes(token),
        true,
      )
    }

    for (const action of [
      'dismiss',
      'snooze',
      'still_have',
      'bought_elsewhere',
      'stop_suggesting',
    ]) {
      assert.equal(
        source.includes(action),
        true,
      )
    }
  },
)

test(
  'M19 notification marketing toggle cannot manufacture M02 consent',
  () => {
    const source =
      read(
        'src/modules/notifications/notification.service.js',
      )

    assert.match(
      source,
      /NOTIFICATION_MARKETING_CONSENT_REQUIRED/,
    )

    assert.match(
      source,
      /input\.marketingEnabled ===/,
    )
  },
)

test(
  'M19 still-have and bought-elsewhere actions delegate to Pantry ownership instead of mutating M09 directly',
  () => {
    const source =
      read(
        'src/modules/notifications/notification.service.js',
      )

    assert.match(
      source,
      /record_customer_still_has_observation/,
    )

    assert.match(
      source,
      /record_bought_elsewhere_observation/,
    )

    assert.match(
      source,
      /createCustomerPantryObservation/,
    )

    assert.match(
      source,
      /status:[\s\S]*?completed/,
    )

    assert.doesNotMatch(
      source,
      /Pantry(Item|Observation)\.(create|updateOne|findOneAndUpdate)/,
    )
  },
)