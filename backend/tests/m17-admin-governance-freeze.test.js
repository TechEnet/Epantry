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

function read(relativePath) {
  return fs.readFileSync(
    path.join(
      backendRoot,
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
  'M17 does not introduce Seller Brand B2B application capabilities or activeMode authorization',
  () => {
    const source =
      stripComments(
        [
          'src/modules/adminGovernance/adminGovernance.models.js',
          'src/modules/adminGovernance/adminGovernance.validation.js',
          'src/modules/adminGovernance/adminGovernance.service.js',
          'src/modules/adminGovernance/adminGovernance.routes.js',
        ]
          .map(read)
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
        source.includes(forbidden),
        false,
        `${forbidden} must not be introduced by M17.`,
      )
    }
  },
)

test(
  'M17 controlled actions delegate to frozen M04 and M07 lifecycle services',
  () => {
    const source =
      read(
        'src/modules/adminGovernance/adminGovernance.service.js',
      )

    assert.match(
      source,
      /retireProductVersion\(/,
    )

    assert.match(
      source,
      /changeRecipeVersionLifecycle\(/,
    )

    assert.match(
      source,
      /changeDishLifecycle\(/,
    )

    assert.doesNotMatch(
      source,
      /ProductVersion\.(updateOne|updateMany|findOneAndUpdate|deleteOne|deleteMany)/,
    )

    assert.doesNotMatch(
      source,
      /RecipeVersion\.(updateOne|findOneAndUpdate|deleteOne|deleteMany)/,
    )
  },
)

test(
  'M17 ProductVersion and RecipeVersion recovery cannot silently rewrite historical truth',
  () => {
    const source =
      read(
        'src/modules/adminGovernance/adminGovernance.service.js',
      )

    assert.match(
      source,
      /ADMIN_PRODUCT_RECOVERY_REQUIRES_NEW_VERSION/,
    )

    assert.match(
      source,
      /ADMIN_RECIPE_VERSION_RECOVERY_REQUIRES_VERSIONED_WORKFLOW/,
    )

    assert.match(
      source,
      /historicalTruthPreserved:\s*true/,
    )
  },
)

test(
  'M17 own privileged mutations write immutable M03 audit records with before after and reason',
  () => {
    const source =
      read(
        'src/modules/adminGovernance/adminGovernance.service.js',
      )

    assert.match(
      source,
      /recordAdminAuditEvent\(/,
    )

    assert.match(
      source,
      /reasonCode:\s*['"]other\.justified['"]/,
    )

    assert.match(
      source,
      /beforeSnapshot/,
    )

    assert.match(
      source,
      /afterSnapshot/,
    )
  },
)

test(
  'M17 keeps feature flag authority on resolved root Super Admin instead of checking User.superAdminEnabled directly',
  () => {
    const service =
      stripComments(
        read(
          'src/modules/adminGovernance/adminGovernance.service.js',
        ),
      )

    const routes =
      stripComments(
        read(
          'src/modules/adminGovernance/adminGovernance.routes.js',
        ),
      )

    assert.match(
      service,
      /isRootSuperAdmin/,
    )

    assert.match(
      routes,
      /isRootSuperAdmin/,
    )

    assert.doesNotMatch(
      service,
      /superAdminEnabled/,
    )

    assert.doesNotMatch(
      routes,
      /superAdminEnabled/,
    )
  },
)

test(
  'M17 reuses M08 RuleProfile and does not mutate its definition from the governance aggregation service',
  () => {
    const source =
      read(
        'src/modules/adminGovernance/adminGovernance.service.js',
      )

    assert.match(
      source,
      /RuleProfile\.find\(/,
    )

    assert.match(
      source,
      /ruleProfilesReusedFromM08:\s*true/,
    )

    assert.doesNotMatch(
      source,
      /RuleProfile\.(create|updateOne|updateMany|findOneAndUpdate|deleteOne|deleteMany)/,
    )
  },
)

test(
  'M17 preserves M11 Razorpay raw webhook boundary before global JSON parsing',
  () => {
    const source =
      read(
        'src/app.js',
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
      webhookIndex >= 0 &&
      jsonIndex >
        webhookIndex,
    )

    assert.match(
      source,
      /adminGovernanceRoutes/,
    )
  },
)

test(
  'M17 feature flags do not grant permissions or become an authorization source',
  () => {
    const models =
      read(
        'src/modules/adminGovernance/adminGovernance.models.js',
      )

    const service =
      read(
        'src/modules/adminGovernance/adminGovernance.service.js',
      )

    const featureFlagBlock =
      models.slice(
        models.indexOf(
          'const adminFeatureFlagSchema',
        ),
        models.indexOf(
          'export const AdminReviewCase',
        ),
      )

    assert.doesNotMatch(
      featureFlagBlock,
      /permissionKeys|roleKeys|superAdminEnabled|hostEnabled|customerEnabled/,
    )

    assert.match(
      service,
      /mutationAuthority|root_super_admin_only|authorizationBoundary/,
    )
  },
)

test(
  'M17 governance command requires a review case plus reason and evidence trace',
  () => {
    const service =
      read(
        'src/modules/adminGovernance/adminGovernance.service.js',
      )

    const validation =
      read(
        'src/modules/adminGovernance/adminGovernance.validation.js',
      )

    assert.match(
      service,
      /requireActionReviewCase/,
    )

    assert.match(
      service,
      /reviewCaseKey/,
    )

    assert.match(
      validation,
      /reason:[\s\S]*?\.min\(10\)/,
    )

    assert.match(
      validation,
      /executeGovernanceActionBodySchema[\s\S]*?evidence:[\s\S]*?\.min\(1\)/,
    )
  },
)