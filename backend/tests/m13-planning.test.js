import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import {
  fileURLToPath,
} from 'node:url'

import {
  allocatePlannedMealReservations,
  safePlanningUnitConversion,
} from '../src/modules/planning/planning.engine.js'

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

const readBackend =
  (
    relativePath,
  ) =>
    fs.readFileSync(
      path.join(
        backendRoot,
        relativePath,
      ),
      'utf8',
    )

const readFrontend =
  (
    relativePath,
  ) =>
    fs.readFileSync(
      path.join(
        projectRoot,
        'frontend',
        relativePath,
      ),
      'utf8',
    )

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
  'M13 registers planning and recommendation collections',
  () => {
    const source =
      readBackend(
        'src/modules/planning/planning.models.js',
      )

    for (
      const collection
      of [
        'mealPlans',
        'plannedMeals',
        'pantryReservations',
        'nextBasketPredictions',
        'recommendationFeedback',
        'recommendationPreferences',
      ]
    ) {
      assert.match(
        source,
        new RegExp(
          collection,
        ),
      )
    }
  },
)

test(
  'M13 keeps Pantry reservation separate from PantryItem ownership truth',
  () => {
    const source =
      readBackend(
        'src/modules/planning/planning.models.js',
      )

    assert.match(
      source,
      /pantryReservationSchema/,
    )

    assert.match(
      source,
      /pantryItemId/,
    )

    assert.doesNotMatch(
      source,
      /PantryItem\.update|PantryItem\.findOneAndUpdate/,
    )
  },
)

test(
  'M13 Planned Meal stores immutable Recipe Version identity',
  () => {
    const source =
      readBackend(
        'src/modules/planning/planning.models.js',
      )

    assert.match(
      source,
      /recipeVersionId/,
    )

    assert.match(
      source,
      /ref:\s*'RecipeVersion'/,
    )
  },
)

test(
  'M13 planning engine reuses deterministic M07 unit conversion',
  () => {
    assert.equal(
      safePlanningUnitConversion({
        quantity: 1,
        fromUnit: 'kg',
        toUnit: 'g',
      }),
      1000,
    )
  },
)

test(
  'M13 first planned meal reserves confirmed exact Pantry without consuming it',
  () => {
    const result =
      allocatePlannedMealReservations({
        pantryItems: [
          {
            id: 'p1',
            canonicalIngredientId: 'i1',
            state: 'confirmed_available',
            quantity: {
              mode: 'exact',
              value: 500,
              unit: 'g',
            },
          },
        ],

        meals: [
          {
            id: 'm1',
            recipeVersionId: 'r1',
            plannedAt:
              '2026-08-25T18:00:00.000Z',
            status: 'planned',
            priority: 3,

            requirements: [
              {
                canonicalIngredientId:
                  'i1',
                label: 'Paneer',
                quantity: 300,
                unit: 'g',
              },
            ],
          },
        ],
      })

    assert.equal(
      result.reservations.length,
      1,
    )

    assert.equal(
      result.reservations[0]
        .reservedQuantity,
      300,
    )

    assert.equal(
      result.mealForecasts[0]
        .readinessState,
      'enough',
    )
  },
)

test(
  'M13 planned meals cannot double count the same confirmed Pantry quantity',
  () => {
    const result =
      allocatePlannedMealReservations({
        pantryItems: [
          {
            id: 'p1',
            canonicalIngredientId: 'i1',
            state: 'confirmed_available',

            quantity: {
              mode: 'exact',
              value: 500,
              unit: 'g',
            },
          },
        ],

        meals: [
          {
            id: 'm1',
            recipeVersionId: 'r1',
            plannedAt:
              '2026-08-25T18:00:00.000Z',
            status: 'planned',

            requirements: [
              {
                canonicalIngredientId:
                  'i1',
                quantity: 300,
                unit: 'g',
              },
            ],
          },

          {
            id: 'm2',
            recipeVersionId: 'r2',
            plannedAt:
              '2026-08-26T18:00:00.000Z',
            status: 'planned',

            requirements: [
              {
                canonicalIngredientId:
                  'i1',
                quantity: 400,
                unit: 'g',
              },
            ],
          },
        ],
      })

    assert.equal(
      result.mealForecasts[0]
        .readinessState,
      'enough',
    )

    assert.equal(
      result.mealForecasts[1]
        .readinessState,
      'running_low_before_meal',
    )

    assert.equal(
      result.mealForecasts[1]
        .forecastLines[0]
        .provenShortageQuantity,
      200,
    )
  },
)

