import {
  Router,
} from 'express'

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
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireCsrfToken,
  requireMfaAssurance,
  requireRecentMfaAuthentication,
} from '../auth/auth.middleware.js'

import {
  requireHostAccess,
} from '../auth/authorization.middleware.js'

import {
  approveDishPassportSnapshot,
  decideHospitalityChangeCase,
  detectHospitalityChangeImpact,
  generateDishPassportSnapshot,
  generateGreyBookSnapshot,
  getGreyBookSnapshot,
  getPublicDishPassport,
  greyBookCsv,
  listDishPassportSnapshots,
  listGreyBookSnapshots,
  listHospitalityChangeCases,
  publishDishPassportSnapshot,
  publishHospitalityChangeCase,
  recalculateHospitalityChangeCase,
} from './hospitality.passport.service.js'

import {
  changeCaseActionBodySchema,
  changeCaseDecisionBodySchema,
  detectHospitalityChangeBodySchema,
  generateDishPassportBodySchema,
  generateGreyBookBodySchema,
  greyBookExportQuerySchema,
  hospitalityPassportIdParamsSchema,
  passportDecisionBodySchema,
  publicPassportParamsSchema,
} from './hospitality.passport.validation.js'

const privateRouter =
  Router()

const publicRouter =
  Router()

function parseOrThrow(
  schema,
  value,
  code,
) {
  const parsed =
    schema.safeParse(
      value,
    )

  if (
    !parsed.success
  ) {
    throw new ApiError(
      400,
      parsed.error
        .issues[0]
        ?.message ||
        'Invalid Hospitality request.',
      [
        {
          code,
          issues:
            parsed.error.issues,
        },
      ],
    )
  }

  return parsed.data
}

function wrap(
  handler,
) {
  return async function hospitalityPassportController(
    req,
    res,
    next,
  ) {
    try {
      return await handler(
        req,
        res,
      )
    } catch (error) {
      return next(
        error,
      )
    }
  }
}

function send(
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

function actorUser(
  req,
) {
  return (
    req.currentUser ||
    req.user
  )
}

function organizationIdHint(
  req,
) {
  const value =
    req.get(
      'x-epantry-organization-id',
    )

  if (!value) {
    return null
  }

  const parsed =
    hospitalityPassportIdParamsSchema.safeParse({
      id:
        value,
    })

  if (
    !parsed.success
  ) {
    throw new ApiError(
      400,
      'x-epantry-organization-id must be a valid organization ObjectId.',
      [
        {
          code:
            'HOSPITALITY_ORGANIZATION_HEADER_INVALID',
        },
      ],
    )
  }

  return parsed.data.id
}

/*
|--------------------------------------------------------------------------
| Public Dish Passport
|--------------------------------------------------------------------------
|
| Public route only returns the latest effective, published, verified
| projection. Internal organization evidence and privileged actor details
| are never exposed here.
|--------------------------------------------------------------------------
*/

publicRouter.get(
  '/:publicId',

  wrap(
    async (
      req,
      res,
    ) => {
      const params =
        parseOrThrow(
          publicPassportParamsSchema,
          req.params,
          'PUBLIC_DISH_PASSPORT_ID_INVALID',
        )

      return send(
        req,
        res,
        200,
        await getPublicDishPassport(
          params.publicId,
        ),
        'Published Dish Passport loaded.',
      )
    },
  ),
)

/*
|--------------------------------------------------------------------------
| Private Host Hospitality boundary
|--------------------------------------------------------------------------
|
| B2B/Hospitality remains inside Host capability.
| activeMode is never authorization authority.
| Super Admin receives no implicit Host tenant bypass.
|--------------------------------------------------------------------------
*/

privateRouter.use(
  sensitiveResponseNoStoreMiddleware,
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireHostAccess,
  requireMfaAssurance,
)

privateRouter.get(
  '/dish-passports',

  wrap(
    async (
      req,
      res,
    ) =>
      send(
        req,
        res,
        200,
        await listDishPassportSnapshots({
          actorUser:
            actorUser(
              req,
            ),
          organizationIdHint:
            organizationIdHint(
              req,
            ),
        }),
        'Dish Passport snapshots loaded.',
      ),
  ),
)

privateRouter.post(
  '/dish-passports/generate',
  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          generateDishPassportBodySchema,
          req.body,
          'HOSPITALITY_DISH_PASSPORT_INPUT_INVALID',
        )

      return send(
        req,
        res,
        201,
        await generateDishPassportSnapshot({
          input,
          actorUser:
            actorUser(
              req,
            ),
          organizationIdHint:
            organizationIdHint(
              req,
            ),
        }),
        'Dish Passport snapshot generated.',
      )
    },
  ),
)

