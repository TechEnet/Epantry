import assert from 'node:assert/strict'

import fs from 'node:fs'

import test from 'node:test'

import {
  createIngredientRelationSchema,
  createRuleProfileSchema,
  testFoodRuleSchema,
} from '../src/modules/foodIntelligence/foodIntelligence.governance.validation.js'

import {
  testFoodRule,
} from '../src/modules/foodIntelligence/foodIntelligence.governance.service.js'

function readSource(
  path,
) {
  return fs.readFileSync(
    new URL(
      `../src/${path}`,
      import.meta.url,
    ),
    'utf8',
  )
}

const objectId =
  '64e000000000000000000001'

const objectId2 =
  '64e000000000000000000002'

const objectId3 =
  '64e000000000000000000003'

test(
  'M08 critical Ingredient allergen mapping accepts governed draft input',
  () => {
    const result =
      createIngredientRelationSchema.safeParse({
        canonicalIngredientId:
          objectId,

        allergenId:
          objectId2,

        relationType:
          'contains',

        evidenceState:
          'verified_source',

        evidenceSourceId:
          objectId3,

        effectiveFrom:
          null,

        effectiveTo:
          null,

        changeReason:
          'Verified source mapping.',

        notes:
          '',
      })

    assert.equal(
      result.success,
      true,
    )
  },
)

