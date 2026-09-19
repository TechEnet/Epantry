import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  HOUSEHOLD_MEMBERSHIP_ROLES,
} from '../households/householdMembership.model.js'

import {
  Household,
} from '../households/household.model.js'

import {
  requireHouseholdMembershipAccess,
} from '../households/household.service.js'

import {
  USER_ACCESS_TYPES,
} from '../users/user.model.js'

import {
  requireMfaAssurance,
  requireRecentMfaAuthentication,
} from './auth.middleware.js'

/*
|--------------------------------------------------------------------------
| Privileged Application Access
|--------------------------------------------------------------------------
*/

export const PRIVILEGED_ACCESS_TYPES =
  Object.freeze([
    'host',
    'super_admin',
  ])

const VALID_ACCESS_TYPES =
  new Set(
    USER_ACCESS_TYPES,
  )

const VALID_HOUSEHOLD_ROLES =
  new Set(
    HOUSEHOLD_MEMBERSHIP_ROLES,
  )

/*
|--------------------------------------------------------------------------
| Generic Identifier Helpers
|--------------------------------------------------------------------------
*/

function normalizeIdentifier(
  value,
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return ''
  }

  if (
    typeof value ===
      'object' &&
    value._id
  ) {
    return String(
      value._id,
    )
  }

  return String(
    value,
  )
}

function sameIdentifier(
  left,
  right,
) {
  const normalizedLeft =
    normalizeIdentifier(
      left,
    )

  const normalizedRight =
    normalizeIdentifier(
      right,
    )

  return Boolean(
    normalizedLeft &&
    normalizedRight &&
    normalizedLeft ===
      normalizedRight,
  )
}

/*
|--------------------------------------------------------------------------
| Loaded User Requirement
|--------------------------------------------------------------------------
*/

function requireLoadedUser(
  req,
) {
  if (
    !req.currentUser
  ) {
    throw new ApiError(
      500,
      'Authorization middleware requires a loaded EPANTRY user.',
    )
  }

  return req.currentUser
}

/*
|--------------------------------------------------------------------------
| Application Access Resolution
|--------------------------------------------------------------------------
|
| Seller / Brand / B2B are intentionally absent.
|
*/

export function getGrantedAccessTypes(
  user,
) {
  const accessTypes = []

  if (
    user?.customerEnabled ===
    true
  ) {
    accessTypes.push(
      'customer',
    )
  }

  if (
    user?.hostEnabled ===
      true &&
    user?.hostAccessStatus ===
      'active'
  ) {
    accessTypes.push(
      'host',
    )
  }

  if (
    user?.superAdminEnabled ===
    true
  ) {
    accessTypes.push(
      'super_admin',
    )
  }

  return accessTypes
}

function normalizeRequiredAccessTypes(
  accessTypes,
) {
  const normalized = [
    ...new Set(
      accessTypes
        .flat()
        .map(
          (accessType) =>
            String(
              accessType ||
                '',
            ).trim(),
        )
        .filter(Boolean),
    ),
  ]

  if (
    normalized.length ===
    0
  ) {
    throw new Error(
      'Authorization middleware requires at least one application access type.',
    )
  }

  const invalidAccessTypes =
    normalized.filter(
      (accessType) =>
        !VALID_ACCESS_TYPES.has(
          accessType,
        ),
    )

  if (
    invalidAccessTypes.length >
    0
  ) {
    throw new Error(
      `Unknown EPANTRY application access type(s): ${invalidAccessTypes.join(', ')}`,
    )
  }

  return normalized
}

function normalizePrivilegedAccessTypes(
  accessTypes,
) {
  const normalized =
    normalizeRequiredAccessTypes(
      accessTypes,
    )

  const invalidAccessTypes =
    normalized.filter(
      (accessType) =>
        !PRIVILEGED_ACCESS_TYPES.includes(
          accessType,
        ),
    )

  if (
    invalidAccessTypes.length >
    0
  ) {
    throw new Error(
      `Non-privileged access type(s) cannot use privileged access guards: ${invalidAccessTypes.join(', ')}`,
    )
  }

  return normalized
}

