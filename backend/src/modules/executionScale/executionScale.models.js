import mongoose from 'mongoose'

const { Schema } = mongoose
const objectId = Schema.Types.ObjectId

const baseOptions = Object.freeze({
  timestamps: true,
  strict: true,
  minimize: false,
  versionKey: false,
})

export const PARTNER_TYPES = Object.freeze([
  'retailer_sync',
  'supplier',
  'payout_provider',
])

export const PARTNER_CONNECTION_STATUSES = Object.freeze([
  'pending_review',
  'active',
  'rejected',
  'disabled',
])

export const PARTNER_OPERATIONS = Object.freeze([
  'catalog_sync',
  'inventory_sync',
  'supplier_po_submit',
  'payout_execute',
  'webhook_receive',
])

export const PARTNER_EVENT_STATUSES = Object.freeze([
  'started',
  'succeeded',
  'failed',
  'received',
  'rejected',
  'deduplicated',
  'ambiguous',
])

export const PURCHASE_ORDER_STATUSES = Object.freeze([
  'draft',
  'approved',
  'submitted',
  'acknowledged',
  'partially_received',
  'received',
  'cancelled',
  'closed',
])

export const PAYOUT_EXECUTION_STATUSES = Object.freeze([
  'submitted',
  'provider_confirmed',
  'provider_failed',
  'ambiguous',
  'reconciled',
  'manual_review',
])

function appendOnlyGuard(label) {
  return function rejectMutation(next) {
    next(
      new Error(
        `${label} is append-only and cannot be changed or deleted.`,
      ),
    )
  }
}

function protectAppendOnly(
  schema,
  label,
) {
  schema.pre(
    [
      'updateOne',
      'updateMany',
      'findOneAndUpdate',
      'replaceOne',
      'deleteOne',
      'deleteMany',
      'findOneAndDelete',
    ],
    appendOnlyGuard(
      label,
    ),
  )
}

const operationPathsSchema =
  new Schema(
    {
      catalogSync: {
        type: String,
        trim: true,
        maxlength: 300,
        default: '',
      },

      inventorySync: {
        type: String,
        trim: true,
        maxlength: 300,
        default: '',
      },

      supplierPurchaseOrder: {
        type: String,
        trim: true,
        maxlength: 300,
        default: '',
      },

      payoutExecution: {
        type: String,
        trim: true,
        maxlength: 300,
        default: '',
      },
    },
    {
      _id: false,
      strict: true,
    },
  )

