import dotenv from 'dotenv'

import {
  readSecretFromBoundary,
} from '../integrations/secrets/secretsBoundary.service.js'

dotenv.config()

/*
|--------------------------------------------------------------------------
| Required Core Environment Variables
|--------------------------------------------------------------------------
*/

const requiredEnvVariables = [
  'PORT',
  'MONGODB_URI',
  'FRONTEND_URL',
]

for (
  const variable of
    requiredEnvVariables
) {
  if (
    !process.env[
      variable
    ] &&
    !process.env[
      `${variable}_FILE`
    ]
  ) {
    throw new Error(
      `Missing environment variable: ${variable}`,
    )
  }
}

/*
|--------------------------------------------------------------------------
| Numeric Environment Helper
|--------------------------------------------------------------------------
*/

function getPositiveNumber(
  value,
  fallback,
) {
  const parsed =
    Number(value)

  if (
    !Number.isFinite(
      parsed,
    ) ||
    parsed <= 0
  ) {
    return fallback
  }

  return parsed
}

/*
|--------------------------------------------------------------------------
| Environment Configuration
|--------------------------------------------------------------------------
*/

export const env = {
  nodeEnv:
    process.env.NODE_ENV ||
    'development',

  port:
    Number(
      process.env.PORT,
    ) || 5001,

  mongodbUri:
    readSecretFromBoundary(
      'MONGODB_URI',
      { required: true },
    ),

  frontendUrl:
    process.env.FRONTEND_URL,

  /*
  |--------------------------------------------------------------------------
  | Seed
  |--------------------------------------------------------------------------
  */

  allowSeed:
    process.env.ALLOW_SEED ===
    'true',

  seedSuperAdminEmail:
    process.env.SEED_SUPER_ADMIN_EMAIL?.trim() ||
    '',

  /*
  |--------------------------------------------------------------------------
  | Location
  |--------------------------------------------------------------------------
  */

  geocodingBaseUrl:
    process.env.GEOCODING_BASE_URL?.trim() ||
    'https://nominatim.openstreetmap.org',

  geocodingUserAgent:
    process.env.GEOCODING_USER_AGENT?.trim() ||
    'EPANTRY/1.0',

  /*
  |--------------------------------------------------------------------------
  | Firebase Admin
  |--------------------------------------------------------------------------
  */

  firebaseProjectId:
    process.env.FIREBASE_PROJECT_ID?.trim() ||
    '',

  googleApplicationCredentials:
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
    '',

  /*
  |--------------------------------------------------------------------------
  | Authentication Session
  |--------------------------------------------------------------------------
  */

  authSessionCookieName:
    process.env.AUTH_SESSION_COOKIE_NAME?.trim() ||
    'epantry_session',

  authCsrfCookieName:
    process.env.AUTH_CSRF_COOKIE_NAME?.trim() ||
    'epantry_csrf',

  authSessionDays:
    getPositiveNumber(
      process.env.AUTH_SESSION_DAYS,
      5,
    ),

  authRecentSignInSeconds:
    getPositiveNumber(
      process.env.AUTH_RECENT_SIGN_IN_SECONDS,
      (process.env.NODE_ENV || 'development') === 'production'
        ? 300
        : 3600,
    ),

  authSessionRateLimitWindowMs:
    getPositiveNumber(
      process.env.AUTH_SESSION_RATE_LIMIT_WINDOW_MS,
      15 * 60 * 1000,
    ),

  authSessionRateLimitMax:
    getPositiveNumber(
      process.env.AUTH_SESSION_RATE_LIMIT_MAX,
      20,
    ),

  /*
  |--------------------------------------------------------------------------
  | Brevo
  |--------------------------------------------------------------------------
  */

  brevoApiKey:
    readSecretFromBoundary(
      'BREVO_API_KEY',
    ),

  brevoSenderName:
    process.env.BREVO_SENDER_NAME?.trim() ||
    'EPANTRY',

  brevoSenderEmail:
    process.env.BREVO_SENDER_EMAIL?.trim() ||
    '',

  /*
  |--------------------------------------------------------------------------
  | Registration Email OTP
  |--------------------------------------------------------------------------
  */

  authEmailOtpLength:
    getPositiveNumber(
      process.env.AUTH_EMAIL_OTP_LENGTH,
      6,
    ),

  authEmailOtpTtlSeconds:
    getPositiveNumber(
      process.env.AUTH_EMAIL_OTP_TTL_SECONDS,
      600,
    ),

  authEmailOtpMaxAttempts:
    getPositiveNumber(
      process.env.AUTH_EMAIL_OTP_MAX_ATTEMPTS,
      3,
    ),

  authEmailOtpResendCooldownSeconds:
    getPositiveNumber(
      process.env.AUTH_EMAIL_OTP_RESEND_COOLDOWN_SECONDS,
      60,
    ),

  authEmailOtpMaxRequestsPerHour:
    getPositiveNumber(
      process.env.AUTH_EMAIL_OTP_MAX_REQUESTS_PER_HOUR,
      5,
    ),

  authEmailOtpHmacSecret:
    readSecretFromBoundary(
      'AUTH_EMAIL_OTP_HMAC_SECRET',
    ),

  authRegistrationProofTtlSeconds:
    getPositiveNumber(
      process.env.AUTH_REGISTRATION_PROOF_TTL_SECONDS,
      900,
    ),

  authEmailOtpIpRateLimitWindowMs:
    getPositiveNumber(
      process.env.AUTH_EMAIL_OTP_IP_RATE_LIMIT_WINDOW_MS,
      15 * 60 * 1000,
    ),

  authEmailOtpIpRateLimitMax:
    getPositiveNumber(
      process.env.AUTH_EMAIL_OTP_IP_RATE_LIMIT_MAX,
      30,
    ),

  /*
  |--------------------------------------------------------------------------
  | Connected Purchase Source Integration Gateway
  |--------------------------------------------------------------------------
  |
  | Gmail / Outlook / retailer OAuth credentials live in the dedicated
  | provider gateway, not in the EPANTRY application database.
  |
  */

  purchaseSourceIntegrationGatewayUrl:
    process.env.PURCHASE_SOURCE_INTEGRATION_GATEWAY_URL?.trim() ||
    '',

  purchaseSourceIntegrationHmacSecret:
    readSecretFromBoundary(
      'PURCHASE_SOURCE_INTEGRATION_HMAC_SECRET',
    ),

  purchaseSourceIntegrationTimeoutMs:
    getPositiveNumber(
      process.env.PURCHASE_SOURCE_INTEGRATION_TIMEOUT_MS,
      10000,
    ),

  purchaseSourceIntegrationSignatureSkewSeconds:
    getPositiveNumber(
      process.env.PURCHASE_SOURCE_INTEGRATION_SIGNATURE_SKEW_SECONDS,
      300,
    ),
}