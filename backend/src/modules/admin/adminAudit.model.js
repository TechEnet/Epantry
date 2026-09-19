import crypto from 'crypto'

import mongoose from 'mongoose'

import {
  ADMIN_PERMISSION_KEYS,
} from './adminPermission.registry.js'

import {
  ADMIN_AUDIT_REASON_CODES,
} from './adminAudit.registry.js'

/*
|--------------------------------------------------------------------------
| Audit Constants
|--------------------------------------------------------------------------
*/

export const ADMIN_AUDIT_OUTCOMES =
  Object.freeze([
    'success',
    'denied',
    'failed',
  ])

export const ADMIN_AUDIT_ACTOR_SOURCES =
  Object.freeze([
    'super_admin',
    'assignment',
    'none',
  ])

export const ADMIN_AUDIT_IMMUTABLE_ERROR =
  'Admin audit events are append-only and cannot be modified or deleted.'

/*
|--------------------------------------------------------------------------
| Actor Snapshot
|--------------------------------------------------------------------------
*/

const adminAuditActorSchema =
  new mongoose.Schema(
    {
      userId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          'User',

        required:
          true,

        immutable:
          true,
      },

      source: {
        type:
          String,

        enum:
          ADMIN_AUDIT_ACTOR_SOURCES,

        required:
          true,

        immutable:
          true,
      },

      isRootSuperAdmin: {
        type:
          Boolean,

        required:
          true,

        default:
          false,

        immutable:
          true,
      },

      roleKeys: {
        type: [
          String,
        ],

        default: [],

        immutable:
          true,
      },

      permissionKeys: {
        type: [
          String,
        ],

        default: [],

        immutable:
          true,

        validate: {
          validator(
            permissionKeys,
          ) {
            return permissionKeys.every(
              (permissionKey) =>
                ADMIN_PERMISSION_KEYS.includes(
                  permissionKey,
                ),
            )
          },

          message:
            'Admin audit actor contains an unknown permission key.',
        },
      },
    },

    {
      _id:
        false,

      minimize:
        false,
    },
  )

/*
|--------------------------------------------------------------------------
| Entity Snapshot
|--------------------------------------------------------------------------
*/

const adminAuditEntitySchema =
  new mongoose.Schema(
    {
      type: {
        type:
          String,

        required:
          true,

        trim:
          true,

        lowercase:
          true,

        maxlength:
          100,

        immutable:
          true,
      },

      id: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          160,

        immutable:
          true,
      },
    },

    {
      _id:
        false,

      minimize:
        false,
    },
  )

/*
|--------------------------------------------------------------------------
| Reason Snapshot
|--------------------------------------------------------------------------
*/

const adminAuditReasonSchema =
  new mongoose.Schema(
    {
      code: {
        type:
          String,

        default:
          null,

        trim:
          true,

        lowercase:
          true,

        immutable:
          true,

        validate: {
          validator(
            reasonCode,
          ) {
            return (
              reasonCode ===
                null ||
              ADMIN_AUDIT_REASON_CODES.includes(
                reasonCode,
              )
            )
          },

          message:
            'Unknown admin audit reason code.',
        },
      },

      details: {
        type:
          String,

        default:
          null,

        trim:
          true,

        maxlength:
          1000,

        immutable:
          true,
      },
    },

    {
      _id:
        false,

      minimize:
        false,
    },
  )

/*
|--------------------------------------------------------------------------
| Admin Audit Event
|--------------------------------------------------------------------------
*/

