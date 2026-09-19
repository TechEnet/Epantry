import mongoose from 'mongoose'

/*
|--------------------------------------------------------------------------
| Household Invitation Roles
|--------------------------------------------------------------------------
|
| owner is intentionally excluded.
|
| Household ownership is a higher-trust lifecycle concern and must not be
| transferred through a normal invitation.
|
*/

export const HOUSEHOLD_INVITATION_ROLES =
  Object.freeze([
    'admin',
    'member',
  ])

/*
|--------------------------------------------------------------------------
| Household Invitation Status
|--------------------------------------------------------------------------
*/

export const HOUSEHOLD_INVITATION_STATUSES =
  Object.freeze([
    'pending',
    'accepted',
    'declined',
    'revoked',
    'expired',
  ])

/*
|--------------------------------------------------------------------------
| Delivery Status
|--------------------------------------------------------------------------
|
| Delivery metadata remains separate from invitation authority.
|
| A successfully delivered email does not mean the invitation was accepted,
| and a failed delivery must never silently create household membership.
|
*/

export const HOUSEHOLD_INVITATION_DELIVERY_STATUSES =
  Object.freeze([
    'pending',
    'sent',
    'failed',
  ])

/*
|--------------------------------------------------------------------------
| Household Invitation Schema
|--------------------------------------------------------------------------
|
| Security principles:
|
| - raw invitation tokens are never stored
| - only SHA-256 token hashes are persisted
| - invitations are separate from memberships
| - pending invitations do not grant tenant access
| - expiry is lifecycle state, not destructive TTL deletion
|
| Historical invitation records are retained so household administration can
| be audited without keeping reusable invitation secrets.
|
*/

const householdInvitationSchema =
  new mongoose.Schema(
    {
      householdId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          'Household',

        required:
          true,

        immutable:
          true,

        index:
          true,
      },

      invitedEmail: {
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

      role: {
        type:
          String,

        enum:
          HOUSEHOLD_INVITATION_ROLES,

        required:
          true,

        default:
          'member',

        index:
          true,
      },

      roleLabel: {
        type:
          String,

        trim:
          true,

        minlength:
          2,

        maxlength:
          40,

        default:
          null,
      },

      status: {
        type:
          String,

        enum:
          HOUSEHOLD_INVITATION_STATUSES,

        required:
          true,

        default:
          'pending',

        index:
          true,
      },

      tokenHash: {
        type:
          String,

        required:
          true,

        trim:
          true,

        minlength:
          64,

        maxlength:
          64,

        unique:
          true,

        index:
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

      invitedByUserId: {
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

      acceptedByUserId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          'User',

        default:
          null,
      },

      declinedByUserId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          'User',

        default:
          null,
      },

      revokedByUserId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          'User',

        default:
          null,
      },

      acceptedAt: {
        type:
          Date,

        default:
          null,
      },

      declinedAt: {
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

      expiredAt: {
        type:
          Date,

        default:
          null,
      },

      resendCount: {
        type:
          Number,

        required:
          true,

        default:
          0,

        min:
          0,
      },

      deliveryStatus: {
        type:
          String,

        enum:
          HOUSEHOLD_INVITATION_DELIVERY_STATUSES,

        required:
          true,

        default:
          'pending',

        index:
          true,
      },

      deliveryAttemptCount: {
        type:
          Number,

        required:
          true,

        default:
          0,

        min:
          0,
      },

      lastDeliveryAttemptAt: {
        type:
          Date,

        default:
          null,
      },

      lastDeliveredAt: {
        type:
          Date,

        default:
          null,
      },

      deliveryProviderMessageId: {
        type:
          String,

        trim:
          true,

        maxlength:
          240,

        default:
          null,
      },
    },

    {
      timestamps:
        true,

      collection:
        'household_invitations',

      minimize:
        false,
    },
  )

/*
|--------------------------------------------------------------------------
| Only One Pending Invitation Per Household + Email
|--------------------------------------------------------------------------
|
| A completed/expired invitation remains historical, while a new invitation
| may be created later.
|
*/

householdInvitationSchema.index(
  {
    householdId:
      1,

    invitedEmail:
      1,
  },

  {
    unique:
      true,

    partialFilterExpression: {
      status:
        'pending',
    },
  },
)

/*
|--------------------------------------------------------------------------
| Household Administration Listing
|--------------------------------------------------------------------------
*/

householdInvitationSchema.index({
  householdId:
    1,

  status:
    1,

  createdAt:
    -1,
})

/*
|--------------------------------------------------------------------------
| Invitee Lookup / Expiry Maintenance
|--------------------------------------------------------------------------
*/

householdInvitationSchema.index({
  invitedEmail:
    1,

  status:
    1,

  expiresAt:
    1,
})

/*
|--------------------------------------------------------------------------
| Model
|--------------------------------------------------------------------------
*/

export const HouseholdInvitation =
  mongoose.models.HouseholdInvitation ||
  mongoose.model(
    'HouseholdInvitation',
    householdInvitationSchema,
  )