test(
  'M08 Ingredient allergen mapping rejects unsupported generic allergen boolean',
  () => {
    const result =
      createIngredientRelationSchema.safeParse({
        canonicalIngredientId:
          objectId,

        allergenId:
          objectId2,

        relationType:
          'allergen',

        evidenceState:
          'verified_source',

        evidenceSourceId:
          objectId3,

        changeReason:
          'Bad relation.',
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

test(
  'M08 Ingredient mapping rejects reversed effective window',
  () => {
    const result =
      createIngredientRelationSchema.safeParse({
        canonicalIngredientId:
          objectId,

        allergenId:
          objectId2,

        relationType:
          'contains',

        evidenceState:
          'verified_source',

        evidenceSourceId:
          objectId3,

        effectiveFrom:
          '2026-09-01T00:00:00.000Z',

        effectiveTo:
          '2026-08-01T00:00:00.000Z',

        changeReason:
          'Invalid dates.',
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

test(
  'M08 Food Rule Profile is versioned draft governance input',
  () => {
    const result =
      createRuleProfileSchema.safeParse({
        ruleKey:
          'vegetarian',

        ruleType:
          'dietary',

        jurisdictionCode:
          'IN',

        definition: {
          requiredFacts: [
            {
              factKey:
                'contains_meat',

              expectedValue:
                false,
            },
          ],
        },

        evidenceSourceIds:
          [],

        effectiveFrom:
          null,

        effectiveTo:
          null,

        changeReason:
          'Initial governed rule.',
      })

    assert.equal(
      result.success,
      true,
    )
  },
)

test(
  'M08 document-aligned Food Rule test is deterministic',
  () => {
    const input = {
      ruleKey:
        'vegetarian',

      evidenceComplete:
        true,

      requiredFacts: [
        {
          factKey:
            'contains_meat',

          expectedValue:
            false,
        },
      ],

      factMap: {
        contains_meat:
          false,
      },
    }

    assert.equal(
      testFoodRuleSchema.safeParse(
        input,
      ).success,
      true,
    )

    assert.equal(
      testFoodRule(
        input,
      ).outcome,
      'eligible',
    )
  },
)

test(
  'M08 Food Rule test fails closed when evidence is incomplete',
  () => {
    const result =
      testFoodRule({
        ruleKey:
          'vegetarian',

        evidenceComplete:
          false,

        requiredFacts:
          [],

        factMap:
          {},
      })

    assert.equal(
      result.outcome,
      'unknown_review_required',
    )
  },
)

test(
  'M08 Ingredient mapping activation enforces maker checker',
  () => {
    const source =
      readSource(
        'modules/foodIntelligence/foodIntelligence.governance.service.js',
      )

    assert.match(
      source,
      /assertDistinctMakerCheckerActors/,
    )

    assert.match(
      source,
      /relation\.createdByUserId/,
    )
  },
)

test(
  'M08 Food Rule activation also uses distinct maker checker',
  () => {
    const source =
      readSource(
        'modules/foodIntelligence/foodIntelligence.governance.service.js',
      )

    assert.match(
      source,
      /profile\.createdByUserId/,
    )

    assert.match(
      source,
      /checkerUserId/,
    )
  },
)

test(
  'M08 Food Calculation approval creates a new immutable snapshot',
  () => {
    const source =
      readSource(
        'modules/foodIntelligence/foodIntelligence.governance.service.js',
      )

    assert.match(
      source,
      /supersedesCalculationId/,
    )

    assert.match(
      source,
      /FoodCalculation\.create/,
    )

    assert.doesNotMatch(
      source,
      /source\.status\s*=/,
    )
  },
)

test(
  'M08 generated Food Calculation cannot self approve when actor identity is available',
  () => {
    const source =
      readSource(
        'modules/foodIntelligence/foodIntelligence.governance.service.js',
      )

    assert.match(
      source,
      /source\.generatedByUserId/,
    )

    assert.match(
      source,
      /assertDistinctMakerCheckerActors/,
    )
  },
)

test(
  'M08 privileged Food governance records immutable Admin audit events',
  () => {
    const source =
      readSource(
        'modules/foodIntelligence/foodIntelligence.admin.controller.js',
      )

    assert.match(
      source,
      /recordAdminAuditEvent/,
    )

    assert.match(
      source,
      /trust_safety\.enforcement/,
    )

    assert.match(
      source,
      /catalog\.governance/,
    )

    assert.match(
      source,
      /recipe\.governance/,
    )
  },
)

test(
  'M08 Food Intelligence admin rejects privileged impersonation',
  () => {
    const source =
      readSource(
        'modules/foodIntelligence/foodIntelligence.admin.routes.js',
      )

    assert.match(
      source,
      /rejectPrivilegedImpersonation/,
    )
  },
)

test(
  'M08 entire Food Intelligence admin surface requires session active account and MFA',
  () => {
    const source =
      readSource(
        'modules/foodIntelligence/foodIntelligence.admin.routes.js',
      )

    assert.match(
      source,
      /authenticateSession/,
    )

    assert.match(
      source,
      /requireActiveAccount/,
    )

    assert.match(
      source,
      /requireMfaAssurance/,
    )
  },
)

test(
  'M08 critical Food mutations require CSRF recent MFA and trust safety mutation authority',
  () => {
    const source =
      readSource(
        'modules/foodIntelligence/foodIntelligence.admin.routes.js',
      )

    assert.match(
      source,
      /requireCsrfToken/,
    )

    assert.match(
      source,
      /requireRecentMfaAuthentication/,
    )

    assert.match(
      source,
      /trust_safety\.mutate/,
    )
  },
)

test(
  'M08 Product calculation uses Catalog or Trust Safety existing permission',
  () => {
    const source =
      readSource(
        'modules/foodIntelligence/foodIntelligence.admin.routes.js',
      )

    assert.match(
      source,
      /catalog\.mutate/,
    )

    assert.match(
      source,
      /requireProductCalculation/,
    )
  },
)

test(
  'M08 Recipe calculation uses Recipe or Trust Safety existing permission',
  () => {
    const source =
      readSource(
        'modules/foodIntelligence/foodIntelligence.admin.routes.js',
      )

    assert.match(
      source,
      /recipe\.mutate/,
    )

    assert.match(
      source,
      /requireRecipeCalculation/,
    )
  },
)

test(
  'M08 exposes required POST admin food rules test endpoint',
  () => {
    const source =
      readSource(
        'modules/foodIntelligence/foodIntelligence.admin.routes.js',
      )

    assert.match(
      source,
      /'\/food-rules\/test'/,
    )

    assert.match(
      source,
      /testFoodRuleController/,
    )
  },
)

test(
  'M08 application mounts Food Intelligence only under existing Admin surface in this batch',
  () => {
    const source =
      readSource(
        'app.js',
      )

    assert.match(
      source,
      /foodIntelligenceAdminRoutes/,
    )

    assert.match(
      source,
      /'\/api\/v1\/admin'/,
    )

    assert.doesNotMatch(
      source,
      /\/host\/food-intelligence/,
    )
  },
)

test(
  'M08 Food Intelligence governance creates no Brand Seller B2B or Recipe application role',
  () => {
    const source =
      [
        readSource(
          'modules/foodIntelligence/foodIntelligence.admin.routes.js',
        ),

        readSource(
          'modules/foodIntelligence/foodIntelligence.governance.service.js',
        ),

        readSource(
          'modules/foodIntelligence/foodIntelligence.admin.controller.js',
        ),
      ].join(
        '\n',
      )

    assert.doesNotMatch(
      source,
      /sellerEnabled\s*=/,
    )

    assert.doesNotMatch(
      source,
      /brandEnabled\s*=/,
    )

    assert.doesNotMatch(
      source,
      /b2bEnabled\s*=/,
    )

    assert.doesNotMatch(
      source,
      /activeMode\s*=/,
    )
  },
)