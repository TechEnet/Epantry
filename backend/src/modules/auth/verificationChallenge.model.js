import mongoose from 'mongoose'

/*
|--------------------------------------------------------------------------
| Verification Purposes
|--------------------------------------------------------------------------
*/

export const VERIFICATION_PURPOSES =
  Object.freeze([
    'registration_email',
  ])

/*
|--------------------------------------------------------------------------
| Public Registration Account Types
|--------------------------------------------------------------------------
|
| Public registration exposes only Customer and Host.
|
| Super Admin is deliberately excluded and Seller / Brand / B2B are no
| longer top-level application roles.
|
*/

export const PUBLIC_REGISTRATION_ACCOUNT_TYPES =
  Object.freeze([
    'customer',
    'host',
  ])

/*
|--------------------------------------------------------------------------
| Verification Challenge
|--------------------------------------------------------------------------
*/

const verificationChallengeSchema =
  new mongoose.Schema(
    {
      purpose: {
        type:
          String,

        enum:
          VERIFICATION_PURPOSES,

        required:
          true,

        index:
          true,
      },

      /*
      |--------------------------------------------------------------------------
      | Temporary Registration Context
      |--------------------------------------------------------------------------
      |
      | Password is intentionally NEVER stored here.
      |
      */

      name: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          120,
      },

      email: {
        type:
          String,

        required:
          true,

        trim:
          true,

        lowercase:
          true,

        maxlength:
          254,

        index:
          true,
      },

      phone: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          20,
      },

      accountType: {
        type:
          String,

        enum:
          PUBLIC_REGISTRATION_ACCOUNT_TYPES,

        required:
          true,
      },

      /*
      |--------------------------------------------------------------------------
      | OTP
      |--------------------------------------------------------------------------
      */

      otpHash: {
        type:
          String,

        required:
          true,

        select:
          false,
      },

      attempts: {
        type:
          Number,

        default:
          0,

        required:
          true,

        min:
          0,
      },

      maxAttempts: {
        type:
          Number,

        required:
          true,
      },

      expiresAt: {
        type:
          Date,

        required:
          true,

        index:
          true,
      },

      resendAvailableAt: {
        type:
          Date,

        required:
          true,
      },

      /*
      |--------------------------------------------------------------------------
      | OTP State
      |--------------------------------------------------------------------------
      */

      consumedAt: {
        type:
          Date,

        default:
          null,
      },

      invalidatedAt: {
        type:
          Date,

        default:
          null,
      },

      /*
      |--------------------------------------------------------------------------
      | Registration Proof
      |--------------------------------------------------------------------------
      */

      registrationProofHash: {
        type:
          String,

        default:
          null,

        select:
          false,
      },

      registrationProofExpiresAt: {
        type:
          Date,

        default:
          null,
      },

      /*
      |--------------------------------------------------------------------------
      | Registration Claim
      |--------------------------------------------------------------------------
      */

      registrationProofConsumedAt: {
        type:
          Date,

        default:
          null,
      },

      registrationClaimedFirebaseUid: {
        type:
          String,

        default:
          null,

        maxlength:
          128,
      },

      /*
      |--------------------------------------------------------------------------
      | Completed Registration
      |--------------------------------------------------------------------------
      */

      registrationCompletedAt: {
        type:
          Date,

        default:
          null,
      },

      registrationCompletedFirebaseUid: {
        type:
          String,

        default:
          null,

        maxlength:
          128,
      },

      registrationCompletedUserId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          'User',

        default:
          null,
      },

      /*
      |--------------------------------------------------------------------------
      | Email Delivery
      |--------------------------------------------------------------------------
      */

      deliveryProvider: {
        type:
          String,

        default:
          'brevo',
      },

      deliveryMessageId: {
        type:
          String,

        default:
          null,
      },

      /*
      |--------------------------------------------------------------------------
      | Cleanup
      |--------------------------------------------------------------------------
      */

      cleanupAt: {
        type:
          Date,

        required:
          true,
      },
    },

    {
      timestamps:
        true,

      collection:
        'verification_challenges',
    },
  )

/*
|--------------------------------------------------------------------------
| Registration Lookup
|--------------------------------------------------------------------------
*/

verificationChallengeSchema.index({
  purpose:
    1,

  email:
    1,

  createdAt:
    -1,
})

/*
|--------------------------------------------------------------------------
| Automatic TTL Cleanup
|--------------------------------------------------------------------------
*/

verificationChallengeSchema.index(
  {
    cleanupAt:
      1,
  },

  {
    expireAfterSeconds:
      0,
  },
)

/*
|--------------------------------------------------------------------------
| Model
|--------------------------------------------------------------------------
*/

export const VerificationChallenge =
  mongoose.models
    .VerificationChallenge ||
  mongoose.model(
    'VerificationChallenge',
    verificationChallengeSchema,
  )