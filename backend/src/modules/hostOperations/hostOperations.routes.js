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
  loadAdminAuthorization,
  requireAdminAccess,
  requireAnyAdminPermission,
} from '../admin/adminPermission.middleware.js'

import {
  rejectPrivilegedImpersonation,
} from '../admin/adminSafety.middleware.js'

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
  addOrganizationMember,
  createBrandRecipeSubmission,
  createHostRecipeImageUploadIntent,
  createHostRecipeListing,
  deleteHostRecipeListing,
  createCampaignBrief,
  createCatalogIngestJob,
  createHostOperationsOrganization,
  decideAdminKybCase,
  decideAdminOperationalActivation,
  getAdminKybCase,
  getBrandRecipeSubmission,
  getCatalogDataQualitySummary,
  getCatalogIngestJob,
  getHostCommercialProfileDeclaration,
  getHostKybCase,
  getHostOperationalReadiness,
  getHostOperationsOrganization,
  getHostRecipeListing,
  listAdminBrandRecipeSubmissions,
  listAdminKybQueue,
  listBrandRecipeSubmissions,
  listHostRecipeListingHistory,
  listHostRecipeListings,
  listCampaignBriefs,
  listCatalogIngestJobs,
  listOrganizationDocuments,
  listOrganizationMembers,
  registerOrganizationDocument,
  requestHostOperationalActivation,
  reviewAdminBrandRecipeSubmission,
  submitCampaignBrief,
  submitHostCommercialProfileDeclaration,
  submitHostKybCase,
  updateHostOperationalProfile,
  updateHostRecipeListing,
  updateOrganizationMember,
  upsertHostKybCase,
} from './hostOperations.service.js'

import {
  adminActivationDecisionSchema,
  adminBrandRecipeDecisionSchema,
  adminKybDecisionSchema,
  adminKybQueueQuerySchema,
  campaignSubmitSchema,
  createBrandRecipeSubmissionSchema,
  createCampaignBriefSchema,
  createCatalogIngestJobSchema,
  createHostOrganizationSchema,
  hostActivationRequestSchema,
  hostCommercialProfileRequestSchema,
  hostDocumentSchema,
  hostMemberBodySchema,
  hostMemberUpdateSchema,
  idempotencyHeaderSchema,
  listBrandRecipeSubmissionsQuerySchema,
  listHostCatalogImportsQuerySchema,
  memberIdParamsSchema,
  objectIdParamsSchema,
  organizationIdParamsSchema,
  updateHostOperationalProfileSchema,
  upsertHostKybSchema,
} from './hostOperations.validation.js'

const router =
  Router()

const hostRouter =
  Router()

const adminRouter =
  Router()

function parseOrThrow(
  schema,
  value,
  code,
  message,
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
        message,
      [
        {
          code,

          issues:
            parsed.error
              .issues,
        },
      ],
    )
  }

  return parsed.data
}

function wrap(
  handler,
) {
  return async function hostOperationsController(
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

function requireIdempotencyKey(
  req,
) {
  return parseOrThrow(
    idempotencyHeaderSchema,

    req.get(
      'idempotency-key',
    ),

    'HOST_OPERATIONS_IDEMPOTENCY_KEY_INVALID',

    'A valid Idempotency-Key header is required.',
  )
}

const hostSecurity = [
  sensitiveResponseNoStoreMiddleware,
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireHostAccess,
  requireMfaAssurance,
]

/*
|--------------------------------------------------------------------------
| Host operational organization / onboarding
|--------------------------------------------------------------------------
|
| Host application capability is still M02 authority.
| M16 operational activation is a separate tenant/business lifecycle.
| activeMode is never consulted.
|--------------------------------------------------------------------------
*/

hostRouter.get(
  '/organization',

  ...hostSecurity,

  wrap(
    async (
      req,
      res,
    ) =>
      sendSuccess(
        req,
        res,
        200,
        await getHostOperationsOrganization({
          actorUser:
            req.currentUser,
        }),
        'Host operational organization loaded.',
      ),
  ),
)

hostRouter.post(
  '/organization',

  ...hostSecurity,

  requireCsrfToken,

  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createHostOrganizationSchema,

          req.body,

          'HOST_OPERATIONS_ORGANIZATION_INPUT_INVALID',

          'Invalid Host organization input.',
        )

      return sendSuccess(
        req,
        res,
        201,
        await createHostOperationsOrganization({
          input,

          actorUser:
            req.currentUser,
        }),
        'Host operational organization initialized.',
      )
    },
  ),
)

