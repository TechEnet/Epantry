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
  addHospitalityMenuItem,
  approveHospitalityProductionRecipe,
  calculateHospitalityRecipeCost,
  createHospitalityMenu,
  createHospitalityOutlet,
  createHospitalityProcurementPlan,
  createHospitalityProductionPlan,
  createHospitalityProductionRecipe,
  createHospitalityStockObservation,
  createHospitalitySupplier,
  createHospitalitySupplierProduct,
  getHospitalityContext,
  getHospitalityProcurementPlan,
  getHospitalityProductionRecipe,
  initializeHospitalityProfile,
  listHospitalityMemberGrants,
  listHospitalityMenus,
  listHospitalityOutlets,
  listHospitalityProductionPlans,
  listHospitalityProductionRecipes,
  listHospitalitySupplierProducts,
  listHospitalitySuppliers,
  revokeHospitalityMemberGrant,
  submitHospitalityProductionRecipe,
  updateHospitalityOutlet,
  updateHospitalitySupplier,
  updateHospitalitySupplierProduct,
  upsertHospitalityMemberGrant,
} from './hospitality.service.js'

import {
  addMenuItemBodySchema,
  calculateRecipeCostBodySchema,
  createMenuBodySchema,
  createOutletBodySchema,
  createProcurementPlanBodySchema,
  createProductionPlanBodySchema,
  createProductionRecipeBodySchema,
  createStockObservationBodySchema,
  createSupplierBodySchema,
  createSupplierProductBodySchema,
  hospitalityIdParamsSchema,
  initializeHospitalityProfileBodySchema,
  productionRecipeActionBodySchema,
  revokeMemberGrantBodySchema,
  updateOutletBodySchema,
  updateSupplierBodySchema,
  updateSupplierProductBodySchema,
  upsertMemberGrantBodySchema,
} from './hospitality.validation.js'

const router =
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
  return async function hospitalityController(
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
    hospitalityIdParamsSchema.safeParse({
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
| M18 Hospitality Host Security Boundary
|--------------------------------------------------------------------------
|
| B2B / Hospitality is NOT a fourth application role.
|
| Every request first requires:
|
| - authenticated session
| - active account
| - Host capability
| - MFA assurance
|
| Organization + Hospitality permission + Outlet scope are then resolved by
| the backend.
|
| activeMode is never authorization authority.
|
| Super Admin receives no implicit Host tenant bypass.
|--------------------------------------------------------------------------
*/

router.use(
  sensitiveResponseNoStoreMiddleware,
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireHostAccess,
  requireMfaAssurance,
)

/*
|--------------------------------------------------------------------------
| Part 1
| Context / Profile
|--------------------------------------------------------------------------
*/

router.get(
  '/context',

  wrap(
    async (
      req,
      res,
    ) =>
      send(
        req,
        res,
        200,
        await getHospitalityContext({
          actorUser:
            actorUser(
              req,
            ),

          organizationIdHint:
            organizationIdHint(
              req,
            ),
        }),
        'Hospitality context loaded.',
      ),
  ),
)

router.post(
  '/profile/initialize',

  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          initializeHospitalityProfileBodySchema,
          req.body,
          'HOSPITALITY_PROFILE_INPUT_INVALID',
        )

      return send(
        req,
        res,
        200,
        await initializeHospitalityProfile({
          input,

          actorUser:
            actorUser(
              req,
            ),
        }),
        'Hospitality workspace initialized.',
      )
    },
  ),
)

/*
|--------------------------------------------------------------------------
| Part 1
| Outlets
|--------------------------------------------------------------------------
*/

router.get(
  '/outlets',

  wrap(
    async (
      req,
      res,
    ) =>
      send(
        req,
        res,
        200,
        await listHospitalityOutlets({
          actorUser:
            actorUser(
              req,
            ),

          organizationIdHint:
            organizationIdHint(
              req,
            ),
        }),
        'Hospitality outlets loaded.',
      ),
  ),
)

