import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto'

import mongoose from 'mongoose'

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
  User,
} from '../users/user.model.js'

import {
  PUBLIC_REGISTRATION_ACCOUNT_TYPES,
  VerificationChallenge,
} from './verificationChallenge.model.js'

const HOUR_MS =
  60 *
  60 *
  1000

const DAY_MS =
  24 *
  HOUR_MS

/*
|--------------------------------------------------------------------------
| Validation
|--------------------------------------------------------------------------
*/

const requestOtpSchema =
  z.object({
    name:
      z.string()
        .trim()
        .min(
          2,
          'Full name must contain at least 2 characters.',
        )
        .max(
          120,
          'Full name is too long.',
        ),

    email:
      z.string()
        .trim()
        .toLowerCase()
        .email(
          'Enter a valid email address.',
        )
        .max(
          254,
          'Email address is too long.',
        ),

    phone:
      z.string()
        .trim()
        .regex(
          /^\+[1-9]\d{7,14}$/,
          'Mobile number must use international format, for example +919876543210.',
        ),

    accountType:
      z.enum(
        PUBLIC_REGISTRATION_ACCOUNT_TYPES,
      ),
  })

const verifyOtpSchema =
  z.object({
    challengeId:
      z.string()
        .trim()
        .regex(
          /^[a-f\d]{24}$/i,
          'Invalid verification challenge.',
        ),

    email:
      z.string()
        .trim()
        .toLowerCase()
        .email(
          'Enter a valid email address.',
        ),

    otp:
      z.string()
        .trim()
        .regex(
          new RegExp(
            `^\\d{${env.authEmailOtpLength}}$`,
          ),
          'Enter a valid verification code.',
        ),
  })

/*
|--------------------------------------------------------------------------
| Configuration
|--------------------------------------------------------------------------
*/

function assertOtpConfiguration() {
  if (
    !env.brevoApiKey ||
    !env.brevoSenderEmail
  ) {
    throw new ApiError(
      500,
      'Email verification is not configured.',
    )
  }

  if (
    !env.authEmailOtpHmacSecret ||
    env.authEmailOtpHmacSecret.length <
      32
  ) {
    throw new ApiError(
      500,
      'Email verification security configuration is invalid.',
    )
  }

  if (
    env.authEmailOtpLength <
      6 ||
    env.authEmailOtpLength >
      8
  ) {
    throw new ApiError(
      500,
      'Email verification security configuration is invalid.',
    )
  }
}

/*
|--------------------------------------------------------------------------
| Parse
|--------------------------------------------------------------------------
*/

function parseInput(
  schema,
  payload,
) {
  const parsed =
    schema.safeParse(
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
        'Invalid request.',
    )
  }

  return parsed.data
}

/*
|--------------------------------------------------------------------------
| OTP Generation
|--------------------------------------------------------------------------
*/

function generateOtp() {
  const maximum =
    10 **
    env.authEmailOtpLength

  return String(
    randomInt(
      0,
      maximum,
    ),
  ).padStart(
    env.authEmailOtpLength,
    '0',
  )
}

/*
|--------------------------------------------------------------------------
| OTP Hash
|--------------------------------------------------------------------------
*/

