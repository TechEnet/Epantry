import assert from 'node:assert/strict'

import test from 'node:test'

import {
  aggregateNormalizedNutrients,
  buildFoodCalculationFingerprint,
  buildFoodCalculationSnapshot,
  deriveCalculatedEvidenceState,
  evaluateAllergenPropagation,
  evaluateExplicitDietaryRule,
} from '../src/modules/foodIntelligence/foodIntelligence.engine.js'

test(
  'M08 known contains allergen propagates as contains',
  () => {
    const result =
      evaluateAllergenPropagation({
        evidenceComplete:
          true,

        relationships: [
          {
            allergenId:
              'milk',

            relationType:
              'contains',

            evidenceState:
              'verified_source',
          },
        ],
      })

    assert.equal(
      result
        .allergens[0]
        .outcome,
      'contains',
    )
  },
)

test(
  'M08 may-contain remains distinct from contains',
  () => {
    const result =
      evaluateAllergenPropagation({
        evidenceComplete:
          true,

        relationships: [
          {
            allergenId:
              'peanut',

            relationType:
              'may_contain',

            evidenceState:
              'verified_source',
          },
        ],
      })

    assert.equal(
      result
        .allergens[0]
        .outcome,
      'may_contain',
    )
  },
)

test(
  'M08 cross-contact remains distinct from may-contain',
  () => {
    const result =
      evaluateAllergenPropagation({
        evidenceComplete:
          true,

        relationships: [
          {
            allergenId:
              'sesame',

            relationType:
              'cross_contact',

            evidenceState:
              'verified_source',
          },
        ],
      })

    assert.equal(
      result
        .allergens[0]
        .outcome,
      'cross_contact',
    )
  },
)

test(
  'M08 contains wins when same allergen has weaker cross-contact relation',
  () => {
    const result =
      evaluateAllergenPropagation({
        evidenceComplete:
          true,

        relationships: [
          {
            allergenId:
              'milk',

            relationType:
              'cross_contact',

            evidenceState:
              'verified_source',
          },

          {
            allergenId:
              'milk',

            relationType:
              'contains',

            evidenceState:
              'verified_source',
          },
        ],
      })

    assert.equal(
      result
        .allergens
        .length,
      1,
    )

    assert.equal(
      result
        .allergens[0]
        .outcome,
      'contains',
    )
  },
)

test(
  'M08 incomplete allergen evidence fails closed',
  () => {
    const result =
      evaluateAllergenPropagation({
        evidenceComplete:
          false,

        relationships:
          [],
      })

    assert.equal(
      result.evidenceState,
      'unknown_review_required',
    )

    assert.equal(
      result.requiresVerification,
      true,
    )

    assert.equal(
      result.freeFromVerificationAllowed,
      false,
    )
  },
)

test(
  'M08 inferred allergen evidence cannot become verified free-from state',
  () => {
    const result =
      evaluateAllergenPropagation({
        evidenceComplete:
          true,

        relationships: [
          {
            allergenId:
              'nuts',

            relationType:
              'may_contain',

            evidenceState:
              'inferred',
          },
        ],
      })

    assert.equal(
      result.evidenceState,
      'inferred',
    )

    assert.equal(
      result.requiresVerification,
      true,
    )

    assert.equal(
      result.freeFromVerificationAllowed,
      false,
    )
  },
)

test(
  'M08 complete verified scope with no allergen relationship may pass absence verification boundary',
  () => {
    const result =
      evaluateAllergenPropagation({
        evidenceComplete:
          true,

        relationships:
          [],
      })

    assert.equal(
      result.freeFromVerificationAllowed,
      true,
    )
  },
)

test(
  'M08 unknown source evidence keeps calculated result unknown',
  () => {
    assert.equal(
      deriveCalculatedEvidenceState({
        evidenceComplete:
          true,

        sourceEvidenceStates: [
          'verified_source',
          'unknown_review_required',
        ],
      }),
      'unknown_review_required',
    )
  },
)

test(
  'M08 deterministic calculation from complete verified sources becomes calculated',
  () => {
    assert.equal(
      deriveCalculatedEvidenceState({
        evidenceComplete:
          true,

        sourceEvidenceStates: [
          'verified_source',
          'operator_declared',
        ],
      }),
      'calculated',
    )
  },
)

