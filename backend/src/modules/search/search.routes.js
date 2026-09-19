import {
  rateLimit,
} from 'express-rate-limit'

import {
  Router,
} from 'express'

import {
  z,
} from 'zod'

import {
  env,
} from '../../config/env.js'

import {
  sensitiveResponseNoStoreMiddleware,
} from '../../middlewares/security.middleware.js'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  ApiResponse,
} from '../../utils/ApiResponse.js'

import {
  getFirebaseAuthAssurance,
  getSessionCookieOptions,
  verifyFirebaseSession,
} from '../auth/auth.service.js'

import {
  userHasAnyAccess,
} from '../auth/authorization.middleware.js'

import {
  assertSessionEligibleAccount,
  requireUserByFirebaseUid,
} from '../users/user.service.js'

import {
  SEARCH_RESULT_MODES,
  SEARCH_RESULT_TYPES,
} from './search.models.js'

import {
  sendFoodCopilotMessage,
} from './search.copilot.service.js'

import {
  createSmartSearch,
  explainSearchDecision,
  refineSmartSearch,
} from './search.service.js'

const objectIdSchema =
  z
    .string()
    .regex(
      /^[a-f\d]{24}$/i,
      'A valid MongoDB ObjectId is required.',
    )

const sessionTokenSchema =
  z
    .string()
    .trim()
    .min(
      20,
      'Search session token is invalid.',
    )
    .max(
      200,
      'Search session token is invalid.',
    )

export const smartSearchBodySchema =
  z
    .object({
      query:
        z
          .string()
          .trim()
          .min(
            2,
            'Search query must contain at least 2 characters.',
          )
          .max(
            500,
            'Search query cannot exceed 500 characters.',
          ),

      mode:
        z
          .enum(
            SEARCH_RESULT_MODES,
          )
          .default(
            'all',
          ),
    })
    .strict()

export const searchRefineBodySchema =
  z
    .object({
      sessionId:
        objectIdSchema,

      sessionToken:
        sessionTokenSchema,

      refinement:
        z
          .string()
          .trim()
          .min(
            1,
            'A refinement is required.',
          )
          .max(
            300,
            'Search refinement cannot exceed 300 characters.',
          ),

      mode:
        z
          .enum(
            SEARCH_RESULT_MODES,
          )
          .optional(),
    })
    .strict()

