import crypto from 'node:crypto'

import mongoose from 'mongoose'

const {
  Schema,
  model,
  models,
} = mongoose

/*
|--------------------------------------------------------------------------
| Purchase Source Providers
|--------------------------------------------------------------------------
|
| Provider identifies the upstream source category only.
|
| Provider-specific OAuth tokens, refresh tokens, access tokens or mailbox
| credentials NEVER belong in this MongoDB model. Those credentials must be
| owned by the provider adapter / deployment secret store.
|
*/

export const PURCHASE_SOURCE_PROVIDERS =
  Object.freeze([
    'gmail',
    'outlook',
    'retailer',
    'receipt_import',
  ])

/*
|--------------------------------------------------------------------------
| Source Lifecycle
|--------------------------------------------------------------------------
|
| pending_authorization:
|   Customer explicitly created the connection intent, but provider
|   authorization has not completed yet.
|
| connected:
|   Provider authorization is valid and sync may run.
|
| paused:
|   Customer paused provider sync. Existing imported history remains visible.
|
| reauthorization_required:
|   Provider credentials are no longer usable and customer action is needed.
|
| revoked:
|   Customer permanently disconnected this authorization. A new connection
|   must be created to reconnect.
|
*/

export const PURCHASE_SOURCE_STATUSES =
  Object.freeze([
    'pending_authorization',
    'connected',
    'paused',
    'reauthorization_required',
    'revoked',
  ])

export const PURCHASE_SOURCE_SYNC_STATUSES =
  Object.freeze([
    'never',
    'running',
    'success',
    'partial',
    'failed',
  ])

export const PURCHASE_SOURCE_CONSENT_PURPOSE =
  'purchase_history_intelligence'

export const PURCHASE_SOURCE_CONSENT_VERSION =
  'purchase-history-v1'

export const PURCHASE_SOURCE_SCOPES =
  Object.freeze([
    'purchase_receipts',
    'order_history',
    'delivery_status',
  ])

/*
|--------------------------------------------------------------------------
| Connected Purchase Source
|--------------------------------------------------------------------------
|
| Ownership model:
|
| - userId is the human account that connected the provider.
| - householdId is the consumer household that may receive derived purchase
|   signals later.
|
| This distinction is intentional. Provider credentials are personal, while
| pantry intelligence is household-scoped.
|
*/