function createOtpHash({
  challengeId,
  email,
  otp,
}) {
  return createHmac(
    'sha256',
    env.authEmailOtpHmacSecret,
  )
    .update(
      [
        'registration_email',
        String(
          challengeId,
        ),
        email,
        otp,
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
| Registration Proof Hash
|--------------------------------------------------------------------------
*/

function createRegistrationProofHash({
  challengeId,
  email,
  proof,
}) {
  return createHmac(
    'sha256',
    env.authEmailOtpHmacSecret,
  )
    .update(
      [
        'registration_proof',
        String(
          challengeId,
        ),
        email,
        proof,
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

  const first =
    Buffer.from(
      firstHash,
      'hex',
    )

  const second =
    Buffer.from(
      secondHash,
      'hex',
    )

  if (
    first.length !==
    second.length
  ) {
    return false
  }

  return timingSafeEqual(
    first,
    second,
  )
}

/*
|--------------------------------------------------------------------------
| Registration Availability
|--------------------------------------------------------------------------
|
| Mongo profile:
|   Registration already completed → reject.
|
| Firebase verified account:
|   Existing real identity → reject.
|
| Firebase UNVERIFIED account without Mongo profile:
|   Allow email ownership verification.
|
| This prevents an attacker from permanently blocking someone else's email
| merely by creating an unverified Firebase account first.
|
*/

async function assertEmailAvailable(
  email,
) {
  const mongoUserExists =
    await User.exists({
      email,
    })

  if (
    mongoUserExists
  ) {
    throw new ApiError(
      409,
      'Unable to start registration with this email. Try signing in if you already have an account.',
    )
  }

  try {
    const firebaseUser =
      await firebaseAdminAuth.getUserByEmail(
        email,
      )

    if (
      firebaseUser.emailVerified
    ) {
      throw new ApiError(
        409,
        'Unable to start registration with this email. Try signing in if you already have an account.',
      )
    }

    /*
    |--------------------------------------------------------------------------
    | Unverified Firebase identity
    |--------------------------------------------------------------------------
    |
    | This can be:
    |
    | - an interrupted EPANTRY registration
    | - an externally created account-squatting attempt
    |
    | Email OTP ownership proof will resolve it safely.
    |
    */

    return
  } catch (error) {
    if (
      error instanceof
      ApiError
    ) {
      throw error
    }

    if (
      error?.code ===
      'auth/user-not-found'
    ) {
      return
    }

    throw new ApiError(
      503,
      'Unable to verify registration availability right now. Please try again.',
    )
  }
}

/*
|--------------------------------------------------------------------------
| Remove Orphan Unverified Firebase Identity
|--------------------------------------------------------------------------
|
| Called ONLY after Brevo OTP has successfully proven ownership of email.
|
| A verified Firebase user is never deleted here.
| A Mongo-backed EPANTRY account is never deleted here.
|
*/

async function clearUnverifiedFirebaseConflict(
  email,
) {
  const mongoUserExists =
    await User.exists({
      email,
    })

  if (
    mongoUserExists
  ) {
    throw new ApiError(
      409,
      'An EPANTRY account already exists for this email.',
    )
  }

  try {
    const firebaseUser =
      await firebaseAdminAuth.getUserByEmail(
        email,
      )

    if (
      firebaseUser.emailVerified
    ) {
      throw new ApiError(
        409,
        'An account already exists for this email.',
      )
    }

    await firebaseAdminAuth.deleteUser(
      firebaseUser.uid,
    )
  } catch (error) {
    if (
      error instanceof
      ApiError
    ) {
      throw error
    }

    if (
      error?.code ===
      'auth/user-not-found'
    ) {
      return
    }

    throw new ApiError(
      503,
      'Unable to prepare registration right now. Please try again.',
    )
  }
}

/*
|--------------------------------------------------------------------------
| Brevo Transactional Email
|--------------------------------------------------------------------------
*/

async function sendRegistrationOtpEmail({
  email,
  name,
  otp,
}) {
  let response

  try {
    response =
      await fetch(
        'https://api.brevo.com/v3/smtp/email',

        {
          method:
            'POST',

          headers: {
            accept:
              'application/json',

            'api-key':
              env.brevoApiKey,

            'content-type':
              'application/json',
          },

          body:
            JSON.stringify({
              sender: {
                name:
                  env.brevoSenderName,

                email:
                  env.brevoSenderEmail,
              },

              to: [
                {
                  email,

                  name,
                },
              ],

              subject:
                'Verify your EPANTRY email',

              textContent:
                [
                  `Hello ${name},`,
                  '',
                  'Your EPANTRY verification code is:',
                  '',
                  otp,
                  '',
                  `This code expires in ${Math.ceil(
                    env.authEmailOtpTtlSeconds /
                      60,
                  )} minutes.`,
                  '',
                  'If you did not request this code, you can ignore this email.',
                ].join(
                  '\n',
                ),
            }),

          signal:
            AbortSignal.timeout(
              10000,
            ),
        },
      )
  } catch {
    throw new ApiError(
      502,
      'Unable to send the verification email right now. Please try again.',
    )
  }

  if (
    !response.ok
  ) {
    throw new ApiError(
      502,
      'Unable to send the verification email right now. Please try again.',
    )
  }

  const result =
    await response
      .json()
      .catch(
        () => ({}),
      )

  return {
    messageId:
      result.messageId ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Request Registration OTP
|--------------------------------------------------------------------------
*/

export async function requestRegistrationEmailOtp(
  payload,
) {
  assertOtpConfiguration()

  const input =
    parseInput(
      requestOtpSchema,
      payload,
    )

  const {
    name,
    email,
    phone,
    accountType,
  } =
    input

  await assertEmailAvailable(
    email,
  )

  const now =
    new Date()

  /*
  |--------------------------------------------------------------------------
  | Resend Cooldown
  |--------------------------------------------------------------------------
  */

  const latestChallenge =
    await VerificationChallenge.findOne({
      purpose:
        'registration_email',

      email,
    })
      .sort({
        createdAt:
          -1,
      })
      .lean()

  if (
    latestChallenge
      ?.resendAvailableAt &&
    latestChallenge
      .resendAvailableAt >
      now &&
    !latestChallenge
      .consumedAt
  ) {
    const retryAfterSeconds =
      Math.max(
        1,

        Math.ceil(
          (
            latestChallenge
              .resendAvailableAt
              .getTime() -
            now.getTime()
          ) /
            1000,
        ),
      )

    throw new ApiError(
      429,
      `Please wait ${retryAfterSeconds} seconds before requesting another verification code.`,
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Per-Email Hourly Limit
  |--------------------------------------------------------------------------
  */

  const oneHourAgo =
    new Date(
      now.getTime() -
        HOUR_MS,
    )

  const requestsInLastHour =
    await VerificationChallenge.countDocuments({
      purpose:
        'registration_email',

      email,

      createdAt: {
        $gte:
          oneHourAgo,
      },
    })

  if (
    requestsInLastHour >=
    env
      .authEmailOtpMaxRequestsPerHour
  ) {
    throw new ApiError(
      429,
      'Too many verification codes have been requested. Please try again later.',
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Create New Challenge
  |--------------------------------------------------------------------------
  |
  | IMPORTANT:
  |
  | Previous OTP is NOT invalidated yet.
  |
  | First:
  |   create new challenge
  |   ↓
  |   Brevo successfully sends email
  |
  | Only THEN old challenges are invalidated.
  |
  | Therefore a Brevo outage cannot destroy the user's previously valid OTP.
  |
  */

  const challengeId =
    new mongoose.Types.ObjectId()

  const otp =
    generateOtp()

  const otpHash =
    createOtpHash({
      challengeId,
      email,
      otp,
    })

  const expiresAt =
    new Date(
      now.getTime() +
        env
          .authEmailOtpTtlSeconds *
          1000,
    )

  const resendAvailableAt =
    new Date(
      now.getTime() +
        env
          .authEmailOtpResendCooldownSeconds *
          1000,
    )

  const cleanupAt =
    new Date(
      now.getTime() +
        DAY_MS,
    )

  const challenge =
    await VerificationChallenge.create({
      _id:
        challengeId,

      purpose:
        'registration_email',

      name,

      email,

      phone,

      accountType,

      otpHash,

      attempts:
        0,

      maxAttempts:
        env
          .authEmailOtpMaxAttempts,

      expiresAt,

      resendAvailableAt,

      cleanupAt,
    })

  /*
  |--------------------------------------------------------------------------
  | Deliver New OTP
  |--------------------------------------------------------------------------
  */

  let delivery

  try {
    delivery =
      await sendRegistrationOtpEmail({
        email,
        name,
        otp,
      })
  } catch (error) {
    await VerificationChallenge.deleteOne({
      _id:
        challenge._id,
    })

    throw error
  }

  /*
  |--------------------------------------------------------------------------
  | New OTP Delivered → Invalidate Previous Challenges
  |--------------------------------------------------------------------------
  */

  await VerificationChallenge.updateMany(
    {
      _id: {
        $ne:
          challenge._id,
      },

      purpose:
        'registration_email',

      email,

      consumedAt:
        null,

      invalidatedAt:
        null,
    },

    {
      $set: {
        invalidatedAt:
          new Date(),
      },
    },
  )

  if (
    delivery.messageId
  ) {
    await VerificationChallenge.updateOne(
      {
        _id:
          challenge._id,
      },

      {
        $set: {
          deliveryMessageId:
            delivery.messageId,
        },
      },
    )
  }

  return {
    challengeId:
      String(
        challenge._id,
      ),

    email,

    expiresInSeconds:
      env
        .authEmailOtpTtlSeconds,

    resendAfterSeconds:
      env
        .authEmailOtpResendCooldownSeconds,
  }
}

/*
|--------------------------------------------------------------------------
| Verify Registration OTP
|--------------------------------------------------------------------------
*/

export async function verifyRegistrationEmailOtp(
  payload,
) {
  assertOtpConfiguration()

  const input =
    parseInput(
      verifyOtpSchema,
      payload,
    )

  const {
    challengeId,
    email,
    otp,
  } =
    input

  const now =
    new Date()

  const challenge =
    await VerificationChallenge.findOne({
      _id:
        challengeId,

      purpose:
        'registration_email',

      email,
    }).select(
      '+otpHash',
    )

  if (
    !challenge ||
    challenge
      .invalidatedAt ||
    challenge
      .consumedAt
  ) {
    throw new ApiError(
      400,
      'This verification challenge is no longer valid. Request a new code.',
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Expiration
  |--------------------------------------------------------------------------
  */

  if (
    challenge
      .expiresAt <=
    now
  ) {
    challenge.invalidatedAt =
      now

    await challenge.save()

    throw new ApiError(
      400,
      'The verification code has expired. Request a new code.',
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Attempt Limit
  |--------------------------------------------------------------------------
  */

  if (
    challenge.attempts >=
    challenge.maxAttempts
  ) {
    challenge.invalidatedAt =
      challenge
        .invalidatedAt ||
      now

    await challenge.save()

    throw new ApiError(
      400,
      'This verification challenge is no longer valid. Request a new code.',
    )
  }

  /*
  |--------------------------------------------------------------------------
  | OTP Comparison
  |--------------------------------------------------------------------------
  */

  const submittedHash =
    createOtpHash({
      challengeId:
        challenge._id,

      email,

      otp,
    })

  const isCorrect =
    safeHashEquals(
      challenge.otpHash,
      submittedHash,
    )

  if (
    !isCorrect
  ) {
    challenge.attempts +=
      1

    if (
      challenge.attempts >=
      challenge.maxAttempts
    ) {
      challenge.invalidatedAt =
        now
    }

    await challenge.save()

    if (
      challenge.invalidatedAt
    ) {
      throw new ApiError(
        400,
        'The verification code was incorrect and this challenge is now invalid. Request a new code.',
      )
    }

    throw new ApiError(
      400,
      'The verification code is incorrect.',
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Email Ownership Proven
  |--------------------------------------------------------------------------
  |
  | If an orphan/unverified Firebase identity already occupies this email,
  | it can now safely be removed because the person completing this request
  | has proven control of the email inbox.
  |
  */

  await clearUnverifiedFirebaseConflict(
    email,
  )

  /*
  |--------------------------------------------------------------------------
  | Registration Proof
  |--------------------------------------------------------------------------
  */

  challenge.consumedAt =
    now

  const registrationProof =
    randomBytes(
      32,
    ).toString(
      'base64url',
    )

  challenge.registrationProofHash =
    createRegistrationProofHash({
      challengeId:
        challenge._id,

      email,

      proof:
        registrationProof,
    })

  challenge.registrationProofExpiresAt =
    new Date(
      now.getTime() +
        env
          .authRegistrationProofTtlSeconds *
          1000,
    )

  await challenge.save()

  return {
    verified:
      true,

    challengeId:
      String(
        challenge._id,
      ),

    registrationProof,

    registrationProofExpiresAt:
      challenge
        .registrationProofExpiresAt
        .toISOString(),
  }
}