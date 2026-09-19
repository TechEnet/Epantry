import { z } from 'zod'

import {
  MARKETPLACE_INVENTORY_NODE_STATUSES,
  MARKETPLACE_INVENTORY_NODE_TYPES,
  MARKETPLACE_INVENTORY_SOURCE_TYPES,
} from './marketplace.constants.js'

import {
  marketplaceObjectIdSchema,
} from './marketplace.host.validation.js'

const postalCodeSchema =
  z
    .string()
    .trim()
    .max(20)

const addressSchema =
  z
    .object({
      line1: z
        .string()
        .trim()
        .max(250)
        .optional()
        .default(''),

      line2: z
        .string()
        .trim()
        .max(250)
        .optional()
        .default(''),

      city: z
        .string()
        .trim()
        .max(120)
        .optional()
        .default(''),

      state: z
        .string()
        .trim()
        .max(120)
        .optional()
        .default(''),

      postalCode:
        postalCodeSchema
          .optional()
          .default(''),

      countryCode: z
        .string()
        .trim()
        .length(2)
        .transform(
          (value) =>
            value.toUpperCase(),
        )
        .optional()
        .default('IN'),
    })
    .strict()

/*
|--------------------------------------------------------------------------
| Inventory Node
|--------------------------------------------------------------------------
*/

export const inventoryNodeIdParamsSchema =
  z
    .object({
      id:
        marketplaceObjectIdSchema,
    })
    .strict()

export const createInventoryNodeSchema =
  z
    .object({
      name: z
        .string()
        .trim()
        .min(1)
        .max(220),

      nodeKey: z
        .string()
        .trim()
        .max(220)
        .optional(),

      nodeType: z
        .enum(
          MARKETPLACE_INVENTORY_NODE_TYPES,
        )
        .optional()
        .default('warehouse'),

      address:
        addressSchema
          .optional()
          .default({}),
    })
    .strict()

export const updateInventoryNodeSchema =
  z
    .object({
      name: z
        .string()
        .trim()
        .min(1)
        .max(220)
        .optional(),

      nodeType: z
        .enum(
          MARKETPLACE_INVENTORY_NODE_TYPES,
        )
        .optional(),

      status: z
        .enum(
          MARKETPLACE_INVENTORY_NODE_STATUSES,
        )
        .optional(),

      address:
        addressSchema
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
          'At least one Inventory Node field is required.',
      },
    )

export const listInventoryNodesQuerySchema =
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
          ...MARKETPLACE_INVENTORY_NODE_STATUSES,
        ])
        .optional()
        .default('all'),

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
| Inventory Snapshot
|--------------------------------------------------------------------------
|
| Snapshot input never accepts:
|
| organizationId
| hostId
| sellerId
| price
|
| Tenant authority is always resolved by backend.
|--------------------------------------------------------------------------
*/

const inventorySnapshotInputSchema =
  z
    .object({
      offerId:
        marketplaceObjectIdSchema,

      inventoryNodeId:
        marketplaceObjectIdSchema,

      availableQuantity: z
        .number()
        .int()
        .min(0)
        .max(1000000000),

      reservedQuantity: z
        .number()
        .int()
        .min(0)
        .max(1000000000)
        .optional()
        .default(0),

      sourceType: z
        .enum(
          MARKETPLACE_INVENTORY_SOURCE_TYPES,
        )
        .optional()
        .default('manual'),

      sourceReference: z
        .string()
        .trim()
        .max(250)
        .optional()
        .default(''),

      observedAt: z
        .string()
        .trim()
        .datetime({
          offset:
            true,
        })
        .optional(),
    })
    .strict()
    .refine(
      (value) =>
        value.reservedQuantity <=
        value.availableQuantity,
      {
        message:
          'Reserved quantity cannot exceed available quantity.',
      },
    )

export const bulkInventorySnapshotSchema =
  z
    .object({
      items: z
        .array(
          inventorySnapshotInputSchema,
        )
        .min(1)
        .max(250),
    })
    .strict()
    .superRefine(
      (
        value,
        ctx,
      ) => {
        const pairs =
          new Set()

        value.items.forEach(
          (
            item,
            index,
          ) => {
            const key =
              `${item.offerId}:${item.inventoryNodeId}`

            if (
              pairs.has(
                key,
              )
            ) {
              ctx.addIssue({
                code:
                  z.ZodIssueCode.custom,

                path: [
                  'items',
                  index,
                ],

                message:
                  'Bulk inventory contains duplicate Offer and Inventory Node pair.',
              })

              return
            }

            pairs.add(
              key,
            )
          },
        )
      },
    )

/*
|--------------------------------------------------------------------------
| Inventory History
|--------------------------------------------------------------------------
*/

export const listInventoryHistoryQuerySchema =
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

      inventoryNodeId:
        marketplaceObjectIdSchema
          .optional(),
    })
    .strict()

/*
|--------------------------------------------------------------------------
| Current Inventory / Freshness
|--------------------------------------------------------------------------
|
| maxAgeSeconds is explicit.
|
| If omitted, the API reports age but does not guess whether data is stale.
|--------------------------------------------------------------------------
*/

export const currentInventoryQuerySchema =
  z
    .object({
      maxAgeSeconds: z.coerce
        .number()
        .int()
        .min(1)
        .max(604800)
        .optional(),
    })
    .strict()