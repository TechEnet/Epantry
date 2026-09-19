import {
  ApiError,
} from '../../utils/ApiError.js'

/*
|--------------------------------------------------------------------------
| Actor ID
|--------------------------------------------------------------------------
*/

function normalizeActorId(
  value,
) {
  return String(
    value ||
      '',
  ).trim()
}

/*
|--------------------------------------------------------------------------
| Maker / Checker Separation
|--------------------------------------------------------------------------
|
| This is the reusable invariant for the future approval workflow.
|
| It is intentionally independent from MongoDB because actor separation is a
| policy rule, not a persistence concern.
|
*/

export function assertDistinctMakerCheckerActors({
  makerUserId,
  checkerUserId,
}) {
  const normalizedMakerUserId =
    normalizeActorId(
      makerUserId,
    )

  const normalizedCheckerUserId =
    normalizeActorId(
      checkerUserId,
    )

  if (
    !normalizedMakerUserId ||
    !normalizedCheckerUserId
  ) {
    throw new ApiError(
      400,
      'Maker and checker identities are required.',
      [
        {
          code:
            'ADMIN_MAKER_CHECKER_ACTOR_REQUIRED',
        },
      ],
    )
  }

  if (
    normalizedMakerUserId ===
    normalizedCheckerUserId
  ) {
    throw new ApiError(
      409,
      'The maker cannot approve their own privileged action.',
      [
        {
          code:
            'ADMIN_MAKER_CHECKER_SELF_APPROVAL_FORBIDDEN',
        },
      ],
    )
  }

  return {
    makerUserId:
      normalizedMakerUserId,

    checkerUserId:
      normalizedCheckerUserId,
  }
}

/*
|--------------------------------------------------------------------------
| Request Header
|--------------------------------------------------------------------------
*/

function readRequestHeader(
  req,
  headerName,
) {
  if (
    typeof req?.get ===
    'function'
  ) {
    return req.get(
      headerName,
    )
  }

  const headers =
    req?.headers ||
    {}

  return (
    headers[
      headerName.toLowerCase()
    ] ||
    null
  )
}

/*
|--------------------------------------------------------------------------
| Truthy Header
|--------------------------------------------------------------------------
*/

function isTruthyHeaderValue(
  value,
) {
  const normalized =
    String(
      value ||
        '',
    )
      .trim()
      .toLowerCase()

  return [
    '1',
    'true',
    'yes',
    'active',
  ].includes(
    normalized,
  )
}

/*
|--------------------------------------------------------------------------
| Detect Privileged Impersonation
|--------------------------------------------------------------------------
|
| Current EPANTRY does not expose an impersonation feature.
|
| These checks are deliberate future-proofing:
|
| - internal request context
| - future admin impersonation context
| - explicit impersonation target
| - reserved EPANTRY impersonation headers
|
| Privileged admin requests always fail closed if impersonation is detected.
|
*/

export function detectPrivilegedImpersonation(
  req,
) {
  const internalContextActive =
    req?.impersonationContext
      ?.active ===
      true ||
    req?.adminImpersonation
      ?.active ===
      true ||
    Boolean(
      req?.impersonatedUserId,
    )

  const headerTarget =
    String(
      readRequestHeader(
        req,
        'x-epantry-impersonated-user-id',
      ) ||
        '',
    ).trim()

  const headerFlag =
    readRequestHeader(
      req,
      'x-epantry-impersonation',
    )

  const headerContextActive =
    Boolean(
      headerTarget,
    ) ||
    isTruthyHeaderValue(
      headerFlag,
    )

  const active =
    internalContextActive ||
    headerContextActive

  let source =
    null

  if (
    internalContextActive
  ) {
    source =
      'request_context'
  } else if (
    headerContextActive
  ) {
    source =
      'request_header'
  }

  const targetUserId =
    normalizeActorId(
      req?.impersonationContext
        ?.targetUserId ||
      req?.adminImpersonation
        ?.targetUserId ||
      req?.impersonatedUserId ||
      headerTarget,
    ) ||
    null

  return {
    active,

    source,

    targetUserId,
  }
}

/*
|--------------------------------------------------------------------------
| Assert No Privileged Impersonation
|--------------------------------------------------------------------------
*/

export function assertNoPrivilegedImpersonation(
  req,
) {
  const context =
    detectPrivilegedImpersonation(
      req,
    )

  if (
    context.active
  ) {
    throw new ApiError(
      403,
      'Privileged administrative actions cannot be performed while impersonating another user.',
      [
        {
          code:
            'ADMIN_PRIVILEGED_IMPERSONATION_FORBIDDEN',

          source:
            context.source,

          targetUserId:
            context.targetUserId,
        },
      ],
    )
  }

  return context
}

/*
|--------------------------------------------------------------------------
| Express Middleware
|--------------------------------------------------------------------------
*/

export function rejectPrivilegedImpersonation(
  req,
  res,
  next,
) {
  try {
    assertNoPrivilegedImpersonation(
      req,
    )

    return next()
  } catch (error) {
    return next(
      error,
    )
  }
}