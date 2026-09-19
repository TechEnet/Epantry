import { z } from 'zod'

import {
  HOST_SERVICE_ACCOUNT_SCOPES,
  HOST_WEBHOOK_EVENT_TYPES,
} from './hostOperations.integration.models.js'

const objectIdSchema =
  z
    .string()
    .trim()
    .regex(
      /^[a-f\d]{24}$/i,
      'A valid MongoDB ObjectId is required.',
    )

export const serviceAccountIdParamsSchema =
  z
    .object({
      id:
        objectIdSchema,
    })
    .strict()

export const webhookIdParamsSchema =
  z
    .object({
      id:
        objectIdSchema,
    })
    .strict()

export const createServiceAccountSchema =
  z
    .object({
      name:
        z
          .string()
          .trim()
          .min(2)
          .max(160),

      description:
        z
          .string()
          .trim()
          .max(1000)
          .optional()
          .default(''),

      scopes:
        z
          .array(
            z.enum(
              HOST_SERVICE_ACCOUNT_SCOPES,
            ),
          )
          .min(1)
          .max(
            HOST_SERVICE_ACCOUNT_SCOPES.length,
          ),
    })
    .strict()

export const updateServiceAccountSchema =
  z
    .object({
      status:
        z
          .enum([
            'active',
            'disabled',
          ])
          .optional(),

      description:
        z
          .string()
          .trim()
          .max(1000)
          .optional(),

      scopes:
        z
          .array(
            z.enum(
              HOST_SERVICE_ACCOUNT_SCOPES,
            ),
          )
          .min(1)
          .max(
            HOST_SERVICE_ACCOUNT_SCOPES.length,
          )
          .optional(),
    })
    .strict()
    .refine(
      (value) =>
        Object.keys(value).length >
        0,
      'At least one Service Account field is required.',
    )

export const createWebhookSchema =
  z
    .object({
      name:
        z
          .string()
          .trim()
          .min(2)
          .max(160),

      endpointUrl:
        z
          .string()
          .trim()
          .url()
          .max(1500),

      eventTypes:
        z
          .array(
            z.enum(
              HOST_WEBHOOK_EVENT_TYPES,
            ),
          )
          .min(1)
          .max(
            HOST_WEBHOOK_EVENT_TYPES.length,
          ),
    })
    .strict()

export const updateWebhookSchema =
  z
    .object({
      name:
        z
          .string()
          .trim()
          .min(2)
          .max(160)
          .optional(),

      endpointUrl:
        z
          .string()
          .trim()
          .url()
          .max(1500)
          .optional(),

      eventTypes:
        z
          .array(
            z.enum(
              HOST_WEBHOOK_EVENT_TYPES,
            ),
          )
          .min(1)
          .max(
            HOST_WEBHOOK_EVENT_TYPES.length,
          )
          .optional(),

      status:
        z
          .enum([
            'active',
            'disabled',
          ])
          .optional(),
    })
    .strict()
    .refine(
      (value) =>
        Object.keys(value).length >
        0,
      'At least one webhook field is required.',
    )

export const integrationListQuerySchema =
  z
    .object({
      page:
        z.coerce
          .number()
          .int()
          .min(1)
          .default(1),

      limit:
        z.coerce
          .number()
          .int()
          .min(1)
          .max(100)
          .default(25),
    })
    .strict()