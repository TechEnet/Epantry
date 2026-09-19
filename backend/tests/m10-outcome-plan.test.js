import assert from 'node:assert/strict'

import fs from 'node:fs'

import test from 'node:test'

import request from 'supertest'

import app from '../src/app.js'

import {
  buildOutcomePlanProjection,
  consolidateOutcomeRequirements,
  deriveOutcomeRequirementLine,
} from '../src/modules/outcomes/outcomePlan.engine.js'

import {
  OutcomePlan,
  RequirementDecision,
  RequirementLine,
  SubstitutionPolicy,
} from '../src/modules/outcomes/outcomePlan.models.js'

import {
  outcomePlanCreateBodySchema,
  outcomePlanUpdateBodySchema,
} from '../src/modules/outcomes/outcomePlan.routes.js'

const backendRoot =
  new URL(
    '../',
    import.meta.url,
  )

function read(
  relativePath,
) {
  return fs.readFileSync(
    new URL(
      relativePath,
      backendRoot,
    ),
    'utf8',
  )
}

const INGREDIENT_A =
  'aaaaaaaaaaaaaaaaaaaaaaaa'

const INGREDIENT_B =
  'bbbbbbbbbbbbbbbbbbbbbbbb'

test(
  'M10 registers documented Outcome Plan collections',
  () => {
    assert.equal(
      OutcomePlan.collection.name,
      'outcomePlans',
    )

    assert.equal(
      RequirementLine.collection.name,
      'requirementLines',
    )

    assert.equal(
      RequirementDecision.collection.name,
      'requirementDecisions',
    )

    assert.equal(
      SubstitutionPolicy.collection.name,
      'substitutionPolicies',
    )
  },
)

test(
  'M10 consolidates duplicate compatible requirements before Pantry subtraction',
  () => {
    const result =
      consolidateOutcomeRequirements([
        {
          recipeIngredientId:
            '111111111111111111111111',

          canonicalIngredientId:
            INGREDIENT_A,

          requiredQuantity:
            100,

          requiredUnit:
            'g',
        },

        {
          recipeIngredientId:
            '222222222222222222222222',

          canonicalIngredientId:
            INGREDIENT_A,

          requiredQuantity:
            0.1,

          requiredUnit:
            'kg',
        },
      ])

    assert.equal(
      result.length,
      1,
    )

    assert.equal(
      result[0].requiredQuantity,
      200,
    )

    assert.deepEqual(
      result[0].sourceRecipeIngredientIds,

      [
        '111111111111111111111111',
        '222222222222222222222222',
      ],
    )
  },
)

test(
  'M10 duplicate optional and mandatory requirement consolidates as mandatory',
  () => {
    const result =
      consolidateOutcomeRequirements([
        {
          canonicalIngredientId:
            INGREDIENT_A,

          requiredQuantity:
            50,

          requiredUnit:
            'g',

          optional:
            true,
        },

        {
          canonicalIngredientId:
            INGREDIENT_A,

          requiredQuantity:
            50,

          requiredUnit:
            'g',

          optional:
            false,
        },
      ])

    assert.equal(
      result.length,
      1,
    )

    assert.equal(
      result[0].optional,
      false,
    )
  },
)

test(
  'M10 genuine shortage is deterministic: 200g required minus 120g confirmed equals 80g',
  () => {
    const line =
      deriveOutcomeRequirementLine({
        requirement: {
          identityKey:
            `${INGREDIENT_A}:g`,

          canonicalIngredientId:
            INGREDIENT_A,

          requiredQuantity:
            200,

          requiredUnit:
            'g',
        },

        reconciliation: {
          status:
            'partial',

          requiredQuantity:
            200,

          requiredUnit:
            'g',

          confirmedAvailableQuantity:
            120,

          reason:
            'confirmed_quantity_below_requirement',
        },

        pantryItem: {
          state:
            'confirmed_available',
        },
      })

    assert.equal(
      line.usablePantryQuantity,
      120,
    )

    assert.equal(
      line.genuineShortage,
      80,
    )

    assert.equal(
      line.purchaseRequired,
      true,
    )

    assert.equal(
      line.includedInBasket,
      true,
    )
  },
)

test(
  'M10 inferred Pantry never invents exact shortage',
  () => {
    const line =
      deriveOutcomeRequirementLine({
        requirement: {
          identityKey:
            `${INGREDIENT_A}:g`,

          canonicalIngredientId:
            INGREDIENT_A,

          requiredQuantity:
            200,

          requiredUnit:
            'g',
        },

        reconciliation: {
          status:
            'uncertain',

          requiredQuantity:
            200,

          requiredUnit:
            'g',

          confirmedAvailableQuantity:
            null,

          reason:
            'pantry_state_not_exactly_confirmed',
        },

        pantryItem: {
          state:
            'inferred_available',
        },
      })

    assert.equal(
      line.genuineShortage,
      null,
    )

    assert.equal(
      line.needsConfirmation,
      true,
    )

    assert.equal(
      line.includedInBasket,
      false,
    )
  },
)

