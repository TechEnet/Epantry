import crypto from 'crypto'

import { ApiError } from '../../utils/ApiError.js'

import {
  assertHostOperationsPermission,
  resolveHostOperationsContext,
} from './hostOperations.service.js'

import {
  HostApiCredential,
  HostOperationsAuditEvent,
  HostServiceAccount,
  HostWebhookEndpoint,
} from './hostOperations.integration.models.js'

function stringifyId(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null
  }

  return String(
    value?._id ||
      value?.id ||
      value,
  )
}

function actorId(actorUser) {
  const value =
    actorUser?._id ||
    actorUser?.id

  if (!value) {
    throw new ApiError(
      401,
      'Authenticated Host identity is required.',
      [
        {
          code:
            'HOST_INTEGRATION_ACTOR_REQUIRED',
        },
      ],
    )
  }

  return value
}

function unique(values) {
  return [
    ...new Set(
      (
        Array.isArray(values)
          ? values
          : []
      )
        .map(
          (value) =>
            String(
              value ||
                '',
            ).trim(),
        )
        .filter(Boolean),
    ),
  ]
}

function sha256(value) {
  return crypto
    .createHash(
      'sha256',
    )
    .update(
      String(value),
    )
    .digest(
      'hex',
    )
}

function serializeServiceAccount(value) {
  const item =
    typeof value?.toObject ===
    'function'
      ? value.toObject()
      : value

  if (!item) {
    return null
  }

  return {
    id:
      stringifyId(
        item._id ||
          item.id,
      ),

    organizationId:
      stringifyId(
        item.organizationId,
      ),

    name:
      item.name,

    description:
      item.description ||
      '',

    scopes:
      item.scopes ||
      [],

    status:
      item.status,

    createdAt:
      item.createdAt ||
      null,

    updatedAt:
      item.updatedAt ||
      null,
  }
}

function serializeCredential(value) {
  const item =
    typeof value?.toObject ===
    'function'
      ? value.toObject()
      : value

  if (!item) {
    return null
  }

  return {
    id:
      stringifyId(
        item._id ||
          item.id,
      ),

    serviceAccountId:
      stringifyId(
        item.serviceAccountId,
      ),

    keyPrefix:
      item.keyPrefix,

    maskedKey:
      `${item.keyPrefix}...${item.secretLast4}`,

    status:
      item.status,

    createdAt:
      item.createdAt ||
      null,

    revokedAt:
      item.revokedAt ||
      null,
  }
}

function serializeWebhook(value) {
  const item =
    typeof value?.toObject ===
    'function'
      ? value.toObject()
      : value

  if (!item) {
    return null
  }

  return {
    id:
      stringifyId(
        item._id ||
          item.id,
      ),

    organizationId:
      stringifyId(
        item.organizationId,
      ),

    name:
      item.name,

    endpointUrl:
      item.endpointUrl,

    eventTypes:
      item.eventTypes ||
      [],

    status:
      item.status,

    maskedSigningSecret:
      `whsec_...${item.signingSecretLast4}`,

    lastDeliveryAt:
      item.lastDeliveryAt ||
      null,

    lastDeliveryStatus:
      item.lastDeliveryStatus ||
      'never',

    createdAt:
      item.createdAt ||
      null,

    updatedAt:
      item.updatedAt ||
      null,
  }
}

async function auditHostOperation({
  organizationId,
  actorUser,
  action,
  entityType,
  entityId,
  requestId = '',
  metadata = {},
}) {
  return HostOperationsAuditEvent.create({
    organizationId,

    actorType:
      'host_user',

    actorUserId:
      actorId(
        actorUser,
      ),

    action,
    entityType,

    entityId:
      String(
        entityId,
      ),

    requestId:
      String(
        requestId ||
          '',
      ),

    metadata,
  })
}

function createApiToken() {
  const prefix =
    `ep_live_${crypto
      .randomBytes(6)
      .toString('hex')}`

  const secret =
    crypto
      .randomBytes(32)
      .toString(
        'base64url',
      )

  const token =
    `${prefix}.${secret}`

  return {
    prefix,
    secret,
    token,

    hash:
      sha256(
        token,
      ),

    last4:
      secret.slice(
        -4,
      ),
  }
}