privateRouter.post(
  '/dish-passports/:id/approve',
  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const params =
        parseOrThrow(
          hospitalityPassportIdParamsSchema,
          req.params,
          'HOSPITALITY_DISH_PASSPORT_ID_INVALID',
        )

      const input =
        parseOrThrow(
          passportDecisionBodySchema,
          req.body,
          'HOSPITALITY_DISH_PASSPORT_DECISION_INVALID',
        )

      return send(
        req,
        res,
        200,
        await approveDishPassportSnapshot({
          snapshotId:
            params.id,
          input,
          actorUser:
            actorUser(
              req,
            ),
          organizationIdHint:
            organizationIdHint(
              req,
            ),
        }),
        'Dish Passport snapshot approved.',
      )
    },
  ),
)

privateRouter.post(
  '/dish-passports/:id/publish',
  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const params =
        parseOrThrow(
          hospitalityPassportIdParamsSchema,
          req.params,
          'HOSPITALITY_DISH_PASSPORT_ID_INVALID',
        )

      const input =
        parseOrThrow(
          passportDecisionBodySchema,
          req.body,
          'HOSPITALITY_DISH_PASSPORT_PUBLICATION_INVALID',
        )

      return send(
        req,
        res,
        200,
        await publishDishPassportSnapshot({
          snapshotId:
            params.id,
          input,
          actorUser:
            actorUser(
              req,
            ),
          organizationIdHint:
            organizationIdHint(
              req,
            ),
        }),
        'Dish Passport snapshot published.',
      )
    },
  ),
)

privateRouter.get(
  '/grey-books',

  wrap(
    async (
      req,
      res,
    ) =>
      send(
        req,
        res,
        200,
        await listGreyBookSnapshots({
          actorUser:
            actorUser(
              req,
            ),
          organizationIdHint:
            organizationIdHint(
              req,
            ),
        }),
        'Grey Book snapshots loaded.',
      ),
  ),
)

privateRouter.post(
  '/grey-books/generate',
  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          generateGreyBookBodySchema,
          req.body,
          'HOSPITALITY_GREY_BOOK_INPUT_INVALID',
        )

      return send(
        req,
        res,
        201,
        await generateGreyBookSnapshot({
          input,
          actorUser:
            actorUser(
              req,
            ),
          organizationIdHint:
            organizationIdHint(
              req,
            ),
        }),
        'Grey Book snapshot generated.',
      )
    },
  ),
)

privateRouter.get(
  '/grey-books/:id',

  wrap(
    async (
      req,
      res,
    ) => {
      const params =
        parseOrThrow(
          hospitalityPassportIdParamsSchema,
          req.params,
          'HOSPITALITY_GREY_BOOK_ID_INVALID',
        )

      return send(
        req,
        res,
        200,
        await getGreyBookSnapshot({
          snapshotId:
            params.id,
          actorUser:
            actorUser(
              req,
            ),
          organizationIdHint:
            organizationIdHint(
              req,
            ),
        }),
        'Grey Book snapshot loaded.',
      )
    },
  ),
)

