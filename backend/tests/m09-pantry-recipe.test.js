import assert from 'node:assert/strict'

import {
  readFile,
} from 'node:fs/promises'

import {
  test,
} from 'node:test'

import {
  reconcileRecipeRequirementWithPantry,
  reconcileRecipeRequirementsWithPantry,
} from '../src/modules/pantry/pantry.reconciliation.js'

const projectRoot =
  new URL(
    '..',
    import.meta.url,
  )

async function readProjectFile(
  path,
) {
  return readFile(
    new URL(
      path,
      projectRoot,
    ),
    'utf8',
  )
}

const INGREDIENT_ID =
  '64b000000000000000000101'

const PANTRY_ITEM_ID =
  '64b000000000000000000201'

function requirement(
  overrides =
    {},
) {
  return {
    recipeIngredientId:
      '64b000000000000000000301',

    canonicalIngredientId:
      INGREDIENT_ID,

    quantity:
      200,

    unit:
      'g',

    optional:
      false,

    ...overrides,
  }
}

function pantryItem(
  overrides =
    {},
) {
  return {
    _id:
      PANTRY_ITEM_ID,

    canonicalIngredientId:
      INGREDIENT_ID,

    state:
      'confirmed_available',

    quantityEstimate: {
      mode:
        'exact',

      exact:
        300,

      unit:
        'g',
    },

    ...overrides,
  }
}

/*
|--------------------------------------------------------------------------
| Confirmed Availability
|--------------------------------------------------------------------------
*/

test(
  'M09 confirmed exact Pantry quantity can satisfy Recipe requirement',

  () => {
    const result =
      reconcileRecipeRequirementWithPantry({
        requirement:
          requirement(),

        pantryItem:
          pantryItem(),
      })

    assert.equal(
      result.status,
      'available',
    )

    assert.equal(
      result.confirmedAvailableQuantity,
      300,
    )
  },
)

