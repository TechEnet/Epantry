import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import {
  fileURLToPath,
} from 'node:url'

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

const projectRoot =
  path.resolve(
    backendRoot,
    '..',
  )

function readBackend(
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
  'M20 Batch 2 preserves only Customer Host Super Admin top-level access semantics',
  () => {
    const source =
      stripComments(
        [
          readBackend(
            'src/modules/reliability/reliability.models.js',
          ),

          readBackend(
            'src/modules/reliability/reliability.service.js',
          ),

          readBackend(
            'src/modules/reliability/reliability.routes.js',
          ),

          readBackend(
            'src/modules/hardening/privacyOps.service.js',
          ),

          readFrontend(
            'src/features/hardening/pages/CustomerPrivacyPage.jsx',
          ),

          readFrontend(
            'src/features/hardening/pages/AdminPrivacyOpsPage.jsx',
          ),

          readFrontend(
            'src/features/hardening/pages/AdminObservabilityPage.jsx',
          ),

          readFrontend(
            'src/App.jsx',
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
      /activeMode\s*===\s*['"]host['"]|activeMode\s*!==\s*['"]host['"]/,
    )
  },
)

test(
  'M20 Launch Gate integrates with M17 AdminIncident instead of creating a second incident authority',
  () => {
    const models =
      readBackend(
        'src/modules/reliability/reliability.models.js',
      )

    const service =
      readBackend(
        'src/modules/reliability/reliability.service.js',
      )

    assert.match(
      service,
      /AdminIncident/,
    )

    assert.match(
      service,
      /investigating/,
    )

    assert.match(
      service,
      /monitoring/,
    )

    assert.match(
      service,
      /ACTIVE_HIGH_CRITICAL_INCIDENT/,
    )

    assert.doesNotMatch(
      models,
      /collection:\s*['"]incidents['"]/,
    )
  },
)

test(
  'M20 deterministic Launch Gate covers security tenant restore load allergen AI-adjacent browser accessibility and release evidence contracts',
  () => {
    const service =
      readBackend(
        'src/modules/reliability/reliability.service.js',
      )

    const routes =
      readBackend(
        'src/modules/reliability/reliability.routes.js',
      )

    for (
      const gate of [
        'recipe_scaling',
        'pantry_exclusion',
        'landed_cost',
        'nutrition_traceability',
        'allergen_fail_closed',
        'economic_idempotency',
        'tenant_isolation',
        'dish_passport_reproducibility',
        'privileged_audit',
        'privacy_jurisdiction_review',
        'load_regression',
        'browser_accessibility',
        'm17_incident_blockers',
        'verified_restore_drill',
      ]
    ) {
      assert.equal(
        service.includes(
          gate,
        ),
        true,
        `missing launch gate ${gate}`,
      )
    }

    assert.match(
      service,
      /inputFingerprint:\s*fingerprint\(\s*deterministicInput\s*,?\s*\)/,
    )

    assert.match(
      routes,
      /loadRegression:\s*launchEvidenceItemSchema/,
    )

    assert.match(
      routes,
      /browserAccessibility:\s*launchEvidenceItemSchema/,
    )
  },
)

test(
  'M20 rollback and restore evidence is append-only and verified restore is independently launch-blocking',
  () => {
    const models =
      readBackend(
        'src/modules/reliability/reliability.models.js',
      )

    const service =
      readBackend(
        'src/modules/reliability/reliability.service.js',
      )

    assert.match(
      models,
      /RecoveryEvidence/,
    )

    assert.match(
      models,
      /sourceSnapshotRef/,
    )

    assert.match(
      models,
      /recoveryPointAt/,
    )

    assert.match(
      models,
      /protectAppendOnlyModel/,
    )

    assert.match(
      service,
      /RECENT_RESTORE_EVIDENCE_REQUIRED/,
    )

    assert.match(
      service,
      /maximumAgeDays:\s*90/,
    )
  },
)

test(
  'M20 privileged Launch Gate recovery and A18 writes preserve M03 permission MFA CSRF recent-MFA and immutable audit boundaries',
  () => {
    const routes =
      readBackend(
        'src/modules/reliability/reliability.routes.js',
      )

    const reliability =
      readBackend(
        'src/modules/reliability/reliability.service.js',
      )

    const privacyOps =
      readBackend(
        'src/modules/hardening/privacyOps.service.js',
      )

    for (
      const token of [
        'loadAdminAuthorization',
        'requireAdminAccess',
        'requireMfaAssurance',
        'requireCsrfToken',
        'requireRecentMfaAuthentication',
        "'trust_safety.mutate'",
      ]
    ) {
      assert.equal(
        routes.includes(
          token,
        ),
        true,
        `missing privileged boundary ${token}`,
      )
    }

    assert.match(
      reliability,
      /recordAdminAuditEvent/,
    )

    assert.match(
      privacyOps,
      /recordAdminAuditEvent/,
    )
  },
)

test(
  'M20 A18 privacy ops processes workflow state without blind deletion cascades',
  () => {
    const service =
      readBackend(
        'src/modules/hardening/privacyOps.service.js',
      )

    const routes =
      readBackend(
        'src/modules/reliability/reliability.routes.js',
      )

    const page =
      readFrontend(
        'src/features/hardening/pages/AdminPrivacyOpsPage.jsx',
      )

    assert.match(
      service,
      /listPrivacyRequestsForAdmin/,
    )

    assert.match(
      service,
      /updatePrivacyRequestForAdmin/,
    )

    assert.doesNotMatch(
      service,
      /deleteMany|findByIdAndDelete|deleteOne/,
    )

    assert.match(
      routes,
      /['"]\/privacy-requests['"]/,
    )

    assert.match(
      routes,
      /['"]\/privacy-requests\/:id['"]/,
    )

    assert.match(
      page,
      /A18 Privacy \/ Consent Ops/,
    )

    assert.match(
      page,
      /retention/i,
    )
  },
)

test(
  'M20 Customer Privacy UX is Customer-scoped and communicates governed export deletion and retention',
  () => {
    const page =
      readFrontend(
        'src/features/hardening/pages/CustomerPrivacyPage.jsx',
      )

    const service =
      readFrontend(
        'src/features/hardening/services/hardening.service.js',
      )

    const app =
      readFrontend(
        'src/App.jsx',
      )

    assert.match(
      page,
      /Privacy Rights Center/,
    )

    assert.match(
      page,
      /data export/i,
    )

    assert.match(
      page,
      /deletion/i,
    )

    assert.match(
      page,
      /retention/i,
    )

    assert.match(
      service,
      /\/privacy\/context/,
    )

    assert.match(
      service,
      /\/privacy\/requests/,
    )

    assert.match(
      app,
      /customerEnabled\s*!==\s*true/,
    )

    assert.match(
      app,
      /\/account\/privacy/,
    )
  },
)

test(
  'M20 A19 Observability preserves M03 authority while exposing security jobs launch and recovery evidence',
  () => {
    const page =
      readFrontend(
        'src/features/hardening/pages/AdminObservabilityPage.jsx',
      )

    const service =
      readFrontend(
        'src/features/hardening/services/hardening.service.js',
      )

    assert.match(
      page,
      /A19 Audit \/ Observability/,
    )

    assert.match(
      page,
      /M03 remains the privileged audit and permission authority/,
    )

    assert.match(
      page,
      /M17 incident-aware launch gates/,
    )

    assert.match(
      page,
      /loadRegression/,
    )

    for (
      const token of [
        'listSecurityEvents',
        'listJobRuns',
        'listLaunchGateRuns',
        'listRecoveryEvidence',
        'runLaunchGate',
        'recordRecoveryEvidence',
      ]
    ) {
      assert.equal(
        service.includes(
          token,
        ),
        true,
        `missing A19 client ${token}`,
      )
    }
  },
)

test(
  'M20 regulatory admin UX remains effective-dated maker-checker and contains no timeless compliance boolean',
  () => {
    const page =
      stripComments(
        readFrontend(
          'src/features/hardening/pages/AdminPrivacyOpsPage.jsx',
        ),
      )

    const service =
      readFrontend(
        'src/features/hardening/services/hardening.service.js',
      )

    assert.match(
      page,
      /effective-dated/i,
    )

    assert.match(
      page,
      /submit|approve|activate/i,
    )

    assert.match(
      service,
      /\/admin\/regulatory-profiles/,
    )

    assert.doesNotMatch(
      page,
      /isFssaiCompliant|fssaiCompliant|officialNutriScore/i,
    )
  },
)

test(
  'M20 error offline reduced-motion and keyboard accessibility contracts remain explicit',
  () => {
    const bootstrap =
      readFrontend(
        'src/features/system/components/BootstrapSync.jsx',
      )

    const boundary =
      readFrontend(
        'src/features/system/components/AppErrorBoundary.jsx',
      )

    const providers =
      readFrontend(
        'src/app/AppProviders.jsx',
      )

    const privacy =
      readFrontend(
        'src/features/hardening/pages/CustomerPrivacyPage.jsx',
      )

    const observability =
      readFrontend(
        'src/features/hardening/pages/AdminObservabilityPage.jsx',
      )

    assert.match(
      bootstrap,
      /navigator\.onLine/,
    )

    assert.match(
      bootstrap,
      /aria-live="polite"/,
    )

    assert.match(
      bootstrap,
      /live price, stock, order, privacy, admin and partner data can be stale or unavailable/,
    )

    assert.match(
      boundary,
      /role="alert"/,
    )

    assert.match(
      boundary,
      /focus-ring/,
    )

    assert.match(
      providers,
      /reducedMotion="user"/,
    )

    assert.match(
      privacy,
      /aria-live/,
    )

    assert.match(
      observability,
      /aria-label|aria-live/,
    )
  },
)

test(
  'M20 allergen and AI-adversarial safety boundaries remain fail-closed and deterministic',
  () => {
    const foodEngine =
      readBackend(
        'src/modules/foodIntelligence/foodIntelligence.engine.js',
      )

    const copilotPrompt =
      readBackend(
        'src/modules/search/search.copilot.prompts.js',
      )

    const copilotService =
      readBackend(
        'src/modules/search/search.copilot.service.js',
      )

    assert.match(
      foodEngine,
      /unknown_review_required/,
    )

    assert.match(
      copilotPrompt,
      /Never invent Product, Recipe, Pantry, price, stock, delivery, payment, order, allergen or dietary facts/,
    )

    assert.match(
      copilotService,
      /allergen[- ]?free|100%\)? safe|completely/i,
    )
  },
)

test(
  'M20 final regression keeps Host authority on hostEnabled plus active status rather than UX activeMode',
  () => {
    const routes =
      readFrontend(
        'src/routes/AppRoutes.jsx',
      )

    assert.match(
      routes,
      /hostEnabled\s*===\s*true\s*&&\s*hostAccessStatus\s*===\s*['"]active['"]/,
    )

    assert.doesNotMatch(
      routes,
      /activeMode\s*===\s*['"]host['"]/,
    )
  },
)

test(
  'M20 final admin routing keeps frontend permission checks UX-only while backend endpoints remain permission-authoritative',
  () => {
    const app =
      readFrontend(
        'src/App.jsx',
      )

    const routes =
      readBackend(
        'src/modules/reliability/reliability.routes.js',
      )

    assert.match(
      app,
      /hasAnyAdminPermission/,
    )

    assert.match(
      app,
      /admin\.audit\.read/,
    )

    assert.match(
      app,
      /trust_safety\.read/,
    )

    assert.match(
      routes,
      /requireAnyAdminPermission/,
    )

    assert.match(
      routes,
      /requireAdminPermission|requireAnyAdminPermission/,
    )
  },
)