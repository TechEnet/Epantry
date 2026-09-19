import crypto from 'node:crypto'

import {
  z,
} from 'zod'

import {
  env,
} from '../../config/env.js'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  HouseholdMembership,
} from '../households/householdMembership.model.js'

import {
  getPurchaseSourceForUser,
} from './purchaseSource.service.js'

import {
  activatePurchaseSourceFromAdapter,
  ingestNormalizedPurchaseBatch,
  markPurchaseSourceReauthorizationRequired,
} from './purchaseSource.ingestion.service.js'

import {
  normalizedPurchaseBatchSchema,
} from './purchaseSource.validation.js'

const INTEGRATION_SIGNATURE_HEADER =
  'x-epantry-integration-signature'

const INTEGRATION_TIMESTAMP_HEADER =
  'x-epantry-integration-timestamp'

const integrationImportSchema =
  z.object({
    userId:
      z.string()
        .trim()
        .regex(
          /^[a-f\d]{24}$/i,
          'Integration user id is invalid.',
        ),

    providerAccountRef:
      z.string()
        .trim()
        .min(1)
        .max(500),

    adapterKey:
      z.string()
        .trim()
        .min(1)
        .max(80),

    batch:
      normalizedPurchaseBatchSchema,
  })
    .strict()

function getGatewayConfiguration() {
  const gatewayUrl =
    String(
      env.purchaseSourceIntegrationGatewayUrl ||
      '',
    )
      .trim()
      .replace(
        /\/+$/,
        '',
      )

  const hmacSecret =
    String(
      env.purchaseSourceIntegrationHmacSecret ||
      '',
    ).trim()

  return {
    gatewayUrl,
    hmacSecret,
    configured:
      Boolean(
        gatewayUrl &&
        hmacSecret,
      ),
  }
}

function canonicalizeJson(
  value,
) {
  if (
    value === null ||
    typeof value !==
      'object'
  ) {
    return JSON.stringify(
      value,
    )
  }

  if (
    Array.isArray(
      value,
    )
  ) {
    return `[${value
      .map(
        canonicalizeJson,
      )
      .join(',')}]`
  }

  const keys =
    Object.keys(
      value,
    )
      .sort()

  return `{${keys
    .map(
      (key) =>
        `${JSON.stringify(
          key,
        )}:${canonicalizeJson(
          value[key],
        )}`,
    )
    .join(',')}}`
}

function hmacHex(
  secret,
  message,
) {
  return crypto
    .createHmac(
      'sha256',
      secret,
    )
    .update(
      message,
      'utf8',
    )
    .digest(
      'hex',
    )
}

function safeEqualHex(
  left,
  right,
) {
  if (
    !/^[a-f\d]{64}$/i.test(
      left ||
      '',
    ) ||
    !/^[a-f\d]{64}$/i.test(
      right ||
      '',
    )
  ) {
    return false
  }

  return crypto.timingSafeEqual(
    Buffer.from(
      left,
      'hex',
    ),
    Buffer.from(
      right,
      'hex',
    ),
  )
}

function encodeSignedHandoff(
  payload,
  secret,
) {
  const encodedPayload =
    Buffer.from(
      JSON.stringify(
        payload,
      ),
      'utf8',
    )
      .toString(
        'base64url',
      )

  const signature =
    hmacHex(
      secret,
      encodedPayload,
    )

  return `${encodedPayload}.${signature}`
}

function createGatewayRequestHeaders({
  body,
  hmacSecret,
}) {
  const timestamp =
    String(
      Math.floor(
        Date.now() /
        1000,
      ),
    )

  const canonicalBody =
    canonicalizeJson(
      body,
    )

  const signature =
    hmacHex(
      hmacSecret,
      `${timestamp}.${canonicalBody}`,
    )

  return {
    'content-type':
      'application/json',

    [INTEGRATION_TIMESTAMP_HEADER]:
      timestamp,

    [INTEGRATION_SIGNATURE_HEADER]:
      signature,
  }
}

