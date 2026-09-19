import {
  z,
} from 'zod'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  getRecipePantryReconciliation,
} from '../pantry/pantry.recipe.service.js'

import {
  getPublicRecipe,
  scalePublicRecipe,
} from '../recipes/recipe.public.service.js'

import {
  createSmartSearch,
  explainSearchDecision,
  refineSmartSearch,
} from './search.service.js'

const COPILOT_MODES =
  Object.freeze([
    'all',
    'recipe',
    'product',
    'ingredient',
    'brand',
  ])

const SEARCH_RESULT_TYPES =
  Object.freeze([
    'recipe',
    'product',
    'ingredient',
    'brand',
  ])

const SUSPICIOUS_ARGUMENT_PATTERNS =
  Object.freeze([
    /https?:\/\//i,
    /\bmongodb\b/i,
    /\b(?:system|developer)\s+prompt\b/i,
    /\bignore\s+(?:all\s+)?(?:previous|prior)\b/i,
    /\bapi[_ -]?key\b/i,
    /\bsecret\b/i,
    /\bpassword\b/i,
    /\b__proto__\b/i,
    /\bconstructor\b/i,
    /\$where\b/i,
    /<script/i,
  ])

const searchToolSchema =
  z
    .object({
      query:
        z
          .string()
          .trim()
          .min(
            2,
          )
          .max(
            500,
          ),

      mode:
        z
          .enum(
            COPILOT_MODES,
          )
          .default(
            'all',
          ),
    })
    .strict()

const refineToolSchema =
  z
    .object({
      refinement:
        z
          .string()
          .trim()
          .min(
            1,
          )
          .max(
            300,
          ),

      mode:
        z
          .enum(
            COPILOT_MODES,
          )
          .optional(),
    })
    .strict()

const recipeToolSchema =
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
            160,
          ),
    })
    .strict()

const scaleRecipeToolSchema =
  recipeToolSchema
    .extend({
      servings:
        z
          .number()
          .int()
          .min(
            1,
          )
          .max(
            100,
          ),
    })
    .strict()

const pantryRecipeToolSchema =
  z
    .object({
      recipeId:
        z
          .string()
          .trim()
          .min(
            1,
          )
          .max(
            160,
          ),

      servings:
        z
          .number()
          .int()
          .min(
            1,
          )
          .max(
            100,
          ),
    })
    .strict()

const explainToolSchema =
  z
    .object({
      candidateType:
        z.enum(
          SEARCH_RESULT_TYPES,
        ),

      candidateId:
        z
          .string()
          .trim()
          .min(
            1,
          )
          .max(
            160,
          ),
    })
    .strict()

export const COPILOT_TOOL_DEFINITIONS =
  Object.freeze([
    {
      type:
        'function',

      function: {
        name:
          'search_epantry',

        description:
          'Run deterministic EPANTRY Smart Search. Use this for Recipe, Product, Ingredient or Brand discovery and for food-intent queries.',

        parameters: {
          type:
            'object',

          additionalProperties:
            false,

          properties: {
            query: {
              type:
                'string',

              description:
                'The user food-search intent in natural language.',
            },

            mode: {
              type:
                'string',

              enum:
                COPILOT_MODES,
            },
          },

          required: [
            'query',
          ],
        },
      },
    },

    {
      type:
        'function',

      function: {
        name:
          'refine_search',

        description:
          'Refine the current deterministic Smart Search session. Use for follow-ups such as quicker, less spicy, use my pantry, or one retailer only.',

        parameters: {
          type:
            'object',

          additionalProperties:
            false,

          properties: {
            refinement: {
              type:
                'string',
            },

            mode: {
              type:
                'string',

              enum:
                COPILOT_MODES,
            },
          },

          required: [
            'refinement',
          ],
        },
      },
    },

    {
      type:
        'function',

      function: {
        name:
          'get_recipe',

        description:
          'Load a published EPANTRY Recipe by its slug. Use only after a known Recipe slug is available from Search or the user.',

        parameters: {
          type:
            'object',

          additionalProperties:
            false,

          properties: {
            slug: {
              type:
                'string',
            },
          },

          required: [
            'slug',
          ],
        },
      },
    },

    {
      type:
        'function',

      function: {
        name:
          'scale_recipe',

        description:
          'Deterministically scale a published Recipe for a requested serving count. Never calculate Recipe quantities yourself.',

        parameters: {
          type:
            'object',

          additionalProperties:
            false,

          properties: {
            slug: {
              type:
                'string',
            },

            servings: {
              type:
                'integer',

              minimum:
                1,

              maximum:
                100,
            },
          },

          required: [
            'slug',
            'servings',
          ],
        },
      },
    },

    {
      type:
        'function',

      function: {
        name:
          'get_recipe_pantry_state',

        description:
          'For an authenticated Customer, compare a published Recipe requirement against the Customer Household Pantry. Pantry ownership is server-derived.',

        parameters: {
          type:
            'object',

          additionalProperties:
            false,

          properties: {
            recipeId: {
              type:
                'string',
            },

            servings: {
              type:
                'integer',

              minimum:
                1,

              maximum:
                100,
            },
          },

          required: [
            'recipeId',
            'servings',
          ],
        },
      },
    },

    {
      type:
        'function',

      function: {
        name:
          'explain_search_result',

        description:
          'Explain a result from the active deterministic Smart Search session using recorded ranking reason codes.',

        parameters: {
          type:
            'object',

          additionalProperties:
            false,

          properties: {
            candidateType: {
              type:
                'string',

              enum:
                SEARCH_RESULT_TYPES,
            },

            candidateId: {
              type:
                'string',
            },
          },

          required: [
            'candidateType',
            'candidateId',
          ],
        },
      },
    },
  ])

