import {
  z,
} from 'zod'

const objectIdPattern =
  /^[a-fA-F0-9]{24}$/

export const publicBrandKeyParamsSchema =
  z
    .object({
      brandKey:
        z
          .string()
          .trim()
          .min(
            1,
          )
          .max(
            220,
          ),
    })
    .strict()

export const publicBrandHistoryParamsSchema =
  z
    .object({
      brandKey:
        z
          .string()
          .trim()
          .min(
            1,
          )
          .max(
            220,
          ),

      packId:
        z
          .string()
          .trim()
          .regex(
            objectIdPattern,
            'A valid Pack ObjectId is required.',
          ),
    })
    .strict()

export const listPublicBrandsQuerySchema =
  z
    .object({
      page:
        z.coerce
          .number()
          .int()
          .min(
            1,
          )
          .default(
            1,
          ),

      limit:
        z.coerce
          .number()
          .int()
          .min(
            1,
          )
          .max(
            100,
          )
          .default(
            24,
          ),

      search:
        z
          .string()
          .trim()
          .max(
            160,
          )
          .optional()
          .default(
            '',
          ),
    })
    .strict()