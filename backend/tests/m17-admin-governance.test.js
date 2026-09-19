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

test(
  'M17 Batch 1 registers reviewCases incidents supportCases and featureFlags without duplicating auditEvents or ruleProfiles',
  () => {
    const source =
      read(
        'src/modules/adminGovernance/adminGovernance.models.js',
      )

    for (const collection of [
      'reviewCases',
      'incidents',
      'supportCases',
      'featureFlags',
    ]) {
      assert.match(
        source,
        new RegExp(
          `collection:\\s*['"]${collection}['"]`,
        ),
      )
    }

    assert.doesNotMatch(
      source,
      /collection:\s*['"]auditEvents['"]/,
    )

    assert.doesNotMatch(
      source,
      /collection:\s*['"]ruleProfiles['"]/,
    )
  },
)

test(
  'M17 review cases are domain scoped and preserve evidence before after snapshots and timeline',
  () => {
    const source =
      read(
        'src/modules/adminGovernance/adminGovernance.models.js',
      )

    assert.match(
      source,
      /ADMIN_GOVERNANCE_DOMAINS/,
    )

    assert.match(
      source,
      /beforeSnapshot/,
    )

    assert.match(
      source,
      /afterSnapshot/,
    )

    assert.match(
      source,
      /timeline/,
    )

    assert.match(
      source,
      /evidence/,
    )
  },
)

test(
  'M17 routes use M03 authorization MFA CSRF recent MFA and privileged impersonation rejection',
  () => {
    const source =
      read(
        'src/modules/adminGovernance/adminGovernance.routes.js',
      )

    for (const token of [
      'rejectPrivilegedImpersonation',
      'authenticateSession',
      'loadCurrentUser',
      'requireActiveAccount',
      'loadAdminAuthorization',
      'requireAdminAccess',
      'requireMfaAssurance',
      'requireCsrfToken',
      'requireRecentMfaAuthentication',
    ]) {
      assert.equal(
        source.includes(token),
        true,
        `${token} must remain in M17 governance security wiring.`,
      )
    }
  },
)

test(
  'M17 exposes command center global search review incident support policy flag and controlled action APIs',
  () => {
    const source =
      read(
        'src/modules/adminGovernance/adminGovernance.routes.js',
      )

    for (const route of [
      "'/command-center'",
      "'/search'",
      "'/review-cases'",
      "'/review-cases/:id'",
      "'/review-cases/:id/assign'",
      "'/review-cases/:id/decision'",
      "'/incidents'",
      "'/support-cases'",
      "'/policy'",
      "'/feature-flags'",
      "'/actions/execute'",
    ]) {
      assert.equal(
        source.includes(route),
        true,
        `${route} must exist.`,
      )
    }

    assert.match(
      source,
      /['"]\/admin\/governance['"]/,
    )
  },
)

test(
  'M17 command center reuses existing domain state instead of creating parallel commerce food or Host truth',
  () => {
    const source =
      read(
        'src/modules/adminGovernance/adminGovernance.service.js',
      )

    for (const token of [
      'ProductVersion',
      'RecipeVersion',
      'SellerOrder',
      'RuleProfile',
      'HostKybCase',
      'HostOperationalProfile',
      'HostSettlement',
      'HostWebhookEndpoint',
      'AdminAuditEvent',
    ]) {
      assert.equal(
        source.includes(token),
        true,
        `${token} must be reused by the command center.`,
      )
    }
  },
)

test(
  'M17 global search is permission filtered and masks user email',
  () => {
    const source =
      read(
        'src/modules/adminGovernance/adminGovernance.service.js',
      )

    assert.match(
      source,
      /permissionFiltered:\s*true/,
    )

    assert.match(
      source,
      /maskEmail/,
    )

    assert.match(
      source,
      /hasPermission\(/,
    )

    assert.match(
      source,
      /allowedDomains\(/,
    )
  },
)

test(
  'M17 critical case and action validators require evidence',
  () => {
    const source =
      read(
        'src/modules/adminGovernance/adminGovernance.validation.js',
      )

    assert.match(
      source,
      /Critical review cases require source\/evidence/,
    )

    assert.match(
      source,
      /Critical incidents require source\/evidence/,
    )

    assert.match(
      source,
      /executeGovernanceActionBodySchema[\s\S]*?\.min\(1\)/,
    )
  },
)

test(
  'M17 feature flag mutation is root Super Admin only and production flags require evidence',
  () => {
    const routes =
      read(
        'src/modules/adminGovernance/adminGovernance.routes.js',
      )

    const validation =
      read(
        'src/modules/adminGovernance/adminGovernance.validation.js',
      )

    assert.match(
      routes,
      /requireResolvedRootSuperAdmin/,
    )

    assert.match(
      routes,
      /isRootSuperAdmin/,
    )

    assert.match(
      validation,
      /production-enabled feature flags require evidence/,
    )
  },
)

test(
  'M17 AI policy keeps human governance authoritative',
  () => {
    const source =
      read(
        'src/modules/adminGovernance/adminGovernance.service.js',
      )

    assert.match(
      source,
      /caseSummarizationAllowed:\s*true/,
    )

    assert.match(
      source,
      /authoritativeDecisionAllowed:\s*false/,
    )

    assert.match(
      source,
      /criticalOverrideApprovalAllowed:\s*false/,
    )
  },
)