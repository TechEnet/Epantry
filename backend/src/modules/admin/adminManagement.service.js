import mongoose from 'mongoose'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  User,
} from '../users/user.model.js'

import {
  AdminAssignment,
} from './adminAssignment.model.js'

import {
  normalizeAdminPermissionKeys,
} from './adminPermission.registry.js'

import {
  ADMIN_SYSTEM_ROLE_TEMPLATES,
  AdminRole,
} from './adminRole.model.js'

import {
  normalizeAdminAuditReason,
  recordAdminAuditEvent,
} from './adminAudit.service.js'

/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

const ROOT_SUPER_ADMIN_ROLE_KEY =
  'root_super_admin'

/*
|--------------------------------------------------------------------------
| Non-delegable Control-plane Permissions
|--------------------------------------------------------------------------
|
| Only the real Super Admin controls creation of roles and assignment of
| internal admins.
|
| Limited internal-admin profiles must never receive these control-plane
| mutation permissions.
|
*/

export const NON_DELEGABLE_ADMIN_PERMISSIONS =
  Object.freeze([
    'admin.roles.manage',
    'admin.assignments.manage',
  ])

/*
|--------------------------------------------------------------------------
| User Projection
|--------------------------------------------------------------------------
*/

const ADMIN_MANAGEMENT_USER_PROJECTION = {
  name:
    1,

  email:
    1,

  accountStatus:
    1,

  customerEnabled:
    1,

  hostEnabled:
    1,

  hostAccessStatus:
    1,

  superAdminEnabled:
    1,

  activeMode:
    1,

  createdAt:
    1,

  updatedAt:
    1,
}

/*
|--------------------------------------------------------------------------
| Generic Object ID
|--------------------------------------------------------------------------
*/

function normalizeObjectId(
  value,
  {
    code,
    message,
  },
) {
  const normalized =
    String(
      value ||
        '',
    ).trim()

  if (
    !mongoose.Types.ObjectId.isValid(
      normalized,
    )
  ) {
    throw new ApiError(
      400,
      message,
      [
        {
          code,
        },
      ],
    )
  }

  return normalized
}

/*
|--------------------------------------------------------------------------
| Actor ID
|--------------------------------------------------------------------------
*/

function getActorUserId(
  actorUser,
) {
  const actorUserId =
    String(
      actorUser?._id ||
        actorUser?.id ||
        '',
    ).trim()

  if (
    !mongoose.Types.ObjectId.isValid(
      actorUserId,
    )
  ) {
    throw new ApiError(
      500,
      'Administrative mutation requires a valid actor.',
      [
        {
          code:
            'ADMIN_MANAGEMENT_ACTOR_INVALID',
        },
      ],
    )
  }

  return actorUserId
}

/*
|--------------------------------------------------------------------------
| Role Key
|--------------------------------------------------------------------------
*/

function normalizeRoleKey(
  roleKey,
) {
  return String(
    roleKey ||
      '',
  )
    .trim()
    .toLowerCase()
}

/*
|--------------------------------------------------------------------------
| Assignable Role
|--------------------------------------------------------------------------
*/

export function isAssignableAdminRoleKey(
  roleKey,
) {
  const normalized =
    normalizeRoleKey(
      roleKey,
    )

  return Boolean(
    normalized &&
    normalized !==
      ROOT_SUPER_ADMIN_ROLE_KEY,
  )
}

/*
|--------------------------------------------------------------------------
| Delegated Permissions
|--------------------------------------------------------------------------
*/

export function validateDelegatedPermissionKeys(
  permissionKeys,
) {
  const normalized =
    normalizeAdminPermissionKeys(
      permissionKeys,
    )

  const blocked =
    normalized.filter(
      (permissionKey) =>
        NON_DELEGABLE_ADMIN_PERMISSIONS.includes(
          permissionKey,
        ),
    )

  if (
    blocked.length >
    0
  ) {
    throw new ApiError(
      400,
      'Limited admin roles cannot receive Super Admin control-plane permissions.',
      [
        {
          code:
            'ADMIN_ROLE_PERMISSION_NON_DELEGABLE',

          permissionKeys:
            blocked,
        },
      ],
    )
  }

  return normalized
}

/*
|--------------------------------------------------------------------------
| Role Serializer
|--------------------------------------------------------------------------
*/

