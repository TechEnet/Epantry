import {
  z,
} from 'zod'

const objectIdPattern =
  /^[a-fA-F0-9]{24}$/

const objectIdSchema =
  z
    .string()
    .trim()
    .regex(
      objectIdPattern,
      'A valid MongoDB ObjectId is required.',
    )

const reasonSchema =
  z
    .string()
    .trim()
    .min(
      1,
    )
    .max(
      2000,
    )

export const recipeGovernanceVersionIdParamsSchema =
  z
    .object({
      versionId:
        objectIdSchema,
    })
    .strict()

export const recipeGovernanceDishIdParamsSchema =
  z
    .object({
      dishId:
        objectIdSchema,
    })
    .strict()

export const submitRecipeForReviewSchema =
  z
    .object({
      reason:
        reasonSchema,
    })
    .strict()

export const reviewRecipeVersionSchema =
  z
    .object({
      reviewType:
        z.enum([
          'editorial',
          'qa',
          'safety',
        ]),

      decision:
        z.enum([
          'approved',
          'changes_requested',
          'rejected',
        ]),

      reason:
        reasonSchema,
    })
    .strict()

export const publishRecipeVersionSchema =
  z
    .object({
      reason:
        reasonSchema,

      effectiveFrom:
        z.coerce
          .date()
          .optional(),
    })
    .strict()

export const changeRecipeVersionLifecycleSchema =
  z
    .object({
      action:
        z.enum([
          'disable',
          'retire',
        ]),

      reason:
        reasonSchema,
    })
    .strict()

export const changeDishLifecycleSchema =
  z
    .object({
      action:
        z.enum([
          'disable',
          'restore',
          'retire',
        ]),

      reason:
        reasonSchema,
    })
    .strict()