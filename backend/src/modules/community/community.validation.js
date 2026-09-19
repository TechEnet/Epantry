import {
  z,
} from 'zod';

import {
  createAdminRecipeSchema,
} from '../recipes/recipe.admin.validation.js';

import {
  COMMUNITY_RECIPE_STATUSES,
  COMMUNITY_RECIPE_VISIBILITIES,
  CREATOR_COURSE_ACCESS_TYPES,
  CREATOR_VERIFICATION_STATES,
} from './community.models.js';

export const objectIdSchema =
  z
      .string()
      .trim()
      .regex(
          /^[a-f\d]{24}$/i,
          'A valid MongoDB ObjectId is required.',
      );

export const idempotencyKeySchema =
  z
      .string()
      .trim()
      .min(
          8,
          'Idempotency-Key must contain at least 8 characters.',
      )
      .max(
          160,
          'Idempotency-Key is too long.',
      );

const rightsSchema =
  z
      .object({
          allowForks:
              z
                  .boolean()
                  .optional()
                  .default(
                      true,
                  ),

          allowProseReuseInForks:
              z
                  .boolean()
                  .optional()
                  .default(
                      false,
                  ),

          allowMediaReuseInForks:
              z
                  .boolean()
                  .optional()
                  .default(
                      false,
                  ),
      })
      .strict()
      .default({});

export const createCommunityRecipeBodySchema =
  z
      .object({
          recipe:
              createAdminRecipeSchema,

          visibility:
              z
                  .enum(
                      COMMUNITY_RECIPE_VISIBILITIES,
                  )
                  .default(
                      'private',
                  ),

          creatorStatement:
              z
                  .string()
                  .trim()
                  .max(
                      4000,
                  )
                  .optional()
                  .default(
                      '',
                  ),

          rights:
              rightsSchema,
      })
      .strict();

export const forkCommunityRecipeBodySchema =
  z
      .object({
          recipe:
              createAdminRecipeSchema,

          visibility:
              z
                  .enum(
                      COMMUNITY_RECIPE_VISIBILITIES,
                  )
                  .default(
                      'private',
                  ),

          creatorStatement:
              z
                  .string()
                  .trim()
                  .max(
                      4000,
                  )
                  .optional()
                  .default(
                      '',
                  ),

          rights:
              rightsSchema,

          attributionLabel:
              z
                  .string()
                  .trim()
                  .min(
                      1,
                  )
                  .max(
                      500,
                  )
                  .optional()
                  .default(
                      'Adapted from a community recipe',
                  ),

          reuseSourceProse:
              z
                  .boolean()
                  .optional()
                  .default(
                      false,
                  ),

          reuseSourceMedia:
              z
                  .boolean()
                  .optional()
                  .default(
                      false,
                  ),
      })
      .strict();

export const submitCommunityRecipeBodySchema =
  z
      .object({
          reason:
              z
                  .string()
                  .trim()
                  .min(
                      3,
                  )
                  .max(
                      2000,
                  )
                  .optional()
                  .default(
                      'Submitted by creator for public moderation.',
                  ),
      })
      .strict();

const ratingSchema =
  z
      .number()
      .int()
      .min(
          1,
      )
      .max(
          5,
      );

export const createCommunityReviewBodySchema =
  z
      .object({
          overallRating:
              ratingSchema,

          tasteRating:
              ratingSchema
                  .nullable()
                  .optional()
                  .default(
                      null,
                  ),

          easeRating:
              ratingSchema
                  .nullable()
                  .optional()
                  .default(
                      null,
                  ),

          timeAccuracyRating:
              ratingSchema
                  .nullable()
                  .optional()
                  .default(
                      null,
                  ),

          familyResponseRating:
              ratingSchema
                  .nullable()
                  .optional()
                  .default(
                      null,
                  ),

          wouldCookAgain:
              z
                  .boolean()
                  .nullable()
                  .optional()
                  .default(
                      null,
                  ),

          reviewText:
              z
                  .string()
                  .trim()
                  .max(
                      4000,
                  )
                  .optional()
                  .default(
                      '',
                  ),
      })
      .strict();

export const createCreatorProfileBodySchema =
  z
      .object({
          slug:
              z
                  .string()
                  .trim()
                  .min(
                      2,
                  )
                  .max(
                      180,
                  ),

          displayName:
              z
                  .string()
                  .trim()
                  .min(
                      2,
                  )
                  .max(
                      160,
                  ),

          biography:
              z
                  .string()
                  .trim()
                  .max(
                      6000,
                  )
                  .optional()
                  .default(
                      '',
                  ),

          cuisineSpecialties:
              z
                  .array(
                      z
                          .string()
                          .trim()
                          .min(
                              1,
                          )
                          .max(
                              120,
                          ),
                  )
                  .max(
                      30,
                  )
                  .optional()
                  .default(
                      [],
                  ),

          languages:
              z
                  .array(
                      z
                          .string()
                          .trim()
                          .min(
                              2,
                          )
                          .max(
                              24,
                          ),
                  )
                  .max(
                      20,
                  )
                  .optional()
                  .default(
                      [],
                  ),

          commercialDisclosure:
              z
                  .string()
                  .trim()
                  .max(
                      3000,
                  )
                  .optional()
                  .default(
                      '',
                  ),
      })
      .strict();

export const requestCreatorVerificationBodySchema =
  z
      .object({
          statement:
              z
                  .string()
                  .trim()
                  .min(
                      10,
                  )
                  .max(
                      3000,
                  ),
      })
      .strict();