const TOOL_SCHEMAS =
  Object.freeze({
    search_epantry:
      searchToolSchema,

    refine_search:
      refineToolSchema,

    get_recipe:
      recipeToolSchema,

    scale_recipe:
      scaleRecipeToolSchema,

    get_recipe_pantry_state:
      pantryRecipeToolSchema,

    explain_search_result:
      explainToolSchema,
  })

export const COPILOT_TOOL_NAMES =
  Object.freeze(
    Object.keys(
      TOOL_SCHEMAS,
    ),
  )

function validateStringArguments(
  value,
) {
  const serialized =
    JSON.stringify(
      value,
    )

  for (
    const pattern
    of SUSPICIOUS_ARGUMENT_PATTERNS
  ) {
    if (
      pattern.test(
        serialized,
      )
    ) {
      throw new ApiError(
        400,
        'Copilot tool arguments were rejected by the safety boundary.',
        [
          {
            code:
              'COPILOT_TOOL_ARGUMENT_REJECTED',
          },
        ],
      )
    }
  }
}

function parseToolArguments(
  toolName,
  rawArguments,
) {
  const schema =
    TOOL_SCHEMAS[
      toolName
    ]

  if (
    !schema
  ) {
    throw new ApiError(
      400,
      'Copilot requested a tool that is not allowlisted.',
      [
        {
          code:
            'COPILOT_TOOL_NOT_ALLOWED',
        },
      ],
    )
  }

  let parsed

  try {
    parsed =
      JSON.parse(
        String(
          rawArguments ||
            '{}',
        ),
      )
  } catch {
    throw new ApiError(
      400,
      'Copilot returned invalid tool arguments.',
      [
        {
          code:
            'COPILOT_TOOL_ARGUMENTS_INVALID_JSON',
        },
      ],
    )
  }

  validateStringArguments(
    parsed,
  )

  const result =
    schema.safeParse(
      parsed,
    )

  if (
    !result.success
  ) {
    throw new ApiError(
      400,
      result.error
        .issues[0]
        ?.message ||
        'Copilot tool arguments are invalid.',
      [
        {
          code:
            'COPILOT_TOOL_ARGUMENTS_INVALID',

          toolName,
        },
      ],
    )
  }

  return result.data
}

function requireCustomerActor(
  context,
) {
  if (
    context?.actorContext
      ?.actorType !==
      'customer' ||
    !context?.actorContext
      ?.currentUser
  ) {
    throw new ApiError(
      403,
      'This Copilot tool requires Customer access.',
      [
        {
          code:
            'COPILOT_CUSTOMER_REQUIRED',
        },
      ],
    )
  }

  return context
    .actorContext
    .currentUser
}

function requireActiveSearchSession(
  context,
) {
  if (
    !context?.searchSession?.id ||
    !context?.searchSession?.token
  ) {
    throw new ApiError(
      400,
      'A current Smart Search session is required for this Copilot action.',
      [
        {
          code:
            'COPILOT_SEARCH_SESSION_REQUIRED',
        },
      ],
    )
  }

  return context.searchSession
}

function buildRecipeSourceCard(
  recipe,
) {
  return {
    type:
      'recipe',

    id:
      recipe?.recipe?.id ||
      recipe?.dish?.id ||
      null,

    title:
      recipe?.dish?.name ||
      recipe?.dish?.title ||
      recipe?.recipe?.title ||
      'Recipe',

    path:
      recipe?.dish?.slug
        ? `/recipes/${recipe.dish.slug}`
        : null,
  }
}

