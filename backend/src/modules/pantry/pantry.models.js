import mongoose from 'mongoose'

import {
  PANTRY_OBSERVATION_SOURCES,
  PANTRY_QUANTITY_MODES,
  PANTRY_QUANTITY_UNITS,
  PANTRY_STATES,
  PANTRY_STORAGE_ZONES,
} from './pantry.constants.js'

const {
  Schema,
  model,
  models,
} =
  mongoose

/*
|--------------------------------------------------------------------------
| Shared Quantity Estimate
|--------------------------------------------------------------------------
*/

const pantryQuantitySchema =
  new Schema(
    {
      mode: {
        type:
          String,

        enum:
          PANTRY_QUANTITY_MODES,

        required:
          true,

        default:
          'unknown',
      },

      value: {
        type:
          Number,

        min:
          0,

        default:
          null,
      },

      min: {
        type:
          Number,

        min:
          0,

        default:
          null,
      },

      max: {
        type:
          Number,

        min:
          0,

        default:
          null,
      },

      unit: {
        type:
          String,

        enum:
          PANTRY_QUANTITY_UNITS,

        default:
          null,
      },
    },
    {
      _id:
        false,

      strict:
        'throw',
    },
  )

/*
|--------------------------------------------------------------------------
| Pantry Item
|--------------------------------------------------------------------------
|
| Mutable projection of latest household Pantry state.
|
| History remains in pantryObservations.
|
*/

const pantryItemSchema =
  new Schema(
    {
      householdId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'Household',

        required:
          true,

        index:
          true,
      },

      /*
      |--------------------------------------------------------------------------
      | Stable Canonical Identity
      |--------------------------------------------------------------------------
      |
      | Pantry is linked to M04 canonical identity.
      |
      | M05 HostOffer / inventory truth never belongs here.
      |
      */

      canonicalPackId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'Pack',

        default:
          null,

        index:
          true,
      },

      canonicalIngredientId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'CanonicalIngredient',

        default:
          null,

        index:
          true,
      },

      identityKey: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      state: {
        type:
          String,

        enum:
          PANTRY_STATES,

        required:
          true,

        default:
          'uncertain',

        index:
          true,
      },

      quantityEstimate: {
        type:
          pantryQuantitySchema,

        required:
          true,

        default:
          () => ({
            mode:
              'unknown',
          }),
      },

      /*
      |--------------------------------------------------------------------------
      | Confidence
      |--------------------------------------------------------------------------
      |
      | Internal deterministic confidence.
      |
      | UI should show qualitative states instead of false precision.
      |
      */

      confidence: {
        type:
          Number,

        min:
          0,

        max:
          1,

        required:
          true,

        default:
          0,
      },

      evidenceStrength: {
        type:
          Number,

        min:
          0,

        max:
          100,

        required:
          true,

        default:
          0,
      },

      lastSourceType: {
        type:
          String,

        enum:
          PANTRY_OBSERVATION_SOURCES,

        default:
          null,
      },

      lastObservationId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'PantryObservation',

        default:
          null,
      },

      lastObservationAt: {
        type:
          Date,

        default:
          null,

        index:
          true,
      },

      /*
      |--------------------------------------------------------------------------
      | Household UX State
      |--------------------------------------------------------------------------
      */

      storageZone: {
        type:
          String,

        enum:
          PANTRY_STORAGE_ZONES,

        default:
          'pantry',
      },

      openedAt: {
        type:
          Date,

        default:
          null,
      },

      useSoonAt: {
        type:
          Date,

        default:
          null,
      },

      plannedUseAt: {
        type:
          Date,

        default:
          null,
      },

      trackingPausedAt: {
        type:
          Date,

        default:
          null,
      },

      createdByUserId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'User',

        required:
          true,
      },

      updatedByUserId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'User',

        required:
          true,
      },
    },
    {
      collection:
        'pantryItems',

      timestamps:
        true,

      strict:
        'throw',
    },
  )

