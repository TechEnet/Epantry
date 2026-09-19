import mongoose from 'mongoose'

/*
|--------------------------------------------------------------------------
| Final Application Access Types
|--------------------------------------------------------------------------
|
| EPANTRY has exactly three top-level access categories:
|
| customer
| host
| super_admin
|
| Customer and Host may belong to the SAME human account.
| Super Admin remains separately controlled and is never publicly selectable.
|
*/

export const USER_ACCESS_TYPES =
  Object.freeze([
    'customer',
    'host',
    'super_admin',
  ])

/*
|--------------------------------------------------------------------------
| Switchable User Modes
|--------------------------------------------------------------------------
|
| activeMode controls the currently selected application experience only.
|
| It is NOT authorization proof.
|
*/

export const USER_ACTIVE_MODES =
  Object.freeze([
    'customer',
    'host',
  ])

/*
|--------------------------------------------------------------------------
| Host Access Lifecycle
|--------------------------------------------------------------------------
|
| Host onboarding/approval is independent from the global account status.
|
| A user may therefore be:
|
| accountStatus = active
| customerEnabled = true
| hostEnabled = false
| hostAccessStatus = pending
|
| and continue using Customer mode while Host access is reviewed.
|
*/

export const HOST_ACCESS_STATUSES =
  Object.freeze([
    'not_requested',
    'pending',
    'active',
    'rejected',
    'suspended',
  ])

/*
|--------------------------------------------------------------------------
| Global Account Status
|--------------------------------------------------------------------------
|
| This status controls whether the MongoDB application identity itself may
| operate inside EPANTRY.
|
| Host onboarding states do NOT belong here.
|
*/

export const USER_ACCOUNT_STATUSES =
  Object.freeze([
    'active',
    'suspended',
    'disabled',
    'locked',
  ])

/*
|--------------------------------------------------------------------------
| Validation
|--------------------------------------------------------------------------
*/

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const E164_PHONE_PATTERN =
  /^\+[1-9]\d{7,14}$/

/*
|--------------------------------------------------------------------------
| User / Application Identity Schema
|--------------------------------------------------------------------------
|
| Firebase owns:
|
| - password credentials
| - authentication
| - Firebase UID
| - MFA factors
| - password reset
|
| MongoDB owns:
|
| - EPANTRY profile
| - Customer / Host / Super Admin access state
| - active application mode
| - Host onboarding state
| - global account status
| - application metadata
|
| Seller / Brand / B2B are NOT top-level user roles in this schema.
|
*/

