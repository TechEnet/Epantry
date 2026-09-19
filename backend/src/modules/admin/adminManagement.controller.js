import {
  z,
} from 'zod'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  ApiResponse,
} from '../../utils/ApiResponse.js'

import {
  createAdminRole,
  getAdminUserRoles,
  listAdminPermissionCatalog,
  listAdminRoles,
  updateAdminRole,
  updateAdminUserRoles,
} from './adminManagement.service.js'

/*
|--------------------------------------------------------------------------
| Shared Validation
|--------------------------------------------------------------------------
*/

const objectIdPattern =
  /^[a-f\d]{24}$/i

const roleKeyPattern =
  /^[a-z][a-z0-9_]*$/

const reasonSchema =
  z.object({
    reasonCode:
      z.string()
        .trim()
        .min(
          1,
        )
        .max(
          120,
        ),

    reasonDetails:
      z.string()
        .trim()
        .max(
          1000,
        )
        .optional()
        .nullable(),
  })

/*
|--------------------------------------------------------------------------
| Role Validation
|--------------------------------------------------------------------------
*/

const roleParamsSchema =
  z.object({
    roleId:
      z.string()
        .trim()
        .regex(
          objectIdPattern,
          'A valid admin role ID is required.',
        ),
  })
  .strict()

const createRoleSchema =
  reasonSchema
    .extend({
      key:
        z.string()
          .trim()
          .toLowerCase()
          .min(
            3,
          )
          .max(
            64,
          )
          .regex(
            roleKeyPattern,
            'Role key must use lowercase letters, numbers and underscores.',
          ),

      name:
        z.string()
          .trim()
          .min(
            2,
          )
          .max(
            80,
          ),

      description:
        z.string()
          .trim()
          .min(
            2,
          )
          .max(
            280,
          ),

      permissionKeys:
        z.array(
          z.string()
            .trim()
            .min(
              1,
            )
            .max(
              120,
            ),
        )
          .min(
            1,
          )
          .max(
            100,
          ),
    })
    .strict()

const updateRoleSchema =
  reasonSchema
    .extend({
      name:
        z.string()
          .trim()
          .min(
            2,
          )
          .max(
            80,
          )
          .optional(),

      description:
        z.string()
          .trim()
          .min(
            2,
          )
          .max(
            280,
          )
          .optional(),

      permissionKeys:
        z.array(
          z.string()
            .trim()
            .min(
              1,
            )
            .max(
              120,
            ),
        )
          .min(
            1,
          )
          .max(
            100,
          )
          .optional(),

      status:
        z.enum([
          'active',
          'disabled',
        ])
          .optional(),
    })
    .strict()
    .refine(
      (value) =>
        value.name !==
          undefined ||
        value.description !==
          undefined ||
        value.permissionKeys !==
          undefined ||
        value.status !==
          undefined,

      {
        message:
          'Provide at least one admin role field to update.',
      },
    )

/*
|--------------------------------------------------------------------------
| User Assignment Validation
|--------------------------------------------------------------------------
*/

const adminUserParamsSchema =
  z.object({
    userId:
      z.string()
        .trim()
        .regex(
          objectIdPattern,
          'A valid user ID is required.',
        ),
  })
  .strict()

const updateUserRolesSchema =
  reasonSchema
    .extend({
      roleKeys:
        z.array(
          z.string()
            .trim()
            .toLowerCase()
            .min(
              1,
            )
            .max(
              64,
            )
            .regex(
              roleKeyPattern,
              'Invalid admin role key.',
            ),
        )
          .max(
            20,
          ),

      expiresAt:
        z.string()
          .datetime({
            offset:
              true,
          })
          .optional()
          .nullable(),
    })
    .strict()

/*
|--------------------------------------------------------------------------
| Parse Helpers
|--------------------------------------------------------------------------
*/

function parseOrThrow(
  schema,
  value,
  {
    code,
    message,
  },
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
        },
      ],
    )
  }

  return parsed.data
}

/*
|--------------------------------------------------------------------------
| Permission Catalog
|--------------------------------------------------------------------------
*/