export const creatorVerificationBodySchema =
  z
      .object({
          decision:
              z.enum([
                  'verified',
                  'rejected',
                  'suspended',
              ]),

          reason:
              z
                  .string()
                  .trim()
                  .min(
                      3,
                  )
                  .max(
                      4000,
                  ),
      })
      .strict();

export const moderationDecisionBodySchema =
  z
      .object({
          decision:
              z.enum([
                  'approve',
                  'request_changes',
                  'reject',
              ]),

          reason:
              z
                  .string()
                  .trim()
                  .min(
                      3,
                  )
                  .max(
                      4000,
                  ),

          effectiveFrom:
              z.coerce
                  .date()
                  .optional(),
      })
      .strict();

export const communityRecipeIdParamsSchema =
  z
      .object({
          id:
              objectIdSchema,
      })
      .strict();

export const creatorIdParamsSchema =
  z
      .object({
          id:
              objectIdSchema,
      })
      .strict();

export const courseIdParamsSchema =
  z
      .object({
          id:
              objectIdSchema,
      })
      .strict();

export const listCommunityRecipesQuerySchema =
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
                      20,
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

          creatorId:
              objectIdSchema
                  .optional(),
      })
      .strict();

export const listMyCommunityRecipesQuerySchema =
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
                      20,
                  ),

          status:
              z
                  .enum(
                      COMMUNITY_RECIPE_STATUSES,
                  )
                  .optional(),
      })
      .strict();

export const moderationQueueQuerySchema =
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
                      25,
                  ),

          status:
              z
                  .enum([
                      'pending',
                      'changes_requested',
                      'rejected',
                      'approved',
                  ])
                  .optional(),
      })
      .strict();

export const creatorVerificationQueueQuerySchema =
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
                      25,
                  ),

          status:
              z
                  .enum(
                      CREATOR_VERIFICATION_STATES,
                  )
                  .optional()
                  .default(
                      'pending',
                  ),
      })
      .strict();

export const ingredientLookupQuerySchema =
  z
      .object({
          search:
              z
                  .string()
                  .trim()
                  .min(
                      1,
                  )
                  .max(
                      120,
                  ),

          limit:
              z.coerce
                  .number()
                  .int()
                  .min(
                      1,
                  )
                  .max(
                      30,
                  )
                  .default(
                      12,
                  ),
      })
      .strict();

const courseRightsSchema =
  z
      .object({
          ownerOrLicensor:
              z
                  .string()
                  .trim()
                  .max(
                      300,
                  )
                  .optional()
                  .default(
                      '',
                  ),

          allowedTerritories:
              z
                  .array(
                      z
                          .string()
                          .trim()
                          .min(
                              2,
                          )
                          .max(
                              10,
                          ),
                  )
                  .max(
                      30,
                  )
                  .optional()
                  .default(
                      [],
                  ),

          downloadableMaterialsAllowed:
              z
                  .boolean()
                  .optional()
                  .default(
                      false,
                  ),

          sponsored:
              z
                  .boolean()
                  .optional()
                  .default(
                      false,
                  ),
      })
      .strict()
      .default({});

export const createCreatorCourseBodySchema =
  z
      .object({
          linkedCommunityRecipeId:
              objectIdSchema,

          slug:
              z
                  .string()
                  .trim()
                  .min(
                      2,
                  )
                  .max(
                      220,
                  ),

          title:
              z
                  .string()
                  .trim()
                  .min(
                      2,
                  )
                  .max(
                      220,
                  ),

          summary:
              z
                  .string()
                  .trim()
                  .max(
                      5000,
                  )
                  .optional()
                  .default(
                      '',
                  ),

          category:
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

          language:
              z
                  .string()
                  .trim()
                  .min(
                      2,
                  )
                  .max(
                      24,
                  )
                  .optional()
                  .default(
                      'en',
                  ),

          accessType:
              z
                  .enum(
                      CREATOR_COURSE_ACCESS_TYPES,
                  )
                  .default(
                      'free',
                  ),

          requiredEquipment:
              z
                  .array(
                      z
                          .string()
                          .trim()
                          .min(
                              1,
                          )
                          .max(
                              120,
                          ),
                  )
                  .max(
                      50,
                  )
                  .optional()
                  .default(
                      [],
                  ),

          commercialDisclosure:
              z
                  .string()
                  .trim()
                  .max(
                      3000,
                  )
                  .optional()
                  .default(
                      '',
                  ),

          rights:
              courseRightsSchema,
      })
      .strict()
      .superRefine(
          (
              value,
              context,
          ) => {
              if (
                  value.rights?.sponsored ===
                      true &&
                  !value.commercialDisclosure
              ) {
                  context.addIssue({
                      code:
                          z.ZodIssueCode.custom,

                      path: [
                          'commercialDisclosure',
                      ],

                      message:
                          'Sponsored learning content requires a visible commercial disclosure.',
                  });
              }
          },
      );

export const listCreatorCoursesQuerySchema =
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
                      20,
                  ),

          creatorId:
              objectIdSchema
                  .optional(),

          accessType:
              z
                  .enum(
                      CREATOR_COURSE_ACCESS_TYPES,
                  )
                  .optional(),
      })
      .strict();

export const prepareCreatorCourseBodySchema =
  z
      .object({
          targetServings:
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
      .strict();