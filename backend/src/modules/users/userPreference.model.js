import mongoose from 'mongoose'

/*
|--------------------------------------------------------------------------
| Dietary Lifestyle Values
|--------------------------------------------------------------------------
|
| These values are USER-SELECTED preferences.
|
| EPANTRY must not infer them from behavior.
|
*/

export const DIETARY_LIFESTYLES =
  Object.freeze([
    'vegetarian',
    'vegan',
    'pescatarian',
    'halal',
    'kosher',
    'gluten_free',
    'dairy_free',
  ])

/*
|--------------------------------------------------------------------------
| Common Food Allergens
|--------------------------------------------------------------------------
|
| Initial foundation uses the major common food allergens.
|
| Free-form dislikes remain separately supported.
|
*/

export const FOOD_ALLERGENS =
  Object.freeze([
    'milk',
    'egg',
    'fish',
    'shellfish',
    'tree_nuts',
    'peanuts',
    'wheat',
    'soy',
    'sesame',
  ])

/*
|--------------------------------------------------------------------------
| Measurement Systems
|--------------------------------------------------------------------------
*/

export const MEASUREMENT_SYSTEMS =
  Object.freeze([
    'metric',
    'imperial',
  ])

/*
|--------------------------------------------------------------------------
| Preference Schema
|--------------------------------------------------------------------------
|
| One preferences document per EPANTRY user.
|
| Household-shared settings belong to Household, not here.
|
*/

const userPreferenceSchema =
  new mongoose.Schema(
    {
      /*
      |--------------------------------------------------------------------------
      | User
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

        unique:
          true,

        index:
          true,
      },

      /*
      |--------------------------------------------------------------------------
      | Dietary Preferences
      |--------------------------------------------------------------------------
      */

      dietaryLifestyles: {
        type: [
          {
            type:
              String,

            enum:
              DIETARY_LIFESTYLES,
          },
        ],

        default: [],
      },

      /*
      |--------------------------------------------------------------------------
      | Allergens
      |--------------------------------------------------------------------------
      |
      | This is an explicit user preference/safety setting.
      |
      | Recommendation features later should use this as an exclusion signal,
      | but should never claim medical safety solely from this field.
      |
      */

      allergens: {
        type: [
          {
            type:
              String,

            enum:
              FOOD_ALLERGENS,
          },
        ],

        default: [],
      },

      /*
      |--------------------------------------------------------------------------
      | Preferred Cuisines
      |--------------------------------------------------------------------------
      |
      | Free-form normalized labels keep the foundation extensible without
      | hard-coding a global cuisine taxonomy during M02.
      |
      */

      preferredCuisines: {
        type: [
          {
            type:
              String,

            trim:
              true,

            minlength:
              2,

            maxlength:
              60,
          },
        ],

        default: [],
      },

      /*
      |--------------------------------------------------------------------------
      | Disliked Ingredients
      |--------------------------------------------------------------------------
      */

      dislikedIngredients: {
        type: [
          {
            type:
              String,

            trim:
              true,

            minlength:
              1,

            maxlength:
              80,
          },
        ],

        default: [],
      },

      /*
      |--------------------------------------------------------------------------
      | Measurements
      |--------------------------------------------------------------------------
      */

      measurementSystem: {
        type:
          String,

        enum:
          MEASUREMENT_SYSTEMS,

        required:
          true,

        default:
          'metric',
      },

      /*
      |--------------------------------------------------------------------------
      | Locale
      |--------------------------------------------------------------------------
      |
      | BCP-47 style value such as:
      |
      | en-IN
      | en-GB
      | hi-IN
      |
      */

      locale: {
        type:
          String,

        trim:
          true,

        maxlength:
          35,

        default:
          'en-IN',
      },

      /*
      |--------------------------------------------------------------------------
      | Personalization Preference
      |--------------------------------------------------------------------------
      |
      | This only controls whether preference data may be actively used by
      | recommendation features.
      |
      | Legal/consent history remains authoritative in UserConsent.
      |
      */

      personalizationEnabled: {
        type:
          Boolean,

        required:
          true,

        default:
          false,
      },
    },

    {
      timestamps:
        true,

      collection:
        'user_preferences',

      minimize:
        false,
    },
  )

/*
|--------------------------------------------------------------------------
| Normalize String Arrays
|--------------------------------------------------------------------------
*/

function normalizeStringArray(
  values,
) {
  if (
    !Array.isArray(
      values,
    )
  ) {
    return []
  }

  return [
    ...new Set(
      values
        .map(
          (value) =>
            String(
              value ||
                '',
            )
              .trim()
              .replace(
                /\s+/g,
                ' ',
              ),
        )
        .filter(Boolean),
    ),
  ]
}

/*
|--------------------------------------------------------------------------
| Normalize Preferences Before Save
|--------------------------------------------------------------------------
*/

userPreferenceSchema.pre(
  'save',

  function normalizePreferences(
    next,
  ) {
    this.dietaryLifestyles =
      normalizeStringArray(
        this.dietaryLifestyles,
      )

    this.allergens =
      normalizeStringArray(
        this.allergens,
      )

    this.preferredCuisines =
      normalizeStringArray(
        this.preferredCuisines,
      )

    this.dislikedIngredients =
      normalizeStringArray(
        this.dislikedIngredients,
      )

    this.locale =
      String(
        this.locale ||
          'en-IN',
      ).trim()

    next()
  },
)

/*
|--------------------------------------------------------------------------
| Model
|--------------------------------------------------------------------------
*/

export const UserPreference =
  mongoose.models.UserPreference ||
  mongoose.model(
    'UserPreference',
    userPreferenceSchema,
  )