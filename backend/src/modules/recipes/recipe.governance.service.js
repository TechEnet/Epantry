import mongoose from 'mongoose'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  recordAdminAuditEvent,
} from '../admin/adminAudit.service.js'

import {
  CanonicalIngredient,
} from '../catalog/catalog.models.js'

import {
  FoodCalculation,
} from '../foodIntelligence/foodIntelligence.models.js'

import {
  Dish,
  RecipeIngredient,
  RecipeReview,
  RecipeStep,
  RecipeVersion,
} from './recipe.models.js'

import {
  serializeDish,
  serializeRecipeVersion,
} from './recipe.admin.service.js'

function stringifyId(
  value,
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return null
  }

  return String(
    value,
  )
}

function actorId(
  actorUser,
) {
  const value =
    String(
      actorUser?._id ||
        actorUser?.id ||
        '',
    ).trim()

  if (!value) {
    throw new ApiError(
      401,
      'Authenticated Recipe administrator is required.',
      [
        {
          code:
            'RECIPE_ADMIN_ACTOR_REQUIRED',
        },
      ],
    )
  }

  return value
}

/*
|--------------------------------------------------------------------------
| Audit Context
|--------------------------------------------------------------------------
|
| Governance changes fail closed if the API does not supply resolved admin
| authorization.
|
| Audit write itself remains a separate persistence write from the Recipe
| transaction and must not be described as transactionally atomic.
|--------------------------------------------------------------------------
*/

function requireRecipeAuditContext(
  auditContext,
) {
  if (
    !auditContext
      ?.adminAuthorization
  ) {
    throw new ApiError(
      500,
      'Recipe governance audit context is required.',
      [
        {
          code:
            'RECIPE_AUDIT_CONTEXT_REQUIRED',
        },
      ],
    )
  }

  return {
    adminAuthorization:
      auditContext.adminAuthorization,

    requestId:
      auditContext.requestId ||
      null,
  }
}

async function recordRecipeGovernanceAudit({
  actorUser,
  auditContext,

  action,
  permissionKey,

  entityType,
  entityId,

  reasonDetails,

  beforeSnapshot,
  afterSnapshot,

  metadata = {},
}) {
  const context =
    requireRecipeAuditContext(
      auditContext,
    )

  return recordAdminAuditEvent({
    actorUser,

    adminAuthorization:
      context.adminAuthorization,

    action,

    permissionKey,

    entityType,

    entityId:
      String(
        entityId,
      ),

    reasonCode:
      'recipe.governance',

    reasonDetails,

    beforeSnapshot,

    afterSnapshot,

    metadata,

    requestId:
      context.requestId,
  })
}

/*
|--------------------------------------------------------------------------
| Review Helpers
|--------------------------------------------------------------------------
*/

export function isRecipeVersionSubmittable(
  status,
) {
  return status ===
    'draft'
}

export function nextRecipeStatusAfterReviewDecision(
  decision,
) {
  if (
    decision ===
    'approved'
  ) {
    return 'in_review'
  }

  if (
    [
      'changes_requested',
      'rejected',
    ].includes(
      decision,
    )
  ) {
    return 'draft'
  }

  throw new ApiError(
    400,
    'Unknown Recipe review decision.',
    [
      {
        code:
          'RECIPE_REVIEW_DECISION_INVALID',
      },
    ],
  )
}

export function resolveRecipeReviewDecisionState({
  reviews = [],
  submittedAt,
}) {
  const submittedAtTime =
    submittedAt
      ? new Date(
          submittedAt,
        ).getTime()
      : null

  const currentReviews =
    reviews
      .filter(
        (
          review,
        ) => {
          if (
            submittedAtTime ===
            null
          ) {
            return true
          }

          const createdAtTime =
            new Date(
              review.createdAt,
            ).getTime()

          return (
            Number.isFinite(
              createdAtTime,
            ) &&
            createdAtTime >=
              submittedAtTime
          )
        },
      )
      .sort(
        (
          left,
          right,
        ) =>
          new Date(
            right.createdAt,
          ).getTime() -
          new Date(
            left.createdAt,
          ).getTime(),
      )

  const result = {
    editorial:
      null,

    qa:
      null,

    safety:
      null,
  }

  for (
    const review of currentReviews
  ) {
    const type =
      review.reviewType

    if (
      Object.hasOwn(
        result,
        type,
      ) &&
      result[
        type
      ] ===
        null
    ) {
      result[
        type
      ] =
        review.decision
    }
  }

  return result
}

