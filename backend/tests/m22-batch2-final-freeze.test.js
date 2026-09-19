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
  'M22 Batch 2 creates bounded sponsored eligibility and Creator transaction evidence collections without duplicating M08 M11 M15 M16 M21 truth',
  () => {
    const models =
      readBackend(
        'src/modules/expansionExecution/expansionExecution.models.js',
      )

    for (
      const collection
      of [
        'sponsoredEligibilityEvidence',
        'creatorSessions',
        'creatorSessionBookings',
        'creatorSessionEvents',
        'creatorPaymentEvidence',
      ]
    ) {
      assert.match(
        models,

        new RegExp(
          `collection:\\s*['"]${collection}['"]`,
        ),
      )
    }

    assert.doesNotMatch(
      models,

      /collection:\s*['"]foodCalculations['"]|collection:\s*['"]creatorCourses['"]|collection:\s*['"]courseEntitlements['"]|collection:\s*['"]campaigns['"]|collection:\s*['"]commerceLedgerEntries['"]|collection:\s*['"]settlements['"]/,
    )
  },
)

test(
  'M22 Product and Recipe sponsored eligibility starts from owned M12 deterministic organic evidence',
  () => {
    const service =
      readBackend(
        'src/modules/expansionExecution/expansionExecution.service.js',
      )

    assert.match(
      service,
      /SearchSession/,
    )

    assert.match(
      service,
      /CandidateSet/,
    )

    assert.match(
      service,
      /RankingDecision/,
    )

    assert.match(
      service,
      /ownerUserId:\s*userId/,
    )

    assert.match(
      service,
      /ORGANIC_HARD_CONSTRAINTS_UNRESOLVED/,
    )

    assert.match(
      service,
      /NOT_AN_ORGANICALLY_ELIGIBLE_CANDIDATE/,
    )
  },
)

