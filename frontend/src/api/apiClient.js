import axios from 'axios'

import {
  clientEnv,
} from '../config/env'

/*
|--------------------------------------------------------------------------
| API Base URL
|--------------------------------------------------------------------------
|
| Development:
|
| Browser → Vite /api/v1
| Vite → Backend
|
| Production:
|
| Browser → configured API URL
|
*/

const apiBaseUrl =
  import.meta.env.DEV
    ? '/api/v1'
    : clientEnv.VITE_API_URL

export const API_AUTH_SESSION_INVALIDATED_EVENT =
  'epantry:auth-session-invalidated'

export const API_CUSTOMER_ACCESS_REQUIRED_EVENT =
  'epantry:customer-access-required'

export const API_NETWORK_ISSUE_EVENT =
  'epantry:network-issue'

export const API_NETWORK_RECOVERED_EVENT =
  'epantry:network-recovered'

let networkIssueActive =
  false

/*
|--------------------------------------------------------------------------
| Axios Client
|--------------------------------------------------------------------------
*/

export const apiClient =
  axios.create({
    baseURL:
      apiBaseUrl,

    timeout:
      15000,

    headers: {
      'Content-Type':
        'application/json',
    },

    withCredentials:
      true,
  })

/*
|--------------------------------------------------------------------------
| Request Metadata
|--------------------------------------------------------------------------
*/

function getRequestUrl(
  error,
) {
  return String(
    error?.config?.url ||
      '',
  )
}

function getRequestMethod(
  error,
) {
  const method =
    String(
      error?.config?.method ||
        '',
    )
      .trim()
      .toUpperCase()

  return method ||
    null
}

/*
|--------------------------------------------------------------------------
| Normalize API Path
|--------------------------------------------------------------------------
|
| error.config.url may be:
|
| /auth/session
|
| or:
|
| /api/v1/auth/session
|
| Normalize both to:
|
| /auth/session
|
*/

function normalizeRequestPath(
  requestUrl,
) {
  const value =
    String(
      requestUrl ||
        '',
    ).trim()

  if (!value) {
    return ''
  }

  let pathname =
    value

  try {
    const base =
      typeof window !==
      'undefined'
        ? window.location.origin
        : 'http://localhost'

    pathname =
      new URL(
        value,
        base,
      ).pathname
  } catch {
    pathname =
      value.split(
        '?',
      )[0]
  }

  return pathname.replace(
    /^\/api\/v1(?=\/|$)/,
    '',
  )
}

/*
|--------------------------------------------------------------------------
| Credential Exchange 401s
|--------------------------------------------------------------------------
|
| These endpoints may legitimately return 401 because a NEW credential
| supplied by the user is invalid/stale.
|
| That does NOT necessarily mean an already-existing EPANTRY HttpOnly
| session is invalid.
|
| Especially important:
|
| POST /auth/reauth
|
| A failed step-up attempt must not destroy the existing valid session.
|
*/

const CREDENTIAL_EXCHANGE_PATHS =
  new Set([
    '/auth/csrf',
    '/auth/session',
    '/auth/reauth',
    '/auth/register/request-otp',
    '/auth/register/verify-email',
    '/auth/register/complete',
  ])

/*
|--------------------------------------------------------------------------
| Session-invalidating 401 Messages
|--------------------------------------------------------------------------
|
| Only the authentication middleware owns session-invalid/expired meaning.
| Domain services may also use HTTP 401 for a missing domain actor/context;
| those responses must NOT destroy an otherwise-valid EPANTRY session.
|
*/

const SESSION_INVALIDATION_MESSAGES =
  new Set([
    'Authentication required.',
    'Your session is invalid or has expired. Please sign in again.',
  ])

/*
|--------------------------------------------------------------------------
| Should Current Session Be Invalidated?
|--------------------------------------------------------------------------
*/

