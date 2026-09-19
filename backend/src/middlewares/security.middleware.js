import {
  rateLimit,
} from 'express-rate-limit'

import helmet from 'helmet'

import {
  env,
} from '../config/env.js'

/*
|--------------------------------------------------------------------------
| Helmet
|--------------------------------------------------------------------------
*/

export const helmetMiddleware =
  helmet()

/*
|--------------------------------------------------------------------------
| Sensitive Response Cache Protection
|--------------------------------------------------------------------------
|
| Authentication/account/tenant responses can contain:
|
| - account identity
| - membership information
| - authentication assurance
| - MFA status
| - consent/preferences
|
| They should not be stored by browser/proxy caches.
|
*/

export function sensitiveResponseNoStoreMiddleware(
  req,
  res,
  next,
) {
  res.set(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate',
  )

  res.set(
    'Pragma',
    'no-cache',
  )

  res.set(
    'Expires',
    '0',
  )

  res.set(
    'Surrogate-Control',
    'no-store',
  )

  return next()
}

/*
|--------------------------------------------------------------------------
| Standard Rate-limit Handler
|--------------------------------------------------------------------------
*/

function createRateLimitHandler({
  message,
  code,
}) {
  return function rateLimitHandler(
    req,
    res,
  ) {
    return res
      .status(429)
      .json({
        success:
          false,

        message,

        requestId:
          req.requestId,

        errors: [
          {
            code,
          },
        ],
      })
  }
}

/*
|--------------------------------------------------------------------------
| General API Rate Limit
|--------------------------------------------------------------------------
*/

export const apiRateLimiter =
  rateLimit({
    windowMs:
      15 *
      60 *
      1000,

    limit:
      300,

    standardHeaders:
      'draft-8',

    legacyHeaders:
      false,

    handler:
      createRateLimitHandler({
        message:
          'Too many requests. Please try again after some time.',

        code:
          'RATE_LIMIT_API',
      }),
  })

/*
|--------------------------------------------------------------------------
| Authentication Session Rate Limit
|--------------------------------------------------------------------------
|
| Covers high-value authentication/session operations.
|
*/

export const authSessionRateLimiter =
  rateLimit({
    windowMs:
      env
        .authSessionRateLimitWindowMs,

    limit:
      env
        .authSessionRateLimitMax,

    standardHeaders:
      'draft-8',

    legacyHeaders:
      false,

    handler:
      createRateLimitHandler({
        message:
          'Too many authentication attempts. Please try again later.',

        code:
          'RATE_LIMIT_AUTH_SESSION',
      }),
  })

/*
|--------------------------------------------------------------------------
| Registration Email OTP IP Rate Limit
|--------------------------------------------------------------------------
|
| Complements:
|
| - per-email hourly generation limit
| - resend cooldown
| - challenge attempt limit
|
*/

export const authEmailOtpRateLimiter =
  rateLimit({
    windowMs:
      env
        .authEmailOtpIpRateLimitWindowMs,

    limit:
      env
        .authEmailOtpIpRateLimitMax,

    standardHeaders:
      'draft-8',

    legacyHeaders:
      false,

    handler:
      createRateLimitHandler({
        message:
          'Too many verification requests. Please try again later.',

        code:
          'RATE_LIMIT_AUTH_EMAIL_OTP',
      }),
  })