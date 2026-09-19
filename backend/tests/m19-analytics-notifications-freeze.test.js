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

function stripComments(
  source,
) {
  return source
    .replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    )
    .replace(
      /(^|[^:])\/\/.*$/gm,
      '$1',
    )
}

test(
  'M19 keeps only Customer Host Super Admin top-level access fields and introduces no Seller Brand B2B capability',
  () => {
    const source =
      stripComments(
        [
          'src/modules/analytics/analytics.models.js',
          'src/modules/analytics/analytics.service.js',
          'src/modules/analytics/analytics.routes.js',
          'src/modules/notifications/notification.models.js',
          'src/modules/notifications/notification.service.js',
          'src/modules/notifications/notification.routes.js',
        ]
          .map(read)
          .join('\n'),
      )

    for (const forbidden of [
      'sellerEnabled',
      'brandEnabled',
      'b2bEnabled',
    ]) {
      assert.equal(
        source.includes(forbidden),
        false,
      )
    }

    assert.doesNotMatch(
      source,
      /activeMode/,
    )
  },
)

test(
  'M19 analytics route cannot accept client organization authority',
  () => {
    const route =
      read(
        'src/modules/analytics/analytics.routes.js',
      )

    const validation =
      read(
        'src/modules/analytics/analytics.validation.js',
      )

    assert.match(
      route,
      /organizationId:\s*null/,
    )

    assert.doesNotMatch(
      validation,
      /organizationId/,
    )
  },
)

test(
  'M19 analytics and notification writes remain CSRF protected',
  () => {
    const analytics =
      read(
        'src/modules/analytics/analytics.routes.js',
      )

    const notifications =
      read(
        'src/modules/notifications/notification.routes.js',
      )

    assert.match(
      analytics,
      /requireCsrfToken/,
    )

    assert.match(
      notifications,
      /requireCsrfToken/,
    )
  },
)

test(
  'M19 notifications require Customer capability while Host still remains compatible through shared Customer access',
  () => {
    const source =
      read(
        'src/modules/notifications/notification.routes.js',
      )

    assert.match(
      source,
      /customerEnabled ===/,
    )

    assert.match(
      source,
      /CUSTOMER_ACCESS_REQUIRED/,
    )
  },
)

test(
  'M19 does not directly import Brevo transport into page controller or notification domain service',
  () => {
    const service =
      read(
        'src/modules/notifications/notification.service.js',
      )

    const routes =
      read(
        'src/modules/notifications/notification.routes.js',
      )

    assert.doesNotMatch(
      service,
      /@getbrevo\/brevo/,
    )

    assert.doesNotMatch(
      routes,
      /@getbrevo\/brevo/,
    )
  },
)

test(
  'M19 notification service has domain reason suppression and no general engagement scheduler',
  () => {
    const source =
      read(
        'src/modules/notifications/notification.service.js',
      )

    assert.match(
      source,
      /reason_code_stopped_by_customer/,
    )

    assert.match(
      source,
      /category_preference_disabled/,
    )

    assert.doesNotMatch(
      source,
      /setInterval|cron|engagementScheduler/i,
    )
  },
)

test(
  'M19 Batch 1 does not duplicate M03 auditEvents or M17 featureFlags',
  () => {
    const models =
      [
        read('src/modules/analytics/analytics.models.js'),
        read('src/modules/notifications/notification.models.js'),
      ].join('\n')

    assert.doesNotMatch(
      models,
      /collection:\s*['"]auditEvents['"]/,
    )

    assert.doesNotMatch(
      models,
      /collection:\s*['"]featureFlags['"]/,
    )
  },
)

test(
  'M19 event registry never defines a weaker allergen safety experiment',
  () => {
    const source =
      read(
        'src/modules/analytics/analytics.service.js',
      )

    assert.doesNotMatch(
      source,
      /allergen.*variant|variant.*allergen/i,
    )

    assert.doesNotMatch(
      source,
      /unknown.*safe|safe.*unknown/i,
    )
  },
)

test(
  'M19 app mounts analytics and notification APIs without moving frozen M11 raw webhook behind JSON parser',
  () => {
    const source =
      read(
        'src/app.js',
      )

    assert.match(
      source,
      /['"]\/api\/v1\/analytics['"]/,
    )

    assert.match(
      source,
      /['"]\/api\/v1\/notifications['"]/,
    )

    const webhookIndex =
      source.indexOf(
        "'/api/v1/webhooks'",
      )

    const jsonIndex =
      source.indexOf(
        'express.json',
      )

    assert.ok(
      webhookIndex >= 0,
    )

    assert.ok(
      jsonIndex >
        webhookIndex,
    )
  },
)

test(
  'M19 Batch 1 leaves experiments assignment authority for Batch 2 rather than abusing analytics context as authorization',
  () => {
    const source =
      [
        read('src/modules/analytics/analytics.service.js'),
        read('src/modules/analytics/analytics.routes.js'),
      ].join('\n')

    assert.match(
      source,
      /experiment\.exposed/,
    )

    assert.doesNotMatch(
      source,
      /hasAccess\s*=.*experiment|experiment.*permission/i,
    )
  },
)