router.post(
  '/outlets',

  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createOutletBodySchema,
          req.body,
          'HOSPITALITY_OUTLET_INPUT_INVALID',
        )

      return send(
        req,
        res,
        201,
        await createHospitalityOutlet({
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
        'Hospitality outlet created.',
      )
    },
  ),
)

router.patch(
  '/outlets/:id',

  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const params =
        parseOrThrow(
          hospitalityIdParamsSchema,
          req.params,
          'HOSPITALITY_OUTLET_ID_INVALID',
        )

      const input =
        parseOrThrow(
          updateOutletBodySchema,
          req.body,
          'HOSPITALITY_OUTLET_UPDATE_INVALID',
        )

      return send(
        req,
        res,
        200,
        await updateHospitalityOutlet({
          outletId:
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
        'Hospitality outlet updated.',
      )
    },
  ),
)

/*
|--------------------------------------------------------------------------
| Part 1
| Member Grants
|--------------------------------------------------------------------------
*/

router.get(
  '/member-grants',

  wrap(
    async (
      req,
      res,
    ) =>
      send(
        req,
        res,
        200,
        await listHospitalityMemberGrants({
          actorUser:
            actorUser(
              req,
            ),

          organizationIdHint:
            organizationIdHint(
              req,
            ),
        }),
        'Hospitality member grants loaded.',
      ),
  ),
)

router.post(
  '/member-grants',

  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          upsertMemberGrantBodySchema,
          req.body,
          'HOSPITALITY_MEMBER_GRANT_INPUT_INVALID',
        )

      return send(
        req,
        res,
        200,
        await upsertHospitalityMemberGrant({
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
        'Hospitality member grant saved.',
      )
    },
  ),
)

router.post(
  '/member-grants/:id/revoke',

  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const params =
        parseOrThrow(
          hospitalityIdParamsSchema,
          req.params,
          'HOSPITALITY_MEMBER_GRANT_ID_INVALID',
        )

      const input =
        parseOrThrow(
          revokeMemberGrantBodySchema,
          req.body,
          'HOSPITALITY_MEMBER_GRANT_REVOKE_INVALID',
        )

      return send(
        req,
        res,
        200,
        await revokeHospitalityMemberGrant({
          grantId:
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
        'Hospitality member grant revoked.',
      )
    },
  ),
)

/*
|--------------------------------------------------------------------------
| Part 1
| Suppliers
|--------------------------------------------------------------------------
*/

router.get(
  '/suppliers',

  wrap(
    async (
      req,
      res,
    ) =>
      send(
        req,
        res,
        200,
        await listHospitalitySuppliers({
          actorUser:
            actorUser(
              req,
            ),

          organizationIdHint:
            organizationIdHint(
              req,
            ),
        }),
        'Hospitality suppliers loaded.',
      ),
  ),
)

router.post(
  '/suppliers',

  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createSupplierBodySchema,
          req.body,
          'HOSPITALITY_SUPPLIER_INPUT_INVALID',
        )

      return send(
        req,
        res,
        201,
        await createHospitalitySupplier({
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
        'Hospitality supplier created.',
      )
    },
  ),
)

router.patch(
  '/suppliers/:id',

  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const params =
        parseOrThrow(
          hospitalityIdParamsSchema,
          req.params,
          'HOSPITALITY_SUPPLIER_ID_INVALID',
        )

      const input =
        parseOrThrow(
          updateSupplierBodySchema,
          req.body,
          'HOSPITALITY_SUPPLIER_UPDATE_INVALID',
        )

      return send(
        req,
        res,
        200,
        await updateHospitalitySupplier({
          supplierId:
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
        'Hospitality supplier updated.',
      )
    },
  ),
)

/*
|--------------------------------------------------------------------------
| Part 1
| Supplier Product / Contract Versions
|--------------------------------------------------------------------------
*/

router.get(
  '/supplier-products',

  wrap(
    async (
      req,
      res,
    ) =>
      send(
        req,
        res,
        200,
        await listHospitalitySupplierProducts({
          actorUser:
            actorUser(
              req,
            ),

          organizationIdHint:
            organizationIdHint(
              req,
            ),
        }),
        'Hospitality Supplier Products loaded.',
      ),
  ),
)

