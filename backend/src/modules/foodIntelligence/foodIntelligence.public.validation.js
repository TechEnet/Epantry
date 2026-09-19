import {
  z,
} from 'zod'

/*
|--------------------------------------------------------------------------
| Mongo Object ID
|--------------------------------------------------------------------------
*/

const objectIdSchema =
  z
    .string()
    .trim()
    .regex(
      /^[a-fA-F0-9]{24}$/,
      'A valid canonical MongoDB ID is required.',
    )

/*
|--------------------------------------------------------------------------
| Product Food Intelligence
|--------------------------------------------------------------------------
*/

export const productFoodIntelligenceParamsSchema =
  z.object({
    id:
      objectIdSchema,
  })

/*
|--------------------------------------------------------------------------
| Recipe Food Intelligence
|--------------------------------------------------------------------------
*/

export const recipeFoodIntelligenceParamsSchema =
  z.object({
    id:
      objectIdSchema,
  })