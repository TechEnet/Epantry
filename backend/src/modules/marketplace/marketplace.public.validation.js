import { z } from 'zod'

import {
  MARKETPLACE_FULFILLMENT_TYPES,
} from './marketplace.constants.js'

import {
  marketplaceObjectIdSchema,
} from './marketplace.host.validation.js'

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

export const publicPackOffersParamsSchema =
  z
    .object({
      packId:
        marketplaceObjectIdSchema,
    })
    .strict()

export const publicPackOffersQuerySchema =
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