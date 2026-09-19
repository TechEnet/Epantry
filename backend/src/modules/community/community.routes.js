import {
  Router,
} from 'express';

import {
  env,
} from '../../config/env.js';

import {
  sensitiveResponseNoStoreMiddleware,
} from '../../middlewares/security.middleware.js';

import {
  ApiError,
} from '../../utils/ApiError.js';

import {
  ApiResponse,
} from '../../utils/ApiResponse.js';

import {
  loadAdminAuthorization,
  requireAdminAccess,
  requireAnyAdminPermission,
} from '../admin/adminPermission.middleware.js';

import {
  rejectPrivilegedImpersonation,
} from '../admin/adminSafety.middleware.js';

import {
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireCsrfToken,
  requireMfaAssurance,
  requireRecentMfaAuthentication,
} from '../auth/auth.middleware.js';

import {
  getFirebaseAuthAssurance,
  getSessionCookieOptions,
  verifyFirebaseSession,
} from '../auth/auth.service.js';

import {
  requireCustomerAccess,
} from '../auth/authorization.middleware.js';

import {
  assertSessionEligibleAccount,
  requireUserByFirebaseUid,
} from '../users/user.service.js';

import {
  createCommunityRecipe,
  createCommunityRecipeReview,
  createCreatorCourse,
  createCreatorProfile,
  followCreator,
  forkCommunityRecipe,
  getCommunityRecipe,
  getCreatorProfile,
  getLearningPro,
  getMyCreatorProfile,
  getModerationRecipeDetail,
  listCommunityModerationQueue,
  listCreatorCourses,
  listCreatorVerificationQueue,
  listMyCommunityRecipes,
  listPublicCommunityRecipes,
  moderateCommunityRecipe,
  prepareCreatorCourse,
  requestCreatorVerification,
  searchCommunityCanonicalIngredients,
  submitCommunityRecipeForModeration,
  verifyCreatorProfile,
} from './community.service.js';

import {
  communityRecipeIdParamsSchema,
  courseIdParamsSchema,
  createCommunityRecipeBodySchema,
  createCommunityReviewBodySchema,
  createCreatorCourseBodySchema,
  createCreatorProfileBodySchema,
  creatorIdParamsSchema,
  creatorVerificationBodySchema,
  creatorVerificationQueueQuerySchema,
  ingredientLookupQuerySchema,
  forkCommunityRecipeBodySchema,
  idempotencyKeySchema,
  listCommunityRecipesQuerySchema,
  listCreatorCoursesQuerySchema,
  listMyCommunityRecipesQuerySchema,
  moderationDecisionBodySchema,
  moderationQueueQuerySchema,
  prepareCreatorCourseBodySchema,
  requestCreatorVerificationBodySchema,
  submitCommunityRecipeBodySchema,
} from './community.validation.js';

const router =
  Router();

const customerRouter =
  Router();

const adminRouter =
  Router();

function parseOrThrow(
  schema,
  value,
  code,
  message,
) {
  const parsed =
      schema.safeParse(
          value,
      );

  if (!parsed.success) {
      throw new ApiError(
          400,
          message,
          [
              {
                  code,

                  issues:
                      parsed.error.issues,
              },
          ],
      );
  }

  return parsed.data;
}

function requireIdempotencyKey(
  req,
) {
  return parseOrThrow(
      idempotencyKeySchema,

      req.get(
          'idempotency-key',
      ),

      'COMMUNITY_IDEMPOTENCY_KEY_INVALID',

      'A valid Idempotency-Key header is required.',
  );
}

function wrap(
  handler,
) {
  return async function communityController(
      req,
      res,
      next,
  ) {
      try {
          return await handler(
              req,
              res,
          );
      } catch (
          error
      ) {
          return next(
              error,
          );
      }
  };
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
      );
}

