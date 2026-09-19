import { z } from 'zod'

import {
  MARKETPLACE_FULFILLMENT_TYPES,
  MARKETPLACE_OFFER_STATUSES,
} from './marketplace.constants.js'

export const marketplaceObjectIdSchema =
  z
    .string()
    .trim()
    .regex(
      /^[a-fA-F0-9]{24}$/,
      'Invalid MongoDB ObjectId.',
    )

const merchantSkuSchema =
  z
    .string()
    .trim()
    .max(180)

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

const minimumOrderQuantitySchema =
  z
    .number()
    .int()
    .min(1)
    .max(100000)

const maximumOrderQuantitySchema =
  z
    .number()
    .int()
    .min(1)
    .max(100000)
    .nullable()

/*
|--------------------------------------------------------------------------
| Offer Params
|--------------------------------------------------------------------------
*/

export const hostOfferIdParamsSchema =
  z
    .object({
      id:
        marketplaceObjectIdSchema,
    })
    .strict()

/*
|--------------------------------------------------------------------------
| Create Offer
|--------------------------------------------------------------------------
|
| organizationId / ownerUserId are intentionally not accepted.
|
| Host tenancy is resolved by the backend from req.currentUser.
|
| Price, stock and canonical Product facts are also intentionally excluded.
|--------------------------------------------------------------------------
*/

export const createHostOfferSchema =
  z
    .object({
      packId:
        marketplaceObjectIdSchema,

      merchantSku:
        merchantSkuSchema
          .optional()
          .default(''),

      fulfillmentTypes:
        fulfillmentTypesSchema
          .optional()
          .default([
            'delivery',
          ]),

      minimumOrderQuantity:
        minimumOrderQuantitySchema
          .optional()
          .default(1),

      maximumOrderQuantity:
        maximumOrderQuantitySchema
          .optional()
          .default(null),

      externalReference: z
        .string()
        .trim()
        .max(250)
        .optional()
        .default(''),
    })
    .strict()
    .refine(
      (value) =>
        value.maximumOrderQuantity ===
          null ||
        value.maximumOrderQuantity >=
          value.minimumOrderQuantity,
      {
        message:
          'Maximum order quantity cannot be lower than minimum order quantity.',
      },
    )

/*
|--------------------------------------------------------------------------
| Update Offer
|--------------------------------------------------------------------------
|
| Part 2 does NOT allow Host to activate an Offer directly.
|
| "active" eligibility will be controlled once Price + Inventory readiness
| exists in later M05 Parts.
|--------------------------------------------------------------------------
*/

const hostEditableOfferStatuses =
  MARKETPLACE_OFFER_STATUSES.filter(
    (status) =>
      status !==
      'active',
  )

export const updateHostOfferSchema =
  z
    .object({
      merchantSku:
        merchantSkuSchema
          .optional(),

      fulfillmentTypes:
        fulfillmentTypesSchema
          .optional(),

      minimumOrderQuantity:
        minimumOrderQuantitySchema
          .optional(),

      maximumOrderQuantity:
        maximumOrderQuantitySchema
          .optional(),

      externalReference: z
        .string()
        .trim()
        .max(250)
        .optional(),

      status: z
        .enum(
          hostEditableOfferStatuses,
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
          'At least one Host Offer field is required.',
      },
    )

/*
|--------------------------------------------------------------------------
| List Offers
|--------------------------------------------------------------------------
*/

export const listHostOffersQuerySchema =
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
          ...MARKETPLACE_OFFER_STATUSES,
        ])
        .optional()
        .default('all'),

      packId:
        marketplaceObjectIdSchema
          .optional(),

      search: z
        .string()
        .trim()
        .max(150)
        .optional()
        .default(''),
    })
    .strict()