import assert from 'node:assert/strict'

import fs from 'node:fs'

import test from 'node:test'

import {
  rankRecipeCandidatesByPantry,
  serializePublicDish,
  serializePublicRecipeVersion,
} from '../src/modules/recipes/recipe.public.service.js'

import {
  listPublicRecipesQuerySchema,
  publicRecipeScaleQuerySchema,
  publicRecipeSlugParamsSchema,
  whatShouldWeCookQuerySchema,
} from '../src/modules/recipes/recipe.public.validation.js'

function readSource(
  relativePath,
) {
  return fs.readFileSync(
    new URL(
      `../src/${relativePath}`,
      import.meta.url,
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
      /\/\/.*$/gm,
      '',
    )
}

test(
  'M07 public Recipe browse applies bounded pagination defaults',
  () => {
    const result =
      listPublicRecipesQuerySchema.safeParse(
        {},
      )

    assert.equal(
      result.success,
      true,
    )

    assert.equal(
      result.data.page,
      1,
    )

    assert.equal(
      result.data.limit,
      24,
    )
  },
)

test(
  'M07 public Recipe browse refuses excessive page size',
  () => {
    assert.equal(
      listPublicRecipesQuerySchema.safeParse({
        limit:
          51,
      }).success,
      false,
    )
  },
)

test(
  'M07 public Recipe detail requires explicit slug',
  () => {
    assert.equal(
      publicRecipeSlugParamsSchema.safeParse({
        slug:
          'paneer-tikka',
      }).success,
      true,
    )

    assert.equal(
      publicRecipeSlugParamsSchema.safeParse({
        slug:
          '',
      }).success,
      false,
    )
  },
)

test(
  'M07 public Recipe scaling coerces serving query deterministically',
  () => {
    const result =
      publicRecipeScaleQuerySchema.safeParse({
        servings:
          '6',
      })

    assert.equal(
      result.success,
      true,
    )

    assert.equal(
      result.data.servings,
      6,
    )
  },
)

test(
  'M07 public Recipe scaling caps target servings',
  () => {
    assert.equal(
      publicRecipeScaleQuerySchema.safeParse({
        servings:
          1001,
      }).success,
      false,
    )
  },
)

test(
  'M07 What Should We Cook accepts comma separated canonical Ingredient IDs',
  () => {
    const result =
      whatShouldWeCookQuerySchema.safeParse({
        ingredientIds:
          '64e000000000000000000001,64e000000000000000000002',
      })

    assert.equal(
      result.success,
      true,
    )

    assert.equal(
      result.data
        .ingredientIds
        .length,
      2,
    )
  },
)

test(
  'M07 What Should We Cook rejects malformed canonical Ingredient identity',
  () => {
    assert.equal(
      whatShouldWeCookQuerySchema.safeParse({
        ingredientIds:
          'not-an-id',
      }).success,
      false,
    )
  },
)

test(
  'M07 public Dish serializer removes administrative lifecycle actors',
  () => {
    const result =
      serializePublicDish({
        _id:
          'dish-1',

        name:
          'Recipe',

        slug:
          'recipe',

        createdByUserId:
          'secret-user',

        disabledByUserId:
          'secret-admin',
      })

    assert.equal(
      Object.hasOwn(
        result,
        'createdByUserId',
      ),
      false,
    )

    assert.equal(
      Object.hasOwn(
        result,
        'disabledByUserId',
      ),
      false,
    )
  },
)

test(
  'M07 public Recipe serializer excludes administrative and Host Organization identity',
  () => {
    const result =
      serializePublicRecipeVersion({
        _id:
          'version-1',

        versionNumber:
          1,

        title:
          'Recipe',

        baseServings:
          4,

        scalingMethod:
          'linear',

        difficulty:
          'easy',

        sourceType:
          'brand',

        sourceOrganizationId:
          'private-org',

        submittedByUserId:
          'private-user',

        publishedByUserId:
          'private-admin',
      })

    assert.equal(
      Object.hasOwn(
        result.source,
        'organizationId',
      ),
      false,
    )

    assert.equal(
      Object.hasOwn(
        result,
        'publishedByUserId',
      ),
      false,
    )
  },
)

test(
  'M07 pantry ranking gives exact ingredient coverage highest rank',
  () => {
    const result =
      rankRecipeCandidatesByPantry({
        availableIngredientIds: [
          'a',
          'b',
        ],

        candidates: [
          {
            dish: {
              name:
                'Partial',
            },

            ingredientRows: [
              {
                canonicalIngredientId:
                  'a',

                optional:
                  false,
              },

              {
                canonicalIngredientId:
                  'c',

                optional:
                  false,
              },
            ],
          },

          {
            dish: {
              name:
                'Exact',
            },

            ingredientRows: [
              {
                canonicalIngredientId:
                  'a',

                optional:
                  false,
              },

              {
                canonicalIngredientId:
                  'b',

                optional:
                  false,
              },
            ],
          },
        ],
      })

    assert.equal(
      result[0].dish.name,
      'Exact',
    )

    assert.equal(
      result[0]
        .matching
        .coverageRatio,
      1,
    )
  },
)

test(
  'M07 pantry ranking explicitly returns missing required ingredients',
  () => {
    const result =
      rankRecipeCandidatesByPantry({
        availableIngredientIds: [
          'a',
        ],

        candidates: [
          {
            dish: {
              name:
                'Recipe',
            },

            ingredientRows: [
              {
                canonicalIngredientId:
                  'a',
              },

              {
                canonicalIngredientId:
                  'b',
              },
            ],
          },
        ],
      })

    assert.deepEqual(
      result[0]
        .matching
        .missingIngredientIds,
      [
        'b',
      ],
    )
  },
)

test(
  'M07 optional ingredient does not reduce pantry coverage',
  () => {
    const result =
      rankRecipeCandidatesByPantry({
        availableIngredientIds: [
          'a',
        ],

        candidates: [
          {
            dish: {
              name:
                'Recipe',
            },

            ingredientRows: [
              {
                canonicalIngredientId:
                  'a',

                optional:
                  false,
              },

              {
                canonicalIngredientId:
                  'b',

                optional:
                  true,
              },
            ],
          },
        ],
      })

    assert.equal(
      result[0]
        .matching
        .coverageRatio,
      1,
    )
  },
)

test(
  'M07 pantry ranking remains deterministic for equal coverage',
  () => {
    const result =
      rankRecipeCandidatesByPantry({
        availableIngredientIds: [
          'a',
        ],

        candidates: [
          {
            dish: {
              name:
                'Zulu',
            },

            ingredientRows: [
              {
                canonicalIngredientId:
                  'a',
              },
            ],
          },

          {
            dish: {
              name:
                'Alpha',
            },

            ingredientRows: [
              {
                canonicalIngredientId:
                  'a',
              },
            ],
          },
        ],
      })

    assert.equal(
      result[0].dish.name,
      'Alpha',
    )
  },
)

test(
  'M07 public Recipe service does not compose Marketplace commercial models',
  () => {
    const source =
      stripComments(
        readSource(
          'modules/recipes/recipe.public.service.js',
        ),
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

test(
  'M07 public Recipe router is read only',
  () => {
    const source =
      stripComments(
        readSource(
          'modules/recipes/recipe.public.routes.js',
        ),
      )

    assert.match(
      source,
      /router\.get/,
    )

    assert.doesNotMatch(
      source,
      /router\.post/,
    )

    assert.doesNotMatch(
      source,
      /router\.patch/,
    )

    assert.doesNotMatch(
      source,
      /router\.delete/,
    )
  },
)

test(
  'M07 public Recipe router exposes browse detail history scale and What Should We Cook',
  () => {
    const source =
      readSource(
        'modules/recipes/recipe.public.routes.js',
      )

    assert.match(
      source,
      /what-should-we-cook/,
    )

    assert.match(
      source,
      /:slug\/history/,
    )

    assert.match(
      source,
      /:slug\/scale/,
    )

    assert.match(
      source,
      /:slug/,
    )
  },
)