const partnerConnectionSchema =
  new Schema(
    {
      organizationId: {
        type: objectId,
        ref: 'MarketplaceOrganization',
        required: true,
        index: true,
        immutable: true,
      },

      partnerKey: {
        type: String,
        trim: true,
        lowercase: true,
        minlength: 3,
        maxlength: 100,
        match:
          /^[a-z][a-z0-9_.-]*$/,
        required: true,
      },

      displayName: {
        type: String,
        trim: true,
        maxlength: 220,
        required: true,
      },

      partnerType: {
        type: String,
        enum:
          PARTNER_TYPES,
        required: true,
        index: true,
      },

      adapterType: {
        type: String,
        enum: [
          'epantry_https_v1',
        ],
        required: true,
        default:
          'epantry_https_v1',
      },

      baseUrl: {
        type: String,
        trim: true,
        maxlength: 600,
        required: true,
      },

      /*
      |--------------------------------------------------------------------------
      | Secret References Only
      |--------------------------------------------------------------------------
      |
      | These fields contain environment-variable names.
      |
      | They never contain:
      |
      | API token
      | bank credential
      | password
      | webhook secret
      |
      */

      credentialEnvKey: {
        type: String,
        trim: true,
        maxlength: 160,
        default: '',
      },

      webhookSecretEnvKey: {
        type: String,
        trim: true,
        maxlength: 160,
        default: '',
      },

      allowedOperations: {
        type: [
          String,
        ],

        enum:
          PARTNER_OPERATIONS,

        required: true,

        default: [],
      },

      operationPaths: {
        type:
          operationPathsSchema,

        required:
          true,

        default:
          () => ({}),
      },

      status: {
        type: String,
        enum:
          PARTNER_CONNECTION_STATUSES,

        required:
          true,

        default:
          'pending_review',

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

      reviewedByUserId: {
        type:
          objectId,

        ref:
          'User',

        default:
          null,
      },

      reviewedAt: {
        type:
          Date,

        default:
          null,
      },

      reviewReason: {
        type:
          String,

        trim:
          true,

        maxlength:
          4000,

        default:
          '',
      },
    },
    {
      ...baseOptions,

      collection:
        'partnerConnections',
    },
  )

partnerConnectionSchema.index(
  {
    organizationId:
      1,

    partnerKey:
      1,
  },
  {
    unique:
      true,

    name:
      'partner_connection_org_key_unique',
  },
)

const partnerExecutionEventSchema =
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

        immutable:
          true,
      },

      partnerConnectionId: {
        type:
          objectId,

        ref:
          'PartnerConnection',

        required:
          true,

        index:
          true,

        immutable:
          true,
      },

      direction: {
        type:
          String,

        enum: [
          'outbound',
          'inbound',
          'internal',
        ],

        required:
          true,

        immutable:
          true,
      },

      operation: {
        type:
          String,

        enum:
          PARTNER_OPERATIONS,

        required:
          true,

        index:
          true,

        immutable:
          true,
      },

      idempotencyKey: {
        type:
          String,

        trim:
          true,

        maxlength:
          180,

        required:
          true,

        immutable:
          true,
      },

      correlationId: {
        type:
          String,

        trim:
          true,

        maxlength:
          180,

        default:
          '',

        immutable:
          true,
      },

      status: {
        type:
          String,

        enum:
          PARTNER_EVENT_STATUSES,

        required:
          true,

        index:
          true,

        immutable:
          true,
      },

      requestFingerprint: {
        type:
          String,

        trim:
          true,

        maxlength:
          128,

        default:
          '',

        immutable:
          true,
      },

      responseFingerprint: {
        type:
          String,

        trim:
          true,

        maxlength:
          128,

        default:
          '',

        immutable:
          true,
      },

      providerEventId: {
        type:
          String,

        trim:
          true,

        maxlength:
          240,

        default:
          '',

        immutable:
          true,
      },

      sourceEntityType: {
        type:
          String,

        trim:
          true,

        maxlength:
          80,

        default:
          '',

        immutable:
          true,
      },

      sourceEntityId: {
        type:
          String,

        trim:
          true,

        maxlength:
          240,

        default:
          '',

        immutable:
          true,
      },

      normalizedSummary: {
        type:
          Schema.Types.Mixed,

        default:
          {},

        immutable:
          true,
      },

      errorCode: {
        type:
          String,

        trim:
          true,

        maxlength:
          160,

        default:
          '',

        immutable:
          true,
      },

      errorMessage: {
        type:
          String,

        trim:
          true,

        maxlength:
          1000,

        default:
          '',

        immutable:
          true,
      },

      occurredAt: {
        type:
          Date,

        required:
          true,

        default:
          Date.now,

        index:
          true,

        immutable:
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

      strict:
        true,

      minimize:
        false,

      versionKey:
        false,

      collection:
        'partnerExecutionEvents',
    },
  )

partnerExecutionEventSchema.index({
  partnerConnectionId:
    1,

  operation:
    1,

  idempotencyKey:
    1,

  status:
    1,
})

protectAppendOnly(
  partnerExecutionEventSchema,
  'Partner execution event',
)

const purchaseOrderLineSchema =
  new Schema(
    {
      canonicalIngredientId: {
        type:
          objectId,

        ref:
          'CanonicalIngredient',

        required:
          true,
      },

      supplierProductId: {
        type:
          objectId,

        ref:
          'HospitalitySupplierProduct',

        required:
          true,
      },

      quantity: {
        type:
          Number,

        min:
          0,

        required:
          true,
      },

      unit: {
        type:
          String,

        trim:
          true,

        maxlength:
          40,

        required:
          true,
      },

      expectedCostMinor: {
        type:
          Number,

        min:
          0,

        required:
          true,
      },
    },
    {
      _id:
        false,

      strict:
        true,
    },
  )

