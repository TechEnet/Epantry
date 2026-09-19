import mongoose from 'mongoose'

const { Schema } = mongoose
const objectId = Schema.Types.ObjectId

export const HOST_SERVICE_ACCOUNT_SCOPES = Object.freeze([
  'catalog.read',
  'catalog.ingest',
  'pricing.read',
  'inventory.read',
  'inventory.manage',
  'orders.read',
  'orders.manage',
  'finance.read',
  'recipes.read',
  'campaigns.read',
  'webhooks.read',
])

export const HOST_WEBHOOK_EVENT_TYPES = Object.freeze([
  'catalog.import.completed',
  'catalog.import.needs_npi',
  'order.confirmed',
  'order.status_changed',
  'order.delivered',
  'order.return_requested',
  'order.refunded',
  'settlement.approved',
  'settlement.paid',
  'brand_recipe.reviewed',
])

const appendOnlyGuard =
  (label) =>
    function blockMutation(next) {
      next(
        new Error(
          `${label} is append-only.`,
        ),
      )
    }

const serviceAccountSchema =
  new Schema(
    {
      organizationId: {
        type:
          objectId,

        ref:
          'MarketplaceOrganization',

        required:
          true,

        index:
          true,
      },

      name: {
        type:
          String,

        trim:
          true,

        maxlength:
          160,

        required:
          true,
      },

      description: {
        type:
          String,

        trim:
          true,

        maxlength:
          1000,

        default:
          '',
      },

      scopes: {
        type: [
          {
            type:
              String,

            enum:
              HOST_SERVICE_ACCOUNT_SCOPES,
          },
        ],

        required:
          true,

        default:
          [],
      },

      status: {
        type:
          String,

        enum: [
          'active',
          'disabled',
        ],

        required:
          true,

        default:
          'active',

        index:
          true,
      },

      createdByUserId: {
        type:
          objectId,

        ref:
          'User',

        required:
          true,
      },

      updatedByUserId: {
        type:
          objectId,

        ref:
          'User',

        required:
          true,
      },
    },
    {
      timestamps:
        true,

      collection:
        'serviceAccounts',

      versionKey:
        false,
    },
  )

serviceAccountSchema.index(
  {
    organizationId:
      1,

    name:
      1,
  },
  {
    unique:
      true,
  },
)