export async function executeCopilotToolCall({
  toolName,
  rawArguments,
  context,
}) {
  if (
    !COPILOT_TOOL_NAMES.includes(
      toolName,
    )
  ) {
    throw new ApiError(
      400,
      'Copilot requested a tool that is not allowlisted.',
      [
        {
          code:
            'COPILOT_TOOL_NOT_ALLOWED',
        },
      ],
    )
  }

  const input =
    parseToolArguments(
      toolName,
      rawArguments,
    )

  switch (
    toolName
  ) {
    case 'search_epantry': {
      const result =
        await createSmartSearch({
          query:
            input.query,

          mode:
            input.mode,

          actorContext:
            context.actorContext,
        })

      return {
        toolName,

        result,

        nextSearchSession:
          result?.session ||
          null,

        sourceCards:
          (
            result?.results ||
            []
          )
            .slice(
              0,
              8,
            )
            .map(
              (
                item,
              ) => ({
                type:
                  item.type,

                id:
                  item.id,

                title:
                  item.displayName,

                path:
                  item.path ||
                  null,

                subtitle:
                  item.subtitle ||
                  null,

                reasonCodes:
                  item.reasonCodes ||
                  [],
              }),
            ),
      }
    }

    case 'refine_search': {
      const searchSession =
        requireActiveSearchSession(
          context,
        )

      const result =
        await refineSmartSearch({
          sessionId:
            searchSession.id,

          sessionToken:
            searchSession.token,

          refinement:
            input.refinement,

          mode:
            input.mode,

          actorContext:
            context.actorContext,
        })

      return {
        toolName,

        result,

        nextSearchSession:
          result?.session ||
          searchSession,

        sourceCards:
          (
            result?.results ||
            []
          )
            .slice(
              0,
              8,
            )
            .map(
              (
                item,
              ) => ({
                type:
                  item.type,

                id:
                  item.id,

                title:
                  item.displayName,

                path:
                  item.path ||
                  null,

                subtitle:
                  item.subtitle ||
                  null,

                reasonCodes:
                  item.reasonCodes ||
                  [],
              }),
            ),
      }
    }

    case 'get_recipe': {
      const result =
        await getPublicRecipe(
          input.slug,
        )

      return {
        toolName,

        result,

        sourceCards: [
          buildRecipeSourceCard(
            result,
          ),
        ],
      }
    }

    case 'scale_recipe': {
      const result =
        await scalePublicRecipe(
          input.slug,
          input.servings,
        )

      return {
        toolName,

        result,

        sourceCards: [
          {
            type:
              'recipe_scale',

            id:
              result?.recipe?.id ||
              result?.dish?.id ||
              input.slug,

            title:
              result?.dish?.name ||
              result?.dish?.title ||
              result?.recipe?.title ||
              input.slug,

            subtitle:
              `Scaled for ${input.servings} servings`,

            path:
              result?.dish?.slug
                ? `/recipes/${result.dish.slug}`
                : `/recipes/${input.slug}`,
          },
        ],
      }
    }

    case 'get_recipe_pantry_state': {
      const actorUser =
        requireCustomerActor(
          context,
        )

      const result =
        await getRecipePantryReconciliation({
          recipeId:
            input.recipeId,

          targetServings:
            input.servings,

          actorUser,
        })

      return {
        toolName,

        result,

        sourceCards: [
          {
            type:
              'pantry_recipe',

            id:
              result?.recipeVersion?.id ||
              input.recipeId,

            title:
              result?.dish?.title ||
              'Recipe Pantry check',

            subtitle:
              `Household Pantry reconciliation for ${input.servings} servings`,

            path:
              result?.dish?.slug
                ? `/recipes/${result.dish.slug}`
                : null,
          },
        ],
      }
    }

    case 'explain_search_result': {
      const searchSession =
        requireActiveSearchSession(
          context,
        )

      const result =
        await explainSearchDecision({
          sessionId:
            searchSession.id,

          sessionToken:
            searchSession.token,

          candidateType:
            input.candidateType,

          candidateId:
            input.candidateId,

          actorContext:
            context.actorContext,
        })

      return {
        toolName,

        result,

        sourceCards: [
          {
            type:
              input.candidateType,

            id:
              input.candidateId,

            title:
              result?.candidate
                ?.displayName ||
              'Search result',

            path:
              result?.candidate
                ?.path ||
              null,

            reasonCodes:
              (
                result?.reasons ||
                []
              ).map(
                (
                  reason,
                ) =>
                  reason.code,
              ),
          },
        ],
      }
    }

    default:
      throw new ApiError(
        400,
        'Copilot requested an unsupported tool.',
        [
          {
            code:
              'COPILOT_TOOL_NOT_SUPPORTED',
          },
        ],
      )
  }
}