pantryItemSchema.index(
  {
    householdId:
      1,

    identityKey:
      1,
  },
  {
    unique:
      true,

    name:
      'pantry_household_identity_unique',
  },
)

pantryItemSchema.index(
  {
    householdId:
      1,

    state:
      1,

    lastObservationAt:
      -1,
  },
  {
    name:
      'pantry_household_state_recent',
  },
)

pantryItemSchema.pre(
  'validate',

  function validatePantryIdentity(
    next,
  ) {
    if (
      !this.canonicalPackId &&
      !this.canonicalIngredientId
    ) {
      return next(
        new Error(
          'PantryItem requires canonical Pack and/or canonical Ingredient identity.',
        ),
      )
    }

    return next()
  },
)

/*
|--------------------------------------------------------------------------
| Pantry Observation
|--------------------------------------------------------------------------
|
| Append-only household evidence.
|
*/

const pantryObservationSchema =
  new Schema(
    {
      householdId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'Household',

        required:
          true,

        index:
          true,
      },

      pantryItemId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'PantryItem',

        required:
          true,

        index:
          true,
      },

      sourceType: {
        type:
          String,

        enum:
          PANTRY_OBSERVATION_SOURCES,

        required:
          true,

        index:
          true,
      },

      stateSignal: {
        type:
          String,

        enum:
          PANTRY_STATES,

        default:
          null,
      },

      quantitySignal: {
        type:
          pantryQuantitySchema,

        required:
          true,

        default:
          () => ({
            mode:
              'unknown',
          }),
      },

      confidenceWeight: {
        type:
          Number,

        min:
          0,

        max:
          1,

        required:
          true,
      },

      evidenceStrength: {
        type:
          Number,

        min:
          0,

        max:
          100,

        required:
          true,
      },

      customerCorrection: {
        type:
          Boolean,

        required:
          true,

        default:
          false,
      },

      observedAt: {
        type:
          Date,

        required:
          true,

        index:
          true,
      },

      actorUserId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'User',

        default:
          null,
      },

      storageZoneSignal: {
        type:
          String,

        enum:
          PANTRY_STORAGE_ZONES,

        default:
          null,
      },

      openedAtSignal: {
        type:
          Date,

        default:
          null,
      },

      useSoonAtSignal: {
        type:
          Date,

        default:
          null,
      },

      plannedUseAtSignal: {
        type:
          Date,

        default:
          null,
      },

      note: {
        type:
          String,

        trim:
          true,

        maxlength:
          500,

        default:
          null,
      },

      /*
      |--------------------------------------------------------------------------
      | Projection Result
      |--------------------------------------------------------------------------
      |
      | Observation always stays in history even if an older/weaker signal does
      | not replace current PantryItem projection.
      |
      */

      projectionApplied: {
        type:
          Boolean,

        required:
          true,

        default:
          true,
      },

      projectionReason: {
        type:
          String,

        trim:
          true,

        maxlength:
          160,

        default:
          null,
      },
    },
    {
      collection:
        'pantryObservations',

      timestamps:
        true,

      strict:
        'throw',
    },
  )

pantryObservationSchema.index(
  {
    householdId:
      1,

    pantryItemId:
      1,

    observedAt:
      -1,
  },
  {
    name:
      'pantry_observation_history',
  },
)

/*
|--------------------------------------------------------------------------
| Consumption Event
|--------------------------------------------------------------------------
|
| Recipe cooking and explicit consumption stay as append-only events.
|
| They are not the same thing as seller inventory.
|
*/