async function loadOptionalCommunityActor(
  req,
  res,
  next,
) {
  const sessionCookie =
      req.cookies?.[
          env.authSessionCookieName
      ];

  if (!sessionCookie) {
      req.communityViewer =
          null;

      return next();
  }

  try {
      const decoded =
          await verifyFirebaseSession(
              sessionCookie,
          );

      const user =
          await requireUserByFirebaseUid(
              decoded.uid,
          );

      assertSessionEligibleAccount(
          user,
      );

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
      };

      req.currentUser =
          user;

      req.communityViewer =
          user;

      return next();
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
      );

      return next(
          error,
      );
  }
}

/*
| Public/community read surface.
| Public recipes are Guest-safe; private/friends recipes only resolve when the
| optional authenticated viewer satisfies ownership/friend visibility.
*/

router.get(
  '/community-recipes',

  wrap(
      async (
          req,
          res,
      ) => {
          const query =
              parseOrThrow(
                  listCommunityRecipesQuerySchema,

                  req.query,

                  'COMMUNITY_RECIPE_LIST_QUERY_INVALID',

                  'Invalid Community Recipe query.',
              );

          return sendSuccess(
              req,
              res,
              200,
              await listPublicCommunityRecipes(
                  query,
              ),
              'Community Recipes loaded.',
          );
      },
  ),
);

router.get(
  '/community-recipes/:id',

  sensitiveResponseNoStoreMiddleware,

  loadOptionalCommunityActor,

  wrap(
      async (
          req,
          res,
      ) => {
          const {
              id,
          } =
              parseOrThrow(
                  communityRecipeIdParamsSchema,

                  req.params,

                  'COMMUNITY_RECIPE_ID_INVALID',

                  'Invalid Community Recipe ID.',
              );

          return sendSuccess(
              req,
              res,
              200,
              await getCommunityRecipe({
                  communityRecipeId:
                      id,

                  viewerUser:
                      req.communityViewer,
              }),
              'Community Recipe loaded.',
          );
      },
  ),
);

router.get(
  '/creators/:id',

  wrap(
      async (
          req,
          res,
      ) => {
          const {
              id,
          } =
              parseOrThrow(
                  creatorIdParamsSchema,

                  req.params,

                  'CREATOR_PROFILE_ID_INVALID',

                  'Invalid Creator profile ID.',
              );

          return sendSuccess(
              req,
              res,
              200,
              await getCreatorProfile(
                  id,
              ),
              'Creator profile loaded.',
          );
      },
  ),
);

/*
| Public Learn / Pro discovery.
| Course records are discovery placeholders only in M15. Core Recipe / Food
| Intelligence facts remain on the normal public Recipe surfaces.
*/

router.get(
  '/courses',

  wrap(
      async (
          req,
          res,
      ) => {
          const query =
              parseOrThrow(
                  listCreatorCoursesQuerySchema,

                  req.query,

                  'CREATOR_COURSE_LIST_QUERY_INVALID',

                  'Invalid Learn/Pro course query.',
              );

          return sendSuccess(
              req,
              res,
              200,
              await listCreatorCourses(
                  query,
              ),
              'Learn/Pro courses loaded.',
          );
      },
  ),
);

/*
| Customer contributor boundary.
| Host users retain Customer capability through the same identity.
| activeMode is UX state only and never authorization authority.
*/

const customerSecurity = [
  sensitiveResponseNoStoreMiddleware,
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireCustomerAccess,
];

customerRouter.get(
  '/community/ingredients',

  ...customerSecurity,

  wrap(
      async (
          req,
          res,
      ) => {
          const query =
              parseOrThrow(
                  ingredientLookupQuerySchema,

                  req.query,

                  'COMMUNITY_INGREDIENT_LOOKUP_INVALID',

                  'Invalid canonical Ingredient lookup.',
              );

          return sendSuccess(
              req,
              res,
              200,
              await searchCommunityCanonicalIngredients(
                  query,
              ),
              'Canonical Ingredients loaded.',
          );
      },
  ),
);