test(
  'M10 running-low Pantry remains explainable without exact shortage fabrication',
  () => {
    const line =
      deriveOutcomeRequirementLine({
        requirement: {
          identityKey:
            `${INGREDIENT_A}:g`,

          canonicalIngredientId:
            INGREDIENT_A,

          requiredQuantity:
            200,

          requiredUnit:
            'g',
        },

        reconciliation: {
          status:
            'uncertain',

          requiredQuantity:
            200,

          requiredUnit:
            'g',

          reason:
            'pantry_state_not_exactly_confirmed',
        },

        pantryItem: {
          state:
            'running_low',
        },
      })

    assert.equal(
      line.group,
      'running_low',
    )

    assert.equal(
      line.genuineShortage,
      null,
    )

    assert.equal(
      line.purchaseRequired,
      false,
    )
  },
)

test(
  'M10 missing mandatory requirement enters requirement basket',
  () => {
    const line =
      deriveOutcomeRequirementLine({
        requirement: {
          identityKey:
            `${INGREDIENT_A}:g`,

          canonicalIngredientId:
            INGREDIENT_A,

          requiredQuantity:
            75,

          requiredUnit:
            'g',
        },

        reconciliation: {
          status:
            'missing',

          requiredQuantity:
            75,

          requiredUnit:
            'g',

          confirmedAvailableQuantity:
            0,

          reason:
            'no_matching_pantry_observation',
        },
      })

    assert.equal(
      line.genuineShortage,
      75,
    )

    assert.equal(
      line.includedInBasket,
      true,
    )
  },
)

test(
  'M10 optional shortage stays outside basket until explicitly selected',
  () => {
    const base = {
      requirement: {
        identityKey:
          `${INGREDIENT_A}:g`,

        canonicalIngredientId:
          INGREDIENT_A,

        requiredQuantity:
          25,

        requiredUnit:
          'g',

        optional:
          true,
      },

      reconciliation: {
        status:
          'missing',

        requiredQuantity:
          25,

        requiredUnit:
          'g',

        confirmedAvailableQuantity:
          0,

        reason:
          'no_matching_pantry_observation',
      },
    }

    const excluded =
      deriveOutcomeRequirementLine({
        ...base,

        optionalIncluded:
          false,
      })

    const included =
      deriveOutcomeRequirementLine({
        ...base,

        optionalIncluded:
          true,
      })

    assert.equal(
      excluded.includedInBasket,
      false,
    )

    assert.equal(
      included.includedInBasket,
      true,
    )
  },
)

test(
  'M10 projection returns only confirmed genuine shortages as basket input',
  () => {
    const requirements = [
      {
        identityKey:
          `${INGREDIENT_A}:g`,

        canonicalIngredientId:
          INGREDIENT_A,

        requiredQuantity:
          200,

        requiredUnit:
          'g',
      },

      {
        identityKey:
          `${INGREDIENT_B}:g`,

        canonicalIngredientId:
          INGREDIENT_B,

        requiredQuantity:
          50,

        requiredUnit:
          'g',
      },
    ]

    const projection =
      buildOutcomePlanProjection({
        requirements,

        reconciliationLines: [
          {
            status:
              'available',

            requiredQuantity:
              200,

            requiredUnit:
              'g',

            confirmedAvailableQuantity:
              200,

            reason:
              'confirmed_quantity_satisfies_requirement',
          },

          {
            status:
              'missing',

            requiredQuantity:
              50,

            requiredUnit:
              'g',

            confirmedAvailableQuantity:
              0,

            reason:
              'no_matching_pantry_observation',
          },
        ],
      })

    assert.equal(
      projection.readinessState,
      'almost_there',
    )

    assert.equal(
      projection.basket.length,
      1,
    )

    assert.equal(
      projection.basket[0].quantity,
      50,
    )
  },
)

test(
  'M10 create schema accepts Recipe and servings but rejects ownership injection',
  () => {
    assert.deepEqual(
      outcomePlanCreateBodySchema.parse({
        recipeId:
          'butter-chicken',

        targetServings:
          4,
      }),

      {
        recipeId:
          'butter-chicken',

        targetServings:
          4,
      },
    )

    assert.throws(
      () =>
        outcomePlanCreateBodySchema.parse({
          recipeId:
            'butter-chicken',

          targetServings:
            4,

          householdId:
            INGREDIENT_A,
        }),
    )
  },
)

