import {
  z,
} from 'zod'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  createProfilePhotoUploadIntent,
} from '../../integrations/media/cloudinary.provider.js'

import {
  serializeCurrentUser,
} from './user.service.js'

import {
  User,
} from './user.model.js'

import {
  DIETARY_LIFESTYLES,
  FOOD_ALLERGENS,
  MEASUREMENT_SYSTEMS,
  UserPreference,
} from './userPreference.model.js'

import {
  USER_CONSENT_DECISIONS,
  USER_CONSENT_TYPES,
  UserConsent,
} from './userConsent.model.js'

/*
|--------------------------------------------------------------------------
| Current Consent Versions
|--------------------------------------------------------------------------
|
| When legal/campaign policy changes materially, increment the relevant
| version here.
|
| Example:
|
| privacy-v1 -> privacy-v2
|
| Existing old acceptance remains in audit history but no longer satisfies
| the new current-version requirement.
|
*/

export const CURRENT_CONSENT_VERSIONS =
  Object.freeze({
    terms_of_service:
      'terms-v1',

    privacy_policy:
      'privacy-v1',

    marketing_email:
      'marketing-v1',

    personalization:
      'personalization-v1',
  })

const REQUIRED_CONSENT_TYPES =
  new Set([
    'terms_of_service',
    'privacy_policy',
  ])

/*
|--------------------------------------------------------------------------
| Profile Validation
|--------------------------------------------------------------------------
*/

const updateProfileSchema =
  z.object({
    name:
      z.string()
        .trim()
        .min(
          2,
          'Name must contain at least 2 characters.',
        )
        .max(
          120,
          'Name cannot exceed 120 characters.',
        )
        .transform(
          (value) =>
            value.replace(
              /\s+/g,
              ' ',
            ),
        )
        .optional(),

    phone:
      z.union([
        z.string()
          .trim()
          .max(
            30,
            'Phone number is too long.',
          ),

        z.null(),
      ])
        .optional(),

    profilePhotoUrl:
      z.union([
        z.string()
          .trim()
          .url(
            'Profile photo must use a valid URL.',
          )
          .max(
            2048,
            'Profile photo URL is too long.',
          ),

        z.null(),
      ])
        .optional(),
  })
    .strict()
    .refine(
      (value) =>
        Object.keys(
          value,
        ).length >
        0,

      {
        message:
          'At least one profile field is required.',
      },
    )

/*
|--------------------------------------------------------------------------
| Preference Validation
|--------------------------------------------------------------------------
*/

const dietaryLifestyleSchema =
  z.enum(
    DIETARY_LIFESTYLES,
  )

const allergenSchema =
  z.enum(
    FOOD_ALLERGENS,
  )

const measurementSystemSchema =
  z.enum(
    MEASUREMENT_SYSTEMS,
  )

const localeSchema =
  z.string()
    .trim()
    .min(
      2,
      'Locale is required.',
    )
    .max(
      35,
      'Locale is too long.',
    )
    .regex(
      /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/,
      'Enter a valid locale such as en-IN.',
    )

const updatePreferencesSchema =
  z.object({
    dietaryLifestyles:
      z.array(
        dietaryLifestyleSchema,
      )
        .max(
          10,
          'Too many dietary preferences were selected.',
        )
        .optional(),

    allergens:
      z.array(
        allergenSchema,
      )
        .max(
          20,
          'Too many allergens were selected.',
        )
        .optional(),

    preferredCuisines:
      z.array(
        z.string()
          .trim()
          .min(
            2,
            'Cuisine names must contain at least 2 characters.',
          )
          .max(
            60,
            'Cuisine names cannot exceed 60 characters.',
          ),
      )
        .max(
          25,
          'Too many cuisines were supplied.',
        )
        .optional(),

    dislikedIngredients:
      z.array(
        z.string()
          .trim()
          .min(
            1,
            'Ingredient names cannot be empty.',
          )
          .max(
            80,
            'Ingredient names cannot exceed 80 characters.',
          ),
      )
        .max(
          50,
          'Too many disliked ingredients were supplied.',
        )
        .optional(),

    measurementSystem:
      measurementSystemSchema
        .optional(),

    locale:
      localeSchema
        .optional(),
  })
    .strict()
    .refine(
      (value) =>
        Object.keys(
          value,
        ).length >
        0,

      {
        message:
          'At least one preference field is required.',
      },
    )

