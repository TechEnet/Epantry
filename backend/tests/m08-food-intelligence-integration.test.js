import assert from 'node:assert/strict'

import fs from 'node:fs'

import test from 'node:test'

import {
  ApiError,
} from '../src/utils/ApiError.js'

import {
  calculateProductFoodIntelligenceSchema,
  calculateRecipeFoodIntelligenceSchema,
} from '../src/modules/foodIntelligence/foodIntelligence.integration.validation.js'

import {
  buildActiveIngredientRelationFilter,
  combineFoodEvidenceStates,
  resolveFoodCalculationStatus,
} from '../src/modules/foodIntelligence/foodIntelligence.calculation.js'

import {
  assertProductVersionFoodIntelligenceEligible,
} from '../src/modules/foodIntelligence/foodIntelligence.product.service.js'

import {
  applyExplicitNutritionYieldFactors,
  assertRecipeVersionFoodIntelligenceEligible,
  buildRecipeNutrientComponents,
  selectRecipeIngredientsForFoodCalculation,
} from '../src/modules/foodIntelligence/foodIntelligence.recipe.service.js'

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

function validProductInput() {
  return {
    jurisdictionCode:
      'IN',

    entityEvidenceState:
      'verified_source',

    basis:
      'published product version',

    dietaryEvidenceComplete:
      true,

    ingredientSources: [
      {
        canonicalIngredientId:
          objectId,

        evidenceSourceId:
          objectId2,

        sourceVersion:
          'label-v1',

        evidenceState:
          'verified_source',

        allergenEvidenceComplete:
          true,

        nutrientEvidenceComplete:
          true,
      },
    ],

    nutrientComponents: [
      {
        canonicalIngredientId:
          objectId,

        evidenceSourceId:
          objectId2,

        sourceVersion:
          'nutrition-v1',

        evidenceState:
          'verified_source',

        quantityFactor:
          1,

        nutrients: [
          {
            nutrientId:
              objectId3,

            amount:
              10,

            unit:
              'g',
          },
        ],
      },
    ],

    dietaryEvaluations:
      [],

    assumptions:
      [],

    reason:
      'Generate governed Food Intelligence.',
  }
}

test(
  'M08 Product calculation accepts explicit canonical source lineage',
  () => {
    assert.equal(
      calculateProductFoodIntelligenceSchema.safeParse(
        validProductInput(),
      ).success,
      true,
    )
  },
)

test(
  'M08 Product calculation rejects commercial price state',
  () => {
    assert.equal(
      calculateProductFoodIntelligenceSchema.safeParse({
        ...validProductInput(),

        price:
          499,
      }).success,
      false,
    )
  },
)

test(
  'M08 Product calculation rejects inventory state',
  () => {
    assert.equal(
      calculateProductFoodIntelligenceSchema.safeParse({
        ...validProductInput(),

        inventory: {
          quantity:
            4,
        },
      }).success,
      false,
    )
  },
)

test(
  'M08 Product Food Intelligence requires published Product Version',
  () => {
    assert.doesNotThrow(
      () =>
        assertProductVersionFoodIntelligenceEligible({
          status:
            'published',
        }),
    )

    assert.throws(
      () =>
        assertProductVersionFoodIntelligenceEligible({
          status:
            'draft',
        }),
      ApiError,
    )
  },
)

test(
  'M08 active ingredient relation filter is effective dated',
  () => {
    const filter =
      buildActiveIngredientRelationFilter({
        canonicalIngredientIds: [
          objectId,
        ],

        at:
          new Date(
            '2026-08-24T00:00:00.000Z',
          ),
      })

    assert.equal(
      filter.status,
      'active',
    )

    assert.ok(
      filter.$and,
    )
  },
)

test(
  'M08 incomplete calculation evidence requires review',
  () => {
    assert.equal(
      resolveFoodCalculationStatus(
        'unknown_review_required',
      ),
      'requires_review',
    )
  },
)

test(
  'M08 complete deterministic evidence remains calculated until approval',
  () => {
    assert.equal(
      resolveFoodCalculationStatus(
        'calculated',
      ),
      'calculated',
    )
  },
)

test(
  'M08 evidence aggregation fails closed on unknown state',
  () => {
    assert.equal(
      combineFoodEvidenceStates([
        'calculated',
        'unknown_review_required',
      ]),
      'unknown_review_required',
    )
  },
)