test(
  'M13 range minimum may support likely enough without pretending exact stock',
  () => {
    const result =
      allocatePlannedMealReservations({
        pantryItems: [
          {
            id: 'p1',
            canonicalIngredientId: 'i1',
            state: 'confirmed_available',

            quantity: {
              mode: 'range',
              min: 350,
              max: 500,
              unit: 'g',
            },
          },
        ],

        meals: [
          {
            id: 'm1',
            recipeVersionId: 'r1',
            plannedAt:
              '2026-08-25T18:00:00.000Z',
            status: 'planned',

            requirements: [
              {
                canonicalIngredientId:
                  'i1',
                quantity: 300,
                unit: 'g',
              },
            ],
          },
        ],
      })

    assert.equal(
      result.mealForecasts[0]
        .readinessState,
      'likely_enough',
    )

    assert.equal(
      result.reservations[0]
        .reservationBasis,
      'confirmed_range_minimum',
    )
  },
)

test(
  'M13 inferred Pantry never creates an exact reservation or exact shortage',
  () => {
    const result =
      allocatePlannedMealReservations({
        pantryItems: [
          {
            id: 'p1',
            canonicalIngredientId: 'i1',
            state: 'inferred_available',

            quantity: {
              mode: 'range',
              min: 100,
              max: 500,
              unit: 'g',
            },
          },
        ],

        meals: [
          {
            id: 'm1',
            recipeVersionId: 'r1',
            plannedAt:
              '2026-08-25T18:00:00.000Z',
            status: 'planned',

            requirements: [
              {
                canonicalIngredientId:
                  'i1',
                quantity: 300,
                unit: 'g',
              },
            ],
          },
        ],
      })

    assert.equal(
      result.reservations.length,
      0,
    )

    assert.equal(
      result.mealForecasts[0]
        .readinessState,
      'needs_confirmation',
    )

    assert.equal(
      result.mealForecasts[0]
        .forecastLines[0]
        .provenShortageQuantity,
      null,
    )
  },
)

test(
  'M13 Pantry out produces a deterministic missing meal requirement',
  () => {
    const result =
      allocatePlannedMealReservations({
        pantryItems: [
          {
            id: 'p1',
            canonicalIngredientId: 'i1',
            state: 'out',

            quantity: {
              mode: 'unknown',
            },
          },
        ],

        meals: [
          {
            id: 'm1',
            recipeVersionId: 'r1',
            plannedAt:
              '2026-08-25T18:00:00.000Z',
            status: 'planned',

            requirements: [
              {
                canonicalIngredientId:
                  'i1',
                quantity: 200,
                unit: 'g',
              },
            ],
          },
        ],
      })

    assert.equal(
      result.mealForecasts[0]
        .readinessState,
      'missing',
    )

    assert.equal(
      result.shortages[0].quantity,
      200,
    )
  },
)

test(
  'M13 do-not-track Pantry remains needs confirmation and creates no purchase shortage',
  () => {
    const result =
      allocatePlannedMealReservations({
        pantryItems: [
          {
            id: 'p1',
            canonicalIngredientId: 'i1',
            state: 'do_not_track',
          },
        ],

        meals: [
          {
            id: 'm1',
            recipeVersionId: 'r1',
            plannedAt:
              '2026-08-25T18:00:00.000Z',
            status: 'planned',

            requirements: [
              {
                canonicalIngredientId:
                  'i1',
                quantity: 200,
                unit: 'g',
              },
            ],
          },
        ],
      })

    assert.equal(
      result.mealForecasts[0]
        .readinessState,
      'needs_confirmation',
    )

    assert.equal(
      result.shortages.length,
      0,
    )
  },
)