function getWebhookEncryptionKey() {
  const raw =
    String(
      process.env
        .HOST_WEBHOOK_SECRET_ENCRYPTION_KEY ||
        '',
    ).trim()

  if (!raw) {
    throw new ApiError(
      503,
      'Webhook secret encryption is not configured.',
      [
        {
          code:
            'HOST_WEBHOOK_ENCRYPTION_KEY_NOT_CONFIGURED',

          requiredEnvironmentVariable:
            'HOST_WEBHOOK_SECRET_ENCRYPTION_KEY',
        },
      ],
    )
  }

  let key =
    null

  if (
    /^[a-f\d]{64}$/i.test(
      raw,
    )
  ) {
    key =
      Buffer.from(
        raw,
        'hex',
      )
  } else {
    try {
      const decoded =
        Buffer.from(
          raw,
          'base64',
        )

      if (
        decoded.length ===
        32
      ) {
        key =
          decoded
      }
    } catch {
      key =
        null
    }
  }

  if (
    !key ||
    key.length !==
      32
  ) {
    throw new ApiError(
      503,
      'Webhook encryption key must be exactly 32 bytes encoded as 64 hex characters or base64.',
      [
        {
          code:
            'HOST_WEBHOOK_ENCRYPTION_KEY_INVALID',
        },
      ],
    )
  }

  return key
}

function encryptWebhookSecret(secret) {
  const key =
    getWebhookEncryptionKey()

  const iv =
    crypto.randomBytes(
      12,
    )

  const cipher =
    crypto.createCipheriv(
      'aes-256-gcm',
      key,
      iv,
    )

  const ciphertext =
    Buffer.concat([
      cipher.update(
        secret,
        'utf8',
      ),

      cipher.final(),
    ])

  const authTag =
    cipher.getAuthTag()

  return {
    ciphertext:
      ciphertext.toString(
        'base64',
      ),

    iv:
      iv.toString(
        'base64',
      ),

    authTag:
      authTag.toString(
        'base64',
      ),
  }
}

export function decryptHostWebhookSigningSecret(webhook) {
  const key =
    getWebhookEncryptionKey()

  const decipher =
    crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(
        webhook.signingSecretIv,
        'base64',
      ),
    )

  decipher.setAuthTag(
    Buffer.from(
      webhook.signingSecretAuthTag,
      'base64',
    ),
  )

  const plaintext =
    Buffer.concat([
      decipher.update(
        Buffer.from(
          webhook.signingSecretCiphertext,
          'base64',
        ),
      ),

      decipher.final(),
    ])

  return plaintext.toString(
    'utf8',
  )
}

function createWebhookSecret() {
  return `whsec_${crypto
    .randomBytes(32)
    .toString('base64url')}`
}

function validateWebhookUrl(endpointUrl) {
  const parsed =
    new URL(
      endpointUrl,
    )

  const isLocalDev =
    [
      'localhost',
      '127.0.0.1',
      '::1',
    ].includes(
      parsed.hostname,
    ) &&
    process.env.NODE_ENV !==
      'production'

  if (
    parsed.protocol !==
      'https:' &&
    !isLocalDev
  ) {
    throw new ApiError(
      400,
      'Webhook endpoints must use HTTPS.',
      [
        {
          code:
            'HOST_WEBHOOK_HTTPS_REQUIRED',
        },
      ],
    )
  }

  return parsed.toString()
}