export const decisionExplainBodySchema =
  z
    .object({
      sessionId:
        objectIdSchema,

      sessionToken:
        sessionTokenSchema,

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

const copilotHistoryMessageSchema =
  z
    .object({
      role:
        z.enum([
          'user',
          'assistant',
        ]),

      content:
        z
          .string()
          .trim()
          .min(
            1,
          )
          .max(
            1500,
          ),
    })
    .strict()

const copilotSearchSessionSchema =
  z
    .object({
      id:
        objectIdSchema,

      token:
        sessionTokenSchema,
    })
    .strict()

export const copilotMessageBodySchema =
  z
    .object({
      message:
        z
          .string()
          .trim()
          .min(
            1,
            'A Copilot message is required.',
          )
          .max(
            1500,
            'Copilot message cannot exceed 1500 characters.',
          ),

      history:
        z
          .array(
            copilotHistoryMessageSchema,
          )
          .max(
            8,
            'Copilot history is limited to the latest 8 messages.',
          )
          .default(
            [],
          ),

      searchSession:
        copilotSearchSessionSchema
          .nullable()
          .optional(),
    })
    .strict()

function getPositiveInteger(
  value,
  fallback,
) {
  const parsed =
    Number(
      value,
    )

  return Number.isInteger(
    parsed,
  ) &&
    parsed >
      0
    ? parsed
    : fallback
}

const copilotRateLimiter =
  rateLimit({
    windowMs:
      getPositiveInteger(
        process.env.COPILOT_RATE_LIMIT_WINDOW_MS,
        60 * 60 * 1000,
      ),

    limit:
      getPositiveInteger(
        process.env.COPILOT_RATE_LIMIT_MAX,
        12,
      ),

    standardHeaders:
      'draft-8',

    legacyHeaders:
      false,

    handler:
      (
        req,
        res,
      ) =>
        res
          .status(
            429,
          )
          .json({
            success:
              false,

            message:
              'Food Copilot request limit reached. Normal EPANTRY Search remains available.',

            requestId:
              req.requestId,

            errors: [
              {
                code:
                  'RATE_LIMIT_FOOD_COPILOT',
              },
            ],
          }),
  })

function parseOrThrow(
  schema,
  value,
  code,
  fallbackMessage,
) {
  const result =
    schema.safeParse(
      value,
    )

  if (
    !result.success
  ) {
    throw new ApiError(
      400,
      result.error
        .issues[0]
        ?.message ||
        fallbackMessage,
      [
        {
          code,
        },
      ],
    )
  }

  return result.data
}

function wrap(
  handler,
) {
  return async function wrappedSearchController(
    req,
    res,
    next,
  ) {
    try {
      return await handler(
        req,
        res,
      )
    } catch (
      error
    ) {
      return next(
        error,
      )
    }
  }
}

function sendSuccess(
  req,
  res,
  statusCode,
  data,
  message,
) {
  return res
    .status(
      statusCode,
    )
    .json(
      new ApiResponse(
        statusCode,
        {
          ...data,

          requestId:
            req.requestId,
        },
        message,
      ),
    )
}

async function loadOptionalSearchActor(
  req,
  res,
  next,
) {
  const sessionCookie =
    req.cookies?.[
      env.authSessionCookieName
    ]

  if (
    !sessionCookie
  ) {
    req.searchActorContext = {
      actorType:
        'guest',

      currentUser:
        null,
    }

    return next()
  }

  try {
    const decoded =
      await verifyFirebaseSession(
        sessionCookie,
      )

    const user =
      await requireUserByFirebaseUid(
        decoded.uid,
      )

    assertSessionEligibleAccount(
      user,
    )

    req.auth = {
      firebaseUid:
        decoded.uid,

      email:
        decoded.email ||
        null,

      emailVerified:
        decoded.email_verified ===
        true,

      firebaseClaims:
        decoded,

      assurance:
        getFirebaseAuthAssurance(
          decoded,
        ),
    }

    req.currentUser =
      user

    req.searchActorContext = {
      actorType:
        userHasAnyAccess(
          user,
          'customer',
        )
          ? 'customer'
          : 'authenticated_non_customer',

      currentUser:
        user,
    }

    return next()
  } catch (
    error
  ) {
    res.clearCookie(
      env.authSessionCookieName,
      {
        ...getSessionCookieOptions(),

        maxAge:
          undefined,
      },
    )

    return next(
      error,
    )
  }
}

const searchRoutes =
  Router()

searchRoutes.use(
  [
    '/search',
    '/search/refine',
    '/decision-explain',
    '/copilot/messages',
  ],
  sensitiveResponseNoStoreMiddleware,
  loadOptionalSearchActor,
)

searchRoutes.post(
  '/search',
  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          smartSearchBodySchema,
          req.body,
          'SMART_SEARCH_INVALID',
          'Invalid Smart Search request.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await createSmartSearch({
          query:
            input.query,

          mode:
            input.mode,

          actorContext:
            req.searchActorContext,
        }),
        'Smart Search completed successfully.',
      )
    },
  ),
)

searchRoutes.post(
  '/search/refine',
  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          searchRefineBodySchema,
          req.body,
          'SMART_SEARCH_REFINE_INVALID',
          'Invalid Search refinement request.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await refineSmartSearch({
          sessionId:
            input.sessionId,

          sessionToken:
            input.sessionToken,

          refinement:
            input.refinement,

          mode:
            input.mode,

          actorContext:
            req.searchActorContext,
        }),
        'Smart Search refined successfully.',
      )
    },
  ),
)

searchRoutes.post(
  '/decision-explain',
  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          decisionExplainBodySchema,
          req.body,
          'SEARCH_DECISION_EXPLAIN_INVALID',
          'Invalid Search explanation request.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await explainSearchDecision({
          sessionId:
            input.sessionId,

          sessionToken:
            input.sessionToken,

          candidateType:
            input.candidateType,

          candidateId:
            input.candidateId,

          actorContext:
            req.searchActorContext,
        }),
        'Search decision explanation loaded successfully.',
      )
    },
  ),
)

searchRoutes.post(
  '/copilot/messages',
  copilotRateLimiter,
  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          copilotMessageBodySchema,
          req.body,
          'COPILOT_MESSAGE_INVALID',
          'Invalid Food Copilot request.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await sendFoodCopilotMessage({
          message:
            input.message,

          history:
            input.history,

          searchSession:
            input.searchSession ||
            null,

          actorContext:
            req.searchActorContext,
        }),
        'Food Copilot response generated.',
      )
    },
  ),
)

export default searchRoutes