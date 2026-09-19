import mongoose from 'mongoose'

/*
|--------------------------------------------------------------------------
| Household Membership Roles
|--------------------------------------------------------------------------
|
| owner:
|   Household ka primary authority.
|
| admin:
|   Future shared household management permissions.
|
| member:
|   Standard household participant.
|
| These are HOUSEHOLD roles.
|
| They are completely separate from global application roles such as:
|
| - customer
| - seller
| - brand
| - super_admin
|
*/

export const HOUSEHOLD_MEMBERSHIP_ROLES =
  Object.freeze([
    'owner',
    'admin',
    'member',
  ])

/*
|--------------------------------------------------------------------------
| Membership Status
|--------------------------------------------------------------------------
|
| active:
|   User currently belongs to household.
|
| left:
|   User voluntarily left.
|
| removed:
|   Membership was ended by authorized household management.
|
| Invitations are intentionally NOT represented in memberships.
|
| HouseholdInvitation owns the pre-membership invitation lifecycle because an
| invitation may exist before the invited person has an EPANTRY User record.
| Membership is created/reactivated only after secure invitation acceptance.
|
*/

export const HOUSEHOLD_MEMBERSHIP_STATUSES =
  Object.freeze([
    'active',
    'left',
    'removed',
  ])

/*
|--------------------------------------------------------------------------
| Household Membership Schema
|--------------------------------------------------------------------------
*/

const householdMembershipSchema =
  new mongoose.Schema(
    {
      /*
      |--------------------------------------------------------------------------
      | Household
      |--------------------------------------------------------------------------
      */

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

      /*
      |--------------------------------------------------------------------------
      | Registered EPANTRY User
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
      | Household Authority
      |--------------------------------------------------------------------------
      */

      role: {
        type:
          String,

        enum:
          HOUSEHOLD_MEMBERSHIP_ROLES,

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

      /*
      |--------------------------------------------------------------------------
      | Membership Lifecycle
      |--------------------------------------------------------------------------
      */

      status: {
        type:
          String,

        enum:
          HOUSEHOLD_MEMBERSHIP_STATUSES,

        required:
          true,

        default:
          'active',

        index:
          true,
      },

      /*
      |--------------------------------------------------------------------------
      | Selected Household Context
      |--------------------------------------------------------------------------
      |
      | A Customer may belong to multiple active Households. Exactly one active
      | membership can be selected as the working Household for Pantry, planning
      | and other Household-scoped Customer features.
      |
      */

      selectedForContext: {
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
      | Membership Timeline
      |--------------------------------------------------------------------------
      */

      joinedAt: {
        type:
          Date,

        required:
          true,

        default:
          Date.now,
      },

      endedAt: {
        type:
          Date,

        default:
          null,
      },

      /*
      |--------------------------------------------------------------------------
      | Management Provenance
      |--------------------------------------------------------------------------
      |
      | These fields keep household member-management actions attributable
      | without introducing a parallel household audit collection.
      |
      */

      roleUpdatedAt: {
        type:
          Date,

        default:
          null,
      },

      roleUpdatedByUserId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          'User',

        default:
          null,
      },

      endedByUserId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          'User',

        default:
          null,
      },
    },

    {
      timestamps:
        true,

      collection:
        'household_memberships',

      minimize:
        false,
    },
  )

/*
|--------------------------------------------------------------------------
| One Historical Relationship Per User + Household
|--------------------------------------------------------------------------
|
| Same user ko same household ke duplicate membership documents create nahi
| karne denge.
|
| If a future "rejoin" workflow is needed, existing membership lifecycle can
| be explicitly governed instead of silently creating duplicate records.
|
*/

householdMembershipSchema.index(
  {
    householdId:
      1,

    userId:
      1,
  },

  {
    unique:
      true,
  },
)

/*
|--------------------------------------------------------------------------
| One Selected Household Context Per User
|--------------------------------------------------------------------------
|
| Multiple simultaneous active Household memberships are allowed.
|
| Only one active membership may be selected as the working Customer context
| at a time. This keeps Pantry/planning tenant resolution deterministic while
| allowing a person to be Owner/Admin/Member across different Households.
|
*/

householdMembershipSchema.index(
  {
    userId:
      1,
  },

  {
    unique:
      true,

    partialFilterExpression: {
      status:
        'active',

      selectedForContext:
        true,
    },

    name:
      'one_selected_household_context_per_user',
  },
)

/*
|--------------------------------------------------------------------------
| One Active Owner Per Household
|--------------------------------------------------------------------------
|
| Prevents accidental dual ownership at database level.
|
| Ownership transfer later must be an explicit governed operation.
|
*/

householdMembershipSchema.index(
  {
    householdId:
      1,

    role:
      1,
  },

  {
    unique:
      true,

    partialFilterExpression: {
      status:
        'active',

      role:
        'owner',
    },

    name:
      'one_active_owner_per_household',
  },
)

/*
|--------------------------------------------------------------------------
| Household Member Lookup
|--------------------------------------------------------------------------
*/

householdMembershipSchema.index({
  householdId:
    1,

  status:
    1,

  role:
    1,
})

/*
|--------------------------------------------------------------------------
| User Household Lookup
|--------------------------------------------------------------------------
*/

householdMembershipSchema.index({
  userId:
    1,

  status:
    1,
})

/*
|--------------------------------------------------------------------------
| Household Membership Model
|--------------------------------------------------------------------------
*/

export const HouseholdMembership =
  mongoose.models.HouseholdMembership ||
  mongoose.model(
    'HouseholdMembership',
    householdMembershipSchema,
  )