export async function listAdminPermissionsController(
  req,
  res,
  next,
) {
  try {
    const permissions =
      await listAdminPermissionCatalog()

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,

          {
            permissions,

            requestId:
              req.requestId,
          },

          'Admin permission catalog loaded',
        ),
      )
  } catch (error) {
    return next(
      error,
    )
  }
}

/*
|--------------------------------------------------------------------------
| Roles
|--------------------------------------------------------------------------
*/

export async function listAdminRolesController(
  req,
  res,
  next,
) {
  try {
    const roles =
      await listAdminRoles()

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,

          {
            roles,

            requestId:
              req.requestId,
          },

          'Admin roles loaded',
        ),
      )
  } catch (error) {
    return next(
      error,
    )
  }
}

export async function createAdminRoleController(
  req,
  res,
  next,
) {
  try {
    const body =
      parseOrThrow(
        createRoleSchema,
        req.body,
        {
          code:
            'ADMIN_ROLE_CREATE_BODY_INVALID',

          message:
            'Invalid admin role request.',
        },
      )

    const role =
      await createAdminRole({
        ...body,

        actorUser:
          req.currentUser,

        adminAuthorization:
          req.adminAuthorization,

        requestId:
          req.requestId,
      })

    return res
      .status(201)
      .json(
        new ApiResponse(
          201,

          {
            role,

            requestId:
              req.requestId,
          },

          'Admin role created successfully',
        ),
      )
  } catch (error) {
    return next(
      error,
    )
  }
}

export async function updateAdminRoleController(
  req,
  res,
  next,
) {
  try {
    const {
      roleId,
    } =
      parseOrThrow(
        roleParamsSchema,
        req.params,
        {
          code:
            'ADMIN_ROLE_ID_INVALID',

          message:
            'A valid admin role ID is required.',
        },
      )

    const body =
      parseOrThrow(
        updateRoleSchema,
        req.body,
        {
          code:
            'ADMIN_ROLE_UPDATE_BODY_INVALID',

          message:
            'Invalid admin role update.',
        },
      )

    const role =
      await updateAdminRole({
        roleId,

        ...body,

        actorUser:
          req.currentUser,

        adminAuthorization:
          req.adminAuthorization,

        requestId:
          req.requestId,
      })

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,

          {
            role,

            requestId:
              req.requestId,
          },

          'Admin role updated successfully',
        ),
      )
  } catch (error) {
    return next(
      error,
    )
  }
}

/*
|--------------------------------------------------------------------------
| User Role Assignment
|--------------------------------------------------------------------------
*/

export async function getAdminUserRolesController(
  req,
  res,
  next,
) {
  try {
    const {
      userId,
    } =
      parseOrThrow(
        adminUserParamsSchema,
        req.params,
        {
          code:
            'ADMIN_ASSIGNMENT_USER_ID_INVALID',

          message:
            'A valid user ID is required.',
        },
      )

    const access =
      await getAdminUserRoles(
        userId,
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

          'Internal admin access loaded',
        ),
      )
  } catch (error) {
    return next(
      error,
    )
  }
}

export async function updateAdminUserRolesController(
  req,
  res,
  next,
) {
  try {
    const {
      userId,
    } =
      parseOrThrow(
        adminUserParamsSchema,
        req.params,
        {
          code:
            'ADMIN_ASSIGNMENT_USER_ID_INVALID',

          message:
            'A valid user ID is required.',
        },
      )

    const body =
      parseOrThrow(
        updateUserRolesSchema,
        req.body,
        {
          code:
            'ADMIN_ASSIGNMENT_BODY_INVALID',

          message:
            'Invalid internal admin assignment.',
        },
      )

    const access =
      await updateAdminUserRoles({
        userId,

        ...body,

        actorUser:
          req.currentUser,

        adminAuthorization:
          req.adminAuthorization,

        requestId:
          req.requestId,
      })

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

          body.roleKeys.length >
            0
            ? 'Internal admin access updated successfully'
            : 'Internal admin access revoked successfully',
        ),
      )
  } catch (error) {
    return next(
      error,
    )
  }
}