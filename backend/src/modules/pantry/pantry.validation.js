import {
  z,
} from 'zod'

import {
  PANTRY_CUSTOMER_OBSERVATION_SOURCES,
  PANTRY_QUANTITY_MODES,
  PANTRY_QUANTITY_UNITS,
  PANTRY_STORAGE_ZONES,
} from './pantry.constants.js'

const mongoObjectIdSchema =
  z
    .string()
    .trim()
    .regex(
      /^[a-fA-F0-9]{24}$/,
      'A valid canonical MongoDB ID is required.',
    )

const pantryQuantitySchema =
  z
    .object({
      mode:
        z.enum(
          PANTRY_QUANTITY_MODES,
        ),

      value:
        z
          .number()
          .finite()
          .min(
            0,
          )
          .optional(),

      min:
        z
          .number()
          .finite()
          .min(
            0,
          )
          .optional(),

      max:
        z
          .number()
          .finite()
          .min(
            0,
          )
          .optional(),

      unit:
        z
          .enum(
            PANTRY_QUANTITY_UNITS,
          )
          .optional(),
    })
    .strict()
    .superRefine(
      (
        value,
        ctx,
      ) => {
        if (
          value.mode ===
          'exact'
        ) {
          if (
            value.value ===
            undefined
          ) {
            ctx.addIssue({
              code:
                z.ZodIssueCode.custom,

              path: [
                'value',
              ],

              message:
                'Exact Pantry quantity requires value.',
            })
          }

          if (
            value.min !==
              undefined ||
            value.max !==
              undefined
          ) {
            ctx.addIssue({
              code:
                z.ZodIssueCode.custom,

              message:
                'Exact Pantry quantity cannot contain range values.',
            })
          }

          if (
            !value.unit
          ) {
            ctx.addIssue({
              code:
                z.ZodIssueCode.custom,

              path: [
                'unit',
              ],

              message:
                'Exact Pantry quantity requires unit.',
            })
          }
        }

        if (
          value.mode ===
          'range'
        ) {
          if (
            value.min ===
              undefined ||
            value.max ===
              undefined
          ) {
            ctx.addIssue({
              code:
                z.ZodIssueCode.custom,

              message:
                'Pantry quantity range requires min and max.',
            })
          }

          if (
            value.min !==
              undefined &&
            value.max !==
              undefined &&
            value.min >
              value.max
          ) {
            ctx.addIssue({
              code:
                z.ZodIssueCode.custom,

              path: [
                'max',
              ],

              message:
                'Pantry quantity range max must be greater than or equal to min.',
            })
          }

          if (
            value.value !==
            undefined
          ) {
            ctx.addIssue({
              code:
                z.ZodIssueCode.custom,

              message:
                'Pantry quantity range cannot contain exact value.',
            })
          }

          if (
            !value.unit
          ) {
            ctx.addIssue({
              code:
                z.ZodIssueCode.custom,

              path: [
                'unit',
              ],

              message:
                'Pantry quantity range requires unit.',
            })
          }
        }

        if (
          value.mode ===
          'unknown'
        ) {
          if (
            value.value !==
              undefined ||
            value.min !==
              undefined ||
            value.max !==
              undefined
          ) {
            ctx.addIssue({
              code:
                z.ZodIssueCode.custom,

              message:
                'Unknown Pantry quantity cannot contain numeric quantity.',
            })
          }
        }
      },
    )

export const customerPantryObservationSchema =
  z
    .object({
      canonicalPackId:
        mongoObjectIdSchema
          .optional(),

      canonicalIngredientId:
        mongoObjectIdSchema
          .optional(),

      sourceType:
        z.enum(
          PANTRY_CUSTOMER_OBSERVATION_SOURCES,
        ),

      quantity:
        pantryQuantitySchema
          .optional(),

      storageZone:
        z
          .enum(
            PANTRY_STORAGE_ZONES,
          )
          .optional(),

      observedAt:
        z
          .string()
          .datetime({
            offset:
              true,
          })
          .optional(),

      openedAt:
        z
          .string()
          .datetime({
            offset:
              true,
          })
          .nullable()
          .optional(),

      useSoonAt:
        z
          .string()
          .datetime({
            offset:
              true,
          })
          .nullable()
          .optional(),

      plannedUseAt:
        z
          .string()
          .datetime({
            offset:
              true,
          })
          .nullable()
          .optional(),

      note:
        z
          .string()
          .trim()
          .min(
            1,
          )
          .max(
            500,
          )
          .optional(),
    })
    .strict()
    .superRefine(
      (
        value,
        ctx,
      ) => {
        if (
          !value.canonicalPackId &&
          !value.canonicalIngredientId
        ) {
          ctx.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'canonicalPackId',
            ],

            message:
              'Pantry observation requires canonical Pack and/or Ingredient identity.',
          })
        }

        if (
          value.sourceType ===
            'manual_quantity_correction' &&
          (
            !value.quantity ||
            value.quantity.mode ===
              'unknown'
          )
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
              'Storage update requires storageZone.',
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
              'Do-not-track observation cannot set Pantry quantity.',
          })
        }

        if (
          value.sourceType ===
            'finished' &&
          value.quantity &&
          (
            value.quantity.mode !==
              'exact' ||
            value.quantity.value !==
              0
          )
        ) {
          ctx.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'quantity',
            ],

            message:
              'Finished Pantry observation may only carry exact zero quantity.',
          })
        }
      },
    )

export const pantryItemIdParamsSchema =
  z
    .object({
      id:
        mongoObjectIdSchema,
    })
    .strict()

export {
  pantryQuantitySchema,
}