import {
  z,
} from 'zod'

import {
  env,
} from '../../config/env.js'

import {
  firebaseAdminAuth,
} from '../../config/firebaseAdmin.js'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  notifyPendingHouseholdInvitationsForUserBestEffort,
} from '../households/householdInvitation.delivery.service.js'

import {
  notifyActiveSuperAdminsBestEffort,
} from '../notifications/notification.service.js'

import {
  User,
} from '../users/user.model.js'

import {
  serializeCurrentUser,
} from '../users/user.service.js'

import {
  claimRegistrationProof,
  markRegistrationProofCompleted,
} from './registrationProof.service.js'

/*
|--------------------------------------------------------------------------
| Request Validation
|--------------------------------------------------------------------------
|
| Password is intentionally absent.
|
| The frontend sends:
|
| - Firebase ID token
| - Brevo verification challenge ID
| - one-time registration proof
|
*/

const completeRegistrationSchema =
  z.object({
    idToken:
      z.string()
        .trim()
        .min(
          100,
          'Firebase authentication is required.',
        )
        .max(
          20000,
          'Invalid Firebase authentication token.',
        ),

    challengeId:
      z.string()
        .trim()
        .regex(
          /^[a-f\d]{24}$/i,
          'Invalid registration challenge.',
        ),

    registrationProof:
      z.string()
        .trim()
        .min(
          32,
          'Invalid registration verification.',
        )
        .max(
          512,
          'Invalid registration verification.',
        ),
  })

/*
|--------------------------------------------------------------------------
| Parse Input
|--------------------------------------------------------------------------
*/

function parseInput(
  payload,
) {
  const parsed =
    completeRegistrationSchema.safeParse(
      payload,
    )

  if (
    !parsed.success
  ) {
    throw new ApiError(
      400,
      parsed.error
        .issues[0]
        ?.message ||
        'Invalid registration request.',
    )
  }

  return parsed.data
}

/*
|--------------------------------------------------------------------------
| Normalize Email
|--------------------------------------------------------------------------
*/

function normalizeEmail(
  email,
) {
  return String(
    email ||
      '',
  )
    .trim()
    .toLowerCase()
}

/*
|--------------------------------------------------------------------------
| Firebase Registration Identity
|--------------------------------------------------------------------------
*/