hostRouter.get(
  '/organization/commercial-profile',

  ...hostSecurity,

  wrap(
    async (
      req,
      res,
    ) =>
      sendSuccess(
        req,
        res,
        200,
        await getHostCommercialProfileDeclaration({
          actorUser: req.currentUser,
        }),
        'Host commercial profile loaded.',
      ),
  ),
)

hostRouter.post(
  '/organization/commercial-profile',

  ...hostSecurity,

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          hostCommercialProfileRequestSchema,
          req.body,
          'HOST_COMMERCIAL_PROFILE_INPUT_INVALID',
          'Invalid Host commercial profile declaration.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await submitHostCommercialProfileDeclaration({
          input,
          actorUser: req.currentUser,
          correlationId: req.requestId,
        }),
        'Host commercial profile declared and Super Admin notified.',
      )
    },
  ),
)

hostRouter.put(
  '/organization/profile',

  ...hostSecurity,

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          updateHostOperationalProfileSchema,

          req.body,

          'HOST_OPERATIONAL_PROFILE_INVALID',

          'Invalid Host operational profile.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await updateHostOperationalProfile({
          input,

          actorUser:
            req.currentUser,
        }),
        'Host operational profile saved.',
      )
    },
  ),
)

hostRouter.get(
  '/organization/readiness',

  ...hostSecurity,

  wrap(
    async (
      req,
      res,
    ) =>
      sendSuccess(
        req,
        res,
        200,
        await getHostOperationalReadiness({
          actorUser:
            req.currentUser,
        }),
        'Host operational readiness loaded.',
      ),
  ),
)

hostRouter.post(
  '/organization/request-activation',

  ...hostSecurity,

  requireCsrfToken,

  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          hostActivationRequestSchema,

          req.body,

          'HOST_ACTIVATION_REQUEST_INVALID',

          'Invalid activation request.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await requestHostOperationalActivation({
          reason:
            input.reason,

          actorUser:
            req.currentUser,
        }),
        'Host operational activation review requested.',
      )
    },
  ),
)

/*
|--------------------------------------------------------------------------
| Team
|--------------------------------------------------------------------------
*/

hostRouter.get(
  '/team',

  ...hostSecurity,

  wrap(
    async (
      req,
      res,
    ) =>
      sendSuccess(
        req,
        res,
        200,
        await listOrganizationMembers({
          actorUser:
            req.currentUser,
        }),
        'Organization team loaded.',
      ),
  ),
)

hostRouter.post(
  '/team',

  ...hostSecurity,

  requireCsrfToken,

  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          hostMemberBodySchema,

          req.body,

          'HOST_MEMBER_INPUT_INVALID',

          'Invalid organization member input.',
        )

      return sendSuccess(
        req,
        res,
        201,
        await addOrganizationMember({
          input,

          actorUser:
            req.currentUser,
        }),
        'Organization member saved.',
      )
    },
  ),
)

hostRouter.patch(
  '/team/:memberId',

  ...hostSecurity,

  requireCsrfToken,

  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const {
        memberId,
      } =
        parseOrThrow(
          memberIdParamsSchema,

          req.params,

          'HOST_MEMBER_ID_INVALID',

          'Invalid member ID.',
        )

      const input =
        parseOrThrow(
          hostMemberUpdateSchema,

          req.body,

          'HOST_MEMBER_UPDATE_INVALID',

          'Invalid member update.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await updateOrganizationMember({
          memberId,

          input,

          actorUser:
            req.currentUser,
        }),
        'Organization member updated.',
      )
    },
  ),
)

/*
|--------------------------------------------------------------------------
| Documents + KYB
|--------------------------------------------------------------------------
*/

hostRouter.get(
  '/documents',

  ...hostSecurity,

  wrap(
    async (
      req,
      res,
    ) =>
      sendSuccess(
        req,
        res,
        200,
        await listOrganizationDocuments({
          actorUser:
            req.currentUser,
        }),
        'Organization documents loaded.',
      ),
  ),
)

hostRouter.post(
  '/documents',

  ...hostSecurity,

  requireCsrfToken,

  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          hostDocumentSchema,

          req.body,

          'HOST_DOCUMENT_INPUT_INVALID',

          'Invalid document metadata.',
        )

      return sendSuccess(
        req,
        res,
        201,
        await registerOrganizationDocument({
          input,

          actorUser:
            req.currentUser,
        }),
        'Private document metadata registered.',
      )
    },
  ),
)

