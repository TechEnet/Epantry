import {
  z,
} from 'zod'

import {
  PANTRY_STATES,
  PANTRY_STORAGE_ZONES,
} from './pantry.constants.js'

import {
  customerPantryObservationSchema,
  pantryQuantitySchema,
} from './pantry.validation.js'

/*
|--------------------------------------------------------------------------
| Object ID
|--------------------------------------------------------------------------
*/

const objectIdSchema =
  z
    .string()
    .trim()
    .regex(
      /^[a-f\d]{24}$/i,
      'A valid MongoDB Object ID is required.',
    )

/*
|--------------------------------------------------------------------------
| Pagination
|--------------------------------------------------------------------------
*/

const pageSchema =
  z.coerce
    .number()
    .int()
    .min(1)
    .max(100000)
    .default(1)

const limitSchema =
  z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50)

/*
|--------------------------------------------------------------------------
| Pantry Browse
|--------------------------------------------------------------------------
*/

export const pantryListQuerySchema =
  z
    .object({
      page:
        pageSchema,

      limit:
        limitSchema,

      state:
        z
          .enum(
            PANTRY_STATES,
          )
          .optional(),

      canonicalPackId:
        objectIdSchema
          .optional(),

      canonicalIngredientId:
        objectIdSchema
          .optional(),
    })
    .strict()

/*
|--------------------------------------------------------------------------
| Pantry Item Params
|--------------------------------------------------------------------------
*/

export const pantryItemApiParamsSchema =
  z
    .object({
      id:
        objectIdSchema,
    })
    .strict()

/*
|--------------------------------------------------------------------------
| Pantry History
|--------------------------------------------------------------------------
*/

export const pantryHistoryQuerySchema =
  z
    .object({
      page:
        pageSchema,

      limit:
        limitSchema,
    })
    .strict()

/*
|--------------------------------------------------------------------------
| Customer Item Patch
|--------------------------------------------------------------------------
|
| PATCH /pantry/items/:id does NOT directly overwrite PantryItem state.
|
| It creates an append-only observation using the PantryItem's server-owned
| canonical identity.
|
*/

export const PANTRY_ITEM_PATCH_SOURCES =
  Object.freeze([
    'manual_quantity_correction',
    'running_low_confirmation',
    'bought_elsewhere',
    'opened',
    'finished',
    'storage_update',
    'planned_use',
    'use_soon',
    'do_not_track',
    'resume_tracking',
  ])

export const pantryItemPatchSchema =
  z
    .object({
      sourceType:
        z.enum(
          PANTRY_ITEM_PATCH_SOURCES,
        ),

      quantity:
        pantryQuantitySchema
          .optional(),

      observedAt:
        z.coerce
          .date()
          .optional(),

      storageZone:
        z
          .enum(
            PANTRY_STORAGE_ZONES,
          )
          .optional(),

      openedAt:
        z.coerce
          .date()
          .nullable()
          .optional(),

      useSoonAt:
        z.coerce
          .date()
          .nullable()
          .optional(),

      plannedUseAt:
        z.coerce
          .date()
          .nullable()
          .optional(),

      note:
        z
          .string()
          .trim()
          .max(500)
          .optional(),
    })
    .strict()
    .superRefine(
      (
        value,
        ctx,
      ) => {
        if (
          value.sourceType ===
            'manual_quantity_correction' &&
          !value.quantity
        ) {
          ctx.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'quantity',
            ],

            message:
              'Manual quantity correction requires an explicit quantity.',
          })
        }

        if (
          value.sourceType ===
            'storage_update' &&
          !value.storageZone
        ) {
          ctx.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'storageZone',
            ],

            message:
              'Storage update requires a storage zone.',
          })
        }

        if (
          value.sourceType ===
            'planned_use' &&
          !value.plannedUseAt
        ) {
          ctx.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'plannedUseAt',
            ],

            message:
              'Planned use requires plannedUseAt.',
          })
        }

        if (
          value.sourceType ===
            'use_soon' &&
          !value.useSoonAt
        ) {
          ctx.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'useSoonAt',
            ],

            message:
              'Use-soon update requires useSoonAt.',
          })
        }

        if (
          value.sourceType ===
            'do_not_track' &&
          value.quantity
        ) {
          ctx.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'quantity',
            ],

            message:
              'Do-not-track cannot carry a quantity.',
          })
        }
      },
    )

/*
|--------------------------------------------------------------------------
| Household Pantry Preferences
|--------------------------------------------------------------------------
*/

export const pantryPreferencesPatchSchema =
  z
    .object({
      pantryTrackingEnabled:
        z
          .boolean()
          .optional(),

      replenishmentPromptsEnabled:
        z
          .boolean()
          .optional(),

      defaultStorageZone:
        z
          .enum(
            PANTRY_STORAGE_ZONES,
          )
          .optional(),
    })
    .strict()
    .refine(
      (
        value,
      ) =>
        Object.keys(
          value,
        ).length >
        0,

      {
        message:
          'At least one Pantry preference must be supplied.',
      },
    )

/*
|--------------------------------------------------------------------------
| Recipe Cooked
|--------------------------------------------------------------------------
*/

export const recipeCookedParamsSchema =
  z
    .object({
      id:
        z
          .string()
          .trim()
          .min(1)
          .max(160),
    })
    .strict()

export const recipeCookedBodySchema =
  z
    .object({
      targetServings:
        z.coerce
          .number()
          .finite()
          .min(0.25)
          .max(1000),

      occurredAt:
        z.coerce
          .date()
          .optional(),
    })
    .strict()

export const recipeCookedIdempotencySchema =
  z
    .string()
    .trim()
    .min(
      8,
      'Idempotency-Key must contain at least 8 characters.',
    )
    .max(
      160,
      'Idempotency-Key is too long.',
    )

/*
|--------------------------------------------------------------------------
| Re-export Existing Strict Customer Observation Contract
|--------------------------------------------------------------------------
*/

export {
  customerPantryObservationSchema,
}