test(
  'M13 skipped meal releases planning demand from deterministic engine',
  () => {
    const result =
      allocatePlannedMealReservations({
        pantryItems: [],

        meals: [
          {
            id: 'm1',
            recipeVersionId: 'r1',
            plannedAt:
              '2026-08-25T18:00:00.000Z',
            status: 'skipped',

            requirements: [
              {
                canonicalIngredientId:
                  'i1',
                quantity: 200,
                unit: 'g',
              },
            ],
          },
        ],
      })

    assert.equal(
      result.reservations.length,
      0,
    )

    assert.equal(
      result.shortages.length,
      0,
    )
  },
)

test(
  'M13 consolidates compatible shortages across planned meals',
  () => {
    const result =
      allocatePlannedMealReservations({
        pantryItems: [],

        meals: [
          {
            id: 'm1',
            recipeVersionId: 'r1',
            plannedAt:
              '2026-08-25T18:00:00.000Z',
            status: 'planned',

            requirements: [
              {
                canonicalIngredientId:
                  'i1',
                quantity: 200,
                unit: 'g',
              },
            ],
          },

          {
            id: 'm2',
            recipeVersionId: 'r2',
            plannedAt:
              '2026-08-26T18:00:00.000Z',
            status: 'planned',

            requirements: [
              {
                canonicalIngredientId:
                  'i1',
                quantity: 0.3,
                unit: 'kg',
              },
            ],
          },
        ],
      })

    assert.equal(
      result.shortages.length,
      1,
    )

    assert.equal(
      result.shortages[0].quantity,
      500,
    )

    assert.equal(
      result.shortages[0].unit,
      'g',
    )
  },
)

test(
  'M13 optional shortage does not enter consolidated Next Basket demand',
  () => {
    const result =
      allocatePlannedMealReservations({
        pantryItems: [],

        meals: [
          {
            id: 'm1',
            recipeVersionId: 'r1',
            plannedAt:
              '2026-08-25T18:00:00.000Z',
            status: 'planned',

            requirements: [
              {
                canonicalIngredientId:
                  'i1',
                quantity: 20,
                unit: 'g',
                optional: true,
              },
            ],
          },
        ],
      })

    assert.equal(
      result.shortages.length,
      0,
    )

    assert.equal(
      result.mealForecasts[0]
        .readinessState,
      'enough',
    )
  },
)

test(
  'M13 service derives Household through existing Pantry membership authority',
  () => {
    const source =
      readBackend(
        'src/modules/planning/planning.service.js',
      )

    assert.match(
      source,
      /requireCurrentPantryHousehold/,
    )

    assert.doesNotMatch(
      source,
      /activeMode/,
    )
  },
)

test(
  'M13 planned Recipe calculation reuses immutable RecipeVersion and M07 scale engine',
  () => {
    const source =
      readBackend(
        'src/modules/planning/planning.service.js',
      )

    assert.match(
      source,
      /RecipeVersion\.findOne/,
    )

    assert.match(
      source,
      /scaleRecipeAggregate/,
    )

    assert.match(
      source,
      /'published'[\s\S]*'retired'/,
    )
  },
)

test(
  'M13 planning service never mutates M09 PantryItem quantity projection',
  () => {
    const source =
      stripComments(
        readBackend(
          'src/modules/planning/planning.service.js',
        ),
      )

    assert.doesNotMatch(
      source,
      /PantryItem\.(?:update|updateOne|updateMany|findOneAndUpdate|delete)/,
    )
  },
)

test(
  'M13 reservation recalculation releases old overlays instead of deleting Pantry truth',
  () => {
    const source =
      readBackend(
        'src/modules/planning/planning.service.js',
      )

    assert.match(
      source,
      /PantryReservation\.updateMany/,
    )

    assert.match(
      source,
      /status:\s*'released'/,
    )

    assert.match(
      source,
      /PantryReservation\.insertMany/,
    )
  },
)

