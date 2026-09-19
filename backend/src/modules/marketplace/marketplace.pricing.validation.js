import { z } from 'zod'

import {
  MARKETPLACE_CURRENCIES,
} from './marketplace.constants.js'

const priceSourceTypes =
  Object.freeze([
    'manual',
    'bulk_import',
    'erp',
    'pos',
    'external_api',
  ])

const moneySchema =
  z
    .object({
      amountMinor: z
        .number()
        .int()
        .min(0)
        .max(999999999999),

      currency: z
        .enum(
          MARKETPLACE_CURRENCIES,
        )
        .default('INR'),
    })
    .strict()

const optionalIsoDateSchema =
  z
    .string()
    .trim()
    .datetime({
      offset:
        true,
    })
    .nullable()
    .optional()
    .default(null)

/*
|--------------------------------------------------------------------------
| Create Effective-dated Price Rule
|--------------------------------------------------------------------------
|
| Price changes are append-only.
|
| Existing rules are not edited through the Host API.
|--------------------------------------------------------------------------
*/

export const createHostPriceRuleSchema =
  z
    .object({
      listPrice:
        moneySchema,

      salePrice:
        moneySchema
          .nullable()
          .optional()
          .default(null),

      effectiveFrom: z
        .string()
        .trim()
        .datetime({
          offset:
            true,
        }),

      effectiveTo:
        optionalIsoDateSchema,

      source: z
        .enum(
          priceSourceTypes,
        )
        .optional()
        .default('manual'),

      changeReason: z
        .string()
        .trim()
        .min(3)
        .max(2000),
    })
    .strict()
    .superRefine(
      (
        value,
        ctx,
      ) => {
        if (
          value.salePrice &&
          value.salePrice.currency !==
            value.listPrice.currency
        ) {
          ctx.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'salePrice',
              'currency',
            ],

            message:
              'Sale price currency must match list price currency.',
          })
        }

        if (
          value.salePrice &&
          value.salePrice.amountMinor >
            value.listPrice.amountMinor
        ) {
          ctx.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'salePrice',
              'amountMinor',
            ],

            message:
              'Sale price cannot exceed list price.',
          })
        }

        if (
          value.effectiveTo &&
          new Date(
            value.effectiveTo,
          ) <=
            new Date(
              value.effectiveFrom,
            )
        ) {
          ctx.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'effectiveTo',
            ],

            message:
              'effectiveTo must be later than effectiveFrom.',
          })
        }
      },
    )

/*
|--------------------------------------------------------------------------
| Price History
|--------------------------------------------------------------------------
*/

export const listHostPriceRulesQuerySchema =
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
    })
    .strict()

/*
|--------------------------------------------------------------------------
| Effective Price Resolver
|--------------------------------------------------------------------------
*/

export const effectiveHostPriceQuerySchema =
  z
    .object({
      at: z
        .string()
        .trim()
        .datetime({
          offset:
            true,
        })
        .optional(),
    })
    .strict()