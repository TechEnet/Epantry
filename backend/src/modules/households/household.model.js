import mongoose from 'mongoose'

/*
|--------------------------------------------------------------------------
| Household Status
|--------------------------------------------------------------------------
|
| active:
|   Normal usable household.
|
| archived:
|   Household historical state me preserved rahega, lekin new active
|   household-scoped activity ke liye use nahi hoga.
|
*/

export const HOUSEHOLD_STATUSES =
  Object.freeze([
    'active',
    'archived',
  ])

/*
|--------------------------------------------------------------------------
| Household Schema
|--------------------------------------------------------------------------
|
| Household consumer-side shared scope hai.
|
| Future entities such as:
|
| - PantryItem
| - PantryObservation
| - Shared List
| - Household Preferences
| - Meal Planning
| - Recommendation Context
|
| householdId reference use karenge.
|
| IMPORTANT:
|
| Members ko Household document ke andar array me embed nahi kar rahe.
| Membership ek separate collection hogi so role/status/history independently
| govern ki ja sake.
|
*/

const householdSchema =
  new mongoose.Schema(
    {
      /*
      |--------------------------------------------------------------------------
      | Household Identity
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

      /*
      |--------------------------------------------------------------------------
      | Usual People Count
      |--------------------------------------------------------------------------
      |
      | This is household planning context, not membership count.
      |
      | Example:
      |
      | Memberships = 2 registered EPANTRY users
      | usualPeopleCount = 4
      |
      | because children/guests/non-registered household members may still
      | influence recipe portions and planning.
      |
      */

      usualPeopleCount: {
        type:
          Number,

        required:
          true,

        default:
          1,

        min:
          1,

        max:
          50,
      },

      /*
      |--------------------------------------------------------------------------
      | Lifecycle
      |--------------------------------------------------------------------------
      */

      status: {
        type:
          String,

        enum:
          HOUSEHOLD_STATUSES,

        required:
          true,

        default:
          'active',

        index:
          true,
      },

      /*
      |--------------------------------------------------------------------------
      | Creation Provenance
      |--------------------------------------------------------------------------
      |
      | Membership determines current authority.
      |
      | createdByUserId exists only as stable provenance/audit information.
      |
      */

      createdByUserId: {
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
    },

    {
      timestamps:
        true,

      collection:
        'households',

      minimize:
        false,
    },
  )

/*
|--------------------------------------------------------------------------
| Creator + Lifecycle Index
|--------------------------------------------------------------------------
*/

householdSchema.index({
  createdByUserId:
    1,

  status:
    1,
})

/*
|--------------------------------------------------------------------------
| Household Model
|--------------------------------------------------------------------------
*/

export const Household =
  mongoose.models.Household ||
  mongoose.model(
    'Household',
    householdSchema,
  )