hostRouter.get(
  '/kyb',

  ...hostSecurity,

  wrap(
    async (
      req,
      res,
    ) =>
      sendSuccess(
        req,
        res,
        200,
        await getHostKybCase({
          actorUser:
            req.currentUser,
        }),
        'KYB case loaded.',
      ),
  ),
)

hostRouter.put(
  '/kyb',

  ...hostSecurity,

  requireCsrfToken,

  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          upsertHostKybSchema,

          req.body,

          'HOST_KYB_INPUT_INVALID',

          'Invalid KYB input.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await upsertHostKybCase({
          input,

          actorUser:
            req.currentUser,
        }),
        'KYB draft saved.',
      )
    },
  ),
)

hostRouter.post(
  '/kyb/submit',

  ...hostSecurity,

  requireCsrfToken,

  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) =>
      sendSuccess(
        req,
        res,
        200,
        await submitHostKybCase({
          actorUser:
            req.currentUser,
        }),
        'KYB submitted for review.',
      ),
  ),
)

/*
|--------------------------------------------------------------------------
| Catalog ingest + data quality
|--------------------------------------------------------------------------
|
| This validates/matches against M04. It never creates or overwrites
| ProductVersion canonical truth and never silently creates offers.
|--------------------------------------------------------------------------
*/

hostRouter.get(
  '/catalog-imports',

  ...hostSecurity,

  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          listHostCatalogImportsQuerySchema,

          req.query,

          'HOST_CATALOG_IMPORT_QUERY_INVALID',

          'Invalid catalog import query.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await listCatalogIngestJobs({
          ...query,

          actorUser:
            req.currentUser,
        }),
        'Catalog ingest jobs loaded.',
      )
    },
  ),
)

hostRouter.post(
  '/catalog-imports',

  ...hostSecurity,

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createCatalogIngestJobSchema,

          req.body,

          'HOST_CATALOG_IMPORT_INVALID',

          'Invalid catalog ingest payload.',
        )

      return sendSuccess(
        req,
        res,
        201,
        await createCatalogIngestJob({
          input,

          idempotencyKey:
            requireIdempotencyKey(
              req,
            ),

          actorUser:
            req.currentUser,
        }),
        'Catalog ingest validated.',
      )
    },
  ),
)

hostRouter.get(
  '/catalog-imports/:id',

  ...hostSecurity,

  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          objectIdParamsSchema,

          req.params,

          'HOST_CATALOG_IMPORT_ID_INVALID',

          'Invalid import ID.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await getCatalogIngestJob({
          jobId:
            id,

          actorUser:
            req.currentUser,
        }),
        'Catalog ingest detail loaded.',
      )
    },
  ),
)

hostRouter.get(
  '/data-quality',

  ...hostSecurity,

  wrap(
    async (
      req,
      res,
    ) =>
      sendSuccess(
        req,
        res,
        200,
        await getCatalogDataQualitySummary({
          actorUser:
            req.currentUser,
        }),
        'Catalog data-quality summary loaded.',
      ),
  ),
)

/*
|--------------------------------------------------------------------------
| Host Recipe listings
|--------------------------------------------------------------------------
|
| Any active Host with recipes.submit can create a governed Recipe listing.
| The Host submission enters in_review immediately; only Super Admin Recipe
| governance can publish canonical Recipe truth. Brand-specific M16 intake is
| retained below for backwards compatibility and authority-scoped workflows.
|--------------------------------------------------------------------------
*/

hostRouter.get(
  '/recipes',

  ...hostSecurity,

  wrap(
    async (
      req,
      res,
    ) =>
      sendSuccess(
        req,
        res,
        200,
        await listHostRecipeListings({
          actorUser:
            req.currentUser,
        }),
        'Host Recipe listings loaded.',
      ),
  ),
)


hostRouter.get(
  '/recipes/history',

  ...hostSecurity,

  wrap(
    async (
      req,
      res,
    ) =>
      sendSuccess(
        req,
        res,
        200,
        await listHostRecipeListingHistory({
          actorUser:
            req.currentUser,
        }),
        'Host Recipe listing history loaded.',
      ),
  ),
)


hostRouter.post(
  '/recipes/image-upload-intent',

  ...hostSecurity,

  requireCsrfToken,

  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) =>
      sendSuccess(
        req,
        res,
        200,
        await createHostRecipeImageUploadIntent({
          actorUser:
            req.currentUser,
        }),
        'Recipe image upload intent created.',
      ),
  ),
)

