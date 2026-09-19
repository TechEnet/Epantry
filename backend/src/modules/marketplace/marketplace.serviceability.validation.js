import { z } from 'zod'

import {
  MARKETPLACE_FULFILLMENT_TYPES,
  MARKETPLACE_SERVICE_AREA_STATUSES,
} from './marketplace.constants.js'

import {
  marketplaceObjectIdSchema,
} from './marketplace.host.validation.js'

/*
|--------------------------------------------------------------------------
| Indian Pincode
|--------------------------------------------------------------------------
|
| Current M05 serviceability contract is Indian pincode based.
|
| Spaces are normalized:
|
| "273 001" -> "273001"
|--------------------------------------------------------------------------
*/

const indianPostalCodeSchema =
  z
    .string()
    .trim()
    .transform(
      (value) =>
        value.replace(
          /\s+/g,
          '',
        ),
    )
    .refine(
      (value) =>
        /^\d{6}$/.test(
          value,
        ),
      {
        message:
          'Pincode must contain exactly 6 digits.',
      },
    )

const fulfillmentTypesSchema =
  z
    .array(
      z.enum(
        MARKETPLACE_FULFILLMENT_TYPES,
      ),
    )
    .min(1)
    .max(
      MARKETPLACE_FULFILLMENT_TYPES.length,
    )
    .transform(
      (values) => [
        ...new Set(
          values,
        ),
      ],
    )

const postalCodesSchema =
  z
    .array(
      indianPostalCodeSchema,
    )
    .min(1)
    .max(5000)
    .transform(
      (values) => [
        ...new Set(
          values,
        ),
      ],
    )

/*
|--------------------------------------------------------------------------
| Params
|--------------------------------------------------------------------------
*/

export const serviceAreaIdParamsSchema =
  z
    .object({
      id:
        marketplaceObjectIdSchema,
    })
    .strict()

/*
|--------------------------------------------------------------------------
| Create Service Area
|--------------------------------------------------------------------------
|
| organizationId is intentionally not accepted.
|
| Host tenancy is always backend-resolved.
|--------------------------------------------------------------------------
*/

export const createServiceAreaSchema =
  z
    .object({
      name: z
        .string()
        .trim()
        .min(1)
        .max(220),

      serviceAreaKey: z
        .string()
        .trim()
        .max(220)
        .optional(),

      inventoryNodeId:
        marketplaceObjectIdSchema
          .nullable()
          .optional()
          .default(null),

      postalCodes:
        postalCodesSchema,

      fulfillmentTypes:
        fulfillmentTypesSchema
          .optional()
          .default([
            'delivery',
          ]),
    })
    .strict()

/*
|--------------------------------------------------------------------------
| Update Service Area
|--------------------------------------------------------------------------
*/

export const updateServiceAreaSchema =
  z
    .object({
      name: z
        .string()
        .trim()
        .min(1)
        .max(220)
        .optional(),

      inventoryNodeId:
        marketplaceObjectIdSchema
          .nullable()
          .optional(),

      postalCodes:
        postalCodesSchema
          .optional(),

      fulfillmentTypes:
        fulfillmentTypesSchema
          .optional(),

      status: z
        .enum(
          MARKETPLACE_SERVICE_AREA_STATUSES,
        )
        .optional(),
    })
    .strict()
    .refine(
      (value) =>
        Object.keys(
          value,
        ).length >
        0,
      {
        message:
          'At least one Service Area field is required.',
      },
    )

/*
|--------------------------------------------------------------------------
| List Service Areas
|--------------------------------------------------------------------------
*/

export const listServiceAreasQuerySchema =
  z
    .object({
      page: z.coerce
        .number()
        .int()
        .min(1)
        .optional()
        .default(1),

      limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .default(25),

      status: z
        .enum([
          'all',
          ...MARKETPLACE_SERVICE_AREA_STATUSES,
        ])
        .optional()
        .default('all'),

      inventoryNodeId:
        marketplaceObjectIdSchema
          .optional(),

      pincode:
        indianPostalCodeSchema
          .optional(),

      search: z
        .string()
        .trim()
        .max(150)
        .optional()
        .default(''),
    })
    .strict()

/*
|--------------------------------------------------------------------------
| Serviceability Resolver
|--------------------------------------------------------------------------
*/

export const resolveHostServiceabilityQuerySchema =
  z
    .object({
      pincode:
        indianPostalCodeSchema,

      fulfillmentType: z
        .enum(
          MARKETPLACE_FULFILLMENT_TYPES,
        )
        .optional(),
    })
    .strict()