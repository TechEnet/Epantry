import assert from 'node:assert/strict'

import test from 'node:test'

import {
  PANTRY_CUSTOMER_OBSERVATION_SOURCES,
  PANTRY_OBSERVATION_SOURCES,
  PANTRY_STATES,
} from '../src/modules/pantry/pantry.constants.js'

import {
  PantryConsumptionEvent,
  PantryHouseholdPreference,
  PantryItem,
  PantryObservation,
} from '../src/modules/pantry/pantry.models.js'

import {
  customerPantryObservationSchema,
} from '../src/modules/pantry/pantry.validation.js'

const PACK_ID =
  '64b000000000000000000001'

const INGREDIENT_ID =
  '64b000000000000000000002'

test(
  'M09 exposes authoritative Living Pantry states',
  () => {
    assert.deepEqual(
      PANTRY_STATES,
      [
        'confirmed_available',
        'inferred_available',
        'running_low',
        'uncertain',
        'out',
        'replenished_elsewhere',
        'do_not_track',
      ],
    )
  },
)

test(
  'M09 Pantry sources include customer purchase consumption and inference signals',
  () => {
    for (
      const source
      of [
        'manual_have',
        'marketplace_purchase',
        'external_purchase_confirmation',
        'recipe_consumption',
        'manual_quantity_correction',
        'running_low_confirmation',
        'bought_elsewhere',
        'discard_expiry',
        'inference',
      ]
    ) {
      assert.equal(
        PANTRY_OBSERVATION_SOURCES.includes(
          source,
        ),
        true,
      )
    }
  },
)

test(
  'M09 PantryItem uses dedicated pantryItems collection',
  () => {
    assert.equal(
      PantryItem.collection.collectionName,
      'pantryItems',
    )
  },
)

test(
  'M09 PantryObservation uses dedicated pantryObservations collection',
  () => {
    assert.equal(
      PantryObservation.collection.collectionName,
      'pantryObservations',
    )
  },
)

test(
  'M09 consumption event uses dedicated consumptionEvents collection',
  () => {
    assert.equal(
      PantryConsumptionEvent.collection.collectionName,
      'consumptionEvents',
    )
  },
)

test(
  'M09 household Pantry preference uses documented householdPreferences collection',
  () => {
    assert.equal(
      PantryHouseholdPreference
        .collection
        .collectionName,
      'householdPreferences',
    )
  },
)

test(
  'M09 PantryItem is explicitly household scoped',
  () => {
    assert.ok(
      PantryItem
        .schema
        .path(
          'householdId',
        ),
    )
  },
)

test(
  'M09 PantryItem references canonical Pack and Ingredient identity',
  () => {
    assert.equal(
      PantryItem
        .schema
        .path(
          'canonicalPackId',
        )
        .options
        .ref,
      'Pack',
    )

    assert.equal(
      PantryItem
        .schema
        .path(
          'canonicalIngredientId',
        )
        .options
        .ref,
      'CanonicalIngredient',
    )
  },
)

test(
  'M09 PantryItem has unique household identity projection',
  () => {
    const indexes =
      PantryItem
        .schema
        .indexes()

    const found =
      indexes.some(
        ([
          fields,
          options,
        ]) =>
          fields.householdId ===
            1 &&
          fields.identityKey ===
            1 &&
          options.unique ===
            true,
      )

    assert.equal(
      found,
      true,
    )
  },
)

test(
  'M09 PantryObservation preserves source timestamp and confidence evidence',
  () => {
    assert.ok(
      PantryObservation
        .schema
        .path(
          'sourceType',
        ),
    )

    assert.ok(
      PantryObservation
        .schema
        .path(
          'observedAt',
        ),
    )

    assert.ok(
      PantryObservation
        .schema
        .path(
          'confidenceWeight',
        ),
    )

    assert.ok(
      PantryObservation
        .schema
        .path(
          'evidenceStrength',
        ),
    )
  },
)

test(
  'M09 consumption event may reference immutable Recipe Version identity',
  () => {
    assert.equal(
      PantryConsumptionEvent
        .schema
        .path(
          'recipeVersionId',
        )
        .options
        .ref,
      'RecipeVersion',
    )
  },
)

test(
  'M09 consumption events have household idempotency key',
  () => {
    const indexes =
      PantryConsumptionEvent
        .schema
        .indexes()

    const found =
      indexes.some(
        ([
          fields,
          options,
        ]) =>
          fields.householdId ===
            1 &&
          fields.eventKey ===
            1 &&
          options.unique ===
            true,
      )

    assert.equal(
      found,
      true,
    )
  },
)

test(
  'M09 Pantry domain contains no seller price inventory or serviceability truth',
  () => {
    const paths =
      Object.keys(
        PantryItem
          .schema
          .paths,
      )

    for (
      const forbidden
      of [
        'price',
        'salePrice',
        'listPrice',
        'stock',
        'inventory',
        'serviceability',
        'organizationId',
        'hostOfferId',
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

test(
  'M09 Pantry models create no Brand Seller B2B or admin application authority',
  () => {
    const serialized =
      JSON.stringify({
        pantryItem:
          Object.keys(
            PantryItem
              .schema
              .paths,
          ),

        observation:
          Object.keys(
            PantryObservation
              .schema
              .paths,
          ),
      })

    assert.doesNotMatch(
      serialized,
      /accountType|activeMode|superAdminEnabled|hostEnabled|brandEnabled|sellerEnabled|b2bEnabled/,
    )
  },
)

test(
  'M09 customer may submit I have this observation',
  () => {
    const result =
      customerPantryObservationSchema.safeParse({
        canonicalPackId:
          PACK_ID,

        sourceType:
          'manual_have',

        quantity: {
          mode:
            'exact',

          value:
            500,

          unit:
            'g',
        },
      })

    assert.equal(
      result.success,
      true,
    )
  },
)

test(
  'M09 customer Pantry API cannot inject household ownership',
  () => {
    const result =
      customerPantryObservationSchema.safeParse({
        householdId:
          '64b000000000000000000099',

        canonicalPackId:
          PACK_ID,

        sourceType:
          'manual_have',
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

test(
  'M09 customer Pantry API cannot inject actor or confidence authority',
  () => {
    const result =
      customerPantryObservationSchema.safeParse({
        actorUserId:
          '64b000000000000000000099',

        confidenceWeight:
          1,

        canonicalIngredientId:
          INGREDIENT_ID,

        sourceType:
          'manual_have',
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

test(
  'M09 customer cannot fake trusted marketplace purchase observation',
  () => {
    assert.equal(
      PANTRY_CUSTOMER_OBSERVATION_SOURCES.includes(
        'marketplace_purchase',
      ),
      false,
    )

    const result =
      customerPantryObservationSchema.safeParse({
        canonicalPackId:
          PACK_ID,

        sourceType:
          'marketplace_purchase',
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

test(
  'M09 manual quantity correction requires explicit quantity',
  () => {
    const result =
      customerPantryObservationSchema.safeParse({
        canonicalIngredientId:
          INGREDIENT_ID,

        sourceType:
          'manual_quantity_correction',
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

test(
  'M09 do not track cannot smuggle a quantity state',
  () => {
    const result =
      customerPantryObservationSchema.safeParse({
        canonicalPackId:
          PACK_ID,

        sourceType:
          'do_not_track',

        quantity: {
          mode:
            'exact',

          value:
            200,

          unit:
            'g',
        },
      })

    assert.equal(
      result.success,
      false,
    )
  },
)