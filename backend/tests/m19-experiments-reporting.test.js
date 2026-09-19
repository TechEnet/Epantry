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

test(
  'M19 Batch 2 owns versioned experiment definitions and stable experiment assignments',
  () => {
    const source =
      readBackend(
        'src/modules/analytics/analytics.batch2.models.js',
      )

    assert.match(
      source,
      /collection:\s*['"]experimentDefinitions['"]/,
    )

    assert.match(
      source,
      /collection:\s*['"]experimentAssignments['"]/,
    )

    assert.match(
      source,
      /experimentKey:[\s\S]*?versionNumber:/,
    )

    assert.match(
      source,
      /variantKey:[\s\S]*?immutable:\s*true/,
    )
  },
)

test(
  'M19 experiment assignment is deterministic rather than random per request',
  () => {
    const source =
      readBackend(
        'src/modules/analytics/analytics.batch2.service.js',
      )

    assert.match(
      source,
      /deterministicBucket/,
    )

    assert.match(
      source,
      /createHash\(\s*['"]sha256['"]/,
    )

    assert.doesNotMatch(
      source,
      /Math\.random/,
    )

    assert.match(
      source,
      /persisted_assignment/,
    )
  },
)

test(
  'M19 experiment definitions are gated by M17 FeatureFlag state',
  () => {
    const source =
      readBackend(
        'src/modules/analytics/analytics.batch2.service.js',
      )

    assert.match(
      source,
      /FeatureFlag/,
    )

    assert.match(
      source,
      /EXPERIMENT_FEATURE_FLAG_DISABLED/,
    )

    assert.match(
      source,
      /featureFlagEnabledAtAssignment/,
    )
  },
)

test(
  'M19 blocks safety authorization payment and tenant-isolation experiment surfaces',
  () => {
    const source =
      readBackend(
        'src/modules/analytics/analytics.batch2.service.js',
      )

    assert.match(
      source,
      /PROHIBITED_EXPERIMENT_TERMS/,
    )

    assert.match(
      source,
      /EXPERIMENT_SAFETY_BOUNDARY_PROHIBITED/,
    )

    for (
      const term of [
        'allerg',
        'mfa',
        'payment',
        'tenant',
        'permission',
      ]
    ) {
      assert.equal(
        source
          .toLowerCase()
          .includes(
            term,
          ),
        true,
      )
    }
  },
)

test(
  'M19 notification experiments require holdout and utility-oriented primary metrics',
  () => {
    const source =
      readBackend(
        'src/modules/analytics/analytics.batch2.service.js',
      )

    assert.match(
      source,
      /EXPERIMENT_NOTIFICATION_HOLDOUT_REQUIRED/,
    )

    assert.match(
      source,
      /EXPERIMENT_UTILITY_METRIC_REQUIRED/,
    )

    assert.match(
      source,
      /utilityMetric\.includes/,
    )
  },
)

test(
  'M19 experiment exposure records explicit assignment context in AnalyticsEvent',
  () => {
    const source =
      readBackend(
        'src/modules/analytics/analytics.batch2.service.js',
      )

    assert.match(
      source,
      /eventName:\s*['"]experiment\.exposed['"]/,
    )

    assert.match(
      source,
      /experiments:\s*\[/,
    )

    assert.match(
      source,
      /variantKey:/,
    )
  },
)

test(
  'M19 Host analytics derives organization scope server-side and reports Seller Brand B2B as Host lenses',
  () => {
    const source =
      readBackend(
        'src/modules/analytics/analytics.batch2.service.js',
      )

    assert.match(
      source,
      /resolveHostOrganization/,
    )

    assert.match(
      source,
      /MarketplaceOrganization\.findOne/,
    )

    assert.match(
      source,
      /HospitalityMemberGrant\.findOne/,
    )

    assert.match(
      source,
      /sellerBrandB2bAreHostLenses:\s*true/,
    )

    assert.match(
      source,
      /uxModeAuthorizes:\s*false/,
    )
  },
)

test(
  'M19 Admin analytics is filtered by resolved M03 permissions',
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
      /adminAuthorization\?\.permissionKeys/,
    )

    assert.match(
      routes,
      /loadAdminAuthorization/,
    )

    assert.match(
      routes,
      /requireAnyAdminPermission/,
    )
  },
)

test(
  'M19 reporting keeps organic and sponsored metrics separated',
  () => {
    const source =
      readBackend(
        'src/modules/analytics/analytics.batch2.service.js',
      )

    assert.match(
      source,
      /decisionContextCounts/,
    )

    assert.match(
      source,
      /organicSponsored/,
    )

    assert.match(
      source,
      /sponsoredSeparated:\s*true/,
    )
  },
)

test(
  'M19 notification still-have and bought-elsewhere actions now delegate through M09 service',
  () => {
    const source =
      readBackend(
        'src/modules/notifications/notification.service.js',
      )

    assert.match(
      source,
      /createCustomerPantryObservation/,
    )

    assert.match(
      source,
      /sourceType:[\s\S]*?manual_have/,
    )

    assert.match(
      source,
      /bought_elsewhere/,
    )

    assert.match(
      source,
      /status:[\s\S]*?completed/,
    )
  },
)

test(
  'M19 frontend exposes Notification Center Host Analytics and Admin Analytics',
  () => {
    const routes =
      readFrontend(
        'src/routes/AppRoutes.jsx',
      )

    assert.match(
      routes,
      /path="\/notifications"/,
    )

    assert.match(
      routes,
      /path="\/host\/analytics"/,
    )

    assert.match(
      routes,
      /path="\/admin\/analytics"/,
    )

    assert.match(
      routes,
      /HostAnalyticsPage/,
    )

    assert.match(
      routes,
      /AdminAnalyticsPage/,
    )
  },
)

test(
  'M19 HostShell adds analytics without losing frozen M16 M18 navigation contracts',
  () => {
    const source =
      readFrontend(
        'src/features/host/components/HostShell.jsx',
      )

    assert.match(
      source,
      /label:\s*['"]Orders['"]/,
    )

    assert.match(
      source,
      /screenLabel:\s*['"]S06 Orders['"]/,
    )

    assert.match(
      source,
      /screenLabel:\s*['"]Hospitality \/ Pro Ops['"]/,
    )

    assert.match(
      source,
      /to:\s*['"]\/host\/analytics['"]/,
    )
  },
)