const purchaseOrderSchema =
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

        immutable:
          true,
      },

      procurementPlanId: {
        type:
          objectId,

        ref:
          'HospitalityProcurementPlan',

        required:
          true,

        index:
          true,

        immutable:
          true,
      },

      supplierId: {
        type:
          objectId,

        ref:
          'HospitalitySupplier',

        required:
          true,

        index:
          true,

        immutable:
          true,
      },

      partnerConnectionId: {
        type:
          objectId,

        ref:
          'PartnerConnection',

        default:
          null,

        index:
          true,
      },

      poNumber: {
        type:
          String,

        trim:
          true,

        maxlength:
          160,

        required:
          true,

        unique:
          true,

        index:
          true,

        immutable:
          true,
      },

      status: {
        type:
          String,

        enum:
          PURCHASE_ORDER_STATUSES,

        required:
          true,

        default:
          'draft',

        index:
          true,
      },

      currency: {
        type:
          String,

        trim:
          true,

        uppercase:
          true,

        minlength:
          3,

        maxlength:
          3,

        required:
          true,

        default:
          'INR',

        immutable:
          true,
      },

      lines: {
        type: [
          purchaseOrderLineSchema,
        ],

        required:
          true,

        default:
          [],
      },

      expectedTotalMinor: {
        type:
          Number,

        min:
          0,

        required:
          true,

        immutable:
          true,
      },

      idempotencyKey: {
        type:
          String,

        trim:
          true,

        maxlength:
          180,

        required:
          true,

        immutable:
          true,
      },

      createdByUserId: {
        type:
          objectId,

        ref:
          'User',

        required:
          true,

        immutable:
          true,
      },

      approvedByUserId: {
        type:
          objectId,

        ref:
          'User',

        default:
          null,
      },

      approvedAt: {
        type:
          Date,

        default:
          null,
      },

      submittedAt: {
        type:
          Date,

        default:
          null,
      },

      acknowledgedAt: {
        type:
          Date,

        default:
          null,
      },

      receivedAt: {
        type:
          Date,

        default:
          null,
      },

      providerReference: {
        type:
          String,

        trim:
          true,

        maxlength:
          300,

        default:
          '',
      },

      lastReason: {
        type:
          String,

        trim:
          true,

        maxlength:
          4000,

        default:
          '',
      },
    },
    {
      ...baseOptions,

      collection:
        'purchaseOrders',
    },
  )

purchaseOrderSchema.index(
  {
    organizationId:
      1,

    procurementPlanId:
      1,

    supplierId:
      1,
  },
  {
    unique:
      true,

    name:
      'purchase_order_plan_supplier_unique',
  },
)