/*
|--------------------------------------------------------------------------
| Pure Application Access Checks
|--------------------------------------------------------------------------
*/

export function userHasAnyAccess(
  user,
  accessTypes,
) {
  const requiredAccessTypes =
    normalizeRequiredAccessTypes(
      Array.isArray(
        accessTypes,
      )
        ? accessTypes
        : [
            accessTypes,
          ],
    )

  const grantedAccessTypes =
    new Set(
      getGrantedAccessTypes(
        user,
      ),
    )

  return requiredAccessTypes.some(
    (accessType) =>
      grantedAccessTypes.has(
        accessType,
      ),
  )
}

export function userHasAllAccess(
  user,
  accessTypes,
) {
  const requiredAccessTypes =
    normalizeRequiredAccessTypes(
      Array.isArray(
        accessTypes,
      )
        ? accessTypes
        : [
            accessTypes,
          ],
    )

  const grantedAccessTypes =
    new Set(
      getGrantedAccessTypes(
        user,
      ),
    )

  return requiredAccessTypes.every(
    (accessType) =>
      grantedAccessTypes.has(
        accessType,
      ),
  )
}

export function isPrivilegedUser(
  user,
) {
  const grantedAccessTypes =
    new Set(
      getGrantedAccessTypes(
        user,
      ),
    )

  return PRIVILEGED_ACCESS_TYPES.some(
    (accessType) =>
      grantedAccessTypes.has(
        accessType,
      ),
  )
}

/*
|--------------------------------------------------------------------------
| Application Access Errors
|--------------------------------------------------------------------------
*/

function createAccessDeniedError(
  requiredAccessTypes,
  mode,
) {
  return new ApiError(
    403,
    'You do not have permission to perform this action.',
    [
      {
        code:
          'AUTH_ACCESS_REQUIRED',

        mode,

        requiredAccessTypes,
      },
    ],
  )
}

/*
|--------------------------------------------------------------------------
| Require Any Application Access
|--------------------------------------------------------------------------
*/

export function requireAnyAccess(
  ...accessTypes
) {
  const requiredAccessTypes =
    normalizeRequiredAccessTypes(
      accessTypes,
    )

  return function requireAnyAccessMiddleware(
    req,
    res,
    next,
  ) {
    try {
      const user =
        requireLoadedUser(
          req,
        )

      if (
        userHasAnyAccess(
          user,
          requiredAccessTypes,
        )
      ) {
        return next()
      }

      return next(
        createAccessDeniedError(
          requiredAccessTypes,
          'any',
        ),
      )
    } catch (error) {
      return next(
        error,
      )
    }
  }
}

/*
|--------------------------------------------------------------------------
| Require All Application Access
|--------------------------------------------------------------------------
*/

export function requireAllAccess(
  ...accessTypes
) {
  const requiredAccessTypes =
    normalizeRequiredAccessTypes(
      accessTypes,
    )

  return function requireAllAccessMiddleware(
    req,
    res,
    next,
  ) {
    try {
      const user =
        requireLoadedUser(
          req,
        )

      if (
        userHasAllAccess(
          user,
          requiredAccessTypes,
        )
      ) {
        return next()
      }

      return next(
        createAccessDeniedError(
          requiredAccessTypes,
          'all',
        ),
      )
    } catch (error) {
      return next(
        error,
      )
    }
  }
}

/*
|--------------------------------------------------------------------------
| Named Access Gates
|--------------------------------------------------------------------------
*/

