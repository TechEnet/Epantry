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

function readBackend(relativePath) {
  return fs.readFileSync(
    path.join(
      backendRoot,
      relativePath,
    ),
    'utf8',
  )
}

function readFrontend(relativePath) {
  return fs.readFileSync(
    path.join(
      projectRoot,
      'frontend',
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
  'M21 Batch 2 registers campaigns adDecisionLogs creatorContent and communityReports without duplicating frozen M15 M16 M19 truth',
  () => {
    const retailModels =
      readBackend(
        'src/modules/retailMedia/retailMedia.models.js',
      )

    const communityModels =
      readBackend(
        'src/modules/communityExpansion/communityExpansion.models.js',
      )

    assert.match(
      retailModels,
      /collection:\s*['"]campaigns['"]/,
    )

    assert.match(
      retailModels,
      /collection:\s*['"]adDecisionLogs['"]/,
    )

    assert.match(
      communityModels,
      /collection:\s*['"]creatorContent['"]/,
    )

    assert.match(
      communityModels,
      /collection:\s*['"]communityReports['"]/,
    )

    const combined =
      retailModels +
      communityModels

    assert.doesNotMatch(
      combined,
      /collection:\s*['"]communityRecipes['"]|collection:\s*['"]creatorProfiles['"]|collection:\s*['"]hostCampaignBriefs['"]|collection:\s*['"]analyticsEvents['"]/,
    )
  },
)

test(
  'M21 Retail Media upgrades the M16 Host Campaign Brief seam instead of bypassing Host organization authority',
  () => {
    const service =
      readBackend(
        'src/modules/retailMedia/retailMedia.service.js',
      )

    assert.match(
      service,
      /HostCampaignBrief/,
    )

    assert.match(
      service,
      /resolveHostOperationsContext/,
    )

    assert.match(
      service,
      /assertHostOperationsPermission\([\s\S]*['"]campaigns\.manage['"]/,
    )

    assert.match(
      service,
      /submitted_for_future_media_review/,
    )
  },
)

test(
  'M21 sponsored ranking is separated from organic and forbids sensitive health or allergy targeting',
  () => {
    const service =
      readBackend(
        'src/modules/retailMedia/retailMedia.service.js',
      )

    assert.match(
      service,
      /M21_RETAIL_MEDIA_SENSITIVE_TARGETING_FORBIDDEN/,
    )

    assert.match(
      service,
      /organicRankingOverrideAllowed:\s*false/,
    )

    assert.match(
      service,
      /organicRankingScoreUntouched:\s*true/,
    )

    assert.match(
      service,
      /sensitiveTargetingUsed:\s*false/,
    )
  },
)

test(
  'M21 first Retail Media serving lane fails closed for product and recipe ads until independent safety eligibility exists',
  () => {
    const service =
      readBackend(
        'src/modules/retailMedia/retailMedia.service.js',
      )

    assert.match(
      service,
      /PUBLIC_SERVING_ENTITY_TYPES[\s\S]*['"]brand['"][\s\S]*['"]generic['"]/,
    )

    assert.match(
      service,
      /productOrRecipeAdsServedWithoutSafetyEligibility:\s*false/,
    )

    assert.match(
      service,
      /productOrRecipeServingSuppressedWithoutSafetyEligibility:\s*true/,
    )
  },
)

test(
  'M21 AdDecisionLog is append-only evidence and a sponsored unit requires an explicit label plus organic path',
  () => {
    const models =
      readBackend(
        'src/modules/retailMedia/retailMedia.models.js',
      )

    const service =
      readBackend(
        'src/modules/retailMedia/retailMedia.service.js',
      )

    assert.match(
      models,
      /protectAppendOnlyModel\(adDecisionLogSchema\)/,
    )

    assert.match(
      models,
      /Sponsored/,
    )

    assert.match(
      service,
      /organicPathRequired:\s*true/,
    )

    assert.match(
      service,
      /This is a paid placement\./,
    )
  },
)

test(
  'M21 Retail Media admin policy mutation preserves M03 MFA CSRF permissions and immutable audit',
  () => {
    const routes =
      readBackend(
        'src/modules/retailMedia/retailMedia.routes.js',
      )

    const service =
      readBackend(
        'src/modules/retailMedia/retailMedia.service.js',
      )

    assert.match(
      routes,
      /loadAdminAuthorization/,
    )

    assert.match(
      routes,
      /requireMfaAssurance/,
    )

    assert.match(
      routes,
      /requireRecentMfaAuthentication/,
    )

    assert.match(
      routes,
      /requireCsrfToken/,
    )

    assert.match(
      routes,
      /trust_safety\.mutate/,
    )

    assert.match(
      service,
      /recordAdminAuditEvent/,
    )
  },
)

test(
  'M21 creator provenance keeps lineage rights sponsored disclosure and never copies Food Intelligence',
  () => {
    const models =
      readBackend(
        'src/modules/communityExpansion/communityExpansion.models.js',
      )

    const service =
      readBackend(
        'src/modules/communityExpansion/communityExpansion.service.js',
      )

    assert.match(
      models,
      /sourceLineage/,
    )

    assert.match(
      models,
      /ownerOrLicensor/,
    )

    assert.match(
      models,
      /Sponsored/,
    )

    assert.match(
      models,
      /foodIntelligenceCopied/,
    )

    assert.match(
      service,
      /foodIntelligenceCopiedFromParent:\s*false/,
    )
  },
)

test(
  'M21 Community privacy controls cannot make an ungoverned recipe public or leak Pantry household data',
  () => {
    const service =
      readBackend(
        'src/modules/communityExpansion/communityExpansion.service.js',
      )

    assert.match(
      service,
      /M21_COMMUNITY_PUBLICATION_GOVERNANCE_REQUIRED/,
    )

    assert.match(
      service,
      /pantryDataSharedToCommunity:\s*false/,
    )

    assert.match(
      service,
      /householdDataSharedToCommunity:\s*false/,
    )
  },
)

test(
  'M21 Community abuse workflow supports dangerous allergen claims undisclosed sponsorship copyright and governed quarantine without delete cascades',
  () => {
    const models =
      readBackend(
        'src/modules/communityExpansion/communityExpansion.models.js',
      )

    const service =
      stripComments(
        readBackend(
          'src/modules/communityExpansion/communityExpansion.service.js',
        ),
      )

    assert.match(
      models,
      /dangerous_allergen_claim/,
    )

    assert.match(
      models,
      /undisclosed_sponsorship/,
    )

    assert.match(
      models,
      /copyright/,
    )

    assert.match(
      service,
      /quarantined/,
    )

    assert.doesNotMatch(
      service,
      /deleteMany\(|findByIdAndDelete\(|findOneAndDelete\(/,
    )
  },
)

test(
  'M21 Community Trust admin writes remain M03 Trust Safety governed and do not mutate application roles',
  () => {
    const routes =
      readBackend(
        'src/modules/communityExpansion/communityExpansion.routes.js',
      )

    const service =
      stripComments(
        readBackend(
          'src/modules/communityExpansion/communityExpansion.service.js',
        ),
      )

    assert.match(
      routes,
      /trust_safety\.mutate/,
    )

    assert.match(
      routes,
      /requireRecentMfaAuthentication/,
    )

    assert.match(
      routes,
      /requireCsrfToken/,
    )

    assert.match(
      service,
      /recordAdminAuditEvent/,
    )

    assert.doesNotMatch(
      service,
      /superAdminEnabled\s*=|hostEnabled\s*=|customerEnabled\s*=|activeMode\s*=/,
    )
  },
)

test(
  'M21 Batch 2 APIs remain behind M17 feature flags and app mounts them without moving M11 raw webhook boundary',
  () => {
    const retail =
      readBackend(
        'src/modules/retailMedia/retailMedia.service.js',
      )

    const community =
      readBackend(
        'src/modules/communityExpansion/communityExpansion.service.js',
      )

    const app =
      readBackend(
        'src/app.js',
      )

    assert.match(
      retail,
      /m21\.retail_media/,
    )

    assert.match(
      community,
      /m21\.community_trust/,
    )

    assert.match(
      retail,
      /AdminFeatureFlag/,
    )

    assert.match(
      community,
      /AdminFeatureFlag/,
    )

    assert.match(
      app,
      /retailMediaRoutes/,
    )

    assert.match(
      app,
      /communityExpansionRoutes/,
    )

    assert.ok(
      app.indexOf(
        "'/api/v1/webhooks'",
      ) <
        app.indexOf(
          'express.json',
        ),
    )
  },
)

test(
  'M21 Host Retail Media frontend replaces the old S10 seam while preserving explicit sponsored and organic separation language',
  () => {
    const shell =
      readFrontend(
        'src/features/host/components/HostShell.jsx',
      )

    const page =
      readFrontend(
        'src/features/retailMedia/pages/HostRetailMediaPage.jsx',
      )

    assert.match(
      shell,
      /HostRetailMediaPage/,
    )

    assert.match(
      shell,
      /['"]\/host\/campaigns['"]/,
    )

    assert.match(
      page,
      /Sponsored \/ Ad \/ Paid placement/,
    )

    assert.match(
      page,
      /Paid ranking never changes organic/,
    )

    assert.match(
      page,
      /allergy inferences are never advertising targeting segments/,
    )
  },
)

test(
  'M21 Admin expansion frontend exposes Community reports Creator provenance Retail Media policy and append-only decision evidence',
  () => {
    const panel =
      readFrontend(
        'src/features/communityExpansion/components/AdminExpansionTrustPanel.jsx',
      )

    const adminCommunity =
      readFrontend(
        'src/features/community/pages/AdminCommunityPage.jsx',
      )

    assert.match(
      adminCommunity,
      /AdminExpansionTrustPanel/,
    )

    assert.match(
      panel,
      /Community reports/,
    )

    assert.match(
      panel,
      /Creator content provenance/,
    )

    assert.match(
      panel,
      /Retail Media policy/,
    )

    assert.match(
      panel,
      /AdDecisionLog is append-only evidence/,
    )
  },
)

test(
  'M21 Batch 2 preserves only Customer Host Super Admin top-level access semantics and never uses activeMode for authority',
  () => {
    const source =
      stripComments(
        [
          readBackend(
            'src/modules/retailMedia/retailMedia.models.js',
          ),
          readBackend(
            'src/modules/retailMedia/retailMedia.service.js',
          ),
          readBackend(
            'src/modules/retailMedia/retailMedia.routes.js',
          ),
          readBackend(
            'src/modules/communityExpansion/communityExpansion.models.js',
          ),
          readBackend(
            'src/modules/communityExpansion/communityExpansion.service.js',
          ),
          readBackend(
            'src/modules/communityExpansion/communityExpansion.routes.js',
          ),
          readFrontend(
            'src/features/retailMedia/pages/HostRetailMediaPage.jsx',
          ),
          readFrontend(
            'src/features/communityExpansion/components/AdminExpansionTrustPanel.jsx',
          ),
        ].join('\n'),
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
      )
    }

    assert.doesNotMatch(
      source,
      /activeMode\s*===\s*['"]host['"]|activeMode\s*!==\s*['"]host['"]/,
    )
  },
)

test(
  'M21 final expansion freeze preserves M20 launch gate trust boundaries and M08 allergen fail closed boundary',
  () => {
    const m20Freeze =
      readBackend(
        'tests/m20-batch2-final-freeze.test.js',
      )

    const food =
      readBackend(
        'src/modules/foodIntelligence/foodIntelligence.engine.js',
      )

    assert.match(
      m20Freeze,
      /tenant_isolation/,
    )

    assert.match(
      m20Freeze,
      /allergen_fail_closed/,
    )

    assert.match(
      m20Freeze,
      /browser_accessibility/,
    )

    assert.match(
      food,
      /unknown|cannot_verify|incomplete/i,
    )
  },
)