const userSchema =
  new mongoose.Schema(
    {
      /*
      |--------------------------------------------------------------------------
      | Firebase Identity
      |--------------------------------------------------------------------------
      */

      firebaseUid: {
        type:
          String,

        required:
          true,

        unique:
          true,

        immutable:
          true,

        trim:
          true,

        minlength:
          1,

        maxlength:
          128,
      },

      /*
      |--------------------------------------------------------------------------
      | Profile
      |--------------------------------------------------------------------------
      */

      name: {
        type:
          String,

        required:
          true,

        trim:
          true,

        minlength:
          2,

        maxlength:
          120,
      },

      email: {
        type:
          String,

        required:
          true,

        unique:
          true,

        trim:
          true,

        lowercase:
          true,

        maxlength:
          254,

        validate: {
          validator(
            value,
          ) {
            return EMAIL_PATTERN.test(
              value,
            )
          },

          message:
            'A valid email address is required.',
        },
      },

      phone: {
        type:
          String,

        default:
          null,

        trim:
          true,

        validate: {
          validator(
            value,
          ) {
            if (
              value ===
                null ||
              value ===
                undefined ||
              value ===
                ''
            ) {
              return true
            }

            return E164_PHONE_PATTERN.test(
              value,
            )
          },

          message:
            'Phone number must use E.164 format.',
        },
      },

      profilePhotoUrl: {
        type:
          String,

        default:
          null,

        trim:
          true,

        maxlength:
          2048,
      },

      /*
      |--------------------------------------------------------------------------
      | Verification Mirrors
      |--------------------------------------------------------------------------
      */

      emailVerified: {
        type:
          Boolean,

        default:
          false,

        required:
          true,
      },

      phoneVerified: {
        type:
          Boolean,

        default:
          false,

        required:
          true,
      },

      /*
      |--------------------------------------------------------------------------
      | Global Account State
      |--------------------------------------------------------------------------
      */

      accountStatus: {
        type:
          String,

        enum:
          USER_ACCOUNT_STATUSES,

        required:
          true,

        default:
          'active',

        index:
          true,
      },

      /*
      |--------------------------------------------------------------------------
      | Customer Access
      |--------------------------------------------------------------------------
      */

      customerEnabled: {
        type:
          Boolean,

        required:
          true,

        default:
          false,

        index:
          true,
      },

      /*
      |--------------------------------------------------------------------------
      | Host Access
      |--------------------------------------------------------------------------
      |
      | hostEnabled is the actual authorization capability.
      |
      | hostAccessStatus describes onboarding/approval lifecycle.
      |
      */

      hostEnabled: {
        type:
          Boolean,

        required:
          true,

        default:
          false,

        index:
          true,
      },

      hostAccessStatus: {
        type:
          String,

        enum:
          HOST_ACCESS_STATUSES,

        required:
          true,

        default:
          'not_requested',

        index:
          true,
      },

      /*
      |--------------------------------------------------------------------------
      | Super Admin Access
      |--------------------------------------------------------------------------
      |
      | Never assigned by public registration.
      |
      */

      superAdminEnabled: {
        type:
          Boolean,

        required:
          true,

        default:
          false,

        index:
          true,
      },

      /*
      |--------------------------------------------------------------------------
      | Active Application Mode
      |--------------------------------------------------------------------------
      |
      | This is a UX/application preference only.
      |
      | Backend authorization always checks the actual access capability.
      |
      | Super-admin-only accounts may keep this value null.
      |
      */

      activeMode: {
        type:
          String,

        enum: [
          ...USER_ACTIVE_MODES,
          null,
        ],

        default:
          null,

        index:
          true,
      },

      /*
      |--------------------------------------------------------------------------
      | Activity
      |--------------------------------------------------------------------------
      */

      lastLoginAt: {
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
        'users',

      minimize:
        false,
    },
  )

/*
|--------------------------------------------------------------------------
| Access-State Invariants
|--------------------------------------------------------------------------
*/

userSchema.pre(
  'validate',

  function validateAccessState(
    next,
  ) {
    if (
      this.hostEnabled &&
      this.hostAccessStatus !==
        'active'
    ) {
      this.invalidate(
        'hostEnabled',
        'Host access can only be enabled when Host access status is active.',
      )
    }

    if (
      this.hostAccessStatus ===
        'active' &&
      !this.hostEnabled
    ) {
      this.invalidate(
        'hostAccessStatus',
        'Active Host access status requires Host access to be enabled.',
      )
    }

    if (
      this.hostEnabled &&
      !this.customerEnabled
    ) {
      this.invalidate(
        'customerEnabled',
        'Every Host account must retain Customer access.',
      )
    }

    if (
      this.activeMode ===
        'customer' &&
      !this.customerEnabled
    ) {
      this.invalidate(
        'activeMode',
        'Customer mode requires Customer access.',
      )
    }

    if (
      this.activeMode ===
        'host' &&
      !this.hostEnabled
    ) {
      this.invalidate(
        'activeMode',
        'Host mode requires Host access.',
      )
    }

    if (
      !this.customerEnabled &&
      !this.hostEnabled &&
      !this.superAdminEnabled
    ) {
      this.invalidate(
        'customerEnabled',
        'An EPANTRY user must have at least one application access capability.',
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

userSchema.index({
  hostAccessStatus:
    1,

  hostEnabled:
    1,
})

userSchema.index({
  customerEnabled:
    1,

  hostEnabled:
    1,

  activeMode:
    1,
})

/*
|--------------------------------------------------------------------------
| User Model
|--------------------------------------------------------------------------
*/

export const User =
  mongoose.models.User ||
  mongoose.model(
    'User',
    userSchema,
  )