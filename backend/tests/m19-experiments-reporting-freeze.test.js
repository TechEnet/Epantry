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

const projectRoot =
  path.resolve(
    __dirname,
    '..',
    '..',
  )

function readBackend(
  relativePath,
) {
  return fs.readFileSync(
    path.join(
      projectRoot,
      'backend',
      relativePath,
    ),
    'utf8',
  )
}

function readFrontend(
  relativePath,
) {
  return fs.readFileSync(
    path.join(
      projectRoot,
      'frontend',
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
  'M19 Batch 2 introduces no Seller Brand B2B top-level capability or activeMode authorization',
  () => {
    const source =
      stripComments(
        [
          readBackend(
            'src/modules/analytics/analytics.batch2.models.js',
          ),
          readBackend(
            'src/modules/analytics/analytics.batch2.service.js',
          ),
          readBackend(
            'src/modules/analytics/analytics.batch2.routes.js',
          ),
          readBackend(
            'src/middlewares/analyticsInstrumentation.middleware.js',
          ),
          readFrontend(
            'src/features/analytics/pages/HostAnalyticsPage.jsx',
          ),
          readFrontend(
            'src/routes/AppRoutes.jsx',
          ),
        ].join(
          '\n',
        ),
      )

    for (
      const forbidden of [
        'sellerEnabled',
        'brandEnabled',
        'b2bEnabled',
      ]
    ) {
      assert.equal(
        source.includes(
          forbidden,
        ),
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
  'M19 preserves exact Host capability authorization line in AppRoutes',
  () => {
    const source =
      readFrontend(
        'src/routes/AppRoutes.jsx',
      )

    assert.match(
      source,
      /hostEnabled === true && hostAccessStatus === 'active'/,
    )

    assert.match(
      source,
      /CUSTOMER:\n\s{6}['"]customer['"]/,
    )

    assert.match(
      source,
      /HOST:\n\s{6}['"]host['"]/,
    )

    assert.match(
      source,
      /SUPER_ADMIN:\n\s{6}['"]super_admin['"]/,
    )
  },
)

test(
  'M19 experiment assignment and feature flags never appear in application authorization gates',
  () => {
    const routes =
      readFrontend(
        'src/routes/AppRoutes.jsx',
      )

    const backend =
      readBackend(
        'src/modules/analytics/analytics.batch2.routes.js',
      )

    assert.doesNotMatch(
      routes,
      /experiment.*hasAccess|hasAccess.*experiment/i,
    )

    assert.doesNotMatch(
      routes,
      /featureFlag.*hasAccess|hasAccess.*featureFlag/i,
    )

    assert.match(
      backend,
      /requireHostAccess/,
    )

    assert.match(
      backend,
      /loadAdminAuthorization/,
    )
  },
)

test(
  'M19 instrumentation runs post-response and uses best-effort analytics',
  () => {
    const source =
      readBackend(
        'src/middlewares/analyticsInstrumentation.middleware.js',
      )

    assert.match(
      source,
      /res\.once\(\s*['"]finish['"]/,
    )

    assert.match(
      source,
      /recordAnalyticsEventBestEffort/,
    )

    assert.match(
      source,
      /res\.statusCode <[\s\S]*?200/,
    )
  },
)

test(
  'M19 instrumentation does not copy raw search text or Pantry contents into analytics payload',
  () => {
    const source =
      readBackend(
        'src/middlewares/analyticsInstrumentation.middleware.js',
      )

    assert.match(
      source,
      /queryLength/,
    )

    assert.doesNotMatch(
      source,
      /payload:\s*\{[\s\S]{0,160}query:\s*body\.query/,
    )

    assert.doesNotMatch(
      source,
      /payload:\s*\{[\s\S]{0,160}pantryItems/,
    )
  },
)

test(
  'M19 Pantry notification adapter calls M09 service and never Pantry models directly',
  () => {
    const source =
      readBackend(
        'src/modules/notifications/notification.service.js',
      )

    assert.match(
      source,
      /createCustomerPantryObservation/,
    )

    assert.doesNotMatch(
      source,
      /Pantry(Item|Observation)\.(create|updateOne|findOneAndUpdate)/,
    )
  },
)

test(
  'M19 Admin experiment mutation remains real-root-only with recent MFA and CSRF',
  () => {
    const service =
      readBackend(
        'src/modules/analytics/analytics.batch2.service.js',
      )

    const routes =
      readBackend(
        'src/modules/analytics/analytics.batch2.routes.js',
      )

    assert.match(
      service,
      /adminAuthorization\?\.isRootSuperAdmin ===/,
    )

    assert.match(
      routes,
      /requireCsrfToken/,
    )

    assert.match(
      routes,
      /requireRecentMfaAuthentication/,
    )
  },
)

test(
  'M19 app mounts experiments Host analytics Admin analytics and instrumentation without moving M11 raw webhook',
  () => {
    const source =
      readBackend(
        'src/app.js',
      )

    assert.match(
      source,
      /analyticsInstrumentationMiddleware/,
    )

    assert.match(
      source,
      /['"]\/api\/v1\/experiments['"]/,
    )

    assert.match(
      source,
      /['"]\/api\/v1\/host\/analytics['"]/,
    )

    assert.match(
      source,
      /['"]\/api\/v1\/admin\/analytics['"]/,
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
      webhookIndex >=
      0,
    )

    assert.ok(
      jsonIndex >
        webhookIndex,
    )
  },
)

test(
  'M19 Customer Notification Center describes reason-driven controls and no engagement spam',
  () => {
    const source =
      readFrontend(
        'src/features/notifications/pages/NotificationCenterPage.jsx',
      )

    for (
      const label of [
        'Dismiss',
        'Snooze 24h',
        'Still have',
        'Bought elsewhere',
        'Stop suggesting',
      ]
    ) {
      assert.equal(
        source.includes(
          label,
        ),
        true,
      )
    }

    assert.match(
      source,
      /does not add a generic engagement-spam scheduler/,
    )
  },
)