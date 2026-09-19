import assert from 'node:assert/strict'

import test from 'node:test'

import {
  calculateRecipeScalingMultiplier,
  convertRecipeQuantity,
  normalizeRecipeQuantityForDisplay,
  scaleRecipeAggregate,
  scaleRecipeIngredientRequirement,
} from '../src/modules/recipes/recipe.scaling.js'

test(
  'M07 linear Recipe scaling doubles requirement from 2 to 4 servings',
  () => {
    assert.equal(
      calculateRecipeScalingMultiplier({
        baseServings:
          2,

        targetServings:
          4,

        scalingRule: {
          type:
            'linear',
        },
      }),
      2,
    )
  },
)

test(
  'M07 fixed ingredient scaling keeps authored quantity',
  () => {
    assert.equal(
      calculateRecipeScalingMultiplier({
        baseServings:
          2,

        targetServings:
          8,

        scalingRule: {
          type:
            'fixed',
        },
      }),
      1,
    )
  },
)

test(
  'M07 power scaling supports deterministic non-linear exception',
  () => {
    assert.equal(
      calculateRecipeScalingMultiplier({
        baseServings:
          2,

        targetServings:
          8,

        scalingRule: {
          type:
            'power',

          exponent:
            0.5,
        },
      }),
      2,
    )
  },
)

test(
  'M07 bounded scaling respects minimum multiplier',
  () => {
    assert.equal(
      calculateRecipeScalingMultiplier({
        baseServings:
          4,

        targetServings:
          1,

        scalingRule: {
          type:
            'bounded',

          minMultiplier:
            0.5,

          maxMultiplier:
            null,
        },
      }),
      0.5,
    )
  },
)

test(
  'M07 bounded scaling respects maximum multiplier',
  () => {
    assert.equal(
      calculateRecipeScalingMultiplier({
        baseServings:
          2,

        targetServings:
          20,

        scalingRule: {
          type:
            'bounded',

          minMultiplier:
            null,

          maxMultiplier:
            3,
        },
      }),
      3,
    )
  },
)

test(
  'M07 mass conversion is deterministic',
  () => {
    assert.equal(
      convertRecipeQuantity({
        quantity:
          1.5,

        fromUnit:
          'kg',

        toUnit:
          'g',
      }),
      1500,
    )
  },
)

test(
  'M07 volume conversion uses explicit deterministic platform factors',
  () => {
    assert.equal(
      convertRecipeQuantity({
        quantity:
          2,

        fromUnit:
          'tbsp',

        toUnit:
          'ml',
      }),
      30,
    )
  },
)

test(
  'M07 incompatible unit dimensions are rejected',
  () => {
    assert.throws(
      () =>
        convertRecipeQuantity({
          quantity:
            10,

          fromUnit:
            'g',

          toUnit:
            'ml',
        }),
    )
  },
)

test(
  'M07 count units are not guessed as interchangeable',
  () => {
    assert.throws(
      () =>
        convertRecipeQuantity({
          quantity:
            2,

          fromUnit:
            'piece',

          toUnit:
            'slice',
        }),
    )
  },
)

test(
  'M07 display normalization uses kilogram for large mass requirement',
  () => {
    assert.deepEqual(
      normalizeRecipeQuantityForDisplay({
        quantity:
          1500,

        unit:
          'g',
      }),
      {
        quantity:
          1.5,

        unit:
          'kg',
      },
    )
  },
)

test(
  'M07 display normalization uses litre for large volume requirement',
  () => {
    assert.deepEqual(
      normalizeRecipeQuantityForDisplay({
        quantity:
          1500,

        unit:
          'ml',
      }),
      {
        quantity:
          1.5,

        unit:
          'l',
      },
    )
  },
)

test(
  'M07 individual ingredient scaling preserves canonical Ingredient identity',
  () => {
    const result =
      scaleRecipeIngredientRequirement({
        ingredient: {
          id:
            'ingredient-row-1',

          canonicalIngredientId:
            'canonical-1',

          lineNumber:
            1,

          quantity:
            250,

          unit:
            'g',

          scalingRule: {
            type:
              'linear',
          },
        },

        baseServings:
          2,

        targetServings:
          4,
      })

    assert.equal(
      result.canonicalIngredientId,
      'canonical-1',
    )

    assert.equal(
      result.scaledQuantity,
      500,
    )
  },
)

test(
  'M07 scaling warns below recommended serving range instead of guessing failure',
  () => {
    const result =
      scaleRecipeAggregate({
        recipeVersion: {
          id:
            'recipe-1',

          baseServings:
            4,

          minRecommendedServings:
            2,

          maxRecommendedServings:
            8,
        },

        targetServings:
          1,

        ingredients: [
          {
            id:
              'row-1',

            canonicalIngredientId:
              'ingredient-1',

            lineNumber:
              1,

            quantity:
              100,

            unit:
              'g',

            scalingRule: {
              type:
                'linear',
            },
          },
        ],
      })

    assert.equal(
      result.warnings[0].code,
      'RECIPE_BELOW_RECOMMENDED_SERVINGS',
    )
  },
)

test(
  'M07 scaling warns above recommended serving range',
  () => {
    const result =
      scaleRecipeAggregate({
        recipeVersion: {
          id:
            'recipe-1',

          baseServings:
            4,

          minRecommendedServings:
            2,

          maxRecommendedServings:
            8,
        },

        targetServings:
          12,

        ingredients: [
          {
            id:
              'row-1',

            canonicalIngredientId:
              'ingredient-1',

            lineNumber:
              1,

            quantity:
              100,

            unit:
              'g',

            scalingRule: {
              type:
                'linear',
            },
          },
        ],
      })

    assert.equal(
      result.warnings[0].code,
      'RECIPE_ABOVE_RECOMMENDED_SERVINGS',
    )
  },
)

test(
  'M07 substitution quantity scales from its source Recipe requirement',
  () => {
    const result =
      scaleRecipeAggregate({
        recipeVersion: {
          id:
            'recipe-1',

          baseServings:
            2,
        },

        targetServings:
          4,

        ingredients: [
          {
            id:
              'row-1',

            canonicalIngredientId:
              'ingredient-1',

            lineNumber:
              1,

            quantity:
              100,

            unit:
              'g',

            scalingRule: {
              type:
                'linear',
            },
          },
        ],

        substitutions: [
          {
            id:
              'sub-1',

            sourceRecipeIngredientId:
              'row-1',

            substituteCanonicalIngredientId:
              'ingredient-2',

            replacementRatio:
              0.5,

            replacementUnit:
              'g',

            priority:
              1,
          },
        ],
      })

    assert.equal(
      result.substitutions[0].replacementQuantity,
      100,
    )
  },
)

test(
  'M07 scaling output contains requirement truth and no retail price stock or Pack recommendation',
  () => {
    const result =
      scaleRecipeAggregate({
        recipeVersion: {
          id:
            'recipe-1',

          baseServings:
            2,
        },

        targetServings:
          4,

        ingredients: [
          {
            id:
              'row-1',

            canonicalIngredientId:
              'ingredient-1',

            lineNumber:
              1,

            quantity:
              100,

            unit:
              'ml',

            scalingRule: {
              type:
                'linear',
            },
          },
        ],
      })

    assert.equal(
      Object.hasOwn(
        result,
        'price',
      ),
      false,
    )

    assert.equal(
      Object.hasOwn(
        result,
        'stock',
      ),
      false,
    )

    assert.equal(
      Object.hasOwn(
        result,
        'packId',
      ),
      false,
    )
  },
)