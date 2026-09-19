import mongoose from 'mongoose'

/*
|--------------------------------------------------------------------------
| Admin Assignment Model
|--------------------------------------------------------------------------
|
| One EPANTRY user may hold multiple internal admin permission profiles.
|
| The assignment is still subordinate to the existing top-level
| super_admin capability. It does not create a fourth top-level access type
| and it never changes Customer / Host activeMode behavior.
|
| Step 1C will resolve effective permissions from these assignments and will
| keep backend authorization as the source of truth.
|
*/

export const ADMIN_ASSIGNMENT_STATUSES =
  Object.freeze([
    'active',
    'revoked',
  ])

export const ADMIN_ASSIGNMENT_SCOPES =
  Object.freeze([
    'platform',
  ])

const adminAssignmentSchema =
  new mongoose.Schema(
    {
      userId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          'User',

        required:
          true,

        unique:
          true,

        immutable:
          true,

        index:
          true,
      },

      roleIds: {
        type: [
          {
            type:
              mongoose.Schema.Types.ObjectId,

            ref:
              'AdminRole',

            required:
              true,
          },
        ],

        required:
          true,

        validate: {
          validator(
            roleIds,
          ) {
            return Array.isArray(
              roleIds,
            ) &&
            roleIds.length >
              0
          },

          message:
            'An admin assignment requires at least one role.',
        },
      },

      status: {
        type:
          String,

        enum:
          ADMIN_ASSIGNMENT_STATUSES,

        required:
          true,

        default:
          'active',

        index:
          true,
      },

      scope: {
        type:
          String,

        enum:
          ADMIN_ASSIGNMENT_SCOPES,

        required:
          true,

        default:
          'platform',
      },

      assignedBy: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          'User',

        default:
          null,
      },

      assignedAt: {
        type:
          Date,

        required:
          true,

        default:
          Date.now,
      },

      expiresAt: {
        type:
          Date,

        default:
          null,

        index:
          true,
      },

      revokedBy: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          'User',

        default:
          null,
      },

      revokedAt: {
        type:
          Date,

        default:
          null,
      },
    },

    {
      timestamps:
        true,

      collection:
        'adminAssignments',

      minimize:
        false,

      optimisticConcurrency:
        true,
    },
  )

/*
|--------------------------------------------------------------------------
| Assignment Invariants
|--------------------------------------------------------------------------
*/

adminAssignmentSchema.pre(
  'validate',

  function validateAdminAssignment(
    next,
  ) {
    const uniqueRoleIds = [
      ...new Set(
        (
          this.roleIds ||
          []
        ).map(
          (roleId) =>
            String(
              roleId,
            ),
        ),
      ),
    ]

    this.roleIds =
      uniqueRoleIds

    if (
      this.expiresAt &&
      this.assignedAt &&
      this.expiresAt <=
        this.assignedAt
    ) {
      this.invalidate(
        'expiresAt',
        'Admin assignment expiry must be later than its assignment time.',
      )
    }

    if (
      this.status ===
        'active' &&
      (
        this.revokedAt ||
        this.revokedBy
      )
    ) {
      this.invalidate(
        'status',
        'An active admin assignment cannot contain revocation metadata.',
      )
    }

    if (
      this.status ===
        'revoked' &&
      !this.revokedAt
    ) {
      this.invalidate(
        'revokedAt',
        'A revoked admin assignment requires a revocation timestamp.',
      )
    }

    next()
  },
)

/*
|--------------------------------------------------------------------------
| Indexes
|--------------------------------------------------------------------------
*/

adminAssignmentSchema.index({
  status:
    1,

  expiresAt:
    1,
})

adminAssignmentSchema.index({
  roleIds:
    1,

  status:
    1,
})

/*
|--------------------------------------------------------------------------
| Model
|--------------------------------------------------------------------------
*/

export const AdminAssignment =
  mongoose.models.AdminAssignment ||
  mongoose.model(
    'AdminAssignment',
    adminAssignmentSchema,
  )