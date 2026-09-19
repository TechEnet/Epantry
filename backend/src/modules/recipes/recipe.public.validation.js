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

function parseIngredientIds(
  value,
) {
  const raw =
    Array.isArray(
      value,
    )
      ? value
      : [
          value,
        ]

  return raw
    .flatMap(
      (
        item,
      ) =>
        String(
          item ||
            '',
        )
          .split(
            ',',
          ),
    )
    .map(
      (
        item,
      ) =>
        item.trim(),
    )
    .filter(
      Boolean,
    )
}

export const listPublicRecipesQuerySchema =
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
            50,
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

      cuisine:
        z
          .string()
          .trim()
          .max(
            120,
          )
          .optional()
          .default(
            '',
          ),

      course:
        z
          .string()
          .trim()
          .max(
            120,
          )
          .optional()
          .default(
            '',
          ),

      tag:
        z
          .string()
          .trim()
          .max(
            80,
          )
          .optional()
          .default(
            '',
          ),
    })
    .strict()

export const publicRecipeSlugParamsSchema =
  z
    .object({
      slug:
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

export const publicRecipeHistoryQuerySchema =
  z
    .object({
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
            50,
          ),
    })
    .strict()

export const publicRecipeScaleQuerySchema =
  z
    .object({
      servings:
        z.coerce
          .number()
          .positive()
          .max(
            1000,
          ),
    })
    .strict()

export const whatShouldWeCookQuerySchema =
  z
    .object({
      ingredientIds:
        z.preprocess(
          parseIngredientIds,

          z
            .array(
              objectIdSchema,
            )
            .min(
              1,
            )
            .max(
              100,
            ),
        ),

      limit:
        z.coerce
          .number()
          .int()
          .min(
            1,
          )
          .max(
            50,
          )
          .default(
            12,
          ),
    })
    .strict()
export const aiCookBodySchema =
  z
    .discriminatedUnion(
      'action',
      [
        z
          .object({
            action:
              z.literal(
                'suggestions',
              ),

            ingredients:
              z
                .string()
                .trim()
                .min(
                  2,
                  'Tell EPANTRY at least one ingredient you have.',
                )
                .max(
                  1200,
                  'Ingredient input is too long.',
                ),
          })
          .strict(),

        z
          .object({
            action:
              z.literal(
                'recipe',
              ),

            ingredients:
              z
                .string()
                .trim()
                .min(
                  2,
                  'Tell EPANTRY at least one ingredient you have.',
                )
                .max(
                  1200,
                  'Ingredient input is too long.',
                ),

            dishName:
              z
                .string()
                .trim()
                .min(
                  1,
                  'A dish name is required.',
                )
                .max(
                  100,
                  'Dish name is too long.',
                ),
          })
          .strict(),
      ],
    )