function shouldInvalidateCurrentSession({
  error,
  status,
  requestUrl,
}) {
  if (
    status !==
    401
  ) {
    return false
  }

  if (
    typeof window ===
    'undefined'
  ) {
    return false
  }

  /*
  |--------------------------------------------------------------------------
  | Optional Per-request Escape Hatch
  |--------------------------------------------------------------------------
  |
  | Future credential exchanges may explicitly use:
  |
  | skipAuthSessionInvalidation: true
  |
  */

  if (
    error?.config
      ?.skipAuthSessionInvalidation ===
    true
  ) {
    return false
  }

  const requestPath =
    normalizeRequestPath(
      requestUrl,
    )

  if (
    CREDENTIAL_EXCHANGE_PATHS.has(
      requestPath,
    )
  ) {
    return false
  }

  const responseMessage =
    String(
      error?.response?.data
        ?.message ||
        '',
    ).trim()

  return SESSION_INVALIDATION_MESSAGES.has(
    responseMessage,
  )
}

/*
|--------------------------------------------------------------------------
| Response / Error Normalization
|--------------------------------------------------------------------------
*/

apiClient.interceptors.response.use(
  (
    response,
  ) => {
    if (
      networkIssueActive &&
      typeof window !==
        'undefined' &&
      (
        typeof navigator ===
          'undefined' ||
        navigator.onLine !==
          false
      )
    ) {
      networkIssueActive =
        false

      window.dispatchEvent(
        new CustomEvent(
          API_NETWORK_RECOVERED_EVENT,
        ),
      )
    }

    return response
  },

  (
    error,
  ) => {
    const status =
      error.response?.status ??
      null

    const requestUrl =
      getRequestUrl(
        error,
      )

    const requestMethod =
      getRequestMethod(
        error,
      )

    const offline =
      status === null &&
      typeof navigator !==
        'undefined' &&
      navigator.onLine ===
        false

    const timedOut =
      error.code ===
        'ECONNABORTED' ||
      error.code ===
        'ETIMEDOUT'

    const retryable =
      offline ||
      timedOut ||
      [
        502,
        503,
        504,
      ].includes(
        status,
      )

    const networkFailure =
      status === null &&
      error.code !==
        'ERR_CANCELED'

    if (
      networkFailure &&
      typeof window !==
        'undefined'
    ) {
      networkIssueActive =
        true

      window.dispatchEvent(
        new CustomEvent(
          API_NETWORK_ISSUE_EVENT,
        ),
      )
    }

    const normalizedError = {
      status,

      code:
        offline
          ? 'NETWORK_OFFLINE'
          : error.code ||
            null,

      message:
        offline
          ? 'You appear to be offline. Reconnect and retry this action.'
          : timedOut
            ? 'The request timed out. Check your connection and retry.'
            : error.response?.data
                ?.message ||
              error.message ||
              'Something went wrong',

      offline,

      retryable,

      requestId:
        error.response?.data
          ?.requestId ||
        error.response?.headers?.[
          'x-request-id'
        ] ||
        null,

      errors:
        Array.isArray(
          error.response?.data
            ?.errors,
        )
          ? error.response
              .data
              .errors
          : [],

      requestUrl:
        requestUrl ||
        null,

      requestMethod,
    }

    /*
    |--------------------------------------------------------------------------
    | Global Session Invalidation
    |--------------------------------------------------------------------------
    |
    | Protected endpoint 401:
    |
    | Server session is invalid/expired
    | → AuthContext clears current user.
    |
    | Credential exchange 401:
    |
    | New credential attempt failed
    | → existing session remains untouched.
    |
    */

    const customerContextRequired =
      status ===
        403 &&
      normalizedError.errors.some(
        (entry) =>
          entry?.code ===
          'AUTH_CUSTOMER_CONTEXT_REQUIRED',
      )

    if (
      customerContextRequired &&
      typeof window !==
        'undefined'
    ) {
      window.dispatchEvent(
        new CustomEvent(
          API_CUSTOMER_ACCESS_REQUIRED_EVENT,
          {
            detail: {
              returnTo:
                `${window.location.pathname}${window.location.search}${window.location.hash}`,
            },
          },
        ),
      )
    }

    if (
      shouldInvalidateCurrentSession({
        error,

        status,

        requestUrl,
      })
    ) {
      window.dispatchEvent(
        new CustomEvent(
          API_AUTH_SESSION_INVALIDATED_EVENT,

          {
            detail: {
              status,

              requestUrl:
                requestUrl ||
                null,

              requestMethod,
            },
          },
        ),
      )
    }

    return Promise.reject(
      normalizedError,
    )
  },
)