const adminAuditEventSchema =
  new mongoose.Schema(
    {
      eventId: {
        type:
          String,

        required:
          true,

        unique:
          true,

        immutable:
          true,

        default:
          () =>
            crypto.randomUUID(),

        index:
          true,
      },

      actor: {
        type:
          adminAuditActorSchema,

        required:
          true,

        immutable:
          true,
      },

      action: {
        type:
          String,

        required:
          true,

        trim:
          true,

        lowercase:
          true,

        maxlength:
          120,

        immutable:
          true,

        match: [
          /^[a-z][a-z0-9_.:-]*$/,
          'Invalid admin audit action.',
        ],
      },

      permissionKey: {
        type:
          String,

        default:
          null,

        trim:
          true,

        lowercase:
          true,

        immutable:
          true,

        validate: {
          validator(
            permissionKey,
          ) {
            return (
              permissionKey ===
                null ||
              ADMIN_PERMISSION_KEYS.includes(
                permissionKey,
              )
            )
          },

          message:
            'Unknown admin audit permission key.',
        },
      },

      entity: {
        type:
          adminAuditEntitySchema,

        required:
          true,

        immutable:
          true,
      },

      outcome: {
        type:
          String,

        enum:
          ADMIN_AUDIT_OUTCOMES,

        required:
          true,

        default:
          'success',

        immutable:
          true,
      },

      reason: {
        type:
          adminAuditReasonSchema,

        default: () => ({
          code:
            null,

          details:
            null,
        }),

        immutable:
          true,
      },

      beforeSnapshot: {
        type:
          mongoose.Schema.Types.Mixed,

        default:
          null,

        immutable:
          true,
      },

      afterSnapshot: {
        type:
          mongoose.Schema.Types.Mixed,

        default:
          null,

        immutable:
          true,
      },

      metadata: {
        type:
          mongoose.Schema.Types.Mixed,

        default:
          null,

        immutable:
          true,
      },

      requestId: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          120,

        immutable:
          true,

        index:
          true,
      },

      occurredAt: {
        type:
          Date,

        required:
          true,

        default:
          Date.now,

        immutable:
          true,

        index:
          true,
      },
    },

    {
      timestamps: {
        createdAt:
          true,

        updatedAt:
          false,
      },

      collection:
        'admin_audit_events',

      minimize:
        false,
    },
  )

/*
|--------------------------------------------------------------------------
| Append-only Protection
|--------------------------------------------------------------------------
*/

adminAuditEventSchema.pre(
  'save',

  function preventExistingAuditSave(
    next,
  ) {
    if (
      !this.isNew
    ) {
      const error =
        new Error(
          ADMIN_AUDIT_IMMUTABLE_ERROR,
        )

      error.code =
        'ADMIN_AUDIT_IMMUTABLE'

      return next(
        error,
      )
    }

    return next()
  },
)

function preventAuditMutation(
  next,
) {
  const error =
    new Error(
      ADMIN_AUDIT_IMMUTABLE_ERROR,
    )

  error.code =
    'ADMIN_AUDIT_IMMUTABLE'

  return next(
    error,
  )
}

adminAuditEventSchema.pre(
  'updateOne',
  preventAuditMutation,
)

adminAuditEventSchema.pre(
  'updateMany',
  preventAuditMutation,
)

adminAuditEventSchema.pre(
  'findOneAndUpdate',
  preventAuditMutation,
)

adminAuditEventSchema.pre(
  'replaceOne',
  preventAuditMutation,
)

adminAuditEventSchema.pre(
  'deleteOne',
  preventAuditMutation,
)

adminAuditEventSchema.pre(
  'deleteMany',
  preventAuditMutation,
)

adminAuditEventSchema.pre(
  'findOneAndDelete',
  preventAuditMutation,
)

/*
|--------------------------------------------------------------------------
| Audit Lookup Indexes
|--------------------------------------------------------------------------
*/

adminAuditEventSchema.index({
  'actor.userId':
    1,

  occurredAt:
    -1,
})

adminAuditEventSchema.index({
  'entity.type':
    1,

  'entity.id':
    1,

  occurredAt:
    -1,
})

adminAuditEventSchema.index({
  action:
    1,

  occurredAt:
    -1,
})

adminAuditEventSchema.index({
  outcome:
    1,

  occurredAt:
    -1,
})

/*
|--------------------------------------------------------------------------
| Model
|--------------------------------------------------------------------------
*/

export const AdminAuditEvent =
  mongoose.models.AdminAuditEvent ||
  mongoose.model(
    'AdminAuditEvent',
    adminAuditEventSchema,
  )