export async function listHostServiceAccounts({
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'api.read',
  )

  const accounts =
    await HostServiceAccount.find({
      organizationId:
        context.organization._id,
    })
      .sort({
        createdAt: -1,
      })
      .lean()

  const credentials =
    await HostApiCredential.find({
      organizationId:
        context.organization._id,

      serviceAccountId: {
        $in:
          accounts.map(
            (account) =>
              account._id,
          ),
      },
    })
      .sort({
        createdAt: -1,
      })
      .lean()

  const credentialsByAccount =
    new Map()

  for (const credential of credentials) {
    const key =
      stringifyId(
        credential.serviceAccountId,
      )

    if (
      !credentialsByAccount.has(
        key,
      )
    ) {
      credentialsByAccount.set(
        key,
        [],
      )
    }

    credentialsByAccount
      .get(key)
      .push(
        serializeCredential(
          credential,
        ),
      )
  }

  return {
    serviceAccounts:
      accounts.map(
        (account) => ({
          ...serializeServiceAccount(
            account,
          ),

          credentials:
            credentialsByAccount.get(
              stringifyId(
                account._id,
              ),
            ) ||
            [],
        }),
      ),
  }
}

export async function createHostServiceAccount({
  input,
  actorUser,
  requestId,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'api.manage',
  )

  const userId =
    actorId(
      actorUser,
    )

  const scopes =
    unique(
      input.scopes,
    )

  const account =
    await HostServiceAccount.create({
      organizationId:
        context.organization._id,

      name:
        input.name,

      description:
        input.description,

      scopes,

      status:
        'active',

      createdByUserId:
        userId,

      updatedByUserId:
        userId,
    })

  const token =
    createApiToken()

  const credential =
    await HostApiCredential.create({
      organizationId:
        context.organization._id,

      serviceAccountId:
        account._id,

      keyPrefix:
        token.prefix,

      secretHashSha256:
        token.hash,

      secretLast4:
        token.last4,

      status:
        'active',

      createdByUserId:
        userId,
    })

  await auditHostOperation({
    organizationId:
      context.organization._id,

    actorUser,

    action:
      'service_account.created',

    entityType:
      'service_account',

    entityId:
      account._id,

    requestId,

    metadata: {
      scopes,

      credentialPrefix:
        token.prefix,
    },
  })

  return {
    serviceAccount:
      serializeServiceAccount(
        account,
      ),

    credential:
      serializeCredential(
        credential,
      ),

    apiKey:
      token.token,

    secretVisibility:
      'shown_once',
  }
}

export async function updateHostServiceAccount({
  serviceAccountId,
  input,
  actorUser,
  requestId,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'api.manage',
  )

  const account =
    await HostServiceAccount.findOne({
      _id:
        serviceAccountId,

      organizationId:
        context.organization._id,
    })

  if (!account) {
    throw new ApiError(
      404,
      'Service Account was not found.',
      [
        {
          code:
            'HOST_SERVICE_ACCOUNT_NOT_FOUND',
        },
      ],
    )
  }

  if (input.status) {
    account.status =
      input.status
  }

  if (
    input.description !==
    undefined
  ) {
    account.description =
      input.description
  }

  if (input.scopes) {
    account.scopes =
      unique(
        input.scopes,
      )
  }

  account.updatedByUserId =
    actorId(
      actorUser,
    )

  await account.save()

  await auditHostOperation({
    organizationId:
      context.organization._id,

    actorUser,

    action:
      'service_account.updated',

    entityType:
      'service_account',

    entityId:
      account._id,

    requestId,

    metadata: {
      status:
        account.status,

      scopes:
        account.scopes,
    },
  })

  return {
    serviceAccount:
      serializeServiceAccount(
        account,
      ),
  }
}

