import {
  z,
} from 'zod'

export const updateNotificationPreferencesBodySchema = z
  .object({
    inAppEnabled:
      z
        .boolean()
        .optional(),

    emailEnabled:
      z
        .boolean()
        .optional(),

    smsEnabled:
      z
        .boolean()
        .optional(),

    whatsappEnabled:
      z
        .boolean()
        .optional(),

    planningEnabled:
      z
        .boolean()
        .optional(),

    pantryEnabled:
      z
        .boolean()
        .optional(),

    householdEnabled:
      z
        .boolean()
        .optional(),

    orderEnabled:
      z
        .boolean()
        .optional(),

    priceEnabled:
      z
        .boolean()
        .optional(),

    classEnabled:
      z
        .boolean()
        .optional(),

    marketingEnabled:
      z
        .boolean()
        .optional(),

    operationsEnabled:
      z
        .boolean()
        .optional(),

    quietHours:
      z
        .object({
          enabled:
            z.boolean(),

          startLocalHour:
            z
              .number()
              .int()
              .min(0)
              .max(23),

          endLocalHour:
            z
              .number()
              .int()
              .min(0)
              .max(23),

          timezone:
            z
              .string()
              .trim()
              .min(3)
              .max(80),
        })
        .strict()
        .optional(),
  })
  .strict()
  .refine(
    (value) =>
      Object.keys(value).length >
      0,
    'At least one notification preference must change.',
  )

export const notificationListQuerySchema = z
  .object({
    limit:
      z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .default(40),

    status:
      z
        .enum([
          'pending',
          'delivered',
          'read',
          'dismissed',
          'snoozed',
          'action_required_domain',
          'cancelled',
        ])
        .optional(),
  })
  .strict()

export const notificationIdParamsSchema = z
  .object({
    id:
      z
        .string()
        .trim()
        .regex(
          /^[a-f\d]{24}$/i,
          'A valid Notification ObjectId is required.',
        ),
  })
  .strict()

export const notificationActionBodySchema = z
  .object({
    action:
      z.enum([
        'accept',
        'dismiss',
        'snooze',
        'still_have',
        'bought_elsewhere',
        'stop_suggesting',
      ]),

    snoozeUntil:
      z.coerce
        .date()
        .nullable()
        .optional()
        .default(null),
  })
  .strict()
  .superRefine(
    (
      value,
      context,
    ) => {
      if (
        value.action ===
          'snooze' &&
        !value.snoozeUntil
      ) {
        context.addIssue({
          code:
            z.ZodIssueCode.custom,
          path: [
            'snoozeUntil',
          ],
          message:
            'snoozeUntil is required for snooze.',
        })
      }
    },
  )

export const availabilityWatchBodySchema = z
  .object({
    query:
      z
        .string()
        .trim()
        .min(2)
        .max(180),

    canonicalIngredientId:
      z
        .string()
        .trim()
        .regex(
          /^[a-f\d]{24}$/i,
          'A valid Canonical Ingredient ObjectId is required.',
        )
        .nullable()
        .optional()
        .default(null),

    packId:
      z
        .string()
        .trim()
        .regex(
          /^[a-f\d]{24}$/i,
          'A valid Pack ObjectId is required.',
        )
        .nullable()
        .optional()
        .default(null),

    source:
      z
        .enum([
          'search',
          'recipe',
          'product',
        ])
        .default('search'),
  })
  .strict()