hostRouter.post(
  '/recipes',

  ...hostSecurity,

  requireCsrfToken,

  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      return sendSuccess(
        req,
        res,
        201,
        await createHostRecipeListing({
          input:
            req.body,

          actorUser:
            req.currentUser,
        }),
        'Host Recipe submitted for Super Admin review.',
      )
    },
  ),
)


hostRouter.get(
  '/recipes/:id',

  ...hostSecurity,

  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          objectIdParamsSchema,

          req.params,

          'HOST_RECIPE_ID_INVALID',

          'Invalid Host Recipe ID.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await getHostRecipeListing({
          recipeVersionId:
            id,

          actorUser:
            req.currentUser,
        }),
        'Host Recipe listing loaded.',
      )
    },
  ),
)

hostRouter.patch(
  '/recipes/:id',

  ...hostSecurity,

  requireCsrfToken,

  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          objectIdParamsSchema,

          req.params,

          'HOST_RECIPE_ID_INVALID',

          'Invalid Host Recipe ID.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await updateHostRecipeListing({
          recipeVersionId:
            id,

          input:
            req.body,

          actorUser:
            req.currentUser,
        }),
        'Host Recipe updated and resubmitted for Super Admin review.',
      )
    },
  ),
)

hostRouter.delete(
  '/recipes/:id',

  ...hostSecurity,

  requireCsrfToken,

  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          objectIdParamsSchema,

          req.params,

          'HOST_RECIPE_ID_INVALID',

          'Invalid Host Recipe ID.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await deleteHostRecipeListing({
          recipeVersionId:
            id,

          actorUser:
            req.currentUser,
        }),
        'Host Recipe listing deleted.',
      )
    },
  ),
)

/*
|--------------------------------------------------------------------------
| Brand recipe submissions
|--------------------------------------------------------------------------
*/

hostRouter.get(
  '/brand-recipes',

  ...hostSecurity,

  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          listBrandRecipeSubmissionsQuerySchema,

          req.query,

          'HOST_BRAND_RECIPE_QUERY_INVALID',

          'Invalid Brand Recipe query.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await listBrandRecipeSubmissions({
          ...query,

          actorUser:
            req.currentUser,
        }),
        'Brand Recipe submissions loaded.',
      )
    },
  ),
)

hostRouter.get(
  '/brand-recipes/:id',

  ...hostSecurity,

  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          objectIdParamsSchema,

          req.params,

          'HOST_BRAND_RECIPE_ID_INVALID',

          'Invalid submission ID.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await getBrandRecipeSubmission({
          submissionId:
            id,

          actorUser:
            req.currentUser,
        }),
        'Brand Recipe submission loaded.',
      )
    },
  ),
)

hostRouter.post(
  '/brand-recipes',

  ...hostSecurity,

  requireCsrfToken,

  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createBrandRecipeSubmissionSchema,

          req.body,

          'HOST_BRAND_RECIPE_INPUT_INVALID',

          'Invalid Brand Recipe submission.',
        )

      return sendSuccess(
        req,
        res,
        201,
        await createBrandRecipeSubmission({
          input,

          actorUser:
            req.currentUser,
        }),
        'Brand Recipe submitted to governed intake.',
      )
    },
  ),
)

/*
|--------------------------------------------------------------------------
| Campaign seam only - not a Retail Media serving engine
|--------------------------------------------------------------------------
*/

hostRouter.get(
  '/campaigns',

  ...hostSecurity,

  wrap(
    async (
      req,
      res,
    ) =>
      sendSuccess(
        req,
        res,
        200,
        await listCampaignBriefs({
          actorUser:
            req.currentUser,
        }),
        'Campaign briefs loaded.',
      ),
  ),
)

hostRouter.post(
  '/campaigns',

  ...hostSecurity,

  requireCsrfToken,

  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createCampaignBriefSchema,

          req.body,

          'HOST_CAMPAIGN_BRIEF_INVALID',

          'Invalid campaign brief.',
        )

      return sendSuccess(
        req,
        res,
        201,
        await createCampaignBrief({
          input,

          actorUser:
            req.currentUser,
        }),
        'Campaign brief created.',
      )
    },
  ),
)

hostRouter.post(
  '/campaigns/:id/submit',

  ...hostSecurity,

  requireCsrfToken,

  requireRecentMfaAuthentication,

  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          objectIdParamsSchema,

          req.params,

          'HOST_CAMPAIGN_ID_INVALID',

          'Invalid campaign brief ID.',
        )

      parseOrThrow(
        campaignSubmitSchema,

        req.body,

        'HOST_CAMPAIGN_SUBMIT_INVALID',

        'Campaign acknowledgment is required.',
      )

      return sendSuccess(
        req,
        res,
        200,
        await submitCampaignBrief({
          campaignId:
            id,

          actorUser:
            req.currentUser,
        }),
        'Campaign brief submitted to the future-media review seam.',
      )
    },
  ),
)

