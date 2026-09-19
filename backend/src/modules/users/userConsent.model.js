import mongoose from 'mongoose'

/*
|--------------------------------------------------------------------------
| Consent Types
|--------------------------------------------------------------------------
|
| terms_of_service:
|   EPANTRY Terms acceptance.
|
| privacy_policy:
|   Privacy policy acknowledgement.
|
| marketing_email:
|   Optional promotional email permission.
|
| personalization:
|   Optional preference-based personalization permission.
|
*/

export const USER_CONSENT_TYPES =
  Object.freeze([
    'terms_of_service',
    'privacy_policy',
    'marketing_email',
    'personalization',
  ])

/*
|--------------------------------------------------------------------------
| Consent Decisions
|--------------------------------------------------------------------------
|
| Consent history is append-only.
|
| Instead of mutating:
|
| marketingEmail = true → false
|
| EPANTRY records:
|
| granted
| revoked
|
| and derives the current state from the latest event.
|
*/

export const USER_CONSENT_DECISIONS =
  Object.freeze([
    'granted',
    'revoked',
  ])

/*
|--------------------------------------------------------------------------
| Consent Sources
|--------------------------------------------------------------------------
*/

export const USER_CONSENT_SOURCES =
  Object.freeze([
    'registration',
    'account_settings',
    'onboarding',
    'system_migration',
  ])

/*
|--------------------------------------------------------------------------
| User Consent Event Schema
|--------------------------------------------------------------------------
*/

const userConsentSchema =
  new mongoose.Schema(
    {
      /*
      |--------------------------------------------------------------------------
      | EPANTRY User
      |--------------------------------------------------------------------------
      */

      userId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          'User',

        required:
          true,

        immutable:
          true,

        index:
          true,
      },

      /*
      |--------------------------------------------------------------------------
      | Consent Category
      |--------------------------------------------------------------------------
      */

      consentType: {
        type:
          String,

        enum:
          USER_CONSENT_TYPES,

        required:
          true,

        immutable:
          true,

        index:
          true,
      },

      /*
      |--------------------------------------------------------------------------
      | User Decision
      |--------------------------------------------------------------------------
      */

      decision: {
        type:
          String,

        enum:
          USER_CONSENT_DECISIONS,

        required:
          true,

        immutable:
          true,
      },

      /*
      |--------------------------------------------------------------------------
      | Policy / Consent Version
      |--------------------------------------------------------------------------
      |
      | Examples:
      |
      | terms-v1
      | privacy-v2
      | marketing-v1
      |
      | Mandatory legal documents can therefore require a new acceptance when
      | a materially new version is introduced.
      |
      */

      version: {
        type:
          String,

        required:
          true,

        trim:
          true,

        minlength:
          1,

        maxlength:
          80,

        immutable:
          true,
      },

      /*
      |--------------------------------------------------------------------------
      | Decision Source
      |--------------------------------------------------------------------------
      */

      source: {
        type:
          String,

        enum:
          USER_CONSENT_SOURCES,

        required:
          true,

        default:
          'account_settings',

        immutable:
          true,
      },

      /*
      |--------------------------------------------------------------------------
      | Explicit Decision Time
      |--------------------------------------------------------------------------
      |
      | createdAt is also present, but recordedAt makes the domain meaning
      | explicit and supports future migrations/imports.
      |
      */

      recordedAt: {
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

      /*
      |--------------------------------------------------------------------------
      | Request Correlation
      |--------------------------------------------------------------------------
      |
      | Useful for operational audit without storing secrets or raw tokens.
      |
      */

      requestId: {
        type:
          String,

        trim:
          true,

        maxlength:
          120,

        default:
          null,

        immutable:
          true,
      },
    },

    {
      timestamps:
        true,

      collection:
        'user_consents',

      minimize:
        false,
    },
  )

/*
|--------------------------------------------------------------------------
| Current Consent Lookup
|--------------------------------------------------------------------------
|
| Most current-state queries:
|
| userId + consentType
| ordered by recordedAt descending
|
*/

userConsentSchema.index({
  userId:
    1,

  consentType:
    1,

  recordedAt:
    -1,
})

/*
|--------------------------------------------------------------------------
| Version Audit Lookup
|--------------------------------------------------------------------------
*/

userConsentSchema.index({
  userId:
    1,

  consentType:
    1,

  version:
    1,

  recordedAt:
    -1,
})

/*
|--------------------------------------------------------------------------
| Immutability Protection
|--------------------------------------------------------------------------
|
| Consent events should never be edited after creation.
|
| Revocation creates another event instead.
|
*/

userConsentSchema.pre(
  [
    'updateOne',
    'updateMany',
    'findOneAndUpdate',
    'replaceOne',
  ],

  function preventConsentMutation(
    next,
  ) {
    const error =
      new Error(
        'Consent audit events are immutable.',
      )

    error.code =
      'CONSENT_EVENT_IMMUTABLE'

    next(
      error,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Model
|--------------------------------------------------------------------------
*/

export const UserConsent =
  mongoose.models.UserConsent ||
  mongoose.model(
    'UserConsent',
    userConsentSchema,
  )