export function serializeAdminRole(
  role,
) {
  return {
    id:
      String(
        role._id,
      ),

    key:
      role.key,

    name:
      role.name,

    description:
      role.description,

    status:
      role.status,

    permissionMode:
      role.permissionMode,

    permissionKeys:
      Array.isArray(
        role.permissionKeys,
      )
        ? [
            ...role.permissionKeys,
          ]
        : [],

    isSystem:
      role.isSystem ===
      true,

    createdAt:
      role.createdAt ||
      null,

    updatedAt:
      role.updatedAt ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| User Serializer
|--------------------------------------------------------------------------
*/

function serializeAdminManagementUser(
  user,
) {
  return {
    id:
      String(
        user._id,
      ),

    name:
      user.name,

    email:
      user.email,

    accountStatus:
      user.accountStatus,

    customerEnabled:
      user.customerEnabled ===
      true,

    hostEnabled:
      user.hostEnabled ===
      true &&
      user.hostAccessStatus ===
        'active',

    hostAccessStatus:
      user.hostAccessStatus ||
      'not_requested',

    superAdminEnabled:
      user.superAdminEnabled ===
      true,

    activeMode:
      user.activeMode ||
      null,

    createdAt:
      user.createdAt ||
      null,

    updatedAt:
      user.updatedAt ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Assignment Serializer
|--------------------------------------------------------------------------
*/

export function serializeAdminAssignment({
  user,
  assignment,
  roles =
    [],
}) {
  return {
    user:
      serializeAdminManagementUser(
        user,
      ),

    assignment:
      assignment
        ? {
            id:
              String(
                assignment._id,
              ),

            status:
              assignment.status,

            scope:
              assignment.scope,

            roleIds:
              Array.isArray(
                assignment.roleIds,
              )
                ? assignment.roleIds.map(
                    (roleId) =>
                      String(
                        roleId,
                      ),
                  )
                : [],

            assignedBy:
              assignment.assignedBy
                ? String(
                    assignment.assignedBy,
                  )
                : null,

            assignedAt:
              assignment.assignedAt ||
              null,

            expiresAt:
              assignment.expiresAt ||
              null,

            revokedBy:
              assignment.revokedBy
                ? String(
                    assignment.revokedBy,
                  )
                : null,

            revokedAt:
              assignment.revokedAt ||
              null,

            createdAt:
              assignment.createdAt ||
              null,

            updatedAt:
              assignment.updatedAt ||
              null,
          }
        : null,

    roles:
      roles.map(
        serializeAdminRole,
      ),
  }
}

/*
|--------------------------------------------------------------------------
| System Role Synchronization
|--------------------------------------------------------------------------
|
| System roles are code-owned.
|
| Their permissions are refreshed from the deployed templates and cannot be
| converted into arbitrary database-defined authority.
|
*/

export async function ensureAdminSystemRoles() {
  const templates =
    Object.values(
      ADMIN_SYSTEM_ROLE_TEMPLATES,
    )

  const roles = []

  for (
    const template
    of templates
  ) {
    let role =
      await AdminRole.findOne({
        key:
          template.key,
      })

    if (
      role &&
      role.isSystem !==
        true
    ) {
      throw new ApiError(
        409,
        'A custom role is using a reserved system role key.',
        [
          {
            code:
              'ADMIN_SYSTEM_ROLE_KEY_COLLISION',

            roleKey:
              template.key,
          },
        ],
      )
    }

    if (!role) {
      role =
        new AdminRole({
          key:
            template.key,

          name:
            template.name,

          description:
            template.description,

          status:
            'active',

          permissionMode:
            template.permissionMode,

          permissionKeys: [
            ...template.permissionKeys,
          ],

          isSystem:
            true,

          createdBy:
            null,

          updatedBy:
            null,
        })
    } else {
      role.name =
        template.name

      role.description =
        template.description

      role.status =
        'active'

      role.permissionMode =
        template.permissionMode

      role.permissionKeys = [
        ...template.permissionKeys,
      ]

      role.isSystem =
        true
    }

    await role.save()

    roles.push(
      role,
    )
  }

  return roles
}

/*
|--------------------------------------------------------------------------
| Permission Catalog
|--------------------------------------------------------------------------
*/

export async function listAdminPermissionCatalog() {
  const {
    ADMIN_PERMISSION_DEFINITIONS,
  } =
    await import(
      './adminPermission.registry.js'
    )

  return ADMIN_PERMISSION_DEFINITIONS.map(
    (definition) => ({
      ...definition,

      delegable:
        !NON_DELEGABLE_ADMIN_PERMISSIONS.includes(
          definition.key,
        ),
    }),
  )
}

/*
|--------------------------------------------------------------------------
| List Roles
|--------------------------------------------------------------------------
*/

export async function listAdminRoles() {
  await ensureAdminSystemRoles()

  const roles =
    await AdminRole.find({})
      .sort({
        isSystem:
          -1,

        name:
          1,

        key:
          1,
      })
      .lean()

  return roles.map(
    serializeAdminRole,
  )
}

/*
|--------------------------------------------------------------------------
| Create Custom Role
|--------------------------------------------------------------------------
*/

export async function createAdminRole({
  key,
  name,
  description,
  permissionKeys,

  actorUser,
  adminAuthorization,

  reasonCode,
  reasonDetails,

  requestId,
}) {
  const actorUserId =
    getActorUserId(
      actorUser,
    )

  const normalizedKey =
    normalizeRoleKey(
      key,
    )

  if (
    ADMIN_SYSTEM_ROLE_TEMPLATES[
      normalizedKey
    ]
  ) {
    throw new ApiError(
      409,
      'System admin role keys are reserved.',
      [
        {
          code:
            'ADMIN_ROLE_KEY_RESERVED',

          roleKey:
            normalizedKey,
        },
      ],
    )
  }

  const normalizedPermissions =
    validateDelegatedPermissionKeys(
      permissionKeys,
    )

  normalizeAdminAuditReason({
    action:
      'admin.role.create',

    reasonCode,

    reasonDetails,
  })

  const existingRole =
    await AdminRole.findOne({
      key:
        normalizedKey,
    }).lean()

  if (existingRole) {
    throw new ApiError(
      409,
      'An admin role with this key already exists.',
      [
        {
          code:
            'ADMIN_ROLE_KEY_EXISTS',
        },
      ],
    )
  }

  const role =
    await AdminRole.create({
      key:
        normalizedKey,

      name,

      description,

      status:
        'active',

      permissionMode:
        'explicit',

      permissionKeys:
        normalizedPermissions,

      isSystem:
        false,

      createdBy:
        actorUserId,

      updatedBy:
        actorUserId,
    })

  const serializedRole =
    serializeAdminRole(
      role,
    )

  await recordAdminAuditEvent({
    actorUser,

    adminAuthorization,

    action:
      'admin.role.create',

    permissionKey:
      'admin.roles.manage',

    entityType:
      'admin_role',

    entityId:
      String(
        role._id,
      ),

    reasonCode,

    reasonDetails,

    beforeSnapshot:
      null,

    afterSnapshot:
      serializedRole,

    requestId,
  })

  return serializedRole
}

/*
|--------------------------------------------------------------------------
| Update Custom Role
|--------------------------------------------------------------------------
*/

export async function updateAdminRole({
  roleId,

  name,
  description,
  permissionKeys,
  status,

  actorUser,
  adminAuthorization,

  reasonCode,
  reasonDetails,

  requestId,
}) {
  const normalizedRoleId =
    normalizeObjectId(
      roleId,
      {
        code:
          'ADMIN_ROLE_ID_INVALID',

        message:
          'A valid admin role ID is required.',
      },
    )

  const actorUserId =
    getActorUserId(
      actorUser,
    )

  const role =
    await AdminRole.findById(
      normalizedRoleId,
    )

  if (!role) {
    throw new ApiError(
      404,
      'Admin role was not found.',
      [
        {
          code:
            'ADMIN_ROLE_NOT_FOUND',
        },
      ],
    )
  }

  if (
    role.isSystem ===
    true
  ) {
    throw new ApiError(
      409,
      'System admin roles are controlled by deployed policy and cannot be edited here.',
      [
        {
          code:
            'ADMIN_SYSTEM_ROLE_IMMUTABLE',
        },
      ],
    )
  }

  const beforeSnapshot =
    serializeAdminRole(
      role,
    )

  const disablingRole =
    status ===
      'disabled' &&
    role.status !==
      'disabled'

  const auditAction =
    disablingRole
      ? 'admin.role.disable'
      : 'admin.role.update'

  normalizeAdminAuditReason({
    action:
      auditAction,

    reasonCode,

    reasonDetails,
  })

  if (
    name !==
    undefined
  ) {
    role.name =
      name
  }

  if (
    description !==
    undefined
  ) {
    role.description =
      description
  }

  if (
    permissionKeys !==
    undefined
  ) {
    role.permissionKeys =
      validateDelegatedPermissionKeys(
        permissionKeys,
      )
  }

  if (
    status !==
    undefined
  ) {
    role.status =
      status
  }

  role.updatedBy =
    actorUserId

  await role.save()

  const afterSnapshot =
    serializeAdminRole(
      role,
    )

  await recordAdminAuditEvent({
    actorUser,

    adminAuthorization,

    action:
      auditAction,

    permissionKey:
      'admin.roles.manage',

    entityType:
      'admin_role',

    entityId:
      String(
        role._id,
      ),

    reasonCode,

    reasonDetails,

    beforeSnapshot,

    afterSnapshot,

    requestId,
  })

  return afterSnapshot
}

/*
|--------------------------------------------------------------------------
| Require Assignment Target
|--------------------------------------------------------------------------
*/

async function requireAdminAssignmentTarget(
  userId,
) {
  const normalizedUserId =
    normalizeObjectId(
      userId,
      {
        code:
          'ADMIN_ASSIGNMENT_USER_ID_INVALID',

        message:
          'A valid user ID is required.',
      },
    )

  const user =
    await User.findById(
      normalizedUserId,

      ADMIN_MANAGEMENT_USER_PROJECTION,
    ).lean()

  if (!user) {
    throw new ApiError(
      404,
      'EPANTRY user was not found.',
      [
        {
          code:
            'ADMIN_ASSIGNMENT_USER_NOT_FOUND',
        },
      ],
    )
  }

  return user
}

/*
|--------------------------------------------------------------------------
| Load Roles For Assignment
|--------------------------------------------------------------------------
*/

async function loadAssignmentRoles(
  roleIds,
) {
  if (
    !Array.isArray(
      roleIds,
    ) ||
    roleIds.length ===
      0
  ) {
    return []
  }

  return AdminRole.find({
    _id: {
      $in:
        roleIds,
    },
  })
    .sort({
      name:
        1,
    })
    .lean()
}

/*
|--------------------------------------------------------------------------
| Get User Admin Roles
|--------------------------------------------------------------------------
*/

export async function getAdminUserRoles(
  userId,
) {
  await ensureAdminSystemRoles()

  const user =
    await requireAdminAssignmentTarget(
      userId,
    )

  const assignment =
    await AdminAssignment.findOne({
      userId:
        user._id,
    }).lean()

  const roles =
    assignment
      ? await loadAssignmentRoles(
          assignment.roleIds,
        )
      : []

  return serializeAdminAssignment({
    user,

    assignment,

    roles,
  })
}

/*
|--------------------------------------------------------------------------
| Expiry
|--------------------------------------------------------------------------
*/

function normalizeAssignmentExpiry(
  expiresAt,
) {
  if (
    expiresAt ===
    undefined
  ) {
    return undefined
  }

  if (
    expiresAt ===
    null ||
    expiresAt ===
      ''
  ) {
    return null
  }

  const parsed =
    new Date(
      expiresAt,
    )

  if (
    Number.isNaN(
      parsed.getTime(),
    ) ||
    parsed <=
      new Date()
  ) {
    throw new ApiError(
      400,
      'Admin assignment expiry must be a future date.',
      [
        {
          code:
            'ADMIN_ASSIGNMENT_EXPIRY_INVALID',
        },
      ],
    )
  }

  return parsed
}

/*
|--------------------------------------------------------------------------
| Resolve Requested Roles
|--------------------------------------------------------------------------
*/

async function resolveAssignableRoles(
  roleKeys,
) {
  const normalizedRoleKeys = [
    ...new Set(
      roleKeys
        .map(
          normalizeRoleKey,
        )
        .filter(Boolean),
    ),
  ]

  if (
    normalizedRoleKeys.some(
      (roleKey) =>
        !isAssignableAdminRoleKey(
          roleKey,
        ),
    )
  ) {
    throw new ApiError(
      400,
      'The root Super Admin role cannot be delegated through an assignment.',
      [
        {
          code:
            'ADMIN_ROOT_ROLE_NON_DELEGABLE',
        },
      ],
    )
  }

  if (
    normalizedRoleKeys.length ===
      0
  ) {
    return {
      roleKeys:
        [],

      roles:
        [],
    }
  }

  const roles =
    await AdminRole.find({
      key: {
        $in:
          normalizedRoleKeys,
      },

      status:
        'active',
    }).lean()

  const foundRoleKeys =
    new Set(
      roles.map(
        (role) =>
          role.key,
      ),
    )

  const missingRoleKeys =
    normalizedRoleKeys.filter(
      (roleKey) =>
        !foundRoleKeys.has(
          roleKey,
        ),
    )

  if (
    missingRoleKeys.length >
    0
  ) {
    throw new ApiError(
      400,
      'One or more requested admin roles do not exist or are disabled.',
      [
        {
          code:
            'ADMIN_ASSIGNMENT_ROLE_INVALID',

          roleKeys:
            missingRoleKeys,
        },
      ],
    )
  }

  return {
    roleKeys:
      normalizedRoleKeys,

    roles,
  }
}

/*
|--------------------------------------------------------------------------
| Update / Grant / Revoke User Roles
|--------------------------------------------------------------------------
|
| roleKeys = []
|
| means revoke the limited internal-admin assignment.
|
| This NEVER changes:
|
| customerEnabled
| hostEnabled
| hostAccessStatus
| superAdminEnabled
| activeMode
|
*/

export async function updateAdminUserRoles({
  userId,
  roleKeys,

  expiresAt,

  actorUser,
  adminAuthorization,

  reasonCode,
  reasonDetails,

  requestId,
}) {
  await ensureAdminSystemRoles()

  const actorUserId =
    getActorUserId(
      actorUser,
    )

  const user =
    await requireAdminAssignmentTarget(
      userId,
    )

  if (
    user.superAdminEnabled ===
    true
  ) {
    throw new ApiError(
      409,
      'A real Super Admin does not use limited admin assignments.',
      [
        {
          code:
            'ADMIN_ASSIGNMENT_TARGET_SUPER_ADMIN',
        },
      ],
    )
  }

  if (
    user.accountStatus !==
    'active'
  ) {
    throw new ApiError(
      409,
      'Only an active EPANTRY account can receive internal admin access.',
      [
        {
          code:
            'ADMIN_ASSIGNMENT_TARGET_INACTIVE',

          accountStatus:
            user.accountStatus,
        },
      ],
    )
  }

  const {
    roles,
  } =
    await resolveAssignableRoles(
      roleKeys,
    )

  const normalizedExpiry =
    normalizeAssignmentExpiry(
      expiresAt,
    )

  let assignment =
    await AdminAssignment.findOne({
      userId:
        user._id,
    })

  const beforeRoles =
    assignment
      ? await loadAssignmentRoles(
          assignment.roleIds,
        )
      : []

  const beforeSnapshot =
    serializeAdminAssignment({
      user,

      assignment,

      roles:
        beforeRoles,
    })

  const revoking =
    roles.length ===
    0

  const granting =
    !revoking &&
    (
      !assignment ||
      assignment.status !==
        'active'
    )

  const auditAction =
    revoking
      ? 'admin.assignment.revoke'
      : granting
        ? 'admin.assignment.grant'
        : 'admin.assignment.update'

  normalizeAdminAuditReason({
    action:
      auditAction,

    reasonCode,

    reasonDetails,
  })

  /*
  |--------------------------------------------------------------------------
  | Revoke
  |--------------------------------------------------------------------------
  */

  if (revoking) {
    if (assignment) {
      assignment.status =
        'revoked'

      assignment.revokedBy =
        actorUserId

      assignment.revokedAt =
        new Date()

      await assignment.save()
    }
  } else {
    /*
    |--------------------------------------------------------------------------
    | Grant / Update
    |--------------------------------------------------------------------------
    */

    if (!assignment) {
      assignment =
        new AdminAssignment({
          userId:
            user._id,

          roleIds:
            roles.map(
              (role) =>
                role._id,
            ),

          status:
            'active',

          scope:
            'platform',

          assignedBy:
            actorUserId,

          assignedAt:
            new Date(),

          expiresAt:
            normalizedExpiry ===
              undefined
              ? null
              : normalizedExpiry,

          revokedBy:
            null,

          revokedAt:
            null,
        })
    } else {
      assignment.roleIds =
        roles.map(
          (role) =>
            role._id,
        )

      if (
        assignment.status !==
        'active'
      ) {
        assignment.assignedBy =
          actorUserId

        assignment.assignedAt =
          new Date()
      }

      assignment.status =
        'active'

      assignment.scope =
        'platform'

      assignment.revokedBy =
        null

      assignment.revokedAt =
        null

      if (
        normalizedExpiry !==
        undefined
      ) {
        assignment.expiresAt =
          normalizedExpiry
      }
    }

    await assignment.save()
  }

  const afterRoles =
    assignment
      ? await loadAssignmentRoles(
          assignment.roleIds,
        )
      : []

  const afterSnapshot =
    serializeAdminAssignment({
      user,

      assignment,

      roles:
        afterRoles,
    })

  await recordAdminAuditEvent({
    actorUser,

    adminAuthorization,

    action:
      auditAction,

    permissionKey:
      'admin.assignments.manage',

    entityType:
      'admin_assignment',

    entityId:
      String(
        user._id,
      ),

    reasonCode,

    reasonDetails,

    beforeSnapshot,

    afterSnapshot,

    requestId,
  })

  return afterSnapshot
}