/*
|--------------------------------------------------------------------------
| A11 / M03 governance dependencies
|--------------------------------------------------------------------------
*/

adminRouter.use(
  sensitiveResponseNoStoreMiddleware,

  rejectPrivilegedImpersonation,

  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  loadAdminAuthorization,

  requireAdminAccess,

  requireMfaAssurance,
)

adminRouter.get(
  '/kyb',

  requireAnyAdminPermission(
    'marketplace.read',
    'trust_safety.read',
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          adminKybQueueQuerySchema,

          req.query,

          'ADMIN_HOST_KYB_QUERY_INVALID',

          'Invalid KYB queue query.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await listAdminKybQueue(
          query,
        ),
        'Host KYB queue loaded.',
      )
    },
  ),
)

adminRouter.get(
  '/kyb/:id',

  requireAnyAdminPermission(
    'marketplace.read',
    'trust_safety.read',
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          objectIdParamsSchema,

          req.params,

          'ADMIN_HOST_KYB_ID_INVALID',

          'Invalid KYB case ID.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await getAdminKybCase({
          kybId:
            id,
        }),
        'Host KYB case loaded.',
      )
    },
  ),
)

adminRouter.post(
  '/kyb/:id/decision',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireAnyAdminPermission(
    'marketplace.mutate',
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          objectIdParamsSchema,

          req.params,

          'ADMIN_HOST_KYB_ID_INVALID',

          'Invalid KYB case ID.',
        )

      const input =
        parseOrThrow(
          adminKybDecisionSchema,

          req.body,

          'ADMIN_HOST_KYB_DECISION_INVALID',

          'Invalid KYB decision.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await decideAdminKybCase({
          kybId:
            id,

          input,

          actorUser:
            req.currentUser,

          adminAuthorization:
            req.adminAuthorization,

          requestId:
            req.requestId,
        }),
        'Host KYB decision recorded.',
      )
    },
  ),
)

adminRouter.post(
  '/organizations/:organizationId/activation',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireAnyAdminPermission(
    'marketplace.mutate',
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const {
        organizationId,
      } =
        parseOrThrow(
          organizationIdParamsSchema,

          req.params,

          'ADMIN_HOST_ORGANIZATION_ID_INVALID',

          'Invalid organization ID.',
        )

      const input =
        parseOrThrow(
          adminActivationDecisionSchema,

          req.body,

          'ADMIN_HOST_ACTIVATION_DECISION_INVALID',

          'Invalid operational activation decision.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await decideAdminOperationalActivation({
          organizationId,

          input,

          actorUser:
            req.currentUser,

          adminAuthorization:
            req.adminAuthorization,

          requestId:
            req.requestId,
        }),
        'Host operational activation decision recorded.',
      )
    },
  ),
)

adminRouter.get(
  '/brand-recipes',

  requireAnyAdminPermission(
    'recipe.read',
    'trust_safety.read',
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          listBrandRecipeSubmissionsQuerySchema,

          req.query,

          'ADMIN_BRAND_RECIPE_QUERY_INVALID',

          'Invalid Brand Recipe queue query.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await listAdminBrandRecipeSubmissions(
          query,
        ),
        'Brand Recipe intake queue loaded.',
      )
    },
  ),
)

adminRouter.post(
  '/brand-recipes/:id/review',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireAnyAdminPermission(
    'recipe.mutate',
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          objectIdParamsSchema,

          req.params,

          'ADMIN_BRAND_RECIPE_ID_INVALID',

          'Invalid Brand Recipe submission ID.',
        )

      const input =
        parseOrThrow(
          adminBrandRecipeDecisionSchema,

          req.body,

          'ADMIN_BRAND_RECIPE_DECISION_INVALID',

          'Invalid Brand Recipe review decision.',
        )

      return sendSuccess(
        req,
        res,
        200,
        await reviewAdminBrandRecipeSubmission({
          submissionId:
            id,

          input,

          actorUser:
            req.currentUser,

          adminAuthorization:
            req.adminAuthorization,

          requestId:
            req.requestId,
        }),
        'Brand Recipe intake decision recorded.',
      )
    },
  ),
)

router.use(
  '/host/operations',
  hostRouter,
)

router.use(
  '/admin/host-operations',
  adminRouter,
)

export default router