router.post(
  '/supplier-products',

  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createSupplierProductBodySchema,
          req.body,
          'HOSPITALITY_SUPPLIER_PRODUCT_INPUT_INVALID',
        )

      return send(
        req,
        res,
        201,
        await createHospitalitySupplierProduct({
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
        'Hospitality Supplier Product version created.',
      )
    },
  ),
)

router.patch(
  '/supplier-products/:id',

  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const params =
        parseOrThrow(
          hospitalityIdParamsSchema,
          req.params,
          'HOSPITALITY_SUPPLIER_PRODUCT_ID_INVALID',
        )

      const input =
        parseOrThrow(
          updateSupplierProductBodySchema,
          req.body,
          'HOSPITALITY_SUPPLIER_PRODUCT_UPDATE_INVALID',
        )

      return send(
        req,
        res,
        200,
        await updateHospitalitySupplierProduct({
          supplierProductId:
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
        'Hospitality Supplier Product lifecycle updated.',
      )
    },
  ),
)

/*
|--------------------------------------------------------------------------
| Part 2
| Production Recipes
|--------------------------------------------------------------------------
*/

router.get(
  '/production-recipes',

  wrap(
    async (
      req,
      res,
    ) =>
      send(
        req,
        res,
        200,
        await listHospitalityProductionRecipes({
          actorUser:
            actorUser(
              req,
            ),

          organizationIdHint:
            organizationIdHint(
              req,
            ),
        }),
        'Hospitality Production Recipes loaded.',
      ),
  ),
)

router.get(
  '/production-recipes/:id',

  wrap(
    async (
      req,
      res,
    ) => {
      const params =
        parseOrThrow(
          hospitalityIdParamsSchema,
          req.params,
          'HOSPITALITY_PRODUCTION_RECIPE_ID_INVALID',
        )

      return send(
        req,
        res,
        200,
        await getHospitalityProductionRecipe({
          productionRecipeVersionId:
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
        'Hospitality Production Recipe loaded.',
      )
    },
  ),
)

router.post(
  '/production-recipes',

  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createProductionRecipeBodySchema,
          req.body,
          'HOSPITALITY_PRODUCTION_RECIPE_INPUT_INVALID',
        )

      return send(
        req,
        res,
        201,
        await createHospitalityProductionRecipe({
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
        'Hospitality Production Recipe draft created.',
      )
    },
  ),
)

router.post(
  '/production-recipes/:id/submit',

  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const params =
        parseOrThrow(
          hospitalityIdParamsSchema,
          req.params,
          'HOSPITALITY_PRODUCTION_RECIPE_ID_INVALID',
        )

      const input =
        parseOrThrow(
          productionRecipeActionBodySchema,
          req.body,
          'HOSPITALITY_PRODUCTION_RECIPE_ACTION_INVALID',
        )

      return send(
        req,
        res,
        200,
        await submitHospitalityProductionRecipe({
          productionRecipeVersionId:
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
        'Hospitality Production Recipe submitted for review.',
      )
    },
  ),
)

router.post(
  '/production-recipes/:id/approve',

  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const params =
        parseOrThrow(
          hospitalityIdParamsSchema,
          req.params,
          'HOSPITALITY_PRODUCTION_RECIPE_ID_INVALID',
        )

      const input =
        parseOrThrow(
          productionRecipeActionBodySchema,
          req.body,
          'HOSPITALITY_PRODUCTION_RECIPE_ACTION_INVALID',
        )

      return send(
        req,
        res,
        200,
        await approveHospitalityProductionRecipe({
          productionRecipeVersionId:
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
        'Hospitality Production Recipe approved.',
      )
    },
  ),
)

/*
|--------------------------------------------------------------------------
| Part 2
| Menus
|--------------------------------------------------------------------------
*/

router.get(
  '/menus',

  wrap(
    async (
      req,
      res,
    ) =>
      send(
        req,
        res,
        200,
        await listHospitalityMenus({
          actorUser:
            actorUser(
              req,
            ),

          organizationIdHint:
            organizationIdHint(
              req,
            ),
        }),
        'Hospitality menus loaded.',
      ),
  ),
)

router.post(
  '/menus',

  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createMenuBodySchema,
          req.body,
          'HOSPITALITY_MENU_INPUT_INVALID',
        )

      return send(
        req,
        res,
        201,
        await createHospitalityMenu({
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
        'Hospitality menu created.',
      )
    },
  ),
)