customerRouter.get(
  '/me/creator-profile',

  ...customerSecurity,

  wrap(
      async (
          req,
          res,
      ) =>
          sendSuccess(
              req,
              res,
              200,
              await getMyCreatorProfile({
                  actorUser:
                      req.currentUser,
              }),
              'Creator profile loaded.',
          ),
  ),
);

customerRouter.get(
  '/learning/pro',

  ...customerSecurity,

  wrap(
      async (
          req,
          res,
      ) =>
          sendSuccess(
              req,
              res,
              200,
              await getLearningPro({
                  actorUser:
                      req.currentUser,
              }),
              'EPANTRY Pro entitlement state loaded.',
          ),
  ),
);

customerRouter.post(
  '/creators/profile/courses',

  ...customerSecurity,

  requireCsrfToken,

  wrap(
      async (
          req,
          res,
      ) => {
          const input =
              parseOrThrow(
                  createCreatorCourseBodySchema,

                  req.body,

                  'CREATOR_COURSE_INPUT_INVALID',

                  'Invalid Learn/Pro course input.',
              );

          return sendSuccess(
              req,
              res,
              201,
              await createCreatorCourse({
                  input,

                  actorUser:
                      req.currentUser,
              }),
              'Learn/Pro course placeholder created.',
          );
      },
  ),
);

customerRouter.post(
  '/courses/:id/prepare',

  ...customerSecurity,

  requireCsrfToken,

  wrap(
      async (
          req,
          res,
      ) => {
          const {
              id,
          } =
              parseOrThrow(
                  courseIdParamsSchema,

                  req.params,

                  'CREATOR_COURSE_ID_INVALID',

                  'Invalid Learn/Pro course ID.',
              );

          const input =
              parseOrThrow(
                  prepareCreatorCourseBodySchema,

                  req.body,

                  'CREATOR_COURSE_PREPARE_INPUT_INVALID',

                  'Invalid Prepare-for-Class request.',
              );

          return sendSuccess(
              req,
              res,
              201,
              await prepareCreatorCourse({
                  courseId:
                      id,

                  targetServings:
                      input.targetServings,

                  idempotencyKey:
                      requireIdempotencyKey(
                          req,
                      ),

                  actorUser:
                      req.currentUser,
              }),
              'Class preparation Outcome Plan created.',
          );
      },
  ),
);

customerRouter.post(
  '/recipes/community',

  ...customerSecurity,

  requireCsrfToken,

  wrap(
      async (
          req,
          res,
      ) => {
          const input =
              parseOrThrow(
                  createCommunityRecipeBodySchema,

                  req.body,

                  'COMMUNITY_RECIPE_INPUT_INVALID',

                  'Invalid Community Recipe input.',
              );

          const result =
              await createCommunityRecipe({
                  input,

                  actorUser:
                      req.currentUser,

                  idempotencyKey:
                      requireIdempotencyKey(
                          req,
                      ),
              });

          return sendSuccess(
              req,
              res,
              201,
              result,
              'Community Recipe created.',
          );
      },
  ),
);

customerRouter.get(
  '/me/community-recipes',

  ...customerSecurity,

  wrap(
      async (
          req,
          res,
      ) => {
          const query =
              parseOrThrow(
                  listMyCommunityRecipesQuerySchema,

                  req.query,

                  'MY_COMMUNITY_RECIPE_QUERY_INVALID',

                  'Invalid Community Recipe query.',
              );

          return sendSuccess(
              req,
              res,
              200,
              await listMyCommunityRecipes({
                  ...query,

                  actorUser:
                      req.currentUser,
              }),
              'Your Community Recipes loaded.',
          );
      },
  ),
);

