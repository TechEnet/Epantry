import assert from 'node:assert/strict'

import test from 'node:test'

import {
  Dish,
  RecipeIngredient,
  RecipeReview,
  RecipeStep,
  RecipeSubstitution,
  RecipeVersion,
} from '../src/modules/recipes/recipe.models.js'

import {
  DISH_STATUSES,
  getRecipeUnitDimension,
  normalizeRecipeKey,
  normalizeRecipeSlug,
  normalizeRecipeUnit,
  RECIPE_SCALING_METHODS,
  RECIPE_SOURCE_TYPES,
  RECIPE_VERSION_STATUSES,
} from '../src/modules/recipes/recipe.constants.js'

test(
  'M07 Dish lifecycle supports active disabled and retired recovery states',
  () => {
    assert.deepEqual(
      DISH_STATUSES,
      [
        'active',
        'disabled',
        'retired',
      ],
    )
  },
)

test(
  'M07 Recipe Version lifecycle separates draft review publication retirement and disable',
  () => {
    assert.deepEqual(
      RECIPE_VERSION_STATUSES,
      [
        'draft',
        'in_review',
        'published',
        'retired',
        'disabled',
      ],
    )
  },
)

test(
  'M07 recipe sources are attribution types and not application roles',
  () => {
    assert.deepEqual(
      RECIPE_SOURCE_TYPES,
      [
        'internal',
        'brand',
        'chef',
        'community',
        'imported',
      ],
    )
  },
)

test(
  'M07 scaling supports simple linear and recipe-specific mixed behavior',
  () => {
    assert.deepEqual(
      RECIPE_SCALING_METHODS,
      [
        'linear',
        'mixed',
      ],
    )
  },
)

test(
  'M07 recipe key normalization is deterministic',
  () => {
    assert.equal(
      normalizeRecipeKey(
        'South Indian Breakfast',
      ),
      'south_indian_breakfast',
    )
  },
)

test(
  'M07 recipe slug normalization is deterministic',
  () => {
    assert.equal(
      normalizeRecipeSlug(
        'Paneer Tikka!',
      ),
      'paneer-tikka',
    )
  },
)

test(
  'M07 known recipe unit normalization is deterministic',
  () => {
    assert.equal(
      normalizeRecipeUnit(
        ' ML ',
      ),
      'ml',
    )
  },
)

test(
  'M07 unknown recipe requirement unit is not guessed',
  () => {
    assert.equal(
      normalizeRecipeUnit(
        'packet',
      ),
      null,
    )
  },
)

test(
  'M07 recipe units retain dimensional identity',
  () => {
    assert.equal(
      getRecipeUnitDimension(
        'g',
      ),
      'mass',
    )

    assert.equal(
      getRecipeUnitDimension(
        'ml',
      ),
      'volume',
    )

    assert.equal(
      getRecipeUnitDimension(
        'piece',
      ),
      'count',
    )
  },
)

test(
  'M07 Dish uses dedicated dishes collection',
  () => {
    assert.equal(
      Dish.collection.name,
      'dishes',
    )
  },
)

test(
  'M07 RecipeVersion uses dedicated recipeVersions collection',
  () => {
    assert.equal(
      RecipeVersion.collection.name,
      'recipeVersions',
    )
  },
)

test(
  'M07 child Recipe records use dedicated collections',
  () => {
    assert.equal(
      RecipeIngredient.collection.name,
      'recipeIngredients',
    )

    assert.equal(
      RecipeStep.collection.name,
      'recipeSteps',
    )

    assert.equal(
      RecipeSubstitution.collection.name,
      'recipeSubstitutions',
    )

    assert.equal(
      RecipeReview.collection.name,
      'recipeReviews',
    )
  },
)

test(
  'M07 RecipeVersion contains serving yield and source attribution fields',
  () => {
    const paths =
      RecipeVersion.schema.paths

    for (
      const key of [
        'baseServings',
        'servingSizeAmount',
        'finishedYieldAmount',
        'scalingMethod',
        'sourceType',
        'sourceName',
      ]
    ) {
      assert.ok(
        paths[key],
        `Missing ${key}`,
      )
    }
  },
)

test(
  'M07 RecipeIngredient points to canonical Ingredient truth',
  () => {
    assert.ok(
      RecipeIngredient
        .schema
        .paths
        .canonicalIngredientId,
    )
  },
)

test(
  'M07 Recipe domain does not persist Marketplace price inventory or serviceability truth',
  () => {
    const modelPaths = [
      ...Object.keys(
        RecipeVersion.schema.paths,
      ),

      ...Object.keys(
        RecipeIngredient.schema.paths,
      ),
    ]

    for (
      const forbidden of [
        'price',
        'salePrice',
        'stock',
        'inventory',
        'serviceability',
        'sellerOfferId',
      ]
    ) {
      assert.equal(
        modelPaths.includes(
          forbidden,
        ),
        false,
      )
    }
  },
)

test(
  'M07 Recipe models do not create Brand Seller or B2B application access state',
  () => {
    const paths = [
      ...Object.keys(
        Dish.schema.paths,
      ),

      ...Object.keys(
        RecipeVersion.schema.paths,
      ),
    ]

    for (
      const forbidden of [
        'activeMode',
        'accountType',
        'brandEnabled',
        'sellerEnabled',
        'b2bEnabled',
      ]
    ) {
      assert.equal(
        paths.includes(
          forbidden,
        ),
        false,
      )
    }
  },
)