privateRouter.get(
  '/grey-books/:id/export',

  wrap(
    async (
      req,
      res,
    ) => {
      const params =
        parseOrThrow(
          hospitalityPassportIdParamsSchema,
          req.params,
          'HOSPITALITY_GREY_BOOK_ID_INVALID',
        )

      const query =
        parseOrThrow(
          greyBookExportQuerySchema,
          req.query,
          'HOSPITALITY_GREY_BOOK_EXPORT_QUERY_INVALID',
        )

      const data =
        await getGreyBookSnapshot({
          snapshotId:
            params.id,
          actorUser:
            actorUser(
              req,
            ),
          organizationIdHint:
            organizationIdHint(
              req,
            ),
        })

      if (
        query.format ===
        'csv'
      ) {
        res.setHeader(
          'content-type',
          'text/csv; charset=utf-8',
        )

        res.setHeader(
          'content-disposition',
          `attachment; filename="grey-book-${data.greyBook.greyBookKey}-v${data.greyBook.versionNumber}.csv"`,
        )

        return res
          .status(200)
          .send(
            greyBookCsv(
              data.greyBook,
            ),
          )
      }

      return res
        .status(200)
        .json(
          data.greyBook,
        )
    },
  ),
)

privateRouter.get(
  '/change-cases',

  wrap(
    async (
      req,
      res,
    ) =>
      send(
        req,
        res,
        200,
        await listHospitalityChangeCases({
          actorUser:
            actorUser(
              req,
            ),
          organizationIdHint:
            organizationIdHint(
              req,
            ),
        }),
        'Hospitality Change Cases loaded.',
      ),
  ),
)

privateRouter.post(
  '/change-cases/detect',
  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          detectHospitalityChangeBodySchema,
          req.body,
          'HOSPITALITY_CHANGE_CASE_INPUT_INVALID',
        )

      return send(
        req,
        res,
        201,
        await detectHospitalityChangeImpact({
          input,
          actorUser:
            actorUser(
              req,
            ),
          organizationIdHint:
            organizationIdHint(
              req,
            ),
        }),
        'Hospitality Change Case detected.',
      )
    },
  ),
)

privateRouter.post(
  '/change-cases/:id/recalculate',
  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const params =
        parseOrThrow(
          hospitalityPassportIdParamsSchema,
          req.params,
          'HOSPITALITY_CHANGE_CASE_ID_INVALID',
        )

      const input =
        parseOrThrow(
          changeCaseActionBodySchema,
          req.body,
          'HOSPITALITY_CHANGE_CASE_ACTION_INVALID',
        )

      return send(
        req,
        res,
        200,
        await recalculateHospitalityChangeCase({
          changeCaseId:
            params.id,
          input,
          actorUser:
            actorUser(
              req,
            ),
          organizationIdHint:
            organizationIdHint(
              req,
            ),
        }),
        'Hospitality Change Case recalculated.',
      )
    },
  ),
)

privateRouter.post(
  '/change-cases/:id/decision',
  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const params =
        parseOrThrow(
          hospitalityPassportIdParamsSchema,
          req.params,
          'HOSPITALITY_CHANGE_CASE_ID_INVALID',
        )

      const input =
        parseOrThrow(
          changeCaseDecisionBodySchema,
          req.body,
          'HOSPITALITY_CHANGE_CASE_DECISION_INVALID',
        )

      return send(
        req,
        res,
        200,
        await decideHospitalityChangeCase({
          changeCaseId:
            params.id,
          input,
          actorUser:
            actorUser(
              req,
            ),
          organizationIdHint:
            organizationIdHint(
              req,
            ),
        }),
        'Hospitality Change Case decision recorded.',
      )
    },
  ),
)

privateRouter.post(
  '/change-cases/:id/publish',
  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const params =
        parseOrThrow(
          hospitalityPassportIdParamsSchema,
          req.params,
          'HOSPITALITY_CHANGE_CASE_ID_INVALID',
        )

      const input =
        parseOrThrow(
          changeCaseActionBodySchema,
          req.body,
          'HOSPITALITY_CHANGE_CASE_PUBLICATION_INVALID',
        )

      return send(
        req,
        res,
        200,
        await publishHospitalityChangeCase({
          changeCaseId:
            params.id,
          input,
          actorUser:
            actorUser(
              req,
            ),
          organizationIdHint:
            organizationIdHint(
              req,
            ),
        }),
        'Hospitality Change Case published.',
      )
    },
  ),
)

export {
  privateRouter as hospitalityPassportPrivateRoutes,
  publicRouter as hospitalityPassportPublicRoutes,
}