async function postGatewayCommand({
  path,
  body,
}) {
  const {
    gatewayUrl,
    hmacSecret,
    configured,
  } =
    getGatewayConfiguration()

  if (!configured) {
    throw new ApiError(
      503,
      'Purchase-source provider gateway is not configured.',
    )
  }

  let response

  try {
    response =
      await fetch(
        `${gatewayUrl}${path}`,
        {
          method:
            'POST',

          headers:
            createGatewayRequestHeaders({
              body,
              hmacSecret,
            }),

          body:
            JSON.stringify(
              body,
            ),

          signal:
            AbortSignal.timeout(
              env.purchaseSourceIntegrationTimeoutMs,
            ),
        },
      )
  } catch (error) {
    throw new ApiError(
      502,
      'Purchase-source provider gateway is unavailable.',
      [
        {
          code:
            'PURCHASE_SOURCE_GATEWAY_UNAVAILABLE',

          detail:
            error?.message ||
            'Gateway request failed.',
        },
      ],
    )
  }

  if (!response.ok) {
    throw new ApiError(
      502,
      'Purchase-source provider gateway rejected the request.',
      [
        {
          code:
            'PURCHASE_SOURCE_GATEWAY_REJECTED',

          status:
            response.status,
        },
      ],
    )
  }

  const contentType =
    response.headers.get(
      'content-type',
    ) ||
    ''

  if (
    contentType.includes(
      'application/json',
    )
  ) {
    return response.json()
  }

  return null
}

export function getPurchaseSourceProviderCapabilities() {
  const {
    configured,
  } =
    getGatewayConfiguration()

  return {
    providers: [
      {
        provider:
          'gmail',
        label:
          'Gmail',
        available:
          configured,
        authorizationRequired:
          true,
      },
      {
        provider:
          'outlook',
        label:
          'Outlook',
        available:
          configured,
        authorizationRequired:
          true,
      },
      {
        provider:
          'retailer',
        label:
          'Supported retailer',
        available:
          configured,
        authorizationRequired:
          true,
      },
      {
        provider:
          'receipt_import',
        label:
          'Receipt import',
        available:
          true,
        authorizationRequired:
          false,
      },
    ],

    gatewayConfigured:
      configured,
  }
}

export async function createPurchaseSourceAuthorizationHandoff({
  actorUser,
  sourceId,
}) {
  const source =
    await getPurchaseSourceForUser({
      actorUser,
      sourceId,
    })

  const activeMembership =
    await HouseholdMembership.findOne({
      userId:
        actorUser._id ||
        actorUser.id,
      householdId:
        source.householdId,
      status:
        'active',
    })
      .select({
        _id:
          1,
      })
      .lean()

  if (!activeMembership) {
    throw new ApiError(
      403,
      'Provider authorization requires active membership in the target household.',
    )
  }

  if (
    source.provider ===
    'receipt_import'
  ) {
    throw new ApiError(
      409,
      'Receipt import does not require provider authorization.',
    )
  }

  if (
    ![
      'pending_authorization',
      'reauthorization_required',
    ].includes(
      source.status,
    )
  ) {
    throw new ApiError(
      409,
      'This purchase source is not waiting for provider authorization.',
    )
  }

  const {
    gatewayUrl,
    hmacSecret,
    configured,
  } =
    getGatewayConfiguration()

  if (!configured) {
    throw new ApiError(
      503,
      'Gmail, Outlook and retailer connections require the configured EPANTRY purchase-source integration gateway.',
    )
  }

  const expiresAt =
    Math.floor(
      Date.now() /
      1000,
    ) +
    10 * 60

  const handoff =
    encodeSignedHandoff(
      {
        version:
          1,
        sourceId:
          source.sourceId,
        userId:
          String(
            actorUser._id ||
            actorUser.id,
          ),
        provider:
          source.provider,
        expiresAt,
        returnUrl:
          `${env.frontendUrl.replace(/\/$/, '')}/account/purchase-intelligence`,
      },
      hmacSecret,
    )

  return {
    provider:
      source.provider,

    authorizationUrl:
      `${gatewayUrl}/authorize?handoff=${encodeURIComponent(
        handoff,
      )}`,

    expiresAt:
      new Date(
        expiresAt *
        1000,
      ).toISOString(),
  }
}