const consumptionEventSchema =
  new Schema(
    {
      householdId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'Household',

        required:
          true,

        index:
          true,
      },

      pantryItemId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'PantryItem',

        required:
          true,

        index:
          true,
      },

      recipeVersionId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'RecipeVersion',

        default:
          null,

        index:
          true,
      },

      eventKey: {
        type:
          String,

        trim:
          true,

        required:
          true,
      },

      sourceType: {
        type:
          String,

        enum: [
          'recipe_cooked',
          'manual_consumption',
        ],

        required:
          true,
      },

      quantityConsumed: {
        type:
          Number,

        min:
          0,

        required:
          true,
      },

      unit: {
        type:
          String,

        enum:
          PANTRY_QUANTITY_UNITS,

        required:
          true,
      },

      occurredAt: {
        type:
          Date,

        required:
          true,

        index:
          true,
      },

      actorUserId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'User',

        required:
          true,
      },
    },
    {
      collection:
        'consumptionEvents',

      timestamps:
        true,

      strict:
        'throw',
    },
  )

consumptionEventSchema.index(
  {
    householdId:
      1,

    eventKey:
      1,
  },
  {
    unique:
      true,

    name:
      'pantry_consumption_event_idempotency',
  },
)

/*
|--------------------------------------------------------------------------
| Household Pantry Preference
|--------------------------------------------------------------------------
*/

const pantryHouseholdPreferenceSchema =
  new Schema(
    {
      householdId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'Household',

        required:
          true,

        unique:
          true,

        index:
          true,
      },

      pantryTrackingEnabled: {
        type:
          Boolean,

        required:
          true,

        default:
          true,
      },

      replenishmentPromptsEnabled: {
        type:
          Boolean,

        required:
          true,

        default:
          true,
      },

      defaultStorageZone: {
        type:
          String,

        enum:
          PANTRY_STORAGE_ZONES,

        required:
          true,

        default:
          'pantry',
      },

      doNotTrackPackIds: [
        {
          type:
            Schema.Types.ObjectId,

          ref:
            'Pack',
        },
      ],

      doNotTrackIngredientIds: [
        {
          type:
            Schema.Types.ObjectId,

          ref:
            'CanonicalIngredient',
        },
      ],

      updatedByUserId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'User',

        required:
          true,
      },
    },
    {
      collection:
        'householdPreferences',

      timestamps:
        true,

      strict:
        'throw',
    },
  )

/*
|--------------------------------------------------------------------------
| Immutable Historical Records
|--------------------------------------------------------------------------
*/

function rejectHistoricalMutation(
  next,
) {
  return next(
    new Error(
      'Historical Pantry records are append-only and cannot be updated or deleted.',
    ),
  )
}

pantryObservationSchema.pre(
  'save',

  function preventObservationSaveUpdate(
    next,
  ) {
    if (
      !this.isNew
    ) {
      return rejectHistoricalMutation(
        next,
      )
    }

    return next()
  },
)

consumptionEventSchema.pre(
  'save',

  function preventConsumptionSaveUpdate(
    next,
  ) {
    if (
      !this.isNew
    ) {
      return rejectHistoricalMutation(
        next,
      )
    }

    return next()
  },
)

for (
  const operation
  of [
    'updateOne',
    'updateMany',
    'findOneAndUpdate',
    'replaceOne',
    'deleteOne',
    'deleteMany',
    'findOneAndDelete',
  ]
) {
  pantryObservationSchema.pre(
    operation,

    rejectHistoricalMutation,
  )

  consumptionEventSchema.pre(
    operation,

    rejectHistoricalMutation,
  )
}

/*
|--------------------------------------------------------------------------
| Models
|--------------------------------------------------------------------------
*/

export const PantryItem =
  models.PantryItem ||
  model(
    'PantryItem',
    pantryItemSchema,
  )

export const PantryObservation =
  models.PantryObservation ||
  model(
    'PantryObservation',
    pantryObservationSchema,
  )

export const PantryConsumptionEvent =
  models.PantryConsumptionEvent ||
  model(
    'PantryConsumptionEvent',
    consumptionEventSchema,
  )

export const PantryHouseholdPreference =
  models.PantryHouseholdPreference ||
  model(
    'PantryHouseholdPreference',
    pantryHouseholdPreferenceSchema,
  )