test(
  'M22 rechecks canonical publication and exact approved M08 FoodCalculation before paid rank',
  () => {
    const service =
      readBackend(
        'src/modules/expansionExecution/expansionExecution.service.js',
      )

    assert.match(
      service,
      /ProductVersion/,
    )

    assert.match(
      service,
      /publicationStatus:\s*['"]published['"]/,
    )

    assert.match(
      service,
      /RecipeVersion/,
    )

    assert.match(
      service,
      /status:\s*['"]published['"]/,
    )

    assert.match(
      service,
      /FoodCalculation/,
    )

    assert.match(
      service,
      /status:\s*['"]approved['"]/,
    )
  },
)

test(
  'M22 Product sponsored serving requires current M05 public eligible Offer serviceability while Recipe serving makes no fake commerce claim',
  () => {
    const service =
      readBackend(
        'src/modules/expansionExecution/expansionExecution.service.js',
      )

    assert.match(
      service,
      /listPublicEligibleOffers/,
    )

    assert.match(
      service,
      /PRODUCT_SERVICEABILITY_CONTEXT_REQUIRED/,
    )

    assert.match(
      service,
      /NO_CURRENT_SERVICEABLE_OFFER/,
    )

    assert.match(
      service,
      /RECIPE_SAFETY_ELIGIBLE/,
    )
  },
)

test(
  'M22 paid rank happens only after hard safety and cannot mutate organic ranking',
  () => {
    const service =
      readBackend(
        'src/modules/expansionExecution/expansionExecution.service.js',
      )

    assert.match(
      service,
      /paidRankScore/,
    )

    assert.match(
      service,
      /hardSafetyEvaluatedBeforePaidRank:\s*true/,
    )

    assert.match(
      service,
      /organicRankingMutated:\s*false/,
    )

    assert.match(
      service,
      /unsafeCandidateCanBeResurrectedByBid:\s*false/,
    )

    assert.match(
      service,
      /sensitiveTargetingUsed:\s*false/,
    )
  },
)

test(
  'M22 sponsored decisions continue writing M21 AdDecisionLog with explicit sponsored disclosure and organic alternative',
  () => {
    const service =
      readBackend(
        'src/modules/expansionExecution/expansionExecution.service.js',
      )

    assert.match(
      service,
      /AdDecisionLog/,
    )

    assert.match(
      service,
      /organicAlternativeRequired:\s*true/,
    )

    assert.match(
      service,
      /sponsorLabel/,
    )

    assert.match(
      service,
      /This is a paid placement\./,
    )
  },
)

test(
  'M22 Creator session remains Customer-profile based and reuses M15 CreatorCourse plus M21 CreatorContent governance',
  () => {
    const service =
      readBackend(
        'src/modules/expansionExecution/expansionExecution.service.js',
      )

    assert.match(
      service,
      /CreatorProfile/,
    )

    assert.match(
      service,
      /CreatorCourse/,
    )

    assert.match(
      service,
      /CreatorContent/,
    )

    assert.match(
      service,
      /governanceState:\s*['"]approved['"]/,
    )

    assert.match(
      service,
      /M22_CREATOR_CONTENT_GOVERNANCE_REQUIRED/,
    )
  },
)

test(
  'M22 Creator booking capacity is atomic and economic values come only from server-owned session state',
  () => {
    const service =
      readBackend(
        'src/modules/expansionExecution/expansionExecution.service.js',
      )

    assert.match(
      service,
      /\$expr:[\s\S]*\$lt:[\s\S]*\$reservedSeats[\s\S]*\$capacity/,
    )

    assert.match(
      service,
      /amountMinor:[\s\S]*session\.priceMinor/,
    )

    assert.match(
      service,
      /clientAmountTrusted:\s*false/,
    )
  },
)

test(
  'M22 paid Creator booking reuses existing Razorpay provider helper and stores no raw card data',
  () => {
    const service =
      readBackend(
        'src/modules/expansionExecution/expansionExecution.service.js',
      )

    const models =
      readBackend(
        'src/modules/expansionExecution/expansionExecution.models.js',
      )

    assert.match(
      service,
      /createRazorpayOrder/,
    )

    assert.match(
      service,
      /verifyRazorpayCheckoutSignature/,
    )

    assert.match(
      service,
      /rawCardDataHandledByEpantry:\s*false/,
    )

    assert.doesNotMatch(
      models,
      /cardNumber|cardCvv|cvv|rawCard|bankPassword/,
    )
  },
)

test(
  'M22 Creator payment verification does not claim Creator payout or M16 settlement truth',
  () => {
    const service =
      readBackend(
        'src/modules/expansionExecution/expansionExecution.service.js',
      )

    assert.match(
      service,
      /settlementOrCreatorPayoutClaimed:\s*false/,
    )

    assert.match(
      service,
      /m16SettlementAuthorityPreserved:\s*true/,
    )

    assert.match(
      service,
      /automaticCreatorPayout:\s*false/,
    )
  },
)

test(
  'M22 paid cancellation creates refund review evidence and never claims automatic refund',
  () => {
    const service =
      readBackend(
        'src/modules/expansionExecution/expansionExecution.service.js',
      )

    assert.match(
      service,
      /refund_review_required/,
    )

    assert.match(
      service,
      /providerRefundExecuted:\s*false/,
    )

    assert.match(
      service,
      /automaticRefundExecuted:\s*false/,
    )
  },
)

test(
  'M22 Creator session and payment evidence are append-only where they represent history',
  () => {
    const models =
      readBackend(
        'src/modules/expansionExecution/expansionExecution.models.js',
      )

    assert.match(
      models,
      /protectAppendOnly\([\s\S]*sponsoredEligibilityEvidenceSchema/,
    )

    assert.match(
      models,
      /protectAppendOnly\([\s\S]*creatorSessionEventSchema/,
    )

    assert.match(
      models,
      /protectAppendOnly\([\s\S]*creatorPaymentEvidenceSchema/,
    )
  },
)

test(
  'M22 Batch 2 Customer routes use Customer capability and CSRF on every mutation without activeMode authorization',
  () => {
    const routes =
      readBackend(
        'src/modules/expansionExecution/expansionExecution.routes.js',
      )

    const source =
      stripComments(
        routes,
      )

    assert.match(
      routes,
      /requireCustomerAccess/,
    )

    assert.match(
      routes,
      /requireCsrfToken/,
    )

    assert.doesNotMatch(
      source,
      /activeMode\s*===\s*['"]host['"]|activeMode\s*!==\s*['"]host['"]/,
    )
  },
)

test(
  'M22 Batch 2 remains behind M17 feature flag plane and flag never becomes permission authority',
  () => {
    const service =
      readBackend(
        'src/modules/expansionExecution/expansionExecution.service.js',
      )

    assert.match(
      service,
      /m22\.safe_expansion_execution/,
    )

    assert.match(
      service,
      /AdminFeatureFlag/,
    )

    assert.match(
      service,
      /requireCustomerAccess|actorId/,
    )
  },
)

test(
  'M22 Search frontend mounts safe sponsored disclosure without replacing organic results',
  () => {
    const page =
      readFrontend(
        'src/features/search/pages/SearchPage.jsx',
      )

    const component =
      readFrontend(
        'src/features/expansionExecution/components/SafeSponsoredPlacement.jsx',
      )

    assert.match(
      page,
      /SafeSponsoredPlacement/,
    )

    assert.match(
      page,
      /searchSessionId=\{data\.session\.id\}/,
    )

    assert.match(
      component,
      /Paid rank only after organic safety/,
    )

    assert.match(
      component,
      /Organic results remain unchanged/,
    )

    assert.match(
      component,
      /Sponsored/,
    )
  },
)

test(
  'M22 Learn Pro frontend composes Creator transactions and explicitly denies payout settlement and automatic refund claims',
  () => {
    const page =
      readFrontend(
        'src/features/community/pages/LearnProPage.jsx',
      )

    const component =
      readFrontend(
        'src/features/expansionExecution/components/CreatorProTransactionsPanel.jsx',
      )

    assert.match(
      page,
      /CreatorProTransactionsPanel/,
    )

    assert.match(
      component,
      /Creator remains a Customer-side profile/,
    )

    assert.match(
      component,
      /No creator payout or settlement was inferred/,
    )

    assert.match(
      component,
      /never claims an automatic refund/,
    )
  },
)

test(
  'M22 final freeze preserves only Customer Host Super Admin top-level access semantics',
  () => {
    const source =
      stripComments(
        [
          readBackend(
            'src/modules/expansionExecution/expansionExecution.models.js',
          ),

          readBackend(
            'src/modules/expansionExecution/expansionExecution.service.js',
          ),

          readBackend(
            'src/modules/expansionExecution/expansionExecution.routes.js',
          ),

          readFrontend(
            'src/features/expansionExecution/components/SafeSponsoredPlacement.jsx',
          ),

          readFrontend(
            'src/features/expansionExecution/components/CreatorProTransactionsPanel.jsx',
          ),
        ].join(
          '\n',
        ),
      )

    for (
      const forbidden
      of [
        'sellerEnabled',
        'brandEnabled',
        'b2bEnabled',
        'creatorEnabled',
        'advertiserEnabled',
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