export async function rotateHostServiceAccountCredential({
  serviceAccountId,
  actorUser,
  requestId,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'api.manage',
  )

  const account =
    await HostServiceAccount.findOne({
      _id:
        serviceAccountId,

      organizationId:
        context.organization._id,

      status:
        'active',
    })

  if (!account) {
    throw new ApiError(
      404,
      'Active Service Account was not found.',
      [
        {
          code:
            'HOST_SERVICE_ACCOUNT_NOT_FOUND',
        },
      ],
    )
  }

  const userId =
    actorId(
      actorUser,
    )

  const activeCredentials =
    await HostApiCredential.find({
      organizationId:
        context.organization._id,

      serviceAccountId:
        account._id,

      status:
        'active',
    })

  for (const credential of activeCredentials) {
    credential.status =
      'revoked'

    credential.revokedByUserId =
      userId

    credential.revokedAt =
      new Date()

    await credential.save()
  }

  const token =
    createApiToken()

  const credential =
    await HostApiCredential.create({
      organizationId:
        context.organization._id,

      serviceAccountId:
        account._id,

      keyPrefix:
        token.prefix,

      secretHashSha256:
        token.hash,

      secretLast4:
        token.last4,

      status:
        'active',

      createdByUserId:
        userId,
    })

  await auditHostOperation({
    organizationId:
      context.organization._id,

    actorUser,

    action:
      'service_account.credential_rotated',

    entityType:
      'service_account',

    entityId:
      account._id,

    requestId,

    metadata: {
      credentialPrefix:
        token.prefix,
    },
  })

  return {
    serviceAccount:
      serializeServiceAccount(
        account,
      ),

    credential:
      serializeCredential(
        credential,
      ),

    apiKey:
      token.token,

    secretVisibility:
      'shown_once',
  }
}

export async function authenticateHostApiCredential(rawToken) {
  const token =
    String(
      rawToken ||
        '',
    ).trim()

  const separatorIndex =
    token.indexOf(
      '.',
    )

  if (
    !token.startsWith(
      'ep_live_',
    ) ||
    separatorIndex <=
      0
  ) {
    return null
  }

  const prefix =
    token.slice(
      0,
      separatorIndex,
    )

  const credential =
    await HostApiCredential.findOne({
      keyPrefix:
        prefix,

      status:
        'active',
    }).lean()

  if (!credential) {
    return null
  }

  const suppliedHash =
    sha256(
      token,
    )

  const expectedHash =
    String(
      credential.secretHashSha256 ||
        '',
    )

  const matches =
    suppliedHash.length ===
      expectedHash.length &&
    crypto.timingSafeEqual(
      Buffer.from(
        suppliedHash,
      ),
      Buffer.from(
        expectedHash,
      ),
    )

  if (!matches) {
    return null
  }

  const account =
    await HostServiceAccount.findOne({
      _id:
        credential.serviceAccountId,

      organizationId:
        credential.organizationId,

      status:
        'active',
    }).lean()

  if (!account) {
    return null
  }

  return {
    organizationId:
      stringifyId(
        account.organizationId,
      ),

    serviceAccountId:
      stringifyId(
        account._id,
      ),

    scopes:
      account.scopes ||
      [],

    credentialId:
      stringifyId(
        credential._id,
      ),
  }
}

export async function listHostWebhooks({
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'api.read',
  )

  const records =
    await HostWebhookEndpoint.find({
      organizationId:
        context.organization._id,
    })
      .sort({
        createdAt: -1,
      })
      .lean()

  return {
    webhooks:
      records.map(
        serializeWebhook,
      ),
  }
}

export async function createHostWebhook({
  input,
  actorUser,
  requestId,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'api.manage',
  )

  const signingSecret =
    createWebhookSecret()

  const encrypted =
    encryptWebhookSecret(
      signingSecret,
    )

  const userId =
    actorId(
      actorUser,
    )

  const webhook =
    await HostWebhookEndpoint.create({
      organizationId:
        context.organization._id,

      name:
        input.name,

      endpointUrl:
        validateWebhookUrl(
          input.endpointUrl,
        ),

      eventTypes:
        unique(
          input.eventTypes,
        ),

      status:
        'active',

      signingSecretCiphertext:
        encrypted.ciphertext,

      signingSecretIv:
        encrypted.iv,

      signingSecretAuthTag:
        encrypted.authTag,

      signingSecretLast4:
        signingSecret.slice(
          -4,
        ),

      createdByUserId:
        userId,

      updatedByUserId:
        userId,
    })

  await auditHostOperation({
    organizationId:
      context.organization._id,

    actorUser,

    action:
      'webhook.created',

    entityType:
      'organization_webhook',

    entityId:
      webhook._id,

    requestId,

    metadata: {
      eventTypes:
        webhook.eventTypes,

      endpointOrigin:
        new URL(
          webhook.endpointUrl,
        ).origin,
    },
  })

  return {
    webhook:
      serializeWebhook(
        webhook,
      ),

    signingSecret,

    secretVisibility:
      'shown_once',
  }
}

