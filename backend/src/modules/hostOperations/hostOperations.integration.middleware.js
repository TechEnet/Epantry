import { ApiError } from '../../utils/ApiError.js'

import {
  authenticateHostApiCredential,
} from './hostOperations.integration.service.js'

export async function authenticateHostServiceAccount(
  req,
  res,
  next,
) {
  try {
    const authorization =
      String(
        req.get(
          'authorization',
        ) ||
          '',
      ).trim()

    const [
      scheme,
      token,
    ] =
      authorization.split(
        /\s+/,
        2,
      )

    if (
      scheme?.toLowerCase() !==
        'bearer' ||
      !token
    ) {
      throw new ApiError(
        401,
        'Bearer API credential is required.',
        [
          {
            code:
              'HOST_SERVICE_ACCOUNT_CREDENTIAL_REQUIRED',
          },
        ],
      )
    }

    const identity =
      await authenticateHostApiCredential(
        token,
      )

    if (!identity) {
      throw new ApiError(
        401,
        'API credential is invalid or revoked.',
        [
          {
            code:
              'HOST_SERVICE_ACCOUNT_CREDENTIAL_INVALID',
          },
        ],
      )
    }

    req.hostServiceAccount =
      identity

    return next()
  } catch (error) {
    return next(
      error,
    )
  }
}

export function requireHostServiceAccountScope(
  ...scopeKeys
) {
  const required =
    scopeKeys
      .flat()
      .map(
        (value) =>
          String(
            value ||
              '',
          ).trim(),
      )
      .filter(Boolean)

  return function serviceAccountScopeBoundary(
    req,
    res,
    next,
  ) {
    const scopes =
      new Set(
        req.hostServiceAccount?.scopes ||
          [],
      )

    if (
      !required.every(
        (key) =>
          scopes.has(
            key,
          ),
      )
    ) {
      return next(
        new ApiError(
          403,
          'Service Account scope is required.',
          [
            {
              code:
                'HOST_SERVICE_ACCOUNT_SCOPE_REQUIRED',

              requiredScopes:
                required,
            },
          ],
        ),
      )
    }

    return next()
  }
}