test(
  'M08 normalized nutrient aggregation sums deterministic amounts',
  () => {
    const result =
      aggregateNormalizedNutrients({
        evidenceComplete:
          true,

        components: [
          {
            evidenceState:
              'verified_source',

            nutrients: [
              {
                nutrientId:
                  'protein',

                amount:
                  10,

                unit:
                  'g',
              },
            ],
          },

          {
            evidenceState:
              'verified_source',

            nutrients: [
              {
                nutrientId:
                  'protein',

                amount:
                  5,

                unit:
                  'g',
              },
            ],
          },
        ],
      })

    assert.equal(
      result
        .nutrients[0]
        .amount,
      15,
    )

    assert.equal(
      result
        .nutrients[0]
        .unit,
      'g',
    )
  },
)

test(
  'M08 nutrient component quantity factor is deterministic',
  () => {
    const result =
      aggregateNormalizedNutrients({
        evidenceComplete:
          true,

        components: [
          {
            quantityFactor:
              2,

            evidenceState:
              'verified_source',

            nutrients: [
              {
                nutrientId:
                  'protein',

                amount:
                  8,

                unit:
                  'g',
              },
            ],
          },
        ],
      })

    assert.equal(
      result
        .nutrients[0]
        .amount,
      16,
    )
  },
)

test(
  'M08 nutrient aggregation rejects incompatible canonical units',
  () => {
    assert.throws(
      () =>
        aggregateNormalizedNutrients({
          evidenceComplete:
            true,

          components: [
            {
              evidenceState:
                'verified_source',

              nutrients: [
                {
                  nutrientId:
                    'sodium',

                  amount:
                    10,

                  unit:
                    'mg',
                },
              ],
            },

            {
              evidenceState:
                'verified_source',

              nutrients: [
                {
                  nutrientId:
                    'sodium',

                  amount:
                    1,

                  unit:
                    'g',
                },
              ],
            },
          ],
        }),

      /incompatible canonical units/,
    )
  },
)

test(
  'M08 dietary rule is eligible only when every explicit governed fact matches',
  () => {
    const result =
      evaluateExplicitDietaryRule({
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

          {
            factKey:
              'contains_fish',

            expectedValue:
              false,
          },
        ],

        factMap: {
          contains_meat:
            false,

          contains_fish:
            false,
        },
      })

    assert.equal(
      result.outcome,
      'eligible',
    )
  },
)

test(
  'M08 dietary rule fails deterministically when governed fact conflicts',
  () => {
    const result =
      evaluateExplicitDietaryRule({
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
            true,
        },
      })

    assert.equal(
      result.outcome,
      'not_eligible',
    )
  },
)

test(
  'M08 missing dietary fact fails closed instead of guessing eligibility',
  () => {
    const result =
      evaluateExplicitDietaryRule({
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
  'M08 calculation fingerprint is reproducible regardless of object key ordering',
  () => {
    const first =
      buildFoodCalculationFingerprint({
        engineVersion:
          'm08.1',

        basis:
          'recipe',

        values: {
          b:
            2,

          a:
            1,
        },
      })

    const second =
      buildFoodCalculationFingerprint({
        values: {
          a:
            1,

          b:
            2,
        },

        basis:
          'recipe',

        engineVersion:
          'm08.1',
      })

    assert.equal(
      first,
      second,
    )

    assert.equal(
      first.length,
      64,
    )
  },
)

test(
  'M08 changing rule version changes reproducibility fingerprint',
  () => {
    const first =
      buildFoodCalculationSnapshot({
        entityType:
          'recipe_version',

        entityId:
          'recipe-v1',

        calculationVersion:
          1,

        engineVersion:
          'm08.1',

        sourceVersions:
          [],

        ruleProfileVersions: [
          {
            ruleKey:
              'vegetarian',

            version:
              1,
          },
        ],

        evidenceState:
          'calculated',

        basis:
          'recipe-version',
      })

    const second =
      buildFoodCalculationSnapshot({
        entityType:
          'recipe_version',

        entityId:
          'recipe-v1',

        calculationVersion:
          1,

        engineVersion:
          'm08.1',

        sourceVersions:
          [],

        ruleProfileVersions: [
          {
            ruleKey:
              'vegetarian',

            version:
              2,
          },
        ],

        evidenceState:
          'calculated',

        basis:
          'recipe-version',
      })

    assert.notEqual(
      first.fingerprint,
      second.fingerprint,
    )
  },
)