export async function updateHostWebhook({
  webhookId,
  input,
  actorUser,
  requestId,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'api.manage',
  )

  const webhook =
    await HostWebhookEndpoint.findOne({
      _id:
        webhookId,

      organizationId:
        context.organization._id,
    })

  if (!webhook) {
    throw new ApiError(
      404,
      'Webhook endpoint was not found.',
      [
        {
          code:
            'HOST_WEBHOOK_NOT_FOUND',
        },
      ],
    )
  }

  if (input.name) {
    webhook.name =
      input.name
  }

  if (input.endpointUrl) {
    webhook.endpointUrl =
      validateWebhookUrl(
        input.endpointUrl,
      )
  }

  if (input.eventTypes) {
    webhook.eventTypes =
      unique(
        input.eventTypes,
      )
  }

  if (input.status) {
    webhook.status =
      input.status
  }

  webhook.updatedByUserId =
    actorId(
      actorUser,
    )

  await webhook.save()

  await auditHostOperation({
    organizationId:
      context.organization._id,

    actorUser,

    action:
      'webhook.updated',

    entityType:
      'organization_webhook',

    entityId:
      webhook._id,

    requestId,

    metadata: {
      status:
        webhook.status,

      eventTypes:
        webhook.eventTypes,
    },
  })

  return {
    webhook:
      serializeWebhook(
        webhook,
      ),
  }
}

export async function rotateHostWebhookSecret({
  webhookId,
  actorUser,
  requestId,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'api.manage',
  )

  const webhook =
    await HostWebhookEndpoint.findOne({
      _id:
        webhookId,

      organizationId:
        context.organization._id,
    })

  if (!webhook) {
    throw new ApiError(
      404,
      'Webhook endpoint was not found.',
      [
        {
          code:
            'HOST_WEBHOOK_NOT_FOUND',
        },
      ],
    )
  }

  const signingSecret =
    createWebhookSecret()

  const encrypted =
    encryptWebhookSecret(
      signingSecret,
    )

  webhook.signingSecretCiphertext =
    encrypted.ciphertext

  webhook.signingSecretIv =
    encrypted.iv

  webhook.signingSecretAuthTag =
    encrypted.authTag

  webhook.signingSecretLast4 =
    signingSecret.slice(
      -4,
    )

  webhook.updatedByUserId =
    actorId(
      actorUser,
    )

  await webhook.save()

  await auditHostOperation({
    organizationId:
      context.organization._id,

    actorUser,

    action:
      'webhook.secret_rotated',

    entityType:
      'organization_webhook',

    entityId:
      webhook._id,

    requestId,
  })

  return {
    webhook:
      serializeWebhook(
        webhook,
      ),

    signingSecret,

    secretVisibility:
      'shown_once',
  }
}

export async function listHostOperationsAudit({
  page,
  limit,
  actorUser,
}) {
  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'organization.read',
  )

  const skip =
    (page - 1) *
    limit

  const [
    records,
    total,
  ] = await Promise.all([
    HostOperationsAuditEvent.find({
      organizationId:
        context.organization._id,
    })
      .sort({
        occurredAt: -1,
      })
      .skip(skip)
      .limit(limit)
      .lean(),

    HostOperationsAuditEvent.countDocuments({
      organizationId:
        context.organization._id,
    }),
  ])

  return {
    events:
      records.map(
        (event) => ({
          id:
            stringifyId(
              event._id,
            ),

          actorType:
            event.actorType,

          actorUserId:
            stringifyId(
              event.actorUserId,
            ),

          serviceAccountId:
            stringifyId(
              event.serviceAccountId,
            ),

          action:
            event.action,

          entityType:
            event.entityType,

          entityId:
            event.entityId,

          metadata:
            event.metadata ||
            {},

          occurredAt:
            event.occurredAt,
        }),
      ),

    pagination: {
      page,
      limit,
      total,

      pages:
        total
          ? Math.ceil(
              total /
                limit,
            )
          : 0,
    },
  }
}