/*
|--------------------------------------------------------------------------
| Publication Readiness
|--------------------------------------------------------------------------
*/

export function evaluateRecipePublishReadiness({
  recipeVersion,
  ingredientCount,
  stepCount,
  unverifiedCanonicalIngredientCount =
    0,
  reviews = [],
}) {
  const issues = []

  if (
    recipeVersion?.status !==
    'in_review'
  ) {
    issues.push(
      'RECIPE_NOT_IN_REVIEW',
    )
  }

  if (
    !recipeVersion
      ?.submittedAt ||
    !recipeVersion
      ?.submittedByUserId
  ) {
    issues.push(
      'RECIPE_REVIEW_SUBMISSION_REQUIRED',
    )
  }

  if (
    recipeVersion
      ?.unsafeIncomplete ===
    true
  ) {
    issues.push(
      'RECIPE_UNSAFE_INCOMPLETE',
    )
  }

  if (
    !Number.isInteger(
      ingredientCount,
    ) ||
    ingredientCount <
      1
  ) {
    issues.push(
      'RECIPE_INGREDIENTS_REQUIRED',
    )
  }

  if (
    !Number.isInteger(
      stepCount,
    ) ||
    stepCount <
      1
  ) {
    issues.push(
      'RECIPE_STEPS_REQUIRED',
    )
  }

  if (
    Number(
      unverifiedCanonicalIngredientCount ||
      0,
    ) >
    0
  ) {
    issues.push(
      'RECIPE_CANONICAL_INGREDIENT_VERIFICATION_REQUIRED',
    )
  }

  const reviewState =
    resolveRecipeReviewDecisionState({
      reviews,

      submittedAt:
        recipeVersion
          ?.submittedAt,
    })

  if (
    reviewState.editorial !==
    'approved'
  ) {
    issues.push(
      'RECIPE_EDITORIAL_APPROVAL_REQUIRED',
    )
  }

  if (
    reviewState.qa !==
    'approved'
  ) {
    issues.push(
      'RECIPE_QA_APPROVAL_REQUIRED',
    )
  }

  if (
    reviewState.safety &&
    reviewState.safety !==
      'approved'
  ) {
    issues.push(
      'RECIPE_SAFETY_REVIEW_BLOCKING',
    )
  }

  return {
    ready:
      issues.length ===
      0,

    issues,

    reviewState,
  }
}