router.post(
  '/menus/:id/items',

  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const params =
        parseOrThrow(
          hospitalityIdParamsSchema,
          req.params,
          'HOSPITALITY_MENU_ID_INVALID',
        )

      const input =
        parseOrThrow(
          addMenuItemBodySchema,
          req.body,
          'HOSPITALITY_MENU_ITEM_INPUT_INVALID',
        )

      return send(
        req,
        res,
        201,
        await addHospitalityMenuItem({
          menuId:
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
        'Hospitality menu item added.',
      )
    },
  ),
)

/*
|--------------------------------------------------------------------------
| Part 2
| Costing
|--------------------------------------------------------------------------
*/

router.post(
  '/costing/production-recipes/:id/calculate',

  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const params =
        parseOrThrow(
          hospitalityIdParamsSchema,
          req.params,
          'HOSPITALITY_PRODUCTION_RECIPE_ID_INVALID',
        )

      const input =
        parseOrThrow(
          calculateRecipeCostBodySchema,
          req.body,
          'HOSPITALITY_COSTING_INPUT_INVALID',
        )

      return send(
        req,
        res,
        201,
        await calculateHospitalityRecipeCost({
          productionRecipeVersionId:
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
        'Hospitality Recipe Cost snapshot calculated.',
      )
    },
  ),
)

/*
|--------------------------------------------------------------------------
| Part 3
| Stock Observations
|--------------------------------------------------------------------------
*/

router.post(
  '/stock-observations',

  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createStockObservationBodySchema,
          req.body,
          'HOSPITALITY_STOCK_OBSERVATION_INPUT_INVALID',
        )

      return send(
        req,
        res,
        201,
        await createHospitalityStockObservation({
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
        'Hospitality stock observation recorded.',
      )
    },
  ),
)

/*
|--------------------------------------------------------------------------
| Part 3
| Production Planning
|--------------------------------------------------------------------------
*/

router.get(
  '/production-plans',

  wrap(
    async (
      req,
      res,
    ) =>
      send(
        req,
        res,
        200,
        await listHospitalityProductionPlans({
          actorUser:
            actorUser(
              req,
            ),

          organizationIdHint:
            organizationIdHint(
              req,
            ),
        }),
        'Hospitality Production Plans loaded.',
      ),
  ),
)

router.post(
  '/production-plans',

  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createProductionPlanBodySchema,
          req.body,
          'HOSPITALITY_PRODUCTION_PLAN_INPUT_INVALID',
        )

      return send(
        req,
        res,
        201,
        await createHospitalityProductionPlan({
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
        'Hospitality Production Plan calculated.',
      )
    },
  ),
)

/*
|--------------------------------------------------------------------------
| Part 3
| Procurement
|--------------------------------------------------------------------------
*/

router.post(
  '/procurement-plans',

  requireCsrfToken,
  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createProcurementPlanBodySchema,
          req.body,
          'HOSPITALITY_PROCUREMENT_PLAN_INPUT_INVALID',
        )

      return send(
        req,
        res,
        201,
        await createHospitalityProcurementPlan({
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
        'Hospitality Procurement Plan created.',
      )
    },
  ),
)

router.get(
  '/procurement-plans/:id',

  wrap(
    async (
      req,
      res,
    ) => {
      const params =
        parseOrThrow(
          hospitalityIdParamsSchema,
          req.params,
          'HOSPITALITY_PROCUREMENT_PLAN_ID_INVALID',
        )

      return send(
        req,
        res,
        200,
        await getHospitalityProcurementPlan({
          procurementPlanId:
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
        'Hospitality Procurement Plan loaded.',
      )
    },
  ),
)

export default router