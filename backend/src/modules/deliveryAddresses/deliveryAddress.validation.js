import {
  z,
} from 'zod'

import {
  DELIVERY_ADDRESS_LABELS,
  DELIVERY_ADDRESS_RECIPIENT_TYPES,
  DELIVERY_ADDRESS_SOURCES,
} from './deliveryAddress.models.js'

const phoneSchema =
  z
    .string()
    .trim()
    .min(
      8,
      'Enter a valid recipient phone number.',
    )
    .max(
      18,
      'Recipient phone number is too long.',
    )
    .refine(
      (value) =>
        /^\+?[0-9][0-9\s-]{6,16}[0-9]$/.test(
          value,
        ),
      'Enter a valid recipient phone number.',
    )

const postalCodeSchema =
  z
    .string()
    .trim()
    .regex(
      /^\d{6}$/,
      'Pincode must contain exactly 6 digits.',
    )


export const createDeliveryAddressSchema =
  z
    .object({
      recipientType:
        z.enum(
          DELIVERY_ADDRESS_RECIPIENT_TYPES,
        ),

      recipientName:
        z
          .string()
          .trim()
          .min(
            2,
            'Recipient name is required.',
          )
          .max(
            80,
          ),

      phone:
        phoneSchema,

      label:
        z.enum(
          DELIVERY_ADDRESS_LABELS,
        ),

      customLabel:
        z
          .string()
          .trim()
          .max(
            40,
          )
          .optional()
          .default(''),

      addressLine1:
        z
          .string()
          .trim()
          .min(
            3,
            'House, flat, building, or street address is required.',
          )
          .max(
            160,
          ),

      addressLine2:
        z
          .string()
          .trim()
          .max(
            160,
          )
          .optional()
          .default(''),

      area:
        z
          .string()
          .trim()
          .min(
            2,
            'Area or locality is required.',
          )
          .max(
            120,
          ),

      landmark:
        z
          .string()
          .trim()
          .max(
            120,
          )
          .optional()
          .default(''),

      city:
        z
          .string()
          .trim()
          .min(
            2,
            'City is required.',
          )
          .max(
            100,
          ),

      state:
        z
          .string()
          .trim()
          .min(
            2,
            'State is required.',
          )
          .max(
            100,
          ),

      postalCode:
        postalCodeSchema,

      country:
        z
          .string()
          .trim()
          .min(
            2,
            'Country is required.',
          )
          .max(
            100,
          ),

      deliveryInstructions:
        z
          .string()
          .trim()
          .max(
            240,
          )
          .optional()
          .default(''),

      source:
        z
          .enum(
            DELIVERY_ADDRESS_SOURCES,
          )
          .optional()
          .default(
            'manual',
          ),

      isDefault:
        z
          .boolean()
          .optional()
          .default(
            true,
          ),
    })
    .strict()
    .superRefine(
      (
        value,
        ctx,
      ) => {
        if (
          value.label ===
            'other' &&
          !value.customLabel
        ) {
          ctx.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'customLabel',
            ],

            message:
              'Enter a label for this address.',
          })
        }
      },
    )

export const updateDeliveryAddressSchema =
  createDeliveryAddressSchema

export const deliveryAddressIdParamsSchema =
  z
    .object({
      id:
        z
          .string()
          .trim()
          .regex(
            /^[a-fA-F0-9]{24}$/,
            'A valid delivery address ID is required.',
          ),
    })
    .strict()