const apiCredentialSchema =
  new Schema(
    {
      organizationId: {
        type:
          objectId,

        ref:
          'MarketplaceOrganization',

        required:
          true,

        index:
          true,
      },

      serviceAccountId: {
        type:
          objectId,

        ref:
          'HostServiceAccount',

        required:
          true,

        index:
          true,
      },

      keyPrefix: {
        type:
          String,

        trim:
          true,

        maxlength:
          40,

        required:
          true,

        unique:
          true,

        index:
          true,
      },

      secretHashSha256: {
        type:
          String,

        trim:
          true,

        minlength:
          64,

        maxlength:
          64,

        required:
          true,
      },

      secretLast4: {
        type:
          String,

        trim:
          true,

        minlength:
          4,

        maxlength:
          4,

        required:
          true,
      },

      status: {
        type:
          String,

        enum: [
          'active',
          'revoked',
        ],

        required:
          true,

        default:
          'active',

        index:
          true,
      },

      createdByUserId: {
        type:
          objectId,

        ref:
          'User',

        required:
          true,
      },

      revokedByUserId: {
        type:
          objectId,

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
      timestamps: {
        createdAt:
          true,

        updatedAt:
          false,
      },

      collection:
        'apiCredentials',

      versionKey:
        false,
    },
  )

apiCredentialSchema.index({
  organizationId:
    1,

  serviceAccountId:
    1,

  createdAt:
    -1,
})

const webhookEndpointSchema =
  new Schema(
    {
      organizationId: {
        type:
          objectId,

        ref:
          'MarketplaceOrganization',

        required:
          true,

        index:
          true,
      },

      name: {
        type:
          String,

        trim:
          true,

        maxlength:
          160,

        required:
          true,
      },

      endpointUrl: {
        type:
          String,

        trim:
          true,

        maxlength:
          1500,

        required:
          true,
      },

      eventTypes: {
        type: [
          {
            type:
              String,

            enum:
              HOST_WEBHOOK_EVENT_TYPES,
          },
        ],

        required:
          true,

        default:
          [],
      },

      status: {
        type:
          String,

        enum: [
          'active',
          'disabled',
        ],

        required:
          true,

        default:
          'active',

        index:
          true,
      },

      signingSecretCiphertext: {
        type:
          String,

        required:
          true,
      },

      signingSecretIv: {
        type:
          String,

        required:
          true,
      },

      signingSecretAuthTag: {
        type:
          String,

        required:
          true,
      },

      signingSecretLast4: {
        type:
          String,

        minlength:
          4,

        maxlength:
          4,

        required:
          true,
      },

      createdByUserId: {
        type:
          objectId,

        ref:
          'User',

        required:
          true,
      },

      updatedByUserId: {
        type:
          objectId,

        ref:
          'User',

        required:
          true,
      },

      lastDeliveryAt: {
        type:
          Date,

        default:
          null,
      },

      lastDeliveryStatus: {
        type:
          String,

        enum: [
          'never',
          'success',
          'failed',
        ],

        default:
          'never',
      },
    },
    {
      timestamps:
        true,

      collection:
        'organizationWebhooks',

      versionKey:
        false,
    },
  )

webhookEndpointSchema.index(
  {
    organizationId:
      1,

    name:
      1,
  },
  {
    unique:
      true,
  },
)

const hostOperationsAuditEventSchema =
  new Schema(
    {
      organizationId: {
        type:
          objectId,

        ref:
          'MarketplaceOrganization',

        required:
          true,

        index:
          true,
      },

      actorType: {
        type:
          String,

        enum: [
          'host_user',
          'admin_user',
          'service_account',
        ],

        required:
          true,
      },

      actorUserId: {
        type:
          objectId,

        ref:
          'User',

        default:
          null,
      },

      serviceAccountId: {
        type:
          objectId,

        ref:
          'HostServiceAccount',

        default:
          null,
      },

      action: {
        type:
          String,

        trim:
          true,

        maxlength:
          160,

        required:
          true,

        index:
          true,
      },

      entityType: {
        type:
          String,

        trim:
          true,

        maxlength:
          120,

        required:
          true,
      },

      entityId: {
        type:
          String,

        trim:
          true,

        maxlength:
          240,

        required:
          true,
      },

      requestId: {
        type:
          String,

        trim:
          true,

        maxlength:
          160,

        default:
          '',
      },

      metadata: {
        type:
          Schema.Types.Mixed,

        default:
          {},
      },

      occurredAt: {
        type:
          Date,

        required:
          true,

        default:
          Date.now,
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
        'hostOperationsAuditEvents',

      versionKey:
        false,
    },
  )

hostOperationsAuditEventSchema.index({
  organizationId:
    1,

  occurredAt:
    -1,
})

for (const [schema, label] of [
  [
    apiCredentialSchema,
    'API credential history',
  ],

  [
    hostOperationsAuditEventSchema,
    'Host operations audit event',
  ],
]) {
  schema.pre(
    [
      'updateOne',
      'updateMany',
      'findOneAndUpdate',
      'deleteOne',
      'deleteMany',
      'findOneAndDelete',
    ],
    appendOnlyGuard(
      label,
    ),
  )
}

export const HostServiceAccount =
  mongoose.models.HostServiceAccount ||
  mongoose.model(
    'HostServiceAccount',
    serviceAccountSchema,
  )

export const HostApiCredential =
  mongoose.models.HostApiCredential ||
  mongoose.model(
    'HostApiCredential',
    apiCredentialSchema,
  )

export const HostWebhookEndpoint =
  mongoose.models.HostWebhookEndpoint ||
  mongoose.model(
    'HostWebhookEndpoint',
    webhookEndpointSchema,
  )

export const HostOperationsAuditEvent =
  mongoose.models.HostOperationsAuditEvent ||
  mongoose.model(
    'HostOperationsAuditEvent',
    hostOperationsAuditEventSchema,
  )