test(
  'M13 Next Basket v0 uses planned shortages and running-low Pantry signals without fake ML cadence',
  () => {
    const source =
      readBackend(
        'src/modules/planning/planning.service.js',
      )

    assert.match(
      source,
      /PLANNED_MEAL_GENUINE_SHORTAGE/,
    )

    assert.match(
      source,
      /PANTRY_RUNNING_LOW_SIGNAL/,
    )

    assert.match(
      source,
      /unsupportedUntilEvidenceExists/,
    )

    assert.doesNotMatch(
      source,
      /usually reordered every|purchase cadence =|reorder every/i,
    )
  },
)

test(
  'M13 prediction model contains no Cart Checkout Order or payment authority',
  () => {
    const source =
      stripComments(
        readBackend(
          'src/modules/planning/planning.models.js',
        ),
      )

    assert.doesNotMatch(
      source,
      /cartId|checkoutId|orderId|paymentId|paidState|providerOrderId/i,
    )
  },
)

test(
  'M13 feedback service explicitly preserves no automatic purchase',
  () => {
    const source =
      readBackend(
        'src/modules/planning/planning.service.js',
      )

    assert.match(
      source,
      /automaticPurchase:\s*false/,
    )

    assert.doesNotMatch(
      source,
      /createMarketplaceCart|prepareCheckout|createPaymentIntent/,
    )
  },
)