customerRouter.post(
  '/community-recipes/:id/submit',

  ...customerSecurity,

  requireCsrfToken,

  wrap(
      async (
          req,
          res,
      ) => {
          const {
              id,
          } =
              parseOrThrow(
                  communityRecipeIdParamsSchema,

                  req.params,

                  'COMMUNITY_RECIPE_ID_INVALID',

                  'Invalid Community Recipe ID.',
              );

          const input =
              parseOrThrow(
                  submitCommunityRecipeBodySchema,

                  req.body,

                  'COMMUNITY_RECIPE_SUBMIT_INPUT_INVALID',

                  'Invalid Community Recipe submission.',
              );

          return sendSuccess(
              req,
              res,
              200,
              await submitCommunityRecipeForModeration({
                  communityRecipeId:
                      id,

                  reason:
                      input.reason,

                  actorUser:
                      req.currentUser,
              }),
              'Community Recipe submitted for moderation.',
          );
      },
  ),
);

customerRouter.post(
  '/recipes/:id/fork',

  ...customerSecurity,

  requireCsrfToken,

  wrap(
      async (
          req,
          res,
      ) => {
          const {
              id,
          } =
              parseOrThrow(
                  communityRecipeIdParamsSchema,

                  req.params,

                  'COMMUNITY_RECIPE_ID_INVALID',

                  'Invalid Community Recipe ID.',
              );

          const input =
              parseOrThrow(
                  forkCommunityRecipeBodySchema,

                  req.body,

                  'COMMUNITY_RECIPE_FORK_INPUT_INVALID',

                  'Invalid Community Recipe adaptation.',
              );

          return sendSuccess(
              req,
              res,
              201,
              await forkCommunityRecipe({
                  sourceCommunityRecipeId:
                      id,

                  input,

                  actorUser:
                      req.currentUser,

                  idempotencyKey:
                      requireIdempotencyKey(
                          req,
                      ),
              }),
              'Adapted Community Recipe created with lineage.',
          );
      },
  ),
);

customerRouter.post(
  '/recipes/:id/reviews',

  ...customerSecurity,

  requireCsrfToken,

  wrap(
      async (
          req,
          res,
      ) => {
          const {
              id,
          } =
              parseOrThrow(
                  communityRecipeIdParamsSchema,

                  req.params,

                  'COMMUNITY_RECIPE_ID_INVALID',

                  'Invalid Community Recipe ID.',
              );

          const input =
              parseOrThrow(
                  createCommunityReviewBodySchema,

                  req.body,

                  'COMMUNITY_RECIPE_REVIEW_INPUT_INVALID',

                  'Invalid Community Recipe review.',
              );

          return sendSuccess(
              req,
              res,
              201,
              await createCommunityRecipeReview({
                  communityRecipeId:
                      id,

                  input,

                  actorUser:
                      req.currentUser,

                  idempotencyKey:
                      requireIdempotencyKey(
                          req,
                      ),
              }),
              'Community Recipe review recorded.',
          );
      },
  ),
);

customerRouter.post(
  '/creators/profile',

  ...customerSecurity,

  requireCsrfToken,

  wrap(
      async (
          req,
          res,
      ) => {
          const input =
              parseOrThrow(
                  createCreatorProfileBodySchema,

                  req.body,

                  'CREATOR_PROFILE_INPUT_INVALID',

                  'Invalid Creator profile input.',
              );

          return sendSuccess(
              req,
              res,
              201,
              await createCreatorProfile({
                  input,

                  actorUser:
                      req.currentUser,
              }),
              'Creator profile created.',
          );
      },
  ),
);

customerRouter.post(
  '/creators/profile/request-verification',

  ...customerSecurity,

  requireCsrfToken,

  wrap(
      async (
          req,
          res,
      ) => {
          const input =
              parseOrThrow(
                  requestCreatorVerificationBodySchema,

                  req.body,

                  'CREATOR_VERIFICATION_REQUEST_INVALID',

                  'Invalid Creator verification request.',
              );

          return sendSuccess(
              req,
              res,
              200,
              await requestCreatorVerification({
                  statement:
                      input.statement,

                  actorUser:
                      req.currentUser,
              }),
              'Creator verification request submitted.',
          );
      },
  ),
);

