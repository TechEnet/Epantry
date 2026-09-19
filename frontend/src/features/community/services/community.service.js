import {
  apiClient,
} from '../../../api/apiClient';

function unwrap(
  response,
) {
  if (
      response?.data &&
      typeof response.data ===
          'object' &&
      Object.prototype.hasOwnProperty.call(
          response.data,
          'success',
      )
  ) {
      return response.data.data;
  }

  return response?.data ??
      response;
}

function encodePath(
  value,
) {
  return encodeURIComponent(
      String(
          value ||
              '',
      ).trim(),
  );
}

function newIdempotencyKey(
  prefix,
) {
  const suffix =
      typeof crypto !==
          'undefined' &&
      typeof crypto.randomUUID ===
          'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()
              .toString(16)
              .slice(2)}`;

  return `${prefix}:${suffix}`.slice(
      0,
      160,
  );
}

async function getCsrfToken() {
  const response =
      await apiClient.get(
          '/auth/csrf',
      );

  const data =
      unwrap(
          response,
      );

  if (!data?.csrfToken) {
      throw new Error(
          'Unable to initialize secure Community request.',
      );
  }

  return data.csrfToken;
}

async function mutate({
  method = 'post',
  url,
  data = {},
  idempotencyPrefix = '',
}) {
  const csrfToken =
      await getCsrfToken();

  const headers = {
      'x-csrf-token':
          csrfToken,
  };

  if (idempotencyPrefix) {
      headers['idempotency-key'] =
          newIdempotencyKey(
              idempotencyPrefix,
          );
  }

  const response =
      await apiClient.request({
          method,
          url,
          data,
          headers,
      });

  return unwrap(
      response,
  );
}

export function getCommunityErrorMessage(
  error,
  fallback =
      'Unable to complete this Community action right now.',
) {
  return (
      error?.response?.data
          ?.message ||
      error?.message ||
      fallback
  );
}

/*
|--------------------------------------------------------------------------
| P29 Community Recipes
|--------------------------------------------------------------------------
*/

export async function listCommunityRecipes(
  params = {},
) {
  const response =
      await apiClient.get(
          '/community-recipes',
          {
              params,
          },
      );

  return unwrap(
      response,
  );
}

export async function getCommunityRecipe(
  communityRecipeId,
) {
  const response =
      await apiClient.get(
          `/community-recipes/${encodePath(
              communityRecipeId,
          )}`,
      );

  return unwrap(
      response,
  );
}

export async function listMyCommunityRecipes(
  params = {},
) {
  const response =
      await apiClient.get(
          '/me/community-recipes',
          {
              params,
          },
      );

  return unwrap(
      response,
  );
}

export async function searchCommunityIngredients({
  search,
  limit = 12,
}) {
  const response =
      await apiClient.get(
          '/community/ingredients',
          {
              params: {
                  search,
                  limit,
              },
          },
      );

  return unwrap(
      response,
  );
}

export async function createCommunityRecipe(
  payload,
) {
  return mutate({
      url:
          '/recipes/community',

      data:
          payload,

      idempotencyPrefix:
          'community-recipe',
  });
}

export async function submitCommunityRecipe(
  communityRecipeId,
  reason,
) {
  return mutate({
      url:
          `/community-recipes/${encodePath(
              communityRecipeId,
          )}/submit`,

      data: {
          reason,
      },
  });
}

export async function forkCommunityRecipe({
  communityRecipeId,
  payload,
}) {
  return mutate({
      url:
          `/recipes/${encodePath(
              communityRecipeId,
          )}/fork`,

      data:
          payload,

      idempotencyPrefix:
          'community-fork',
  });
}

export async function reviewCommunityRecipe({
  communityRecipeId,
  payload,
}) {
  return mutate({
      url:
          `/recipes/${encodePath(
              communityRecipeId,
          )}/reviews`,

      data:
          payload,

      idempotencyPrefix:
          'community-review',
  });
}

/*
|--------------------------------------------------------------------------
| P30 Creator Profile
|--------------------------------------------------------------------------
*/

export async function getCreatorProfile(
  creatorProfileId,
) {
  const response =
      await apiClient.get(
          `/creators/${encodePath(
              creatorProfileId,
          )}`,
      );

  return unwrap(
      response,
  );
}

export async function getMyCreatorProfile() {
  const response =
      await apiClient.get(
          '/me/creator-profile',
      );

  return unwrap(
      response,
  );
}

export async function createCreatorProfile(
  payload,
) {
  return mutate({
      url:
          '/creators/profile',

      data:
          payload,
  });
}

export async function requestCreatorVerification(
  statement,
) {
  return mutate({
      url:
          '/creators/profile/request-verification',

      data: {
          statement,
      },
  });
}

export async function followCreator(
  creatorProfileId,
) {
  return mutate({
      url:
          `/creators/${encodePath(
              creatorProfileId,
          )}/follow`,

      data: {},
  });
}

/*
|--------------------------------------------------------------------------
| P31 Learn / EPANTRY Pro Foundation
|--------------------------------------------------------------------------
*/

export async function listCreatorCourses(
  params = {},
) {
  const response =
      await apiClient.get(
          '/courses',
          {
              params,
          },
      );

  return unwrap(
      response,
  );
}

export async function getLearningPro() {
  const response =
      await apiClient.get(
          '/learning/pro',
      );

  return unwrap(
      response,
  );
}

export async function createCreatorCourse(
  payload,
) {
  return mutate({
      url:
          '/creators/profile/courses',

      data:
          payload,
  });
}

export async function prepareCreatorCourse({
  courseId,
  targetServings,
}) {
  return mutate({
      url:
          `/courses/${encodePath(
              courseId,
          )}/prepare`,

      data: {
          targetServings,
      },

      idempotencyPrefix:
          'prepare-course',
  });
}

/*
|--------------------------------------------------------------------------
| M03 Admin Moderation / Creator Ops
|--------------------------------------------------------------------------
*/

export async function listCommunityModerationQueue(
  params = {},
) {
  const response =
      await apiClient.get(
          '/admin/community-recipes/moderation',
          {
              params,
          },
      );

  return unwrap(
      response,
  );
}

export async function getCommunityModerationDetail(
  communityRecipeId,
) {
  const response =
      await apiClient.get(
          `/admin/community-recipes/${encodePath(
              communityRecipeId,
          )}`,
      );

  return unwrap(
      response,
  );
}

export async function moderateCommunityRecipe({
  communityRecipeId,
  decision,
  reason,
}) {
  return mutate({
      url:
          `/admin/community-recipes/${encodePath(
              communityRecipeId,
          )}/moderate`,

      data: {
          decision,
          reason,
      },
  });
}

export async function listCreatorVerificationQueue(
  params = {},
) {
  const response =
      await apiClient.get(
          '/admin/creators/verification',
          {
              params,
          },
      );

  return unwrap(
      response,
  );
}

export async function verifyCreatorProfile({
  creatorProfileId,
  decision,
  reason,
}) {
  return mutate({
      url:
          `/admin/creators/${encodePath(
              creatorProfileId,
          )}/verification`,

      data: {
          decision,
          reason,
      },
  });
}