const purchaseOrderEventSchema =
  new Schema(
    {
      purchaseOrderId: {
        type:
          objectId,

        ref:
          'PurchaseOrder',

        required:
          true,

        index:
          true,

        immutable:
          true,
      },

      organizationId: {
        type:
          objectId,

        ref:
          'MarketplaceOrganization',

        required:
          true,

        index:
          true,

        immutable:
          true,
      },

      eventType: {
        type:
          String,

        enum: [
          'created',
          'approved',
          'submitted',
          'acknowledged',
          'partially_received',
          'received',
          'cancelled',
          'closed',
          'submission_failed',
          'submission_ambiguous',
        ],

        required:
          true,

        immutable:
          true,
      },

      actorUserId: {
        type:
          objectId,

        ref:
          'User',

        default:
          null,

        immutable:
          true,
      },

      reason: {
        type:
          String,

        trim:
          true,

        maxlength:
          4000,

        required:
          true,

        immutable:
          true,
      },

      metadata: {
        type:
          Schema.Types.Mixed,

        default:
          {},

        immutable:
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

      strict:
        true,

      minimize:
        false,

      versionKey:
        false,

      collection:
        'purchaseOrderEvents',
    },
  )

protectAppendOnly(
  purchaseOrderEventSchema,
  'Purchase order event',
)

const payoutExecutionSchema =
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

        immutable:
          true,
      },

      settlementId: {
        type:
          objectId,

        ref:
          'HostSettlement',

        required:
          true,

        unique:
          true,

        index:
          true,

        immutable:
          true,
      },

      partnerConnectionId: {
        type:
          objectId,

        ref:
          'PartnerConnection',

        required:
          true,

        index:
          true,

        immutable:
          true,
      },

      status: {
        type:
          String,

        enum:
          PAYOUT_EXECUTION_STATUSES,

        required:
          true,

        index:
          true,
      },

      amountMinor: {
        type:
          Number,

        min:
          0,

        required:
          true,

        immutable:
          true,
      },

      currency: {
        type:
          String,

        trim:
          true,

        uppercase:
          true,

        minlength:
          3,

        maxlength:
          3,

        required:
          true,

        immutable:
          true,
      },

      idempotencyKey: {
        type:
          String,

        trim:
          true,

        maxlength:
          180,

        required:
          true,

        immutable:
          true,
      },

      providerReference: {
        type:
          String,

        trim:
          true,

        maxlength:
          300,

        default:
          '',
      },

      attemptCount: {
        type:
          Number,

        min:
          1,

        required:
          true,

        default:
          1,
      },

      lastAttemptAt: {
        type:
          Date,

        required:
          true,

        default:
          Date.now,
      },

      executedByUserId: {
        type:
          objectId,

        ref:
          'User',

        required:
          true,

        immutable:
          true,
      },

      lastErrorCode: {
        type:
          String,

        trim:
          true,

        maxlength:
          160,

        default:
          '',
      },

      lastErrorMessage: {
        type:
          String,

        trim:
          true,

        maxlength:
          1000,

        default:
          '',
      },
    },
    {
      ...baseOptions,

      collection:
        'payoutExecutions',
    },
  )

const reconciliationEvidenceSchema =
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

        immutable:
          true,
      },

      domain: {
        type:
          String,

        enum: [
          'purchase_order',
          'payout',
          'partner_sync',
        ],

        required:
          true,

        index:
          true,

        immutable:
          true,
      },

      entityType: {
        type:
          String,

        trim:
          true,

        maxlength:
          80,

        required:
          true,

        immutable:
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

        index:
          true,

        immutable:
          true,
      },

      status: {
        type:
          String,

        enum: [
          'matched',
          'variance',
          'manual_review',
        ],

        required:
          true,

        index:
          true,

        immutable:
          true,
      },

      expected: {
        type:
          Schema.Types.Mixed,

        default:
          {},

        immutable:
          true,
      },

      observed: {
        type:
          Schema.Types.Mixed,

        default:
          {},

        immutable:
          true,
      },

      evidenceRefs: {
        type: [
          String,
        ],

        default:
          [],

        immutable:
          true,
      },

      reason: {
        type:
          String,

        trim:
          true,

        maxlength:
          4000,

        required:
          true,

        immutable:
          true,
      },

      createdByUserId: {
        type:
          objectId,

        ref:
          'User',

        default:
          null,

        immutable:
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

      strict:
        true,

      minimize:
        false,

      versionKey:
        false,

      collection:
        'reconciliationEvidence',
    },
  )

protectAppendOnly(
  reconciliationEvidenceSchema,
  'Reconciliation evidence',
)

export const PartnerConnection =
  mongoose.models
    .PartnerConnection ||
  mongoose.model(
    'PartnerConnection',
    partnerConnectionSchema,
  )

export const PartnerExecutionEvent =
  mongoose.models
    .PartnerExecutionEvent ||
  mongoose.model(
    'PartnerExecutionEvent',
    partnerExecutionEventSchema,
  )

export const PurchaseOrder =
  mongoose.models
    .PurchaseOrder ||
  mongoose.model(
    'PurchaseOrder',
    purchaseOrderSchema,
  )

export const PurchaseOrderEvent =
  mongoose.models
    .PurchaseOrderEvent ||
  mongoose.model(
    'PurchaseOrderEvent',
    purchaseOrderEventSchema,
  )

export const PayoutExecution =
  mongoose.models
    .PayoutExecution ||
  mongoose.model(
    'PayoutExecution',
    payoutExecutionSchema,
  )

export const ReconciliationEvidence =
  mongoose.models
    .ReconciliationEvidence ||
  mongoose.model(
    'ReconciliationEvidence',
    reconciliationEvidenceSchema,
  )