test(
  'M08 Recipe Food Intelligence accepts in-review and published versions',
  () => {
    assert.doesNotThrow(
      () =>
        assertRecipeVersionFoodIntelligenceEligible({
          status:
            'in_review',
        }),
    )

    assert.doesNotThrow(
      () =>
        assertRecipeVersionFoodIntelligenceEligible({
          status:
            'published',
        }),
    )
  },
)

test(
  'M08 Recipe Food Intelligence rejects draft version',
  () => {
    assert.throws(
      () =>
        assertRecipeVersionFoodIntelligenceEligible({
          status:
            'draft',
        }),
      ApiError,
    )
  },
)

test(
  'M08 Recipe optional ingredient policy is explicit',
  () => {
    const ingredients = [
      {
        id:
          1,

        optional:
          false,
      },

      {
        id:
          2,

        optional:
          true,
      },
    ]

    assert.equal(
      selectRecipeIngredientsForFoodCalculation({
        recipeIngredients:
          ingredients,

        optionalIngredientPolicy:
          'exclude',
      }).length,
      1,
    )

    assert.equal(
      selectRecipeIngredientsForFoodCalculation({
        recipeIngredients:
          ingredients,

        optionalIngredientPolicy:
          'include',
      }).length,
      2,
    )
  },
)

test(
  'M08 Recipe nutrient quantity factor derives from authored Recipe requirement',
  () => {
    const result =
      buildRecipeNutrientComponents({
        recipeIngredients: [
          {
            canonicalIngredientId:
              objectId,

            quantity:
              200,

            unit:
              'g',
          },
        ],

        ingredientProfiles: [
          {
            canonicalIngredientId:
              objectId,

            evidenceSourceId:
              objectId2,

            sourceVersion:
              'v1',

            evidenceState:
              'verified_source',

            basisQuantity:
              100,

            basisUnit:
              'g',

            nutrients: [
              {
                nutrientId:
                  objectId3,

                amount:
                  10,

                unit:
                  'g',
              },
            ],
          },
        ],
      })

    assert.equal(
      result
        .components[0]
        .quantityFactor,
      2,
    )
  },
)

test(
  'M08 Recipe calculation refuses to guess incompatible requirement units',
  () => {
    assert.throws(
      () =>
        buildRecipeNutrientComponents({
          recipeIngredients: [
            {
              canonicalIngredientId:
                objectId,

              quantity:
                200,

              unit:
                'g',
            },
          ],

          ingredientProfiles: [
            {
              canonicalIngredientId:
                objectId,

              basisQuantity:
                100,

              basisUnit:
                'ml',

              nutrients:
                [],
            },
          ],
        }),
      ApiError,
    )
  },
)

test(
  'M08 explicit Recipe nutrition yield factor is reproducible',
  () => {
    const result =
      applyExplicitNutritionYieldFactors({
        nutrients: [
          {
            nutrientId:
              objectId,

            amount:
              20,

            unit:
              'g',
          },
        ],

        yieldFactors: [
          {
            key:
              'retention',

            multiplier:
              0.8,
          },
        ],
      })

    assert.equal(
      result[0].amount,
      16,
    )
  },
)

test(
  'M08 integration uses M04 ProductVersion and M07 RecipeVersion without modifying their models',
  () => {
    const productSource =
      readSource(
        'modules/foodIntelligence/foodIntelligence.product.service.js',
      )

    const recipeSource =
      readSource(
        'modules/foodIntelligence/foodIntelligence.recipe.service.js',
      )

    assert.match(
      productSource,
      /ProductVersion/,
    )

    assert.match(
      recipeSource,
      /RecipeVersion/,
    )

    assert.match(
      recipeSource,
      /RecipeIngredient/,
    )
  },
)

test(
  'M08 Product and Recipe integration contains no Marketplace commercial model dependency',
  () => {
    const source =
      [
        readSource(
          'modules/foodIntelligence/foodIntelligence.product.service.js',
        ),

        readSource(
          'modules/foodIntelligence/foodIntelligence.recipe.service.js',
        ),
      ].join(
        '\n',
      )

    assert.doesNotMatch(
      source,
      /HostOffer/,
    )

    assert.doesNotMatch(
      source,
      /PriceRule/,
    )

    assert.doesNotMatch(
      source,
      /InventorySnapshot/,
    )

    assert.doesNotMatch(
      source,
      /ServiceArea/,
    )
  },
)