const connectedPurchaseSourceSchema =
  new Schema(
    {
      sourceId: {
        type:
          String,

        required:
          true,

        unique:
          true,

        immutable:
          true,

        index:
          true,

        default:
          () =>
            `psrc_${crypto.randomUUID()}`,
      },

      userId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'User',

        required:
          true,

        immutable:
          true,

        index:
          true,
      },

      householdId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'Household',

        required:
          true,

        immutable:
          true,

        index:
          true,
      },

      provider: {
        type:
          String,

        enum:
          PURCHASE_SOURCE_PROVIDERS,

        required:
          true,

        immutable:
          true,

        index:
          true,
      },

      displayLabel: {
        type:
          String,

        trim:
          true,

        maxlength:
          160,

        default:
          '',
      },

      status: {
        type:
          String,

        enum:
          PURCHASE_SOURCE_STATUSES,

        required:
          true,

        default:
          'pending_authorization',

        index:
          true,
      },

      /*
      |--------------------------------------------------------------------
      | Explicit Purpose-Scoped Consent
      |--------------------------------------------------------------------
      |
      | This is connection-specific consent, separate from general account
      | personalization preferences. It records exactly why this upstream
      | source may be accessed.
      |
      */

      consentPurpose: {
        type:
          String,

        required:
          true,

        immutable:
          true,

        default:
          PURCHASE_SOURCE_CONSENT_PURPOSE,
      },

      consentVersion: {
        type:
          String,

        required:
          true,

        immutable:
          true,

        default:
          PURCHASE_SOURCE_CONSENT_VERSION,
      },

      consentScopes: {
        type: [
          {
            type:
              String,

            enum:
              PURCHASE_SOURCE_SCOPES,
          },
        ],

        required:
          true,

        default:
          [],
      },

      consentGrantedAt: {
        type:
          Date,

        required:
          true,

        immutable:
          true,

        default:
          Date.now,
      },

      consentRevokedAt: {
        type:
          Date,

        default:
          null,
      },

      /*
      |--------------------------------------------------------------------
      | Provider Binding
      |--------------------------------------------------------------------
      |
      | Only a SHA-256 hash of the provider account reference is kept so the
      | platform can prevent duplicate bindings without storing the raw email,
      | mailbox id or retailer account id in this record.
      |
      | select:false reduces accidental exposure in ordinary queries.
      |
      */

      providerAccountRefHash: {
        type:
          String,

        trim:
          true,

        maxlength:
          64,

        default:
          null,

        select:
          false,
      },

      adapterKey: {
        type:
          String,

        trim:
          true,

        maxlength:
          80,

        default:
          '',
      },

      /*
      |--------------------------------------------------------------------
      | Learning Control
      |--------------------------------------------------------------------
      |
      | Sync and learning are intentionally separate controls.
      |
      | A customer may keep imported history visible while temporarily
      | stopping that data from influencing Pantry / Next Basket learning.
      |
      */

      learningEnabled: {
        type:
          Boolean,

        required:
          true,

        default:
          true,
      },

      learningPausedAt: {
        type:
          Date,

        default:
          null,
      },

      /*
      |--------------------------------------------------------------------
      | Sync State
      |--------------------------------------------------------------------
      */

      lastSyncStatus: {
        type:
          String,

        enum:
          PURCHASE_SOURCE_SYNC_STATUSES,

        required:
          true,

        default:
          'never',
      },

      lastSyncStartedAt: {
        type:
          Date,

        default:
          null,
      },

      lastSyncAt: {
        type:
          Date,

        default:
          null,
      },

      lastSuccessfulSyncAt: {
        type:
          Date,

        default:
          null,
      },

      lastSyncSummary: {
        type:
          String,

        trim:
          true,

        maxlength:
          500,

        default:
          '',
      },

      lastSyncErrorCode: {
        type:
          String,

        trim:
          true,

        maxlength:
          120,

        default:
          '',
      },

      /*
      |--------------------------------------------------------------------
      | Lifecycle Timestamps
      |--------------------------------------------------------------------
      */

      pausedAt: {
        type:
          Date,

        default:
          null,
      },

      reauthorizationRequiredAt: {
        type:
          Date,

        default:
          null,
      },

      revokedAt: {
        type:
          Date,

        default:
          null,
      },

      importedHistoryDeletedAt: {
        type:
          Date,

        default:
          null,
      },

      /*
      |--------------------------------------------------------------------
      | Privacy Reset Boundary
      |--------------------------------------------------------------------
      |
      | After a customer deletes imported history, adapters must not silently
      | re-import older transactions on the next sync. Only purchases on/after
      | this boundary are eligible unless the customer explicitly starts a new
      | import workflow later.
      |
      */

      historyImportAfter: {
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
        'connected_purchase_sources',

      strict:
        'throw',

      minimize:
        false,
    },
  )

/*
|--------------------------------------------------------------------------
| Indexes
|--------------------------------------------------------------------------
*/

connectedPurchaseSourceSchema.index(
  {
    userId:
      1,

    householdId:
      1,

    status:
      1,

    createdAt:
      -1,
  },
  {
    name:
      'purchase_source_owner_household_status',
  },
)

connectedPurchaseSourceSchema.index(
  {
    userId:
      1,

    provider:
      1,

    providerAccountRefHash:
      1,
  },
  {
    unique:
      true,

    partialFilterExpression: {
      providerAccountRefHash: {
        $type:
          'string',
      },
    },

    name:
      'purchase_source_provider_account_active_unique',
  },
)

/*
|--------------------------------------------------------------------------
| Lifecycle Guard
|--------------------------------------------------------------------------
|
| A revoked connection must never silently return to another state through a
| generic save/update path. Reconnection requires a new explicit source.
|
*/

connectedPurchaseSourceSchema.pre(
  'validate',

  function validateRevokedState(
    next,
  ) {
    if (
      this.status ===
        'revoked' &&
      !this.revokedAt
    ) {
      this.revokedAt =
        new Date()
    }

    if (
      this.status !==
        'revoked' &&
      this.consentRevokedAt
    ) {
      return next(
        new Error(
          'A purchase source with revoked consent cannot become active again.',
        ),
      )
    }

    return next()
  },
)

export const ConnectedPurchaseSource =
  models.ConnectedPurchaseSource ||
  model(
    'ConnectedPurchaseSource',
    connectedPurchaseSourceSchema,
  )