/*
|--------------------------------------------------------------------------
| Consent Validation
|--------------------------------------------------------------------------
*/

const consentDecisionSchema =
  z.object({
    consentType:
      z.enum(
        USER_CONSENT_TYPES,
      ),

    decision:
      z.enum(
        USER_CONSENT_DECISIONS,
      ),
  })
    .strict()

/*
|--------------------------------------------------------------------------
| Validation Error Helper
|--------------------------------------------------------------------------
*/

function throwValidationError(
  result,
  fallbackMessage,
) {
  throw new ApiError(
    400,
    result.error
      .issues[0]
      ?.message ||
      fallbackMessage,
  )
}

/*
|--------------------------------------------------------------------------
| Phone Normalization
|--------------------------------------------------------------------------
|
| Allows common human formatting on input:
|
| +91 98765 43210
| (020) 1234 5678
|
| Storage becomes:
|
| +919876543210
| 02012345678
|
*/

function normalizePhone(
  value,
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return null
  }

  const trimmed =
    String(
      value,
    ).trim()

  if (!trimmed) {
    return null
  }

  const hasInternationalPrefix =
    trimmed.startsWith(
      '+',
    )

  const digits =
    trimmed.replace(
      /\D/g,
      '',
    )

  if (
    digits.length <
      8 ||
    digits.length >
      15
  ) {
    throw new ApiError(
      400,
      'Enter a valid phone number containing 8 to 15 digits.',
    )
  }

  return hasInternationalPrefix
    ? `+${digits}`
    : digits
}

/*
|--------------------------------------------------------------------------
| Normalize Free-form Arrays
|--------------------------------------------------------------------------
*/

function normalizeFreeformArray(
  values,
) {
  if (
    !Array.isArray(
      values,
    )
  ) {
    return []
  }

  const seen =
    new Set()

  const normalized =
    []

  for (
    const rawValue
    of values
  ) {
    const value =
      String(
        rawValue ||
          '',
      )
        .trim()
        .replace(
          /\s+/g,
          ' ',
        )

    if (!value) {
      continue
    }

    const lookupKey =
      value.toLowerCase()

    if (
      seen.has(
        lookupKey,
      )
    ) {
      continue
    }

    seen.add(
      lookupKey,
    )

    normalized.push(
      value,
    )
  }

  return normalized
}

/*
|--------------------------------------------------------------------------
| Preference Serializer
|--------------------------------------------------------------------------
*/

