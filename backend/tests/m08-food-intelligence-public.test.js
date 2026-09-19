import assert from 'node:assert/strict'

import fs from 'node:fs'

import path from 'node:path'

import test from 'node:test'

import {
  derivePublicVerificationStatus,
  serializePublicFoodIntelligence,
} from '../src/modules/foodIntelligence/foodIntelligence.public.service.js'

import {
  productFoodIntelligenceParamsSchema,
  recipeFoodIntelligenceParamsSchema,
} from '../src/modules/foodIntelligence/foodIntelligence.public.validation.js'

function readSource(
  relativePath,
) {
  return fs.readFileSync(
    path.resolve(
      process.cwd(),
      relativePath,
    ),
    'utf8',
  )
}

test(
  'M08 public Product Food Intelligence accepts canonical Product Version ID',
  () => {
    const result =
      productFoodIntelligenceParamsSchema.safeParse({
        id:
          '64b000000000000000000001',
      })

    assert.equal(
      result.success,
      true,
    )
  },
)

test(
  'M08 public Product Food Intelligence rejects malformed identity',
  () => {
    const result =
      productFoodIntelligenceParamsSchema.safeParse({
        id:
          'not-an-id',
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

test(
  'M08 public Recipe Food Intelligence accepts canonical Recipe Version ID',
  () => {
    const result =
      recipeFoodIntelligenceParamsSchema.safeParse({
        id:
          '64b000000000000000000002',
      })

    assert.equal(
      result.success,
      true,
    )
  },
)

test(
  'M08 inferred evidence remains cannot verify publicly',
  () => {
    assert.equal(
      derivePublicVerificationStatus({
        calculationEvidenceState:
          'inferred',

        evidenceStates: [
          'inferred',
        ],
      }),
      'cannot_verify',
    )
  },
)

test(
  'M08 unknown evidence remains cannot verify publicly',
  () => {
    assert.equal(
      derivePublicVerificationStatus({
        calculationEvidenceState:
          'unknown_review_required',

        evidenceStates: [
          'unknown_review_required',
        ],
      }),
      'cannot_verify',
    )
  },
)

test(
  'M08 deterministic calculated evidence remains labelled calculated',
  () => {
    assert.equal(
      derivePublicVerificationStatus({
        calculationEvidenceState:
          'calculated',

        evidenceStates: [
          'calculated',
        ],
      }),
      'calculated',
    )
  },
)

test(
  'M08 empty approved allergen output never creates free from claim',
  () => {
    const result =
      serializePublicFoodIntelligence({
        subjectType:
          'product_version',

        subjectId:
          '64b000000000000000000001',

        calculation: {
          status:
            'approved',

          evidenceState:
            'calculated',

          allergens:
            [],
        },
      })

    assert.equal(
      result
        .allergenDisclosure
        .freeFromClaimGenerated,
      false,
    )

    assert.equal(
      result
        .allergenDisclosure
        .absenceStatus,
      'not_asserted',
    )
  },
)

test(
  'M08 contains may contain and cross contact remain distinct publicly',
  () => {
    const result =
      serializePublicFoodIntelligence({
        subjectType:
          'recipe_version',

        subjectId:
          '64b000000000000000000002',

        calculation: {
          status:
            'approved',

          evidenceState:
            'calculated',

          allergens: [
            {
              key:
                'milk',

              relationship:
                'contains',

              evidenceState:
                'verified_source',
            },

            {
              key:
                'nuts',

              relationship:
                'may_contain',

              evidenceState:
                'verified_source',
            },

            {
              key:
                'sesame',

              relationship:
                'cross_contact',

              evidenceState:
                'verified_source',
            },
          ],
        },
      })

    assert.deepEqual(
      result.allergens.map(
        (
          item,
        ) =>
          item.relationship,
      ),
      [
        'contains',
        'may_contain',
        'cross_contact',
      ],
    )
  },
)

test(
  'M08 public calculation with no approved snapshot fails closed',
  () => {
    const result =
      serializePublicFoodIntelligence({
        subjectType:
          'product_version',

        subjectId:
          '64b000000000000000000001',

        calculation:
          null,
      })

    assert.equal(
      result.available,
      false,
    )

    assert.equal(
      result.verificationStatus,
      'cannot_verify',
    )
  },
)

test(
  'M08 public serializer exposes calculation lineage without admin actor fields',
  () => {
    const result =
      serializePublicFoodIntelligence({
        subjectType:
          'product_version',

        subjectId:
          '64b000000000000000000001',

        calculation: {
          status:
            'approved',

          evidenceState:
            'verified_source',

          approvedByUserId:
            'should-not-leak',

          generatedByUserId:
            'should-not-leak',

          sourceLineage: [
            {
              sourceType:
                'evidence_source',

              sourceId:
                '64b000000000000000000003',
            },
          ],
        },
      })

    const serialized =
      JSON.stringify(
        result,
      )

    assert.doesNotMatch(
      serialized,
      /approvedByUserId|generatedByUserId/,
    )
  },
)

test(
  'M08 public router exposes documented Product Food Intelligence GET',
  () => {
    const source =
      readSource(
        'src/modules/foodIntelligence/foodIntelligence.public.routes.js',
      )

    assert.match(
      source,
      /'\/products\/:id\/food-intelligence'/,
    )
  },
)

test(
  'M08 public router exposes documented Recipe Food Intelligence GET',
  () => {
    const source =
      readSource(
        'src/modules/foodIntelligence/foodIntelligence.public.routes.js',
      )

    assert.match(
      source,
      /'\/recipes\/:id\/food-intelligence'/,
    )
  },
)

test(
  'M08 public Food Intelligence router remains read only',
  () => {
    const source =
      readSource(
        'src/modules/foodIntelligence/foodIntelligence.public.routes.js',
      )

    assert.doesNotMatch(
      source,
      /router\.(post|patch|put|delete)\s*\(/,
    )
  },
)

test(
  'M08 public Product Food Intelligence requires published Product Version',
  () => {
    const source =
      readSource(
        'src/modules/foodIntelligence/foodIntelligence.public.service.js',
      )

    assert.match(
      source,
      /version\.publicationStatus\s*!==\s*'published'/,
    )
  },
)

test(
  'M08 public Recipe Food Intelligence requires published Recipe Version',
  () => {
    const source =
      readSource(
        'src/modules/foodIntelligence/foodIntelligence.public.service.js',
      )

    assert.match(
      source,
      /'published'/,
    )

    assert.match(
      source,
      /getRecipePublicationStatus/,
    )
  },
)

test(
  'M08 public Food Intelligence has no Marketplace commercial dependency',
  () => {
    const source =
      readSource(
        'src/modules/foodIntelligence/foodIntelligence.public.service.js',
      )

    assert.doesNotMatch(
      source,
      /marketplace\.models|HostOffer|PriceRule|InventorySnapshot|ServiceArea/,
    )
  },
)