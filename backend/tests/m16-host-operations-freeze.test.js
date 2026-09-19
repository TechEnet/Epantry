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

function read(relativePath) {
  return fs.readFileSync(
    path.join(
      projectRoot,
      relativePath,
    ),
    'utf8',
  )
}

function stripComments(source) {
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
  'M16 Final preserves Customer Host Super Admin access model and never authorizes with activeMode',
  () => {
    const files = [
      'backend/src/modules/hostOperations/hostOperations.routes.js',
      'backend/src/modules/hostOperations/hostOperations.finance.routes.js',
      'backend/src/modules/hostOperations/hostOperations.integration.routes.js',
      'backend/src/modules/hostOperations/hostOperations.finance.service.js',
      'backend/src/modules/hostOperations/hostOperations.integration.service.js',
      'frontend/src/routes/AppRoutes.jsx',
    ]

    const source =
      stripComments(
        files
          .map(
            read,
          )
          .join('\n'),
      )

    assert.doesNotMatch(
      source,
      /activeMode/,
    )

    for (const forbidden of [
      'sellerEnabled',
      'brandEnabled',
      'b2bEnabled',
    ]) {
      assert.equal(
        source.includes(
          forbidden,
        ),
        false,
        `${forbidden} must not exist.`,
      )
    }
  },
)

test(
  'M16 finance Admin mutations require M03 finance.mutate + recent MFA',
  () => {
    const source =
      stripComments(
        read(
          'backend/src/modules/hostOperations/hostOperations.finance.routes.js',
        ),
      )

    assert.match(
      source,
      /requireRecentMfaAuthentication/,
    )

    assert.match(
      source,
      /finance\.mutate/,
    )

    assert.match(
      source,
      /finance\.read/,
    )
  },
)

test(
  'M16 Host finance remains own-org read scoped',
  () => {
    const source =
      read(
        'backend/src/modules/hostOperations/hostOperations.finance.service.js',
      )

    assert.match(
      source,
      /resolveHostOperationsContext\(actorUser\)/,
    )

    assert.match(
      source,
      /assertHostOperationsPermission\(context, ['"]finance\.read['"]\)/,
    )

    assert.match(
      source,
      /organizationId:\s*context\.organization\._id/,
    )
  },
)

test(
  'M16 settlement lines cannot double-settle the same SellerOrder',
  () => {
    const source =
      read(
        'backend/src/modules/hostOperations/hostOperations.finance.models.js',
      )

    assert.match(
      source,
      /sellerOrderId:[\s\S]*?unique:\s*true/,
    )
  },
)

test(
  'M16 v1 does not invent commission/tax values without a governed schedule',
  () => {
    const source =
      read(
        'backend/src/modules/hostOperations/hostOperations.finance.service.js',
      )

    assert.match(
      source,
      /platformFeeMinor:\s*0/,
    )

    assert.match(
      source,
      /taxWithheldMinor:\s*0/,
    )

    assert.match(
      source,
      /m16-v1-no-commission-schedule/,
    )

    assert.match(
      source,
      /commissionScheduleConfigured:\s*false/,
    )
  },
)

test(
  'M16 API credential plaintext is never serialized after creation',
  () => {
    const source =
      read(
        'backend/src/modules/hostOperations/hostOperations.integration.service.js',
      )

    const serializer =
      source.slice(
        source.indexOf(
          'function serializeCredential',
        ),
        source.indexOf(
          'function serializeWebhook',
        ),
      )

    assert.doesNotMatch(
      serializer,
      /secretHashSha256/,
    )

    assert.doesNotMatch(
      serializer,
      /apiKey/,
    )

    assert.match(
      serializer,
      /maskedKey/,
    )
  },
)

test(
  'M16 webhook serializer never returns encrypted secret material',
  () => {
    const source =
      read(
        'backend/src/modules/hostOperations/hostOperations.integration.service.js',
      )

    const serializer =
      source.slice(
        source.indexOf(
          'function serializeWebhook',
        ),
        source.indexOf(
          'async function auditHostOperation',
        ),
      )

    assert.doesNotMatch(
      serializer,
      /signingSecretCiphertext|signingSecretIv|signingSecretAuthTag/,
    )

    assert.match(
      serializer,
      /maskedSigningSecret/,
    )
  },
)

test(
  'M16 brand recipe publication remains M07/M08 governed and Batch 1 auto-publish prohibition stays frozen',
  () => {
    const source =
      read(
        'backend/src/modules/hostOperations/hostOperations.service.js',
      )

    assert.match(
      source,
      /publicationPerformed:\s*false/,
    )

    assert.match(
      source,
      /requiresM07M08Governance:\s*true/,
    )

    assert.doesNotMatch(
      source,
      /publishRecipeVersion\(/,
    )
  },
)

test(
  'M16 bulk catalog ingest still never mutates canonical ProductVersion',
  () => {
    const source =
      read(
        'backend/src/modules/hostOperations/hostOperations.service.js',
      )

    assert.match(
      source,
      /canonicalProductMutationPerformed:\s*false/,
    )

    assert.doesNotMatch(
      source,
      /ProductVersion\.(create|updateOne|findOneAndUpdate|delete)/,
    )
  },
)

test(
  'M16 preserves M11 Razorpay raw webhook mount before global JSON parsing',
  () => {
    const source =
      read(
        'backend/src/app.js',
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
        0 &&
      jsonIndex >
        webhookIndex,
    )

    assert.match(
      source,
      /hostOperationsFinanceRoutes/,
    )

    assert.match(
      source,
      /hostOperationsIntegrationRoutes/,
    )
  },
)

test(
  'M16 Service Account scopes are bounded and do not include admin/superadmin authority',
  () => {
    const source =
      read(
        'backend/src/modules/hostOperations/hostOperations.integration.models.js',
      )

    const block =
      source.slice(
        source.indexOf(
          'HOST_SERVICE_ACCOUNT_SCOPES',
        ),
        source.indexOf(
          'HOST_WEBHOOK_EVENT_TYPES',
        ),
      )

    assert.doesNotMatch(
      block,
      /superAdmin|admin\.audit|finance\.mutate|marketplace\.mutate|trust_safety\.mutate/,
    )
  },
)

test(
  'M16 Host frontend remains capability gated by HOST and not Seller/Brand roles',
  () => {
    const source =
      read(
        'frontend/src/routes/AppRoutes.jsx',
      )

    const block =
      source.slice(
        source.indexOf(
          'path="/host"',
        ),
        source.indexOf(
          'path="/admin"',
        ),
      )

    assert.match(
      block,
      /APPLICATION_ACCESS_TYPES\.HOST/,
    )

    assert.doesNotMatch(
      block,
      /SELLER|BRAND|B2B/,
    )
  },
)