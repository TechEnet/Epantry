import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'

import {
  apiClient,
} from '../../../api/apiClient'

import {
  firebaseAuth,
  firebaseAuthReady,
} from '../../../lib/firebase'

import {
  createEpantrySession,
} from './auth.service'

/*
|--------------------------------------------------------------------------
| Public Registration Account Types
|--------------------------------------------------------------------------
|
| These values describe registration intent only.
|
| They are NOT application authorization roles.
|
| Public registration supports:
|
| - Customer
| - Host
|
| Super Admin is never publicly registered.
|
| Seller / Brand / B2B are business/content concepts, not top-level
| authentication roles.
|
*/

export const PUBLIC_REGISTRATION_ACCOUNT_TYPES =
  Object.freeze([
    'customer',
    'host',
  ])

/*
|--------------------------------------------------------------------------
| Helpers
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

function createRegistrationError(
  code,
  message,
) {
  const error =
    new Error(
      message,
    )

  error.code =
    code

  return error
}

function normalizeRegistrationAccountType(
  accountType,
) {
  const normalized =
    String(
      accountType ||
        '',
    )
      .trim()
      .toLowerCase()

  if (
    !PUBLIC_REGISTRATION_ACCOUNT_TYPES.includes(
      normalized,
    )
  ) {
    throw createRegistrationError(
      'auth/invalid-registration-account-type',
      'Choose either Customer or Host to continue registration.',
    )
  }

  return normalized
}

/*
|--------------------------------------------------------------------------
| API Envelope
|--------------------------------------------------------------------------
|
| Works whether the existing API client returns:
|
| Axios response:
|   { data: { success, data } }
|
| or an interceptor already returns:
|   { success, data }
|
*/

function unwrapApiData(
  response,
) {
  if (
    response?.data &&
    typeof response.data ===
      'object' &&
    Object.prototype.hasOwnProperty.call(
      response.data,
      'success',
    )
  ) {
    return response
      .data
      .data
  }

  if (
    response &&
    typeof response ===
      'object' &&
    Object.prototype.hasOwnProperty.call(
      response,
      'success',
    )
  ) {
    return response.data
  }

  return response?.data ??
    response
}

/*
|--------------------------------------------------------------------------
| Firebase / Registration Error Messages
|--------------------------------------------------------------------------
*/

export function getRegistrationErrorMessage(
  error,
) {
  const backendMessage =
    error?.response
      ?.data
      ?.message

  if (
    backendMessage
  ) {
    return backendMessage
  }

  switch (
    error?.code
  ) {
    case 'auth/email-already-in-use':
      return 'An account already exists for this email.'

    case 'auth/invalid-email':
      return 'Enter a valid email address.'

    case 'auth/weak-password':
      return 'Choose a stronger password.'

    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Unable to resume registration. Please verify your details and try again.'

    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait and try again.'

    case 'auth/network-request-failed':
      return 'Network connection failed. Please try again.'

    case 'auth/invalid-registration-account-type':
      return 'Choose either Customer or Host to continue registration.'

    default:
      return (
        error?.message ||
        'Unable to complete registration. Please try again.'
      )
  }
}

/*
|--------------------------------------------------------------------------
| Request Email OTP
|--------------------------------------------------------------------------
|
| Password is intentionally NOT sent to Express.
|
| accountType is registration intent only:
|
| customer | host
|
| The backend remains authoritative and validates this value again.
|
*/

export async function requestRegistrationOtp({
  name,
  email,
  phone,
  accountType,
}) {
  const normalizedAccountType =
    normalizeRegistrationAccountType(
      accountType,
    )

  const response =
    await apiClient.post(
      '/auth/register/request-otp',

      {
        name:
          String(
            name ||
              '',
          ).trim(),

        email:
          normalizeEmail(
            email,
          ),

        phone:
          String(
            phone ||
              '',
          ).trim(),

        accountType:
          normalizedAccountType,
      },
    )

  return unwrapApiData(
    response,
  )
}

/*
|--------------------------------------------------------------------------
| Verify Email OTP
|--------------------------------------------------------------------------
|
| registrationProof must remain local to the registration flow.
|
| Do NOT put it in:
|
| - localStorage
| - Zustand
| - Context
| - analytics
|
*/

export async function verifyRegistrationOtp({
  challengeId,
  email,
  otp,
}) {
  const response =
    await apiClient.post(
      '/auth/register/verify-email',

      {
        challengeId,

        email:
          normalizeEmail(
            email,
          ),

        otp:
          String(
            otp ||
              '',
          ).trim(),
      },
    )

  return unwrapApiData(
    response,
  )
}

/*
|--------------------------------------------------------------------------
| Resolve Firebase Registration User
|--------------------------------------------------------------------------
|
| Normal case:
|
| createUserWithEmailAndPassword()
|
| Retry case:
|
| Firebase account may already exist because:
|
| - browser/network failed after Firebase creation
| - backend completion temporarily failed
|
| In that case, signing in with the SAME registration password safely resumes
| the registration.
|
*/

