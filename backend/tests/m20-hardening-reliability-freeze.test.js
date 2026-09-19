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
  'M20 Batch 1 introduces no Seller Brand B2B capability fields or activeMode authorization',
  () => {
    const source =
      stripComments(
        [
          'src/modules/hardening/hardening.models.js',
          'src/modules/hardening/hardening.service.js',
          'src/modules/hardening/hardening.routes.js',
          'src/modules/reliability/reliability.models.js',
          'src/modules/reliability/reliability.service.js',
          'src/modules/reliability/reliability.routes.js',
        ]
          .map(
            read,
          )
          .join(
            '\n',
          ),
      )

    for (const forbidden of [
      'sellerEnabled',
      'brandEnabled',
      'b2bEnabled',
      'activeMode',
    ]) {
      assert.equal(
        source.includes(
          forbidden,
        ),
        false,
      )
    }
  },
)

test(
  'M20 does not duplicate M17 incidents M03 audit M02 consent or M19 analytics collections',
  () => {
    const models =
      [
        read(
          'src/modules/hardening/hardening.models.js',
        ),

        read(
          'src/modules/reliability/reliability.models.js',
        ),
      ].join(
        '\n',
      )

    for (const duplicate of [
      'incidents',
      'auditEvents',
      'user_consents',
      'analyticsEvents',
      'metricAggregates',
      'featureFlags',
    ]) {
      assert.doesNotMatch(
        models,
        new RegExp(
          `collection:\\s*['"]${duplicate}['"]`,
        ),
      )
    }
  },
)

test(
  'M20 customer privacy routes require Customer capability CSRF and recent authentication for requests',
  () => {
    const source =
      read(
        'src/modules/hardening/hardening.routes.js',
      )

    assert.match(
      source,
      /requireCustomerAccess/,
    )

    assert.match(
      source,
      /requireCsrfToken/,
    )

    assert.match(
      source,
      /requireRecentAuthentication/,
    )
  },
)

test(
  'M20 privileged retention and regulatory writes use M03 admin authorization MFA CSRF recent MFA and immutable audit',
  () => {
    const routes =
      read(
        'src/modules/hardening/hardening.routes.js',
      )

    const service =
      read(
        'src/modules/hardening/hardening.service.js',
      )

    for (const token of [
      'loadAdminAuthorization',
      'requireAdminAccess',
      'requireMfaAssurance',
      'requireCsrfToken',
      'requireRecentMfaAuthentication',
      "'trust_safety.mutate'",
    ]) {
      assert.equal(
        routes.includes(
          token,
        ),
        true,
      )
    }

    assert.match(
      service,
      /recordAdminAuditEvent/,
    )

    assert.match(
      service,
      /action:\s*['"]trust_safety\.mutate['"]/,
    )
  },
)

test(
  'M20 RegulatoryProfile has no timeless FSSAI compliant boolean or official score claim',
  () => {
    const source =
      stripComments(
        [
          read(
            'src/modules/hardening/hardening.models.js',
          ),

          read(
            'src/modules/hardening/hardening.service.js',
          ),
        ].join(
          '\n',
        ),
      )

    assert.doesNotMatch(
      source,
      /isFssaiCompliant|fssaiCompliant|officialNutriScore/i,
    )
  },
)

test(
  'M20 RegulatoryProfile lifecycle contains no AI approval authority',
  () => {
    const source =
      read(
        'src/modules/hardening/hardening.service.js',
      )

    assert.doesNotMatch(
      source,
      /ai.*approve|approve.*ai/i,
    )

    assert.match(
      source,
      /approvedByUserId/,
    )
  },
)

test(
  'M20 reliability admin reads are M03 permission filtered and MFA protected',
  () => {
    const source =
      read(
        'src/modules/reliability/reliability.routes.js',
      )

    assert.match(
      source,
      /loadAdminAuthorization/,
    )

    assert.match(
      source,
      /requireAdminAccess/,
    )

    assert.match(
      source,
      /requireMfaAssurance/,
    )

    assert.match(
      source,
      /requireAnyAdminPermission/,
    )
  },
)

test(
  'M20 does not install or pretend BullMQ Redis queue ownership in Batch 1',
  () => {
    const source =
      [
        read(
          'src/modules/reliability/reliability.models.js',
        ),

        read(
          'src/modules/reliability/reliability.service.js',
        ),

        read(
          'src/modules/reliability/reliability.routes.js',
        ),
      ].join(
        '\n',
      )

    assert.doesNotMatch(
      source,
      /from ['"]bullmq['"]|from ['"]ioredis['"]/,
    )

    assert.match(
      source,
      /queueProviderRequiredForCurrentBatch:\s*false/,
    )
  },
)

test(
  'M20 required Mongo readiness fails closed while optional partner circuit degradation remains explicit',
  () => {
    const source =
      read(
        'src/modules/reliability/reliability.service.js',
      )

    assert.match(
      source,
      /ready:\s*databaseConnected/,
    )

    assert.match(
      source,
      /required:\s*true/,
    )

    assert.match(
      source,
      /partnerCircuits:[\s\S]*?required:\s*false/,
    )
  },
)

test(
  'M20 app mounts privacy reliability regulatory routes and preserves M11 raw webhook before JSON parser',
  () => {
    const source =
      read(
        'src/app.js',
      )

    for (const mount of [
      "'/api/v1/privacy'",
      "'/api/v1/admin/privacy'",
      "'/api/v1/admin/reliability'",
      "'/api/v1/admin/regulatory-profiles'",
    ]) {
      assert.equal(
        source.includes(
          mount,
        ),
        true,
      )
    }

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
  'M20 has no Super Admin implicit Host tenant bypass in hardening or reliability services',
  () => {
    const source =
      [
        read(
          'src/modules/hardening/hardening.service.js',
        ),

        read(
          'src/modules/reliability/reliability.service.js',
        ),
      ].join(
        '\n',
      )

    assert.doesNotMatch(
      source,
      /superAdminEnabled.*organization|organization.*superAdminEnabled/i,
    )
  },
)