customerRouter.post(
  '/creators/:id/follow',

  ...customerSecurity,

  requireCsrfToken,

  wrap(
      async (
          req,
          res,
      ) => {
          const {
              id,
          } =
              parseOrThrow(
                  creatorIdParamsSchema,

                  req.params,

                  'CREATOR_PROFILE_ID_INVALID',

                  'Invalid Creator profile ID.',
              );

          return sendSuccess(
              req,
              res,
              200,
              await followCreator({
                  creatorProfileId:
                      id,

                  actorUser:
                      req.currentUser,
              }),
              'Creator follow state updated.',
          );
      },
  ),
);

/*
| M03 Admin moderation boundary.
| Creator is not a top-level application role. Moderation remains existing
| Recipe/Trust & Safety permission authority.
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
);

adminRouter.get(
  '/community-recipes/moderation',

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
                  moderationQueueQuerySchema,

                  req.query,

                  'COMMUNITY_MODERATION_QUEUE_QUERY_INVALID',

                  'Invalid Community moderation queue query.',
              );

          return sendSuccess(
              req,
              res,
              200,
              await listCommunityModerationQueue(
                  query,
              ),
              'Community moderation queue loaded.',
          );
      },
  ),
);

adminRouter.get(
  '/community-recipes/:id',

  requireAnyAdminPermission(
      'recipe.read',
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
                  communityRecipeIdParamsSchema,

                  req.params,

                  'COMMUNITY_RECIPE_ID_INVALID',

                  'Invalid Community Recipe ID.',
              );

          return sendSuccess(
              req,
              res,
              200,
              await getModerationRecipeDetail(
                  id,
              ),
              'Community moderation record loaded.',
          );
      },
  ),
);

adminRouter.post(
  '/community-recipes/:id/moderate',

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
                  communityRecipeIdParamsSchema,

                  req.params,

                  'COMMUNITY_RECIPE_ID_INVALID',

                  'Invalid Community Recipe ID.',
              );

          const input =
              parseOrThrow(
                  moderationDecisionBodySchema,

                  req.body,

                  'COMMUNITY_MODERATION_INPUT_INVALID',

                  'Invalid Community moderation decision.',
              );

          return sendSuccess(
              req,
              res,
              200,
              await moderateCommunityRecipe({
                  communityRecipeId:
                      id,

                  input,

                  actorUser:
                      req.currentUser,

                  adminAuthorization:
                      req.adminAuthorization,

                  requestId:
                      req.requestId,
              }),
              'Community moderation decision recorded.',
          );
      },
  ),
);

adminRouter.get(
  '/creators/verification',

  requireAnyAdminPermission(
      'trust_safety.read',
      'recipe.read',
  ),

  wrap(
      async (
          req,
          res,
      ) => {
          const query =
              parseOrThrow(
                  creatorVerificationQueueQuerySchema,

                  req.query,

                  'CREATOR_VERIFICATION_QUEUE_QUERY_INVALID',

                  'Invalid Creator verification queue query.',
              );

          return sendSuccess(
              req,
              res,
              200,
              await listCreatorVerificationQueue(
                  query,
              ),
              'Creator verification queue loaded.',
          );
      },
  ),
);

adminRouter.post(
  '/creators/:id/verification',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireAnyAdminPermission(
      'trust_safety.mutate',
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
                  creatorIdParamsSchema,

                  req.params,

                  'CREATOR_PROFILE_ID_INVALID',

                  'Invalid Creator profile ID.',
              );

          const input =
              parseOrThrow(
                  creatorVerificationBodySchema,

                  req.body,

                  'CREATOR_VERIFICATION_INPUT_INVALID',

                  'Invalid Creator verification decision.',
              );

          return sendSuccess(
              req,
              res,
              200,
              await verifyCreatorProfile({
                  creatorProfileId:
                      id,

                  input,

                  actorUser:
                      req.currentUser,

                  adminAuthorization:
                      req.adminAuthorization,

                  requestId:
                      req.requestId,
              }),
              'Creator verification decision recorded.',
          );
      },
  ),
);

router.use(
  customerRouter,
);

router.use(
  '/admin',
  adminRouter,
);

export default router;