async function verifyFirebaseRegistrationIdentity(
  idToken,
) {
  let decodedToken

  try {
    decodedToken =
      await firebaseAdminAuth.verifyIdToken(
        idToken,
        true,
      )
  } catch {
    throw new ApiError(
      401,
      'Unable to verify Firebase registration.',
    )
  }

  const firebaseUid =
    decodedToken.uid

  const email =
    normalizeEmail(
      decodedToken.email,
    )

  if (!email) {
    throw new ApiError(
      400,
      'Firebase registration does not contain an email address.',
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Password Provider Only
  |--------------------------------------------------------------------------
  */

  if (
    decodedToken.firebase
      ?.sign_in_provider !==
    'password'
  ) {
    throw new ApiError(
      400,
      'This registration flow requires email and password authentication.',
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Recent Authentication
  |--------------------------------------------------------------------------
  */

  const authTime =
    Number(
      decodedToken.auth_time,
    )

  const now =
    Math.floor(
      Date.now() /
        1000,
    )

  if (
    !Number.isFinite(
      authTime,
    ) ||
    now - authTime >
      env
        .authRecentSignInSeconds
  ) {
    throw new ApiError(
      401,
      'Recent authentication is required. Please start registration again.',
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Firebase User Record
  |--------------------------------------------------------------------------
  */

  let firebaseUser

  try {
    firebaseUser =
      await firebaseAdminAuth.getUser(
        firebaseUid,
      )
  } catch {
    throw new ApiError(
      401,
      'Unable to verify Firebase registration.',
    )
  }

  if (
    firebaseUser.disabled
  ) {
    throw new ApiError(
      403,
      'This account is currently unavailable.',
    )
  }

  if (
    normalizeEmail(
      firebaseUser.email,
    ) !==
    email
  ) {
    throw new ApiError(
      400,
      'Firebase registration identity does not match.',
    )
  }

  return {
    firebaseUid,

    email,

    firebaseUser,
  }
}

/*
|--------------------------------------------------------------------------
| Provisioning Rules
|--------------------------------------------------------------------------
|
| Public registration now has only two journeys:
|
| customer
| host
|
| Host registration does NOT create another identity and does NOT grant Host
| authorization immediately. The same user receives Customer access while
| Host onboarding/approval remains pending.
|
*/

function getProvisioningRules(
  accountType,
) {
  switch (
    accountType
  ) {
    case 'customer':
      return {
        accountStatus:
          'active',

        customerEnabled:
          true,

        hostEnabled:
          false,

        hostAccessStatus:
          'not_requested',

        superAdminEnabled:
          false,

        activeMode:
          'customer',

        nextStep:
          'customer-home',
      }

    case 'host':
      return {
        accountStatus:
          'active',

        customerEnabled:
          true,

        hostEnabled:
          false,

        hostAccessStatus:
          'pending',

        superAdminEnabled:
          false,

        activeMode:
          'customer',

        nextStep:
          'application-status',
      }

    default:
      throw new ApiError(
        400,
        'This account type cannot be registered publicly.',
      )
  }
}

/*
|--------------------------------------------------------------------------
| Resolve Next Screen From Current Access State
|--------------------------------------------------------------------------
*/

function getNextStepForUser(
  user,
) {
  if (
    user?.hostAccessStatus ===
      'pending' &&
    user?.hostEnabled !==
      true
  ) {
    return 'application-status'
  }

  if (
    user?.hostEnabled ===
      true &&
    user?.activeMode ===
      'host'
  ) {
    return 'host-home'
  }

  if (
    user?.superAdminEnabled ===
    true
  ) {
    return 'admin-home'
  }

  return 'customer-home'
}

/*
|--------------------------------------------------------------------------
| Existing Application User
|--------------------------------------------------------------------------
*/

async function findExistingApplicationUser({
  firebaseUid,
  email,
}) {
  const existing =
    await User.findOne({
      $or: [
        {
          firebaseUid,
        },

        {
          email,
        },
      ],
    })

  if (!existing) {
    return null
  }

  if (
    existing.firebaseUid ===
      firebaseUid &&
    normalizeEmail(
      existing.email,
    ) ===
      email
  ) {
    return existing
  }

  throw new ApiError(
    409,
    'An EPANTRY account already exists for this identity.',
  )
}

/*
|--------------------------------------------------------------------------
| Create Application User
|--------------------------------------------------------------------------
*/

async function createApplicationUser({
  firebaseUid,
  registration,
}) {
  const provisioning =
    getProvisioningRules(
      registration
        .accountType,
    )

  try {
    return await User.create({
      firebaseUid,

      name:
        registration.name,

      email:
        registration.email,

      phone:
        registration.phone,

      emailVerified:
        true,

      /*
      |--------------------------------------------------------------------------
      | Phone Is NOT Verified Yet
      |--------------------------------------------------------------------------
      |
      | Existing TOTP MFA architecture remains separate.
      |
      */

      phoneVerified:
        false,

      accountStatus:
        provisioning
          .accountStatus,

      customerEnabled:
        provisioning
          .customerEnabled,

      hostEnabled:
        provisioning
          .hostEnabled,

      hostAccessStatus:
        provisioning
          .hostAccessStatus,

      superAdminEnabled:
        provisioning
          .superAdminEnabled,

      activeMode:
        provisioning
          .activeMode,
    })
  } catch (error) {
    if (
      error?.code ===
      11000
    ) {
      const existing =
        await findExistingApplicationUser({
          firebaseUid,

          email:
            registration
              .email,
        })

      if (existing) {
        return existing
      }
    }

    throw error
  }
}

/*
|--------------------------------------------------------------------------
| Complete Registration
|--------------------------------------------------------------------------
*/

export async function completeRegistration(
  payload,
) {
  const input =
    parseInput(
      payload,
    )

  /*
  |--------------------------------------------------------------------------
  | 1. Verify Firebase Identity
  |--------------------------------------------------------------------------
  */

  const firebaseIdentity =
    await verifyFirebaseRegistrationIdentity(
      input.idToken,
    )

  /*
  |--------------------------------------------------------------------------
  | 2. Claim Brevo Registration Proof
  |--------------------------------------------------------------------------
  */

  const registration =
    await claimRegistrationProof({
      challengeId:
        input.challengeId,

      email:
        firebaseIdentity
          .email,

      registrationProof:
        input
          .registrationProof,

      firebaseUid:
        firebaseIdentity
          .firebaseUid,
    })

  /*
  |--------------------------------------------------------------------------
  | 3. Resolve / Create MongoDB Application Profile
  |--------------------------------------------------------------------------
  */

  let applicationUser =
    await findExistingApplicationUser({
      firebaseUid:
        firebaseIdentity
          .firebaseUid,

      email:
        firebaseIdentity
          .email,
    })

  const isNewApplicationUser =
    !applicationUser

  if (
    !applicationUser
  ) {
    applicationUser =
      await createApplicationUser({
        firebaseUid:
          firebaseIdentity
            .firebaseUid,

        registration,
      })
  }

  /*
  |--------------------------------------------------------------------------
  | 4. Synchronize Firebase Verified Email
  |--------------------------------------------------------------------------
  */

  try {
    if (
      !firebaseIdentity
        .firebaseUser
        .emailVerified ||
      firebaseIdentity
        .firebaseUser
        .displayName !==
        registration.name
    ) {
      await firebaseAdminAuth.updateUser(
        firebaseIdentity
          .firebaseUid,

        {
          emailVerified:
            true,

          displayName:
            registration.name,
        },
      )
    }
  } catch {
    throw new ApiError(
      503,
      'Unable to finalize Firebase registration right now. Please try again.',
    )
  }

  /*
  |--------------------------------------------------------------------------
  | 5. Mark Registration Fully Complete
  |--------------------------------------------------------------------------
  */

  await markRegistrationProofCompleted({
    challengeId:
      registration
        .challengeId,

    firebaseUid:
      firebaseIdentity
        .firebaseUid,

    userId:
      applicationUser._id,
  })

  if (
    applicationUser?.customerEnabled ===
      true
  ) {
    await notifyPendingHouseholdInvitationsForUserBestEffort({
      userId:
        applicationUser._id,
      email:
        applicationUser.email,
    })
  }

  if (
    isNewApplicationUser &&
    registration.accountType ===
      'host'
  ) {
    await notifyActiveSuperAdminsBestEffort({
      triggerType:
        'host_registration',
      reasonCode:
        'new_host_registration',
      explanation: `${registration.name} registered for Host access and is awaiting Host review.`,
      relatedEntityType:
        'host_user',
      relatedEntityId:
        String(
          applicationUser._id,
        ),
      sourceDomain:
        'auth',
      sourceVersion:
        'host-registration-v1',
      dedupeScope: `host-registration:${String(applicationUser._id)}`,
      correlationId:
        registration.challengeId,
    })
  }

  /*
  |--------------------------------------------------------------------------
  | 6. Determine Next Screen
  |--------------------------------------------------------------------------
  */

  const nextStep =
    getNextStepForUser(
      applicationUser,
    )

  return {
    registered:
      true,

    user:
      serializeCurrentUser(
        applicationUser,
      ),

    nextStep,

    /*
    |--------------------------------------------------------------------------
    | Client Must Refresh Firebase Token
    |--------------------------------------------------------------------------
    */

    firebaseTokenRefreshRequired:
      true,
  }
}