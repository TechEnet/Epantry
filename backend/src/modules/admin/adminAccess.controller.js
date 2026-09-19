import {
  ApiResponse,
} from '../../utils/ApiResponse.js'

/*
|--------------------------------------------------------------------------
| Current Admin Access Serializer
|--------------------------------------------------------------------------
|
| Deliberately omitted:
|
| userId
| assignmentId
| authentication claims
| session information
| Firebase information
|
| Frontend receives only the effective administrative authorization state
| needed for UX/routing.
|
| Backend authorization remains authoritative for every protected operation.
|
*/

export function serializeCurrentAdminAccess(
  authorization,
) {
  return {
    isAdmin:
      authorization?.isAdmin ===
      true,

    isRootSuperAdmin:
      authorization
        ?.isRootSuperAdmin ===
      true,

    source:
      authorization?.source ===
        'super_admin' ||
      authorization?.source ===
        'assignment'
        ? authorization.source
        : 'none',

    roleKeys: [
      ...new Set(
        Array.isArray(
          authorization?.roleKeys,
        )
          ? authorization.roleKeys
          : [],
      ),
    ],

    permissionKeys: [
      ...new Set(
        Array.isArray(
          authorization?.permissionKeys,
        )
          ? authorization.permissionKeys
          : [],
      ),
    ],
  }
}

/*
|--------------------------------------------------------------------------
| GET /api/v1/admin/access
|--------------------------------------------------------------------------
|
| Route middleware guarantees:
|
| authenticated session
| active EPANTRY account
| resolved admin authorization
| actual administrative access
| MFA assurance
|
*/

export async function getCurrentAdminAccessController(
  req,
  res,
  next,
) {
  try {
    const access =
      serializeCurrentAdminAccess(
        req.adminAuthorization,
      )

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,

          {
            access,

            requestId:
              req.requestId,
          },

          'Administrative access loaded',
        ),
      )
  } catch (error) {
    return next(
      error,
    )
  }
}