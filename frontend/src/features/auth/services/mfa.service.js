import QRCode from 'qrcode'

import {
  multiFactor,
  signInWithEmailAndPassword,
  signOut,
  TotpMultiFactorGenerator,
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
| Active Enrollment
|--------------------------------------------------------------------------
|
| The Firebase TotpSecret object exists ONLY in browser memory.
|
| It is deliberately NOT stored in:
|
| - localStorage
| - sessionStorage
| - Zustand
| - React Context
| - MongoDB
|
| Reloading or leaving the enrollment flow destroys this temporary state.
|
*/

let activeTotpEnrollment =
  null

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

function createMfaError(
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

function normalizeVerificationCode(
  code,
) {
  return String(
    code ||
      '',
  )
    .replace(
      /\D/g,
      '',
    )
    .trim()
}

/*
|--------------------------------------------------------------------------
| MFA Policy Normalization
|--------------------------------------------------------------------------
|
| Backend policy contract:
|
| {
|   required,
|   recommended,
|   reason
| }
|
| MFA enrollment UI historically also expects:
|
| {
|   mode,
|   enrollmentAllowed
| }
|
| Keep that presentation compatibility inside the service boundary rather
| than changing backend authorization/security policy.
|
*/

function normalizeMfaPolicy(
  policy,
  mfa,
) {
  const required =
    policy?.required ===
    true

  const recommended =
    required ||
    policy?.recommended ===
      true

  const mode =
    required
      ? 'required'
      : recommended
        ? 'recommended'
        : 'optional'

  const enrolled =
    mfa?.enrolled ===
    true

  return {
    required,

    recommended,

    reason:
      policy?.reason ||
      null,

    mode,

    enrollmentAllowed:
      !enrolled,
  }
}

function normalizeMfaStatus(
  mfa,
) {
  if (
    !mfa ||
    typeof mfa !==
      'object'
  ) {
    return null
  }

  const normalizedPolicy =
    normalizeMfaPolicy(
      mfa.policy,
      mfa,
    )

  return {
    ...mfa,

    policy:
      normalizedPolicy,

    enrollmentRequired:
      normalizedPolicy.required &&
      mfa.enrolled !==
        true,

    enrollmentRecommended:
      normalizedPolicy.recommended &&
      mfa.enrolled !==
        true,
  }
}

/*
|--------------------------------------------------------------------------
| Temporary Firebase Sign Out
|--------------------------------------------------------------------------
*/

async function clearTemporaryFirebaseAuth() {
  if (
    !firebaseAuth.currentUser
  ) {
    return
  }

  try {
    await signOut(
      firebaseAuth,
    )
  } catch {
    /*
    |--------------------------------------------------------------------------
    | Firebase uses in-memory persistence.
    |--------------------------------------------------------------------------
    |
    | A browser reload also clears this temporary Firebase authentication
    | state.
    |
    */
  }
}

/*
|--------------------------------------------------------------------------
| Error Messages
|--------------------------------------------------------------------------
*/

export function getMfaEnrollmentErrorMessage(
  error,
) {
  switch (
    error?.code
  ) {
    case 'auth/invalid-email':
      return 'Your account email is not valid.'

    case 'auth/user-disabled':
      return 'This Firebase account is currently unavailable.'

    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'The password you entered is incorrect.'

    case 'auth/too-many-requests':
      return 'Too many security attempts. Please wait and try again.'

    case 'auth/network-request-failed':
      return 'Network connection failed. Please try again.'

    case 'auth/multi-factor-auth-required':
      return 'Multi-factor authentication is already enabled for this Firebase account.'

    case 'auth/mfa-already-enrolled':
      return 'An authenticator is already enrolled for this account.'

    case 'auth/email-not-verified':
      return 'Your email must be verified before MFA can be enabled.'

    case 'auth/invalid-verification-code':
    case 'auth/invalid-mfa-code':
      return 'The authenticator code is incorrect. Enter the latest code and try again.'

    case 'auth/code-expired':
      return 'That authenticator code has expired. Enter the newest code from your app.'

    case 'auth/invalid-multi-factor-session':
      return 'The MFA setup session is no longer valid. Start setup again.'

    case 'auth/missing-multi-factor-session':
      return 'The MFA setup session is missing. Start setup again.'

    case 'auth/maximum-second-factor-count-exceeded':
      return 'The maximum number of authentication factors has already been enrolled.'

    case 'auth/second-factor-already-in-use':
      return 'This authentication factor is already connected to the account.'

    default:
      return (
        error?.message ||
        'Unable to complete MFA setup. Please try again.'
      )
  }
}

/*
|--------------------------------------------------------------------------
| Backend MFA Status
|--------------------------------------------------------------------------
*/

export async function getMfaStatus() {
  const response =
    await apiClient.get(
      '/auth/mfa/status',
    )

  const data =
    unwrapApiData(
      response,
    )

  return normalizeMfaStatus(
    data?.mfa,
  )
}

/*
|--------------------------------------------------------------------------
| Cancel TOTP Enrollment
|--------------------------------------------------------------------------
*/

export async function cancelTotpEnrollment() {
  activeTotpEnrollment =
    null

  await clearTemporaryFirebaseAuth()
}

/*
|--------------------------------------------------------------------------
| Start TOTP Enrollment
|--------------------------------------------------------------------------
|
| Existing EPANTRY HttpOnly session
|       ↓
| User re-enters password
|       ↓
| Temporary Firebase authentication
|       ↓
| multiFactor(user).getSession()
|       ↓
| Firebase generates TOTP secret
|       ↓
| Browser locally creates QR image
|
*/

export async function startTotpEnrollment({
  email,
  password,
}) {
  await firebaseAuthReady

  /*
  |--------------------------------------------------------------------------
  | Remove Any Previous Incomplete Setup
  |--------------------------------------------------------------------------
  */

  await cancelTotpEnrollment()

  const normalizedEmail =
    normalizeEmail(
      email,
    )

  try {
    /*
    |--------------------------------------------------------------------------
    | Security Re-authentication
    |--------------------------------------------------------------------------
    |
    | EPANTRY normally keeps Firebase signed out in the browser.
    |
    | MFA enrollment is security-sensitive, so password is deliberately
    | requested again to produce a recently authenticated Firebase user.
    |
    */

    const credential =
      await signInWithEmailAndPassword(
        firebaseAuth,
        normalizedEmail,
        password,
      )

    const firebaseUser =
      credential.user

    /*
    |--------------------------------------------------------------------------
    | Identity Match
    |--------------------------------------------------------------------------
    */

    if (
      normalizeEmail(
        firebaseUser.email,
      ) !==
      normalizedEmail
    ) {
      throw createMfaError(
        'auth/mfa-identity-mismatch',
        'Authenticated Firebase identity does not match the current EPANTRY account.',
      )
    }

    /*
    |--------------------------------------------------------------------------
    | Verified Email Required By Firebase MFA
    |--------------------------------------------------------------------------
    */

    if (
      firebaseUser.emailVerified !==
      true
    ) {
      throw createMfaError(
        'auth/email-not-verified',
        'Email verification is required before MFA enrollment.',
      )
    }

    /*
    |--------------------------------------------------------------------------
    | Existing Factors
    |--------------------------------------------------------------------------
    */

    const firebaseMultiFactor =
      multiFactor(
        firebaseUser,
      )

    const existingFactors =
      Array.isArray(
        firebaseMultiFactor
          .enrolledFactors,
      )
        ? firebaseMultiFactor
            .enrolledFactors
        : []

    const alreadyHasTotp =
      existingFactors.some(
        (factor) =>
          factor.factorId ===
          TotpMultiFactorGenerator
            .FACTOR_ID,
      )

    if (
      alreadyHasTotp
    ) {
      throw createMfaError(
        'auth/mfa-already-enrolled',
        'TOTP multi-factor authentication is already enabled.',
      )
    }

    /*
    |--------------------------------------------------------------------------
    | Firebase MFA Session
    |--------------------------------------------------------------------------
    */

    const multiFactorSession =
      await firebaseMultiFactor.getSession()

    /*
    |--------------------------------------------------------------------------
    | TOTP Secret
    |--------------------------------------------------------------------------
    */

    const totpSecret =
      await TotpMultiFactorGenerator.generateSecret(
        multiFactorSession,
      )

    const accountName =
      firebaseUser.email ||
      normalizedEmail

    const issuer =
      'EPANTRY'

    const qrCodeUri =
      totpSecret.generateQrCodeUrl(
        accountName,
        issuer,
      )

    /*
    |--------------------------------------------------------------------------
    | Local QR Generation
    |--------------------------------------------------------------------------
    |
    | The otpauth URI contains the TOTP secret.
    |
    | It is encoded locally in the browser and is NOT sent to an external
    | QR-code service.
    |
    */

    const qrCodeDataUrl =
      await QRCode.toDataURL(
        qrCodeUri,
        {
          errorCorrectionLevel:
            'M',

          margin:
            1,

          width:
            280,
        },
      )

    /*
    |--------------------------------------------------------------------------
    | Keep Firebase Secret Object In Memory
    |--------------------------------------------------------------------------
    */

    activeTotpEnrollment = {
      firebaseUser,

      totpSecret,
    }

    return {
      accountName,

      issuer,

      secretKey:
        totpSecret.secretKey,

      qrCodeUri,

      qrCodeDataUrl,

      codeLength:
        totpSecret.codeLength,

      codeIntervalSeconds:
        totpSecret
          .codeIntervalSeconds,

      enrollmentCompletionDeadline:
        totpSecret
          .enrollmentCompletionDeadline,
    }
  } catch (error) {
    activeTotpEnrollment =
      null

    await clearTemporaryFirebaseAuth()

    throw error
  }
}

/*
|--------------------------------------------------------------------------
| Complete TOTP Enrollment
|--------------------------------------------------------------------------
*/

export async function completeTotpEnrollment({
  verificationCode,
  displayName =
    'EPANTRY Authenticator',
}) {
  if (
    !activeTotpEnrollment
      ?.firebaseUser ||
    !activeTotpEnrollment
      ?.totpSecret
  ) {
    throw createMfaError(
      'auth/missing-multi-factor-session',
      'Start MFA setup again before entering an authenticator code.',
    )
  }

  const {
    firebaseUser,
    totpSecret,
  } =
    activeTotpEnrollment

  const normalizedCode =
    normalizeVerificationCode(
      verificationCode,
    )

  const expectedLength =
    Number(
      totpSecret.codeLength,
    ) ||
    6

  if (
    normalizedCode.length !==
      expectedLength
  ) {
    throw createMfaError(
      'auth/invalid-mfa-code',
      `Enter the ${expectedLength}-digit code from your authenticator app.`,
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Firebase Enrollment Assertion
  |--------------------------------------------------------------------------
  */

  const assertion =
    TotpMultiFactorGenerator.assertionForEnrollment(
      totpSecret,
      normalizedCode,
    )

  /*
  |--------------------------------------------------------------------------
  | Enroll
  |--------------------------------------------------------------------------
  |
  | If the code is invalid, Firebase throws here.
  |
  | We deliberately keep activeTotpEnrollment in memory so the user can type
  | the next authenticator code without restarting the entire setup.
  |
  */

  await multiFactor(
    firebaseUser,
  ).enroll(
    assertion,
    displayName,
  )

  /*
  |--------------------------------------------------------------------------
  | Enrollment Is Now Authoritative In Firebase
  |--------------------------------------------------------------------------
  */

  await firebaseUser.reload()

  /*
  |--------------------------------------------------------------------------
  | Fresh Firebase Token → Fresh EPANTRY Session
  |--------------------------------------------------------------------------
  |
  | Enrollment already succeeded even if refreshing the EPANTRY server session
  | later encounters a temporary network/backend issue.
  |
  */

  let session =
    null

  let sessionRefreshed =
    false

  try {
    const idToken =
      await firebaseUser.getIdToken(
        true,
      )

    session =
      await createEpantrySession(
        idToken,
      )

    sessionRefreshed =
      session?.authenticated ===
      true
  } catch {
    /*
    |--------------------------------------------------------------------------
    | Existing HttpOnly Session Still Exists
    |--------------------------------------------------------------------------
    |
    | MFA enrollment itself has already succeeded in Firebase.
    |
    | The backend can read Firebase enrolledFactors on the next successful
    | request/session.
    |
    */
  }

  /*
  |--------------------------------------------------------------------------
  | Clear Temporary Firebase Browser Authentication
  |--------------------------------------------------------------------------
  */

  activeTotpEnrollment =
    null

  await clearTemporaryFirebaseAuth()

  return {
    enrolled:
      true,

    sessionRefreshed,

    session,
  }
}