function serializePreferences(
  preferences,
) {
  if (!preferences) {
    return {
      dietaryLifestyles:
        [],

      allergens:
        [],

      preferredCuisines:
        [],

      dislikedIngredients:
        [],

      measurementSystem:
        'metric',

      locale:
        'en-IN',

      personalizationEnabled:
        false,

      createdAt:
        null,

      updatedAt:
        null,
    }
  }

  return {
    dietaryLifestyles:
      Array.isArray(
        preferences
          .dietaryLifestyles,
      )
        ? preferences
            .dietaryLifestyles
        : [],

    allergens:
      Array.isArray(
        preferences
          .allergens,
      )
        ? preferences
            .allergens
        : [],

    preferredCuisines:
      Array.isArray(
        preferences
          .preferredCuisines,
      )
        ? preferences
            .preferredCuisines
        : [],

    dislikedIngredients:
      Array.isArray(
        preferences
          .dislikedIngredients,
      )
        ? preferences
            .dislikedIngredients
        : [],

    measurementSystem:
      preferences
        .measurementSystem ||
      'metric',

    locale:
      preferences.locale ||
      'en-IN',

    personalizationEnabled:
      preferences
        .personalizationEnabled ===
      true,

    createdAt:
      preferences.createdAt ||
      null,

    updatedAt:
      preferences.updatedAt ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Current Profile
|--------------------------------------------------------------------------
*/

export function getAccountProfile(
  currentUser,
) {
  return serializeCurrentUser(
    currentUser,
  )
}

export function createAccountProfilePhotoUploadIntent(
  currentUser,
) {
  const userId =
    currentUser?._id ||
    currentUser?.id

  if (!userId) {
    throw new ApiError(
      401,
      'Authenticated user identity is required.',
    )
  }

  try {
    return createProfilePhotoUploadIntent({
      userId:
        String(
          userId,
        ),
    })
  } catch (error) {
    throw new ApiError(
      503,
      'Profile photo upload is temporarily unavailable.',
      [
        {
          code:
            error?.code ||
            'PROFILE_PHOTO_PROVIDER_UNAVAILABLE',
        },
      ],
    )
  }
}

/*
|--------------------------------------------------------------------------
| Update Profile
|--------------------------------------------------------------------------
|
| Email deliberately cannot be changed here.
|
| Firebase email changes require their own verified / recent-auth workflow.
|
*/

export async function updateAccountProfile({
  userId,
  payload,
}) {
  const parsed =
    updateProfileSchema.safeParse(
      payload || {},
    )

  if (
    !parsed.success
  ) {
    throwValidationError(
      parsed,
      'Invalid profile details.',
    )
  }

  const input =
    parsed.data

  const user =
    await User.findById(
      userId,
    )

  if (!user) {
    throw new ApiError(
      404,
      'EPANTRY user profile was not found.',
    )
  }

  if (
    Object.prototype.hasOwnProperty.call(
      input,
      'name',
    )
  ) {
    user.name =
      input.name
  }

  if (
    Object.prototype.hasOwnProperty.call(
      input,
      'phone',
    )
  ) {
    const nextPhone =
      normalizePhone(
        input.phone,
      )

    const currentPhone =
      user.phone ||
      null

    if (
      currentPhone !==
      nextPhone
    ) {
      user.phone =
        nextPhone

      /*
      |--------------------------------------------------------------------------
      | Verification Invalidated By Phone Change
      |--------------------------------------------------------------------------
      */

      user.phoneVerified =
        false
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(
      input,
      'profilePhotoUrl',
    )
  ) {
    user.profilePhotoUrl =
      input.profilePhotoUrl ||
      null
  }

  await user.save()

  return serializeCurrentUser(
    user,
  )
}

/*
|--------------------------------------------------------------------------
| Get Preferences
|--------------------------------------------------------------------------
|
| GET does not create a database document.
|
| Missing preference state simply resolves to safe application defaults.
|
*/

export async function getAccountPreferences(
  userId,
) {
  const preferences =
    await UserPreference.findOne({
      userId,
    }).lean()

  return serializePreferences(
    preferences,
  )
}

/*
|--------------------------------------------------------------------------
| Update Preferences
|--------------------------------------------------------------------------
|
| personalizationEnabled is NOT accepted here.
|
| That value changes only through audited personalization consent.
|
*/

export async function updateAccountPreferences({
  userId,
  payload,
}) {
  const parsed =
    updatePreferencesSchema.safeParse(
      payload || {},
    )

  if (
    !parsed.success
  ) {
    throwValidationError(
      parsed,
      'Invalid preference details.',
    )
  }

  const input = {
    ...parsed.data,
  }

  /*
  |--------------------------------------------------------------------------
  | Normalize Enum Lists
  |--------------------------------------------------------------------------
  */

  if (
    Array.isArray(
      input
        .dietaryLifestyles,
    )
  ) {
    input.dietaryLifestyles = [
      ...new Set(
        input
          .dietaryLifestyles,
      ),
    ]
  }

  if (
    Array.isArray(
      input.allergens,
    )
  ) {
    input.allergens = [
      ...new Set(
        input.allergens,
      ),
    ]
  }

  /*
  |--------------------------------------------------------------------------
  | Normalize Free-form Lists
  |--------------------------------------------------------------------------
  */

  if (
    Array.isArray(
      input
        .preferredCuisines,
    )
  ) {
    input.preferredCuisines =
      normalizeFreeformArray(
        input
          .preferredCuisines,
      )
  }

  if (
    Array.isArray(
      input
        .dislikedIngredients,
    )
  ) {
    input.dislikedIngredients =
      normalizeFreeformArray(
        input
          .dislikedIngredients,
      )
  }

  const preferences =
    await UserPreference.findOneAndUpdate(
      {
        userId,
      },

      {
        $set:
          input,
      },

      {
        new:
          true,

        upsert:
          true,

        setDefaultsOnInsert:
          true,

        runValidators:
          true,
      },
    ).lean()

  return serializePreferences(
    preferences,
  )
}

/*
|--------------------------------------------------------------------------
| Build Current Consent State
|--------------------------------------------------------------------------
*/

async function buildCurrentConsentState(
  userId,
) {
  const events =
    await UserConsent.find({
      userId,
    })
      .sort({
        recordedAt:
          -1,

        createdAt:
          -1,
      })
      .lean()

  /*
  |--------------------------------------------------------------------------
  | Latest Decision Per Type
  |--------------------------------------------------------------------------
  */

  const latestByType =
    new Map()

  for (
    const event
    of events
  ) {
    if (
      latestByType.has(
        event.consentType,
      )
    ) {
      continue
    }

    latestByType.set(
      event.consentType,
      event,
    )
  }

  const items =
    USER_CONSENT_TYPES.map(
      (
        consentType,
      ) => {
        const latest =
          latestByType.get(
            consentType,
          ) ||
          null

        const currentVersion =
          CURRENT_CONSENT_VERSIONS[
            consentType
          ]

        const isCurrentVersion =
          latest?.version ===
          currentVersion

        const granted =
          latest?.decision ===
            'granted' &&
          isCurrentVersion

        const required =
          REQUIRED_CONSENT_TYPES.has(
            consentType,
          )

        return {
          consentType,

          required,

          currentVersion,

          granted,

          decision:
            latest?.decision ||
            null,

          recordedVersion:
            latest?.version ||
            null,

          isCurrentVersion,

          source:
            latest?.source ||
            null,

          recordedAt:
            latest?.recordedAt ||
            null,

          requiresAction:
            required &&
            !granted,
        }
      },
    )

  const requiredConsentsSatisfied =
    items
      .filter(
        (item) =>
          item.required,
      )
      .every(
        (item) =>
          item.granted,
      )

  return {
    requiredConsentsSatisfied,

    items,
  }
}

/*
|--------------------------------------------------------------------------
| Get Consent State
|--------------------------------------------------------------------------
*/

export async function getAccountConsents(
  userId,
) {
  return buildCurrentConsentState(
    userId,
  )
}

/*
|--------------------------------------------------------------------------
| Record Consent
|--------------------------------------------------------------------------
|
| Legal consent events are append-only.
|
| terms/privacy revocation is deliberately NOT exposed through the ordinary
| settings endpoint because withdrawal may require an account closure or
| dedicated legal workflow.
|
| Optional marketing and personalization consent can be granted/revoked.
|
*/

export async function recordAccountConsent({
  userId,
  payload,
  requestId,
}) {
  const parsed =
    consentDecisionSchema.safeParse(
      payload || {},
    )

  if (
    !parsed.success
  ) {
    throwValidationError(
      parsed,
      'Invalid consent decision.',
    )
  }

  const {
    consentType,
    decision,
  } =
    parsed.data

  /*
  |--------------------------------------------------------------------------
  | Mandatory Legal Consent
  |--------------------------------------------------------------------------
  */

  if (
    REQUIRED_CONSENT_TYPES.has(
      consentType,
    ) &&
    decision ===
      'revoked'
  ) {
    throw new ApiError(
      400,
      'Required legal consent cannot be withdrawn from ordinary account settings.',
      [
        {
          code:
            'CONSENT_REVOCATION_REQUIRES_ACCOUNT_WORKFLOW',
        },
      ],
    )
  }

  const version =
    CURRENT_CONSENT_VERSIONS[
      consentType
    ]

  /*
  |--------------------------------------------------------------------------
  | Idempotency
  |--------------------------------------------------------------------------
  |
  | Clicking the same toggle repeatedly should not create duplicate audit
  | events.
  |
  */

  const latest =
    await UserConsent.findOne({
      userId,

      consentType,
    })
      .sort({
        recordedAt:
          -1,

        createdAt:
          -1,
      })
      .lean()

  const isSameCurrentDecision =
    latest?.version ===
      version &&
    latest?.decision ===
      decision

  if (
    !isSameCurrentDecision
  ) {
    await UserConsent.create({
      userId,

      consentType,

      decision,

      version,

      source:
        'account_settings',

      recordedAt:
        new Date(),

      requestId:
        requestId ||
        null,
    })
  }

  /*
  |--------------------------------------------------------------------------
  | Personalization Runtime Flag
  |--------------------------------------------------------------------------
  |
  | Consent history remains authoritative.
  |
  | UserPreference.personalizationEnabled is merely a convenient runtime flag.
  |
  */

  if (
    consentType ===
    'personalization'
  ) {
    await UserPreference.findOneAndUpdate(
      {
        userId,
      },

      {
        $set: {
          personalizationEnabled:
            decision ===
            'granted',
        },
      },

      {
        new:
          true,

        upsert:
          true,

        setDefaultsOnInsert:
          true,

        runValidators:
          true,
      },
    )
  }

  return buildCurrentConsentState(
    userId,
  )
}