test(
  'M13 recommendation feedback is append-only evidence',
  () => {
    const source =
      readBackend(
        'src/modules/planning/planning.models.js',
      )

    assert.match(
      source,
      /makeAppendOnly\(\s*recommendationFeedbackSchema/,
    )
  },
)

test(
  'M13 correction loop reuses governed M09 Customer Pantry observations',
  () => {
    const source =
      readBackend(
        'src/modules/planning/planning.service.js',
      )

    assert.match(
      source,
      /createCustomerPantryObservation/,
    )

    assert.match(
      source,
      /manual_have/,
    )

    assert.match(
      source,
      /bought_elsewhere/,
    )

    assert.match(
      source,
      /manual_quantity_correction/,
    )
  },
)

test(
  'M13 stop-suggesting feedback suppresses future ingredient suggestions',
  () => {
    const source =
      readBackend(
        'src/modules/planning/planning.service.js',
      )

    assert.match(
      source,
      /getStoppedIngredientIds/,
    )

    assert.match(
      source,
      /action:\s*'stop_suggesting'/,
    )
  },
)

test(
  'M13 recommendation preferences expose consent pause and notification controls',
  () => {
    const source =
      readBackend(
        'src/modules/planning/planning.models.js',
      )

    assert.match(
      source,
      /nextBasketEnabled/,
    )

    assert.match(
      source,
      /pausedUntil/,
    )

    assert.match(
      source,
      /notificationFrequency/,
    )
  },
)

test(
  'M13 planning route schemas are strict and reject ownership injection',
  () => {
    const source =
      stripComments(
        readBackend(
          'src/modules/planning/planning.routes.js',
        ),
      )

    assert.match(
      source,
      /createMealPlanBodySchema[\s\S]*?\.strict\(\)/,
    )

    assert.match(
      source,
      /addPlannedMealBodySchema[\s\S]*?\.strict\(\)/,
    )

    assert.match(
      source,
      /recommendationFeedbackBodySchema[\s\S]*?\.strict\(\)/,
    )

    assert.doesNotMatch(
      source,
      /householdId\s*:/,
    )

    assert.doesNotMatch(
      source,
      /ownerUserId\s*:/,
    )
  },
)

test(
  'M13 routes require session active Customer capability and CSRF on writes',
  () => {
    const source =
      readBackend(
        'src/modules/planning/planning.routes.js',
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
      /requireCustomerAccess/,
    )

    assert.match(
      source,
      /requireCsrfToken/,
    )

    assert.doesNotMatch(
      stripComments(
        source,
      ),
      /activeMode/,
    )
  },
)

test(
  'M13 create and feedback mutations require explicit idempotency keys',
  () => {
    const source =
      readBackend(
        'src/modules/planning/planning.routes.js',
      )

    assert.match(
      source,
      /Idempotency-Key/,
    )

    assert.match(
      source,
      /requireIdempotencyKey/,
    )
  },
)

test(
  'M13 exposes documented Meal Plan and Next Basket API surfaces',
  () => {
    const source =
      readBackend(
        'src/modules/planning/planning.routes.js',
      )

    assert.match(
      source,
      /'\/meal-plans'/,
    )

    assert.match(
      source,
      /'\/next-basket'/,
    )

    assert.match(
      source,
      /'\/next-basket\/:id\/feedback'/,
    )
  },
)

test(
  'M13 does not introduce Seller Brand or B2B top-level access authority',
  () => {
    const source =
      stripComments(
        readBackend(
          'src/modules/planning/planning.routes.js',
        ),
      )

    assert.doesNotMatch(
      source,
      /requireSellerAccess|requireBrandAccess|requireB2BAccess/i,
    )

    assert.doesNotMatch(
      source,
      /actorType:\s*['"](?:seller|brand|b2b)['"]/i,
    )
  },
)

test(
  'M13 frontend service uses CSRF and idempotency for planning mutations',
  () => {
    const source =
      readFrontend(
        'src/features/planning/services/planning.service.js',
      )

    assert.match(
      source,
      /\/auth\/csrf/,
    )

    assert.match(
      source,
      /Idempotency-Key/,
    )

    assert.match(
      source,
      /\/meal-plans/,
    )

    assert.match(
      source,
      /\/next-basket/,
    )
  },
)

test(
  'M13 P16 visibly explains reservation is not consumption',
  () => {
    const source =
      readFrontend(
        'src/features/planning/pages/MealPlanPage.jsx',
      )

    assert.match(
      source,
      /planning evidence only|planning constraints only|forecasting overlay/i,
    )

    assert.match(
      source,
      /do not consume|does not decrease|not consumption|≠ consumption/i,
    )

    assert.match(
      source,
      /Inferred|uncertain/i,
    )
  },
)

test(
  'M13 P17 exposes reason pause and stop controls',
  () => {
    const source =
      readFrontend(
        'src/features/planning/pages/NextBasketPage.jsx',
      )

    assert.match(
      source,
      /Why\?|Why is this here\?/,
    )

    assert.match(
      source,
      /Still have/,
    )

    assert.match(
      source,
      /Bought elsewhere/,
    )

    assert.match(
      source,
      /Snooze (?:7d|24h)/,
    )

    assert.match(
      source,
      /Stop suggesting/,
    )
  },
)

test(
  'M13 P17 explicitly states accepting does not create commerce transaction',
  () => {
    const source =
      readFrontend(
        'src/features/planning/pages/NextBasketPage.jsx',
      )

    assert.match(
      source,
      /does not automatically create a Cart|does not create an M11 Cart/i,
    )
  },
)

test(
  'M13 frontend routes expose P16 and P17 only through Customer application access',
  () => {
    const source =
      readFrontend(
        'src/routes/AppRoutes.jsx',
      )

    assert.match(
      source,
      /path="\/meal-plan"[\s\S]*APPLICATION_ACCESS_TYPES\.CUSTOMER/,
    )

    assert.match(
      source,
      /path="\/next-basket"[\s\S]*APPLICATION_ACCESS_TYPES\.CUSTOMER/,
    )

    assert.match(
      source,
      /hostEnabled\s*===\s*true\s*&&\s*hostAccessStatus\s*===\s*'active'/,
    )

    assert.doesNotMatch(
      source,
      /activeMode/,
    )
  },
)

test(
  'M13 app mounts planning under API v1 without moving M11 raw webhook behind JSON parser',
  () => {
    const source =
      readBackend(
        'src/app.js',
      )

    assert.match(
      source,
      /import planningRoutes from '.\/modules\/planning\/planning\.routes\.js'/,
    )

    assert.match(
      source,
      /app\.use\(\s*'\/api\/v1',[\s\S]*?planningRoutes/,
    )

    const webhookIndex =
      source.indexOf(
        'commerceWebhookRoutes',
        source.indexOf(
          'app.use(',
        ),
      )

    const jsonIndex =
      source.indexOf(
        'express.json',
      )

    assert.ok(
      webhookIndex >=
        0 &&
      jsonIndex >=
        0 &&
      webhookIndex <
        jsonIndex,
    )
  },
)