async function resolveFirebaseRegistrationUser({
  email,
  password,
}) {
  await firebaseAuthReady

  const normalizedEmail =
    normalizeEmail(
      email,
    )

  /*
  |--------------------------------------------------------------------------
  | Existing In-Memory Registration
  |--------------------------------------------------------------------------
  */

  if (
    firebaseAuth.currentUser
  ) {
    if (
      normalizeEmail(
        firebaseAuth
          .currentUser
          .email,
      ) ===
      normalizedEmail
    ) {
      return firebaseAuth
        .currentUser
    }

    await signOut(
      firebaseAuth,
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Create Firebase Account
  |--------------------------------------------------------------------------
  */

  try {
    const credential =
      await createUserWithEmailAndPassword(
        firebaseAuth,
        normalizedEmail,
        password,
      )

    return credential.user
  } catch (error) {
    /*
    |--------------------------------------------------------------------------
    | Interrupted Registration Recovery
    |--------------------------------------------------------------------------
    */

    if (
      error?.code !==
      'auth/email-already-in-use'
    ) {
      throw error
    }

    const credential =
      await signInWithEmailAndPassword(
        firebaseAuth,
        normalizedEmail,
        password,
      )

    return credential.user
  }
}

/*
|--------------------------------------------------------------------------
| Complete EPANTRY Application Registration
|--------------------------------------------------------------------------
*/

async function completeApplicationRegistration({
  firebaseUser,
  challengeId,
  registrationProof,
}) {
  const idToken =
    await firebaseUser.getIdToken(
      true,
    )

  const response =
    await apiClient.post(
      '/auth/register/complete',

      {
        idToken,

        challengeId,

        registrationProof,
      },
    )

  return unwrapApiData(
    response,
  )
}

/*
|--------------------------------------------------------------------------
| Synchronize Firebase User
|--------------------------------------------------------------------------
|
| Backend registration completion sets Firebase:
|
| emailVerified = true
| displayName    = registration name
|
| The browser's current Firebase User object and ID token were created BEFORE
| that server-side update, so both must be refreshed.
|
*/

async function refreshFirebaseIdentity(
  firebaseUser,
) {
  await firebaseUser.reload()

  if (
    !firebaseUser.emailVerified
  ) {
    throw new Error(
      'Email verification could not be synchronized. Please try again.',
    )
  }

  return firebaseUser.getIdToken(
    true,
  )
}

/*
|--------------------------------------------------------------------------
| Complete Verified Registration
|--------------------------------------------------------------------------
|
| FINAL FLOW:
|
| Brevo registrationProof
|       ↓
| Firebase Email/Password user
|       ↓
| Firebase ID Token
|       ↓
| Express /register/complete
|       ↓
| MongoDB profile
|       ↓
| Firebase emailVerified sync
|       ↓
| Firebase token refresh
|       ↓
| CSRF
|       ↓
| HttpOnly EPANTRY session
|       ↓
| Clear temporary Firebase client auth state
|
*/

export async function completeVerifiedRegistration({
  email,
  password,
  challengeId,
  registrationProof,
}) {
  if (
    !registrationProof ||
    !challengeId
  ) {
    throw new Error(
      'Email verification is required before registration can continue.',
    )
  }

  const firebaseUser =
    await resolveFirebaseRegistrationUser({
      email,
      password,
    })

  /*
  |--------------------------------------------------------------------------
  | Complete Mongo/Firebase Application Account
  |--------------------------------------------------------------------------
  |
  | IMPORTANT:
  |
  | On an error we deliberately keep the Firebase user in memory.
  |
  | This lets the SAME browser retry without creating another Firebase
  | identity.
  |
  */

  const registration =
    await completeApplicationRegistration({
      firebaseUser,

      challengeId,

      registrationProof,
    })

  /*
  |--------------------------------------------------------------------------
  | Firebase Admin Changed emailVerified
  |--------------------------------------------------------------------------
  */

  const refreshedIdToken =
    await refreshFirebaseIdentity(
      firebaseUser,
    )

  /*
  |--------------------------------------------------------------------------
  | Server-Owned Session
  |--------------------------------------------------------------------------
  */

  const session =
    await createEpantrySession(
      refreshedIdToken,
    )

  /*
  |--------------------------------------------------------------------------
  | Clear Firebase Client Auth State
  |--------------------------------------------------------------------------
  |
  | From this point onward the browser's authenticated EPANTRY state belongs
  | to the Secure HttpOnly server cookie.
  |
  | Firebase persistence is already in-memory only.
  |
  */

  try {
    await signOut(
      firebaseAuth,
    )
  } catch {
    /*
    |--------------------------------------------------------------------------
    | Server session is already established.
    |--------------------------------------------------------------------------
    |
    | Because Firebase persistence is in-memory only, a page reload also
    | removes this temporary client-side Firebase state.
    |
    */
  }

  return {
    registered:
      true,

    user:
      session?.user ||
      registration?.user ||
      null,

    accountStatus:
      session?.user
        ?.accountStatus ||
      registration?.user
        ?.accountStatus ||
      null,

    nextStep:
      registration
        ?.nextStep ||
      null,

    sessionExpiresAt:
      session
        ?.expiresAt ||
      null,
  }
}