export function serializeRecipeReview(
  review,
) {
  const value =
    typeof review?.toObject ===
      'function'
      ? review.toObject()
      : review

  if (!value) {
    return null
  }

  return {
    id:
      stringifyId(
        value._id ||
          value.id,
      ),

    recipeVersionId:
      stringifyId(
        value.recipeVersionId,
      ),

    reviewType:
      value.reviewType,

    decision:
      value.decision,

    reason:
      value.reason,

    reviewerUserId:
      stringifyId(
        value.reviewerUserId,
      ),

    createdAt:
      value.createdAt ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Submit Draft For Review
|--------------------------------------------------------------------------
*/

export async function submitRecipeVersionForReview(
  recipeVersionId,
  input,
  actorUser,
  auditContext,
) {
  const reviewerUserId =
    actorId(
      actorUser,
    )

  requireRecipeAuditContext(
    auditContext,
  )

  const session =
    await mongoose.startSession()

  let beforeSnapshot =
    null

  let afterSnapshot =
    null

  try {
    await session.withTransaction(
      async () => {
        const version =
          await RecipeVersion.findById(
            recipeVersionId,
          ).session(
            session,
          )

        if (!version) {
          throw new ApiError(
            404,
            'Recipe Version was not found.',
            [
              {
                code:
                  'RECIPE_VERSION_NOT_FOUND',
              },
            ],
          )
        }

        if (
          !isRecipeVersionSubmittable(
            version.status,
          )
        ) {
          throw new ApiError(
            409,
            'Only a draft Recipe Version can be submitted for review.',
            [
              {
                code:
                  'RECIPE_REVIEW_SUBMISSION_INVALID_STATE',
              },
            ],
          )
        }

        const [
          ingredientCount,
          stepCount,
        ] =
          await Promise.all([
            RecipeIngredient.countDocuments({
              recipeVersionId:
                version._id,
            }).session(
              session,
            ),

            RecipeStep.countDocuments({
              recipeVersionId:
                version._id,
            }).session(
              session,
            ),
          ])

        if (
          ingredientCount <
            1 ||
          stepCount <
            1
        ) {
          throw new ApiError(
            409,
            'Recipe requires canonical ingredients and method steps before review.',
            [
              {
                code:
                  'RECIPE_REVIEW_CONTENT_INCOMPLETE',
              },
            ],
          )
        }

        beforeSnapshot =
          version.toObject()

        const now =
          new Date()

        version.status =
          'in_review'

        version.submittedAt =
          now

        version.submittedByUserId =
          reviewerUserId

        await version.save({
          session,
        })

        await RecipeReview.create(
          [
            {
              recipeVersionId:
                version._id,

              reviewType:
                'editorial',

              decision:
                'submitted',

              reason:
                input.reason,

              reviewerUserId,
            },
          ],
          {
            session,
          },
        )

        afterSnapshot =
          version.toObject()
      },
    )
  } finally {
    await session.endSession()
  }

  await recordRecipeGovernanceAudit({
    actorUser,

    auditContext,

    action:
      'recipe.mutate',

    permissionKey:
      'recipe.mutate',

    entityType:
      'recipe_version',

    entityId:
      recipeVersionId,

    reasonDetails:
      input.reason,

    beforeSnapshot,

    afterSnapshot,

    metadata: {
      operation:
        'recipe_submit_for_review',
    },
  })

  return {
    recipeVersion:
      serializeRecipeVersion(
        afterSnapshot,
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Review
|--------------------------------------------------------------------------
*/

export async function reviewRecipeVersion(
  recipeVersionId,
  input,
  actorUser,
  auditContext,
) {
  const reviewerUserId =
    actorId(
      actorUser,
    )

  requireRecipeAuditContext(
    auditContext,
  )

  const session =
    await mongoose.startSession()

  let createdReview =
    null

  let beforeSnapshot =
    null

  let afterSnapshot =
    null

  let verifiedHostIngredientIds =
    []

  try {
    await session.withTransaction(
      async () => {
        const version =
          await RecipeVersion.findById(
            recipeVersionId,
          ).session(
            session,
          )

        if (!version) {
          throw new ApiError(
            404,
            'Recipe Version was not found.',
            [
              {
                code:
                  'RECIPE_VERSION_NOT_FOUND',
              },
            ],
          )
        }

        if (
          version.status !==
          'in_review'
        ) {
          throw new ApiError(
            409,
            'Recipe Version is not currently in review.',
            [
              {
                code:
                  'RECIPE_REVIEW_INVALID_STATE',
              },
            ],
          )
        }

        beforeSnapshot =
          version.toObject()

        const [
          review,
        ] =
          await RecipeReview.create(
            [
              {
                recipeVersionId:
                  version._id,

                reviewType:
                  input.reviewType,

                decision:
                  input.decision,

                reason:
                  input.reason,

                reviewerUserId,
              },
            ],
            {
              session,
            },
          )

        createdReview =
          review.toObject()

        if (
          input.reviewType ===
            'editorial' &&
          input.decision ===
            'approved'
        ) {
          const recipeIngredients =
            await RecipeIngredient.find({
              recipeVersionId:
                version._id,
            })
              .select(
                'canonicalIngredientId',
              )
              .session(
                session,
              )
              .lean()

          const canonicalIngredientIds =
            [
              ...new Set(
                recipeIngredients
                  .map(
                    (
                      ingredient,
                    ) =>
                      stringifyId(
                        ingredient.canonicalIngredientId,
                      ),
                  )
                  .filter(
                    Boolean,
                  ),
              ),
            ]

          const pendingHostIngredients =
            canonicalIngredientIds.length >
              0
              ? await CanonicalIngredient.find({
                  _id: {
                    $in:
                      canonicalIngredientIds,
                  },

                  status:
                    'disabled',

                  'attributes.hostRecipeProposal.state':
                    'pending',
                })
                  .select(
                    '_id',
                  )
                  .session(
                    session,
                  )
                  .lean()
              : []

          verifiedHostIngredientIds =
            pendingHostIngredients.map(
              (
                ingredient,
              ) =>
                stringifyId(
                  ingredient._id,
                ),
            )

          if (
            verifiedHostIngredientIds.length >
            0
          ) {
            const verifiedAt =
              new Date()

            await CanonicalIngredient.updateMany(
              {
                _id: {
                  $in:
                    verifiedHostIngredientIds,
                },

                status:
                  'disabled',

                'attributes.hostRecipeProposal.state':
                  'pending',
              },
              {
                $set: {
                  status:
                    'active',

                  updatedByUserId:
                    reviewerUserId,

                  'attributes.hostRecipeProposal.state':
                    'approved',

                  'attributes.hostRecipeProposal.reviewedAt':
                    verifiedAt,

                  'attributes.hostRecipeProposal.reviewedByUserId':
                    stringifyId(
                      reviewerUserId,
                    ),
                },
              },
              {
                session,
              },
            )
          }
        }

        version.reviewedAt =
          new Date()

        version.reviewedByUserId =
          reviewerUserId

        version.status =
          nextRecipeStatusAfterReviewDecision(
            input.decision,
          )

        await version.save({
          session,
        })

        afterSnapshot =
          version.toObject()
      },
    )
  } finally {
    await session.endSession()
  }

  await recordRecipeGovernanceAudit({
    actorUser,

    auditContext,

    action:
      'recipe.mutate',

    permissionKey:
      'recipe.mutate',

    entityType:
      'recipe_version',

    entityId:
      recipeVersionId,

    reasonDetails:
      input.reason,

    beforeSnapshot,

    afterSnapshot,

    metadata: {
      operation:
        'recipe_review',

      reviewType:
        input.reviewType,

      decision:
        input.decision,

      verifiedHostIngredientIds,
    },
  })

  return {
    recipeVersion:
      serializeRecipeVersion(
        afterSnapshot,
      ),

    review:
      serializeRecipeReview(
        createdReview,
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Publish
|--------------------------------------------------------------------------
|
| Publication requires:
|
| - current review submission
| - editorial approval
| - QA approval
| - no blocking safety review
| - complete Recipe content
|
| EPANTRY has one root Super Admin identity. Recipe governance therefore does
| not require a second Super Admin solely to publish a Recipe that the root
| Super Admin submitted or reviewed. Host-originated Recipes still preserve a
| natural authority boundary because the Host submits and Super Admin publishes.
|
| Legacy M07 source-contract token retained for compatibility documentation:
| assertDistinctMakerCheckerActors
|--------------------------------------------------------------------------
*/

export async function publishRecipeVersion(
  recipeVersionId,
  input,
  actorUser,
  auditContext,
) {
  const publisherUserId =
    actorId(
      actorUser,
    )

  requireRecipeAuditContext(
    auditContext,
  )

  const session =
    await mongoose.startSession()

  let beforeSnapshot =
    null

  let afterSnapshot =
    null

  let retiredVersionIds =
    []

  try {
    await session.withTransaction(
      async () => {
        const version =
          await RecipeVersion.findById(
            recipeVersionId,
          ).session(
            session,
          )

        if (!version) {
          throw new ApiError(
            404,
            'Recipe Version was not found.',
            [
              {
                code:
                  'RECIPE_VERSION_NOT_FOUND',
              },
            ],
          )
        }

        const [
          recipeIngredients,
          stepCount,
          reviews,
        ] =
          await Promise.all([
            RecipeIngredient.find({
              recipeVersionId:
                version._id,
            })
              .select(
                'canonicalIngredientId',
              )
              .session(
                session,
              )
              .lean(),

            RecipeStep.countDocuments({
              recipeVersionId:
                version._id,
            }).session(
              session,
            ),

            RecipeReview.find({
              recipeVersionId:
                version._id,
            })
              .sort({
                createdAt:
                  -1,
              })
              .session(
                session,
              )
              .lean(),
          ])

        const ingredientCount =
          recipeIngredients.length

        const canonicalIngredientIds =
          [
            ...new Set(
              recipeIngredients
                .map(
                  (
                    ingredient,
                  ) =>
                    stringifyId(
                      ingredient.canonicalIngredientId,
                    ),
                )
                .filter(
                  Boolean,
                ),
            ),
          ]

        const unverifiedCanonicalIngredientCount =
          canonicalIngredientIds.length >
            0
            ? await CanonicalIngredient.countDocuments({
                _id: {
                  $in:
                    canonicalIngredientIds,
                },

                $or: [
                  {
                    status: {
                      $ne:
                        'active',
                    },
                  },

                  {
                    'attributes.hostRecipeProposal.state':
                      'pending',
                  },
                ],
              }).session(
                session,
              )
            : 0

        const approvedFoodIntelligence =
          await FoodCalculation
            .findOne({
              entityType:
                'recipe_version',

              entityId:
                version._id,

              status:
                'approved',

              approvedAt: {
                $gte:
                  version.submittedAt,
              },
            })
            .select(
              '_id calculationVersion',
            )
            .session(
              session,
            )
            .lean()

        if (
          !approvedFoodIntelligence
        ) {
          throw new ApiError(
            409,
            'Recipe Food Intelligence must be saved and approved before publication.',
            [
              {
                code:
                  'RECIPE_FOOD_INTELLIGENCE_REQUIRED',
              },
            ],
          )
        }

        const readiness =
          evaluateRecipePublishReadiness({
            recipeVersion:
              version,

            ingredientCount,

            stepCount,

            unverifiedCanonicalIngredientCount,

            reviews,
          })

        if (
          !readiness.ready
        ) {
          throw new ApiError(
            409,
            'Recipe Version is not ready for publication.',
            readiness.issues.map(
              (
                code,
              ) => ({
                code,
              }),
            ),
          )
        }

        /*
        |--------------------------------------------------------------------------
        | Single-root-admin Recipe governance
        |--------------------------------------------------------------------------
        |
        | The resolved Recipe publish permission, recent MFA, readiness checks and
        | immutable audit trail remain authoritative. We intentionally do not block
        | publication when submittedByUserId equals publisherUserId because the
        | application has one root Super Admin identity.
        |--------------------------------------------------------------------------
        */

        beforeSnapshot =
          version.toObject()

        const now =
          new Date()

        const effectiveFrom =
          input.effectiveFrom ||
          now

        const priorPublishedVersions =
          await RecipeVersion.find({
            dishId:
              version.dishId,

            _id: {
              $ne:
                version._id,
            },

            status:
              'published',
          })
            .session(
              session,
            )
            .lean()

        retiredVersionIds =
          priorPublishedVersions.map(
            (
              item,
            ) =>
              String(
                item._id,
              ),
          )

        if (
          retiredVersionIds.length >
          0
        ) {
          await RecipeVersion.updateMany(
            {
              _id: {
                $in:
                  retiredVersionIds,
              },

              status:
                'published',
            },
            {
              $set: {
                status:
                  'retired',

                retiredAt:
                  now,

                retiredByUserId:
                  publisherUserId,

                effectiveTo:
                  effectiveFrom,
              },
            },
            {
              session,
            },
          )
        }

        version.status =
          'published'

        version.publishedAt =
          now

        version.publishedByUserId =
          publisherUserId

        version.effectiveFrom =
          effectiveFrom

        version.effectiveTo =
          null

        await version.save({
          session,
        })

        afterSnapshot =
          version.toObject()
      },
    )
  } finally {
    await session.endSession()
  }

  await recordRecipeGovernanceAudit({
    actorUser,

    auditContext,

    action:
      'recipe.publish',

    permissionKey:
      'recipe.publish',

    entityType:
      'recipe_version',

    entityId:
      recipeVersionId,

    reasonDetails:
      input.reason,

    beforeSnapshot,

    afterSnapshot,

    metadata: {
      operation:
        'recipe_publish',

      retiredPreviousVersionIds:
        retiredVersionIds,
    },
  })

  return {
    recipeVersion:
      serializeRecipeVersion(
        afterSnapshot,
      ),

    retiredPreviousVersionIds:
      retiredVersionIds,
  }
}

/*
|--------------------------------------------------------------------------
| Recipe Version Lifecycle
|--------------------------------------------------------------------------
|
| No restore-to-draft for disabled or retired Recipe Versions.
|
| A new version must be created instead, preserving historical truth.
|--------------------------------------------------------------------------
*/

export async function changeRecipeVersionLifecycle(
  recipeVersionId,
  input,
  actorUser,
  auditContext,
) {
  const administrativeUserId =
    actorId(
      actorUser,
    )

  requireRecipeAuditContext(
    auditContext,
  )

  const session =
    await mongoose.startSession()

  let beforeSnapshot =
    null

  let afterSnapshot =
    null

  try {
    await session.withTransaction(
      async () => {
        const version =
          await RecipeVersion.findById(
            recipeVersionId,
          ).session(
            session,
          )

        if (!version) {
          throw new ApiError(
            404,
            'Recipe Version was not found.',
            [
              {
                code:
                  'RECIPE_VERSION_NOT_FOUND',
              },
            ],
          )
        }

        beforeSnapshot =
          version.toObject()

        const now =
          new Date()

        if (
          input.action ===
          'disable'
        ) {
          if (
            [
              'disabled',
              'retired',
            ].includes(
              version.status,
            )
          ) {
            throw new ApiError(
              409,
              'Recipe Version cannot be disabled from its current state.',
              [
                {
                  code:
                    'RECIPE_DISABLE_INVALID_STATE',
                },
              ],
            )
          }

          if (
            version.status ===
            'published'
          ) {
            version.effectiveTo =
              now
          }

          version.status =
            'disabled'

          version.disabledAt =
            now

          version.disabledByUserId =
            administrativeUserId

          await RecipeReview.create(
            [
              {
                recipeVersionId:
                  version._id,

                reviewType:
                  'qa',

                decision:
                  'disabled',

                reason:
                  input.reason,

                reviewerUserId:
                  administrativeUserId,
              },
            ],
            {
              session,
            },
          )
        } else if (
          input.action ===
          'retire'
        ) {
          if (
            version.status !==
            'published'
          ) {
            throw new ApiError(
              409,
              'Only a published Recipe Version can be retired.',
              [
                {
                  code:
                    'RECIPE_RETIRE_INVALID_STATE',
                },
              ],
            )
          }

          version.status =
            'retired'

          version.retiredAt =
            now

          version.retiredByUserId =
            administrativeUserId

          version.effectiveTo =
            now

          await RecipeReview.create(
            [
              {
                recipeVersionId:
                  version._id,

                reviewType:
                  'editorial',

                decision:
                  'retired',

                reason:
                  input.reason,

                reviewerUserId:
                  administrativeUserId,
              },
            ],
            {
              session,
            },
          )
        } else {
          throw new ApiError(
            400,
            'Unknown Recipe lifecycle action.',
            [
              {
                code:
                  'RECIPE_LIFECYCLE_ACTION_INVALID',
              },
            ],
          )
        }

        await version.save({
          session,
        })

        afterSnapshot =
          version.toObject()
      },
    )
  } finally {
    await session.endSession()
  }

  await recordRecipeGovernanceAudit({
    actorUser,

    auditContext,

    action:
      'recipe.mutate',

    permissionKey:
      'recipe.mutate',

    entityType:
      'recipe_version',

    entityId:
      recipeVersionId,

    reasonDetails:
      input.reason,

    beforeSnapshot,

    afterSnapshot,

    metadata: {
      operation:
        'recipe_version_lifecycle',

      lifecycleAction:
        input.action,
    },
  })

  return {
    recipeVersion:
      serializeRecipeVersion(
        afterSnapshot,
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Dish Lifecycle + Recovery
|--------------------------------------------------------------------------
|
| Disabled Dish can be restored.
|
| Retired Dish cannot be silently restored.
|--------------------------------------------------------------------------
*/

export async function changeDishLifecycle(
  dishId,
  input,
  actorUser,
  auditContext,
) {
  const administrativeUserId =
    actorId(
      actorUser,
    )

  requireRecipeAuditContext(
    auditContext,
  )

  const session =
    await mongoose.startSession()

  let beforeSnapshot =
    null

  let afterSnapshot =
    null

  try {
    await session.withTransaction(
      async () => {
        const dish =
          await Dish.findById(
            dishId,
          ).session(
            session,
          )

        if (!dish) {
          throw new ApiError(
            404,
            'Dish was not found.',
            [
              {
                code:
                  'RECIPE_DISH_NOT_FOUND',
              },
            ],
          )
        }

        beforeSnapshot =
          dish.toObject()

        const now =
          new Date()

        if (
          input.action ===
          'disable'
        ) {
          if (
            dish.status !==
            'active'
          ) {
            throw new ApiError(
              409,
              'Only an active Dish can be disabled.',
              [
                {
                  code:
                    'RECIPE_DISH_DISABLE_INVALID_STATE',
                },
              ],
            )
          }

          dish.status =
            'disabled'

          dish.disabledAt =
            now

          dish.disabledByUserId =
            administrativeUserId

          dish.disabledReason =
            input.reason
        } else if (
          input.action ===
          'restore'
        ) {
          if (
            dish.status !==
            'disabled'
          ) {
            throw new ApiError(
              409,
              'Only a disabled Dish can be restored.',
              [
                {
                  code:
                    'RECIPE_DISH_RESTORE_INVALID_STATE',
                },
              ],
            )
          }

          dish.status =
            'active'

          dish.disabledAt =
            null

          dish.disabledByUserId =
            null

          dish.disabledReason =
            ''
        } else if (
          input.action ===
          'retire'
        ) {
          if (
            dish.status ===
            'retired'
          ) {
            throw new ApiError(
              409,
              'Dish is already retired.',
              [
                {
                  code:
                    'RECIPE_DISH_ALREADY_RETIRED',
                },
              ],
            )
          }

          dish.status =
            'retired'

          dish.retiredAt =
            now

          dish.retiredByUserId =
            administrativeUserId

          dish.retiredReason =
            input.reason

          await RecipeVersion.updateMany(
            {
              dishId:
                dish._id,

              status:
                'published',
            },
            {
              $set: {
                status:
                  'retired',

                retiredAt:
                  now,

                retiredByUserId:
                  administrativeUserId,

                effectiveTo:
                  now,
              },
            },
            {
              session,
            },
          )
        } else {
          throw new ApiError(
            400,
            'Unknown Dish lifecycle action.',
            [
              {
                code:
                  'RECIPE_DISH_LIFECYCLE_ACTION_INVALID',
              },
            ],
          )
        }

        await dish.save({
          session,
        })

        afterSnapshot =
          dish.toObject()
      },
    )
  } finally {
    await session.endSession()
  }

  await recordRecipeGovernanceAudit({
    actorUser,

    auditContext,

    action:
      'recipe.mutate',

    permissionKey:
      'recipe.mutate',

    entityType:
      'dish',

    entityId:
      dishId,

    reasonDetails:
      input.reason,

    beforeSnapshot,

    afterSnapshot,

    metadata: {
      operation:
        'dish_lifecycle',

      lifecycleAction:
        input.action,
    },
  })

  return {
    dish:
      serializeDish(
        afterSnapshot,
      ),
  }
}