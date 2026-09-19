import {
  createHmac,
  timingSafeEqual,
} from 'node:crypto'

import mongoose from 'mongoose'

import {
  env,
} from '../../config/env.js'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  VerificationChallenge,
} from './verificationChallenge.model.js'

/*
|--------------------------------------------------------------------------
| Configuration
|--------------------------------------------------------------------------
*/

function assertProofConfiguration() {
  if (
    !env
      .authEmailOtpHmacSecret ||
    env
      .authEmailOtpHmacSecret
      .length < 32
  ) {
    throw new ApiError(
      500,
      'Registration security configuration is invalid.',
    )
  }
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
| Registration Proof Hash
|--------------------------------------------------------------------------
|
| This must match the HMAC format used when Step 2C creates the proof.
|
*/

function createRegistrationProofHash({
  challengeId,
  email,
  registrationProof,
}) {
  return createHmac(
    'sha256',
    env
      .authEmailOtpHmacSecret,
  )
    .update(
      [
        'registration_proof',

        String(
          challengeId,
        ),

        normalizeEmail(
          email,
        ),

        registrationProof,
      ].join(
        ':',
      ),
    )
    .digest(
      'hex',
    )
}

/*
|--------------------------------------------------------------------------
| Constant-Time Comparison
|--------------------------------------------------------------------------
*/

function safeHashEquals(
  firstHash,
  secondHash,
) {
  if (
    !firstHash ||
    !secondHash
  ) {
    return false
  }

  const firstBuffer =
    Buffer.from(
      firstHash,
      'hex',
    )

  const secondBuffer =
    Buffer.from(
      secondHash,
      'hex',
    )

  if (
    firstBuffer.length !==
    secondBuffer.length
  ) {
    return false
  }

  return timingSafeEqual(
    firstBuffer,
    secondBuffer,
  )
}

/*
|--------------------------------------------------------------------------
| Input Validation
|--------------------------------------------------------------------------
*/

function validateProofInput({
  challengeId,
  email,
  registrationProof,
  firebaseUid,
}) {
  if (
    !mongoose.isValidObjectId(
      challengeId,
    ) ||
    !normalizeEmail(
      email,
    ) ||
    typeof registrationProof !==
      'string' ||
    registrationProof.length <
      32 ||
    typeof firebaseUid !==
      'string' ||
    !firebaseUid.trim()
  ) {
    throw new ApiError(
      400,
      'Registration verification is invalid.',
    )
  }
}

/*
|--------------------------------------------------------------------------
| Safe Registration Context
|--------------------------------------------------------------------------
*/

function getRegistrationContext(
  challenge,
) {
  return {
    challengeId:
      String(
        challenge._id,
      ),

    name:
      challenge.name,

    email:
      challenge.email,

    phone:
      challenge.phone,

    accountType:
      challenge.accountType,
  }
}

/*
|--------------------------------------------------------------------------
| Claim Registration Proof
|--------------------------------------------------------------------------
|
| Initial claim:
|
| Valid Brevo proof
|       ↓
| Bind proof → Firebase UID
|
| Retry:
|
| If completion failed halfway through, only the SAME Firebase UID with the
| SAME proof can resume.
|
*/

export async function claimRegistrationProof({
  challengeId,
  email,
  registrationProof,
  firebaseUid,
}) {
  assertProofConfiguration()

  validateProofInput({
    challengeId,
    email,
    registrationProof,
    firebaseUid,
  })

  const normalizedEmail =
    normalizeEmail(
      email,
    )

  const now =
    new Date()

  const challenge =
    await VerificationChallenge.findOne({
      _id:
        challengeId,

      purpose:
        'registration_email',

      email:
        normalizedEmail,

      consumedAt: {
        $ne:
          null,
      },

      invalidatedAt:
        null,
    }).select(
      '+registrationProofHash',
    )

  if (
    !challenge ||
    !challenge
      .registrationProofHash
  ) {
    throw new ApiError(
      400,
      'Registration verification is invalid or has expired.',
    )
  }

  const submittedHash =
    createRegistrationProofHash({
      challengeId:
        challenge._id,

      email:
        normalizedEmail,

      registrationProof,
    })

  if (
    !safeHashEquals(
      challenge
        .registrationProofHash,

      submittedHash,
    )
  ) {
    throw new ApiError(
      400,
      'Registration verification is invalid or has expired.',
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Already Fully Completed
  |--------------------------------------------------------------------------
  */

  if (
    challenge
      .registrationCompletedAt
  ) {
    if (
      challenge
        .registrationCompletedFirebaseUid !==
      firebaseUid
    ) {
      throw new ApiError(
        409,
        'Registration has already been completed.',
      )
    }

    return {
      state:
        'completed',

      ...getRegistrationContext(
        challenge,
      ),

      completedUserId:
        challenge
          .registrationCompletedUserId ||
        null,
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Existing Claim - Resume
  |--------------------------------------------------------------------------
  */

  if (
    challenge
      .registrationProofConsumedAt
  ) {
    if (
      challenge
        .registrationClaimedFirebaseUid !==
      firebaseUid
    ) {
      throw new ApiError(
        409,
        'Registration verification is already in use.',
      )
    }

    return {
      state:
        'claimed',

      ...getRegistrationContext(
        challenge,
      ),
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Proof Expiry
  |--------------------------------------------------------------------------
  |
  | Expiry is required for the INITIAL claim.
  |
  | Once safely claimed by a Firebase UID, retries by that SAME UID can
  | resume even if a temporary operation later fails.
  |
  */

  if (
    !challenge
      .registrationProofExpiresAt ||
    challenge
      .registrationProofExpiresAt <=
      now
  ) {
    throw new ApiError(
      400,
      'Registration verification has expired. Please verify your email again.',
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Atomic Initial Claim
  |--------------------------------------------------------------------------
  */

  const claimed =
    await VerificationChallenge.findOneAndUpdate(
      {
        _id:
          challenge._id,

        registrationProofConsumedAt:
          null,

        registrationCompletedAt:
          null,
      },

      {
        $set: {
          registrationProofConsumedAt:
            now,

          registrationClaimedFirebaseUid:
            firebaseUid,
        },
      },

      {
        new:
          true,
      },
    )

  /*
  |--------------------------------------------------------------------------
  | Concurrent Request
  |--------------------------------------------------------------------------
  */

  if (!claimed) {
    const current =
      await VerificationChallenge.findById(
        challenge._id,
      )

    if (
      current
        ?.registrationClaimedFirebaseUid ===
        firebaseUid &&
      !current
        .registrationCompletedAt
    ) {
      return {
        state:
          'claimed',

        ...getRegistrationContext(
          current,
        ),
      }
    }

    throw new ApiError(
      409,
      'Registration verification is already in use.',
    )
  }

  return {
    state:
      'claimed',

    ...getRegistrationContext(
      claimed,
    ),
  }
}

/*
|--------------------------------------------------------------------------
| Mark Registration Completed
|--------------------------------------------------------------------------
*/

export async function markRegistrationProofCompleted({
  challengeId,
  firebaseUid,
  userId,
}) {
  const now =
    new Date()

  const completed =
    await VerificationChallenge.findOneAndUpdate(
      {
        _id:
          challengeId,

        registrationClaimedFirebaseUid:
          firebaseUid,

        registrationProofConsumedAt: {
          $ne:
            null,
        },

        registrationCompletedAt:
          null,
      },

      {
        $set: {
          registrationCompletedAt:
            now,

          registrationCompletedFirebaseUid:
            firebaseUid,

          registrationCompletedUserId:
            userId,
        },
      },

      {
        new:
          true,
      },
    )

  if (completed) {
    return completed
  }

  /*
  |--------------------------------------------------------------------------
  | Idempotent Completion
  |--------------------------------------------------------------------------
  */

  const existing =
    await VerificationChallenge.findById(
      challengeId,
    )

  if (
    existing
      ?.registrationCompletedFirebaseUid ===
      firebaseUid &&
    String(
      existing
        .registrationCompletedUserId ||
        '',
    ) ===
      String(
        userId,
      )
  ) {
    return existing
  }

  throw new ApiError(
    409,
    'Unable to finalize registration verification.',
  )
}