export function requireCustomerAccess(
  req,
  res,
  next,
) {
  try {
    const user =
      requireLoadedUser(
        req,
      )

    const hasCustomerAccess =
      userHasAnyAccess(
        user,
        [
          'customer',
        ],
      )

    /*
    | activeMode never grants Customer authority. It only narrows execution
    | when a dual Customer + Host account is explicitly operating in Host
    | presentation mode. The underlying Customer capability is still required.
    */
    const hostContextActive =
      user?.hostEnabled ===
        true &&
      user?.hostAccessStatus ===
        'active' &&
      user?.activeMode ===
        'host'

    const superAdminContextActive =
      user?.superAdminEnabled ===
      true

    if (
      hasCustomerAccess &&
      !hostContextActive &&
      !superAdminContextActive
    ) {
      return next()
    }

    return next(
      new ApiError(
        403,
        'Customer access is required for this action.',
        [
          {
            code:
              'AUTH_CUSTOMER_CONTEXT_REQUIRED',

            activeMode:
              user?.activeMode ||
              null,

            requiredAccessTypes: [
              'customer',
            ],
          },
        ],
      ),
    )
  } catch (error) {
    return next(
      error,
    )
  }
}

export const requireHostAccess =
  requireAnyAccess(
    'host',
  )

export const requireSuperAdminAccess =
  requireAnyAccess(
    'super_admin',
  )

/*
|--------------------------------------------------------------------------
| Privileged MFA Compositions
|--------------------------------------------------------------------------
|
| Existing TOTP MFA middleware is reused.
|
*/

export function requirePrivilegedAccess(
  ...accessTypes
) {
  const privilegedAccessTypes =
    normalizePrivilegedAccessTypes(
      accessTypes,
    )

  return [
    requireAnyAccess(
      privilegedAccessTypes,
    ),

    requireMfaAssurance,
  ]
}

export function requireRecentPrivilegedAccess(
  ...accessTypes
) {
  const privilegedAccessTypes =
    normalizePrivilegedAccessTypes(
      accessTypes,
    )

  return [
    requireAnyAccess(
      privilegedAccessTypes,
    ),

    requireRecentMfaAuthentication,
  ]
}

/*
|--------------------------------------------------------------------------
| Household Role Normalization
|--------------------------------------------------------------------------
|
| Household roles remain separate tenant-scoped roles:
|
| owner
| admin
| member
|
*/

function normalizeHouseholdRoles(
  roles,
) {
  const normalized = [
    ...new Set(
      roles
        .flat()
        .map(
          (role) =>
            String(
              role ||
                '',
            ).trim(),
        )
        .filter(Boolean),
    ),
  ]

  if (
    normalized.length ===
    0
  ) {
    throw new Error(
      'Household authorization requires at least one household role.',
    )
  }

  const invalidRoles =
    normalized.filter(
      (role) =>
        !VALID_HOUSEHOLD_ROLES.has(
          role,
        ),
    )

  if (
    invalidRoles.length >
    0
  ) {
    throw new Error(
      `Unknown household role(s): ${invalidRoles.join(', ')}`,
    )
  }

  return normalized
}

/*
|--------------------------------------------------------------------------
| Household Tenant Loader
|--------------------------------------------------------------------------
*/

export function loadHouseholdTenantFromParam(
  paramName =
    'householdId',
) {
  const normalizedParamName =
    String(
      paramName ||
        '',
    ).trim()

  if (
    !normalizedParamName
  ) {
    throw new Error(
      'Household tenant middleware requires a route parameter name.',
    )
  }

  return async function loadHouseholdTenantMiddleware(
    req,
    res,
    next,
  ) {
    try {
      const user =
        requireLoadedUser(
          req,
        )

      const householdId =
        req.params?.[
          normalizedParamName
        ]

      const membership =
        await requireHouseholdMembershipAccess({
          userId:
            user._id,

          householdId,
        })

      const household =
        await Household.findOne({
          _id:
            householdId,

          status:
            'active',
        }).lean()

      if (!household) {
        throw new ApiError(
          404,
          'Household was not found.',
          [
            {
              code:
                'HOUSEHOLD_NOT_FOUND',
            },
          ],
        )
      }

      req.tenant = {
        type:
          'household',

        id:
          String(
            household._id,
          ),

        role:
          membership.role,

        household,

        membership,
      }

      return next()
    } catch (error) {
      return next(
        error,
      )
    }
  }
}

/*
|--------------------------------------------------------------------------
| Household Tenant Role Gate
|--------------------------------------------------------------------------
*/

export function requireHouseholdTenantRole(
  ...roles
) {
  const allowedRoles =
    normalizeHouseholdRoles(
      roles,
    )

  return function requireHouseholdTenantRoleMiddleware(
    req,
    res,
    next,
  ) {
    const tenant =
      req.tenant

    if (
      tenant?.type !==
        'household' ||
      !tenant.membership
    ) {
      return next(
        new ApiError(
          500,
          'Household tenant context must be loaded before household role authorization.',
        ),
      )
    }

    if (
      allowedRoles.includes(
        tenant.role,
      )
    ) {
      return next()
    }

    return next(
      new ApiError(
        403,
        'Your household role does not allow this action.',
        [
          {
            code:
              'HOUSEHOLD_ROLE_REQUIRED',

            allowedRoles,
          },
        ],
      ),
    )
  }
}

/*
|--------------------------------------------------------------------------
| Self-owned Resource Authorization
|--------------------------------------------------------------------------
*/

export function requireSelfOwnedResource({
  resourceProperty =
    'resource',

  ownerField =
    'userId',
} = {}) {
  const resourceKey =
    String(
      resourceProperty ||
        '',
    ).trim()

  const ownerKey =
    String(
      ownerField ||
        '',
    ).trim()

  if (
    !resourceKey ||
    !ownerKey
  ) {
    throw new Error(
      'Self-resource authorization requires resourceProperty and ownerField.',
    )
  }

  return function requireSelfOwnedResourceMiddleware(
    req,
    res,
    next,
  ) {
    try {
      const user =
        requireLoadedUser(
          req,
        )

      const resource =
        req[
          resourceKey
        ]

      if (!resource) {
        return next(
          new ApiError(
            404,
            'Resource was not found.',
            [
              {
                code:
                  'RESOURCE_NOT_FOUND',
              },
            ],
          ),
        )
      }

      if (
        !sameIdentifier(
          user._id,
          resource[
            ownerKey
          ],
        )
      ) {
        return next(
          new ApiError(
            404,
            'Resource was not found.',
            [
              {
                code:
                  'RESOURCE_NOT_FOUND',
              },
            ],
          ),
        )
      }

      return next()
    } catch (error) {
      return next(
        error,
      )
    }
  }
}

/*
|--------------------------------------------------------------------------
| Household-owned Resource Authorization
|--------------------------------------------------------------------------
*/

export function requireHouseholdOwnedResource({
  resourceProperty =
    'resource',

  householdField =
    'householdId',
} = {}) {
  const resourceKey =
    String(
      resourceProperty ||
        '',
    ).trim()

  const householdKey =
    String(
      householdField ||
        '',
    ).trim()

  if (
    !resourceKey ||
    !householdKey
  ) {
    throw new Error(
      'Household-resource authorization requires resourceProperty and householdField.',
    )
  }

  return function requireHouseholdOwnedResourceMiddleware(
    req,
    res,
    next,
  ) {
    const tenant =
      req.tenant

    if (
      tenant?.type !==
        'household' ||
      !tenant.id
    ) {
      return next(
        new ApiError(
          500,
          'Household tenant context must be loaded before household resource authorization.',
        ),
      )
    }

    const resource =
      req[
        resourceKey
      ]

    if (
      !resource ||
      !sameIdentifier(
        tenant.id,
        resource[
          householdKey
        ],
      )
    ) {
      return next(
        new ApiError(
          404,
          'Resource was not found.',
          [
            {
              code:
                'RESOURCE_NOT_FOUND',
            },
          ],
        ),
      )
    }

    return next()
  }
}