test(
  'M09 confirmed exact Pantry quantity below requirement is partial',

  () => {
    const result =
      reconcileRecipeRequirementWithPantry({
        requirement:
          requirement(),

        pantryItem:
          pantryItem({
            quantityEstimate: {
              mode:
                'exact',

              exact:
                120,

              unit:
                'g',
            },
          }),
      })

    assert.equal(
      result.status,
      'partial',
    )

    assert.equal(
      result.confirmedAvailableQuantity,
      120,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Unit Conversion
|--------------------------------------------------------------------------
*/

test(
  'M09 reconciliation uses deterministic M07 compatible unit conversion',

  () => {
    const result =
      reconcileRecipeRequirementWithPantry({
        requirement:
          requirement({
            quantity:
              500,

            unit:
              'g',
          }),

        pantryItem:
          pantryItem({
            quantityEstimate: {
              mode:
                'exact',

              exact:
                1,

              unit:
                'kg',
            },
          }),
      })

    assert.equal(
      result.status,
      'available',
    )

    assert.equal(
      result.confirmedAvailableQuantity,
      1000,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Inference Is Never Exact
|--------------------------------------------------------------------------
*/

test(
  'M09 inferred available Pantry state remains uncertain for Recipe',

  () => {
    const result =
      reconcileRecipeRequirementWithPantry({
        requirement:
          requirement(),

        pantryItem:
          pantryItem({
            state:
              'inferred_available',

            quantityEstimate: {
              mode:
                'exact',

              exact:
                1000,

              unit:
                'g',
            },
          }),
      })

    assert.equal(
      result.status,
      'uncertain',
    )

    assert.equal(
      result.confirmedAvailableQuantity,
      null,
    )
  },
)

test(
  'M09 running-low Pantry state is not silently treated as fully available',

  () => {
    const result =
      reconcileRecipeRequirementWithPantry({
        requirement:
          requirement(),

        pantryItem:
          pantryItem({
            state:
              'running_low',
          }),
      })

    assert.equal(
      result.status,
      'uncertain',
    )
  },
)

/*
|--------------------------------------------------------------------------
| Range
|--------------------------------------------------------------------------
*/

test(
  'M09 Pantry range minimum can prove Recipe availability',

  () => {
    const result =
      reconcileRecipeRequirementWithPantry({
        requirement:
          requirement(),

        pantryItem:
          pantryItem({
            quantityEstimate: {
              mode:
                'range',

              min:
                250,

              max:
                400,

              unit:
                'g',
            },
          }),
      })

    assert.equal(
      result.status,
      'available',
    )
  },
)

test(
  'M09 Pantry range crossing requirement remains uncertain',

  () => {
    const result =
      reconcileRecipeRequirementWithPantry({
        requirement:
          requirement(),

        pantryItem:
          pantryItem({
            quantityEstimate: {
              mode:
                'range',

              min:
                100,

              max:
                300,

              unit:
                'g',
            },
          }),
      })

    assert.equal(
      result.status,
      'uncertain',
    )
  },
)

/*
|--------------------------------------------------------------------------
| Out / Missing / Untracked
|--------------------------------------------------------------------------
*/

test(
  'M09 Pantry out state becomes missing for Recipe',

  () => {
    const result =
      reconcileRecipeRequirementWithPantry({
        requirement:
          requirement(),

        pantryItem:
          pantryItem({
            state:
              'out',
          }),
      })

    assert.equal(
      result.status,
      'missing',
    )
  },
)

test(
  'M09 absent Pantry observation becomes missing without inventing quantity',

  () => {
    const result =
      reconcileRecipeRequirementWithPantry({
        requirement:
          requirement(),

        pantryItem:
          null,
      })

    assert.equal(
      result.status,
      'missing',
    )

    assert.equal(
      result.confirmedAvailableQuantity,
      0,
    )
  },
)

test(
  'M09 do-not-track remains untracked rather than silently missing',

  () => {
    const result =
      reconcileRecipeRequirementWithPantry({
        requirement:
          requirement(),

        pantryItem:
          pantryItem({
            state:
              'do_not_track',

            quantityEstimate:
              null,
          }),
      })

    assert.equal(
      result.status,
      'untracked',
    )
  },
)

/*
|--------------------------------------------------------------------------
| Aggregate
|--------------------------------------------------------------------------
*/

test(
  'M09 Recipe reconciliation returns deterministic availability summary',

  () => {
    const result =
      reconcileRecipeRequirementsWithPantry({
        requirements: [
          requirement(),

          requirement({
            recipeIngredientId:
              '64b000000000000000000302',

            canonicalIngredientId:
              '64b000000000000000000102',
          }),
        ],

        pantryItems: [
          pantryItem(),
        ],
      })

    assert.equal(
      result.summary.total,
      2,
    )

    assert.equal(
      result.summary.available,
      1,
    )

    assert.equal(
      result.summary.missing,
      1,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Recipe Integration Source
|--------------------------------------------------------------------------
*/

test(
  'M09 cooked Recipe integration uses immutable M07 Recipe Version and scaling engine',

  async () => {
    const source =
      await readProjectFile(
        'src/modules/pantry/pantry.recipe.service.js',
      )

    assert.match(
      source,
      /RecipeVersion/,
    )

    assert.match(
      source,
      /status:\s*'published'/,
    )

    assert.match(
      source,
      /scaleRecipeAggregate/,
    )

    assert.match(
      source,
      /RecipeIngredient/,
    )
  },
)

test(
  'M09 cooked Recipe writes household idempotent consumption events',

  async () => {
    const source =
      await readProjectFile(
        'src/modules/pantry/pantry.recipe.service.js',
      )

    assert.match(
      source,
      /PantryConsumptionEvent/,
    )

    assert.match(
      source,
      /eventKey/,
    )

    assert.match(
      source,
      /idempotencyKey/,
    )

    assert.match(
      source,
      /dish\.cooked/,
    )

    assert.match(
      source,
      /recipe_consumption/,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Cross-domain Boundaries
|--------------------------------------------------------------------------
*/

test(
  'M09 Recipe reconciliation contains no Marketplace commercial model dependency',

  async () => {
    const source =
      await readProjectFile(
        'src/modules/pantry/pantry.recipe.service.js',
      )

    assert.doesNotMatch(
      source,
      /SellerOffer|HostOffer|PriceRule|InventorySnapshot|ServiceArea/,
    )

    assert.doesNotMatch(
      source,
      /marketplace\//,
    )
  },
)

test(
  'M09 Recipe reconciliation does not fabricate M08 Food Intelligence truth',

  async () => {
    const source =
      await readProjectFile(
        'src/modules/pantry/pantry.recipe.service.js',
      )

    assert.doesNotMatch(
      source,
      /FoodCalculation|Allergen|Nutrient|DietaryRule/,
    )

    assert.doesNotMatch(
      source,
      /food-intelligence/,
    )
  },
)

test(
  'M09 Recipe reconciliation does not create M10 Outcome Plan or basket truth',

  async () => {
    const source =
      await readProjectFile(
        'src/modules/pantry/pantry.recipe.service.js',
      )

    assert.doesNotMatch(
      source,
      /OutcomePlan|RequirementBasket|SellerOffer/,
    )

    assert.doesNotMatch(
      source,
      /purchaseRequirement|basketItem|sellerPrice/,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Cooked Route Security
|--------------------------------------------------------------------------
*/

test(
  'M09 Recipe cooked router requires Customer capability and CSRF',

  async () => {
    const source =
      await readProjectFile(
        'src/modules/pantry/pantry.recipe.routes.js',
      )

    assert.match(
      source,
      /authenticateSession/,
    )

    assert.match(
      source,
      /loadCurrentUser/,
    )

    assert.match(
      source,
      /requireActiveAccount/,
    )

    assert.match(
      source,
      /requireCustomerAccess/,
    )

    assert.match(
      source,
      /router\.post\(\s*'\/:id\/cooked',\s*requireCsrfToken/s,
    )

    assert.doesNotMatch(
      source,
      /requireSuperAdminAccess/,
    )

    assert.doesNotMatch(
      source,
      /requireHostAccess/,
    )
  },
)

test(
  'M09 Recipe cooked controller requires explicit idempotency key',

  async () => {
    const source =
      await readProjectFile(
        'src/modules/pantry/pantry.recipe.controller.js',
      )

    assert.match(
      source,
      /idempotency-key/,
    )

    assert.match(
      source,
      /recipeCookedIdempotencySchema/,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Compile Router
|--------------------------------------------------------------------------
*/

test(
  'M09 Recipe Pantry route module compiles',

  async () => {
    const module =
      await import(
        '../src/modules/pantry/pantry.recipe.routes.js'
      )

    assert.ok(
      module.default,
    )
  },
)