test(
  'M10 update schema accepts serving recalculation or optional decisions but rejects client shortage totals',
  () => {
    assert.equal(
      outcomePlanUpdateBodySchema.parse({
        targetServings:
          6,
      }).targetServings,

      6,
    )

    assert.equal(
      outcomePlanUpdateBodySchema.parse({
        decisions: [
          {
            requirementLineId:
              INGREDIENT_A,

            action:
              'include_optional',
          },
        ],
      }).decisions[0].action,

      'include_optional',
    )

    assert.throws(
      () =>
        outcomePlanUpdateBodySchema.parse({
          genuineShortage:
            10,
        }),
    )
  },
)

test(
  'M10 routes require active Customer capability and CSRF on mutations',
  () => {
    const source =
      read(
        'src/modules/outcomes/outcomePlan.routes.js',
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
      source,

      /requireHostAccess|requireSuperAdminAccess|activeMode\s*(?:===|==|!==|!=)/,
    )
  },
)

test(
  'M10 service derives Household from authenticated Pantry membership',
  () => {
    const source =
      read(
        'src/modules/outcomes/outcomePlan.service.js',
      )

    assert.match(
      source,
      /requireCurrentPantryHousehold/,
    )

    assert.doesNotMatch(
      source,
      /input\.householdId|body\.householdId/,
    )
  },
)

test(
  'M10 serving recalculation reuses immutable source Recipe Version',
  () => {
    const source =
      read(
        'src/modules/outcomes/outcomePlan.service.js',
      )

    assert.match(
      source,

      /requireRecipeVersionContext\(\s*plan\.sourceRecipeVersionId/s,
    )
  },
)

test(
  'M10 historical requirement decisions and substitution policies are append-only',
  () => {
    const source =
      read(
        'src/modules/outcomes/outcomePlan.models.js',
      )

    assert.match(
      source,

      /append-only and cannot be changed or deleted/,
    )
  },
)

test(
  'M10 does not import Marketplace commercial truth or create M11 selections',
  () => {
    const source =
      [
        read(
          'src/modules/outcomes/outcomePlan.engine.js',
        ),

        read(
          'src/modules/outcomes/outcomePlan.models.js',
        ),

        read(
          'src/modules/outcomes/outcomePlan.service.js',
        ),

        read(
          'src/modules/outcomes/outcomePlan.routes.js',
        ),
      ].join(
        '\n',
      )

    assert.doesNotMatch(
      source,

      /modules\/marketplace|HostOffer|PriceRule|InventorySnapshot|ServiceArea|selectedOfferId|selectedProductId/,
    )
  },
)

test(
  'M10 preserves Customer Host Super Admin as the only top-level access architecture',
  () => {
    const source =
      [
        read(
          'src/modules/outcomes/outcomePlan.models.js',
        ),

        read(
          'src/modules/outcomes/outcomePlan.service.js',
        ),

        read(
          'src/modules/outcomes/outcomePlan.routes.js',
        ),
      ].join(
        '\n',
      )

    assert.doesNotMatch(
      source,

      /sellerEnabled|brandEnabled|b2bEnabled|APPLICATION_ACCESS_TYPES\.(SELLER|BRAND|B2B)/,
    )
  },
)

test(
  'M10 app mounts Outcome Plan before existing public Recipe router',
  () => {
    const source =
      read(
        'src/app.js',
      )

    const protectedIndex =
      source.indexOf(
        'outcomePlanRecipeRoutes',

        source.indexOf(
          'app.use',
        ),
      )

    const publicIndex =
      source.lastIndexOf(
        'recipePublicRoutes',
      )

    assert.notEqual(
      protectedIndex,
      -1,
    )

    assert.notEqual(
      publicIndex,
      -1,
    )

    assert.ok(
      protectedIndex <
      publicIndex,
    )
  },
)

test(
  'M10 live Outcome Plan read rejects unauthenticated request',
  async () => {
    const response =
      await request(
        app,
      ).get(
        `/api/v1/outcome-plans/${INGREDIENT_A}`,
      )

    assert.equal(
      response.status,
      401,
    )
  },
)

test(
  'M10 live Recipe Outcome mutation rejects unauthenticated request before mutation',
  async () => {
    const response =
      await request(
        app,
      )
        .post(
          '/api/v1/recipes/example-recipe/outcome-plan',
        )
        .set(
          'Idempotency-Key',
          'm10-create-test',
        )
        .send({
          targetServings:
            4,
        })

    assert.equal(
      response.status,
      401,
    )
  },
)

test(
  'M10 unrelated Recipe path remains public-router territory',
  async () => {
    const response =
      await request(
        app,
      ).get(
        '/api/v1/recipes/__m10_unknown__/not-an-outcome-action',
      )

    assert.notEqual(
      response.status,
      401,
    )
  },
)