import {
  ApiResponse,
} from '../../utils/ApiResponse.js'

import {
  createHouseholdForUser,
  getCurrentHouseholdContext,
  getHouseholdContextByIdForUser,
  getHouseholdMembersByIdForUser,
  getHouseholdMembersForUser,
  removeHouseholdMemberForUser,
  selectCurrentHouseholdForUser,
  updateHouseholdForUser,
  updateHouseholdMemberRoleForUser,
} from './household.service.js'

/*
|--------------------------------------------------------------------------
| GET /households/me
|--------------------------------------------------------------------------
*/

export async function getMyHouseholdController(
  req,
  res,
) {
  const context =
    await getCurrentHouseholdContext(
      req.currentUser._id,
    )

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,

        {
          ...context,

          requestId:
            req.requestId,
        },

        context.hasHousehold
          ? 'Household context loaded'
          : 'No household has been created yet',
      ),
    )
}

/*
|--------------------------------------------------------------------------
| GET /households/me/members
|--------------------------------------------------------------------------
*/

export async function getMyHouseholdMembersController(
  req,
  res,
) {
  const context =
    await getHouseholdMembersForUser(
      req.currentUser._id,
    )

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,

        {
          ...context,

          requestId:
            req.requestId,
        },

        context.hasHousehold
          ? 'Household members loaded'
          : 'No household has been created yet',
      ),
    )
}


/*
|--------------------------------------------------------------------------
| POST /households/:householdId/select
|--------------------------------------------------------------------------
*/

export async function selectHouseholdController(
  req,
  res,
) {
  const context =
    await selectCurrentHouseholdForUser({
      userId:
        req.currentUser._id,

      householdId:
        req.params.householdId,
    })

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {
          ...context,
          requestId:
            req.requestId,
        },
        'Active household selected',
      ),
    )
}

/*
|--------------------------------------------------------------------------
| GET /households/:householdId
|--------------------------------------------------------------------------
|
| The route has already loaded an authorized household tenant.
|
| Service authorization is intentionally repeated for defense in depth.
|
*/

export async function getHouseholdByIdController(
  req,
  res,
) {
  const context =
    await getHouseholdContextByIdForUser({
      userId:
        req.currentUser._id,

      householdId:
        req.params
          .householdId,
    })

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,

        {
          ...context,

          requestId:
            req.requestId,
        },

        'Household context loaded',
      ),
    )
}

/*
|--------------------------------------------------------------------------
| GET /households/:householdId/members
|--------------------------------------------------------------------------
*/

export async function getHouseholdMembersByIdController(
  req,
  res,
) {
  const context =
    await getHouseholdMembersByIdForUser({
      userId:
        req.currentUser._id,

      householdId:
        req.params
          .householdId,
    })

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,

        {
          ...context,

          requestId:
            req.requestId,
        },

        'Household members loaded',
      ),
    )
}

/*
|--------------------------------------------------------------------------
| POST /households
|--------------------------------------------------------------------------
*/

export async function createHouseholdController(
  req,
  res,
) {
  const context =
    await createHouseholdForUser({
      userId:
        req.currentUser._id,

      payload:
        req.body,
    })

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,

        {
          ...context,

          requestId:
            req.requestId,
        },

        'Household created successfully',
      ),
    )
}

/*
|--------------------------------------------------------------------------
| PATCH /households/:householdId
|--------------------------------------------------------------------------
|
| Route policy:
|
| active account
| + active tenant membership
| + owner/admin household role
| + CSRF
|
*/

export async function updateHouseholdController(
  req,
  res,
) {
  const context =
    await updateHouseholdForUser({
      userId:
        req.currentUser._id,

      householdId:
        req.params
          .householdId,

      payload:
        req.body,
    })

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,

        {
          ...context,

          requestId:
            req.requestId,
        },

        'Household updated successfully',
      ),
    )
}

/*
|--------------------------------------------------------------------------
| PATCH /households/:householdId/members/:membershipId/role
|--------------------------------------------------------------------------
*/

export async function updateHouseholdMemberRoleController(
  req,
  res,
) {
  const result =
    await updateHouseholdMemberRoleForUser({
      actorUserId:
        req.currentUser._id,

      householdId:
        req.params.householdId,

      membershipId:
        req.params.membershipId,

      payload:
        req.body,
    })

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,

        {
          ...result,

          requestId:
            req.requestId,
        },

        result.unchanged
          ? 'Household member role is already up to date'
          : 'Household member role updated successfully',
      ),
    )
}

/*
|--------------------------------------------------------------------------
| DELETE /households/:householdId/members/:membershipId
|--------------------------------------------------------------------------
*/

export async function removeHouseholdMemberController(
  req,
  res,
) {
  const result =
    await removeHouseholdMemberForUser({
      actorUserId:
        req.currentUser._id,

      householdId:
        req.params.householdId,

      membershipId:
        req.params.membershipId,
    })

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,

        {
          ...result,

          requestId:
            req.requestId,
        },

        'Household member removed successfully',
      ),
    )
}