export function verifyPurchaseSourceIntegrationSignature({
  headers,
  body,
}) {
  const {
    hmacSecret,
    configured,
  } =
    getGatewayConfiguration()

  if (!configured) {
    throw new ApiError(
      503,
      'Purchase-source provider gateway is not configured.',
    )
  }

  const timestamp =
    String(
      headers?.[
        INTEGRATION_TIMESTAMP_HEADER
      ] ||
      '',
    ).trim()

  const signature =
    String(
      headers?.[
        INTEGRATION_SIGNATURE_HEADER
      ] ||
      '',
    ).trim()

  const timestampSeconds =
    Number(
      timestamp,
    )

  if (
    !Number.isFinite(
      timestampSeconds,
    )
  ) {
    throw new ApiError(
      401,
      'Integration timestamp is invalid.',
    )
  }

  const nowSeconds =
    Math.floor(
      Date.now() /
      1000,
    )

  if (
    Math.abs(
      nowSeconds -
      timestampSeconds,
    ) >
    env.purchaseSourceIntegrationSignatureSkewSeconds
  ) {
    throw new ApiError(
      401,
      'Integration request timestamp is outside the accepted window.',
    )
  }

  const expectedSignature =
    hmacHex(
      hmacSecret,
      `${timestamp}.${canonicalizeJson(
        body ||
        {},
      )}`,
    )

  if (
    !safeEqualHex(
      signature,
      expectedSignature,
    )
  ) {
    throw new ApiError(
      401,
      'Integration request signature is invalid.',
    )
  }
}

export async function completePurchaseSourceIntegrationImport({
  sourceId,
  payload,
}) {
  const parsed =
    integrationImportSchema.safeParse(
      payload ||
      {},
    )

  if (!parsed.success) {
    throw new ApiError(
      400,
      parsed.error
        ?.issues?.[0]
        ?.message ||
        'Invalid provider import payload.',
    )
  }

  const {
    userId,
    providerAccountRef,
    adapterKey,
    batch,
  } =
    parsed.data

  await activatePurchaseSourceFromAdapter({
    sourceId,
    userId,
    providerAccountRef,
    adapterKey,
  })

  return ingestNormalizedPurchaseBatch({
    sourceId,
    userId,
    payload:
      batch,
  })
}

export async function requestPurchaseSourceGatewaySync({
  actorUser,
  sourceId,
}) {
  const source =
    await getPurchaseSourceForUser({
      actorUser,
      sourceId,
    })

  if (
    source.provider ===
    'receipt_import'
  ) {
    throw new ApiError(
      409,
      'Receipt import does not support provider sync.',
    )
  }

  if (
    source.status !==
    'connected'
  ) {
    throw new ApiError(
      409,
      'Only a connected purchase source can request synchronization.',
    )
  }

  const response =
    await postGatewayCommand({
      path:
        '/v1/purchase-sources/sync',

      body: {
        sourceId:
          source.sourceId,
        userId:
          String(
            actorUser._id ||
            actorUser.id,
          ),
        provider:
          source.provider,
      },
    })

  return {
    accepted:
      true,
    gateway:
      response ||
      null,
  }
}

export async function notifyPurchaseSourceGatewayLifecycle({
  actorUser,
  source,
  action,
}) {
  if (
    source?.provider ===
    'receipt_import'
  ) {
    return {
      notified:
        false,
      reason:
        'local_source',
    }
  }

  const {
    configured,
  } =
    getGatewayConfiguration()

  if (!configured) {
    return {
      notified:
        false,
      reason:
        'gateway_not_configured',
    }
  }

  try {
    await postGatewayCommand({
      path:
        '/v1/purchase-sources/lifecycle',

      body: {
        sourceId:
          source.sourceId,
        userId:
          String(
            actorUser._id ||
            actorUser.id,
          ),
        provider:
          source.provider,
        action,
      },
    })

    return {
      notified:
        true,
      reason:
        null,
    }
  } catch (error) {
    return {
      notified:
        false,
      reason:
        error?.message ||
        'gateway_notification_failed',
    }
  }
}

export async function markPurchaseSourceGatewayNeedsReauthorization({
  sourceId,
  userId,
  errorCode,
}) {
  return markPurchaseSourceReauthorizationRequired({
    sourceId,
    userId,
    errorCode,
  })
}
