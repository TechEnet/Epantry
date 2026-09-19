import crypto from 'node:crypto'

import {
  ApiError,
} from '../../utils/ApiError.js'

function envValue(
  name,
) {
  return String(
    process.env[name] ||
      '',
  ).trim()
}

function timingSafeHexEqual(
  left,
  right,
) {
  let leftBuffer
  let rightBuffer

  try {
    leftBuffer =
      Buffer.from(
        String(
          left ||
            '',
        ),
        'hex',
      )

    rightBuffer =
      Buffer.from(
        String(
          right ||
            '',
        ),
        'hex',
      )
  } catch {
    return false
  }

  if (
    leftBuffer.length ===
      0 ||
    leftBuffer.length !==
      rightBuffer.length
  ) {
    return false
  }

  return crypto.timingSafeEqual(
    leftBuffer,
    rightBuffer,
  )
}

function razorpayBaseUrl() {
  return (
    envValue(
      'RAZORPAY_BASE_URL',
    ) ||
    'https://api.razorpay.com'
  ).replace(
    /\/+$/,
    '',
  )
}

function razorpayAuthorization() {
  const keyId =
    envValue(
      'RAZORPAY_KEY_ID',
    )

  const keySecret =
    envValue(
      'RAZORPAY_KEY_SECRET',
    )

  if (
    !keyId ||
    !keySecret
  ) {
    return ''
  }

  return Buffer.from(
    `${keyId}:${keySecret}`,
  ).toString(
    'base64',
  )
}

function requireRazorpayConfiguration() {
  const publicConfig =
    getRazorpayPublicConfig()

  const authorization =
    razorpayAuthorization()

  if (
    !publicConfig.configured ||
    !authorization
  ) {
    throw new ApiError(
      503,
      'Payment provider is not configured.',
      [
        {
          code:
            'PAYMENT_PROVIDER_NOT_CONFIGURED',
        },
      ],
    )
  }

  return {
    publicConfig,
    authorization,
    baseUrl:
      razorpayBaseUrl(),
  }
}

async function parseProviderJson(
  response,
) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export function getRazorpayPublicConfig() {
  const keyId =
    envValue(
      'RAZORPAY_KEY_ID',
    )

  const keySecret =
    envValue(
      'RAZORPAY_KEY_SECRET',
    )

  return {
    provider:
      'razorpay',

    configured:
      Boolean(
        keyId &&
        keySecret,
      ),

    keyId:
      keyId &&
      keySecret
        ? keyId
        : '',
  }
}

export function isRazorpayConfigured() {
  return getRazorpayPublicConfig()
    .configured
}

export async function createRazorpayOrder({
  amountMinor,
  currency,
  receipt,
  notes =
    {},
}) {
  const {
    publicConfig,
    authorization,
    baseUrl,
  } =
    requireRazorpayConfiguration()

  const amount =
    Number(
      amountMinor,
    )

  if (
    !Number.isInteger(
      amount,
    ) ||
    amount <=
      0
  ) {
    throw new ApiError(
      409,
      'Order amount is not payable.',
      [
        {
          code:
            'PAYMENT_AMOUNT_INVALID',
        },
      ],
    )
  }

  let response

  try {
    response =
      await fetch(
        `${baseUrl}/v1/orders`,
        {
          method:
            'POST',

          headers: {
            authorization:
              `Basic ${authorization}`,

            'content-type':
              'application/json',

            accept:
              'application/json',
          },

          body:
            JSON.stringify({
              amount,

              currency:
                String(
                  currency ||
                    'INR',
                ).toUpperCase(),

              receipt:
                String(
                  receipt ||
                    '',
                ).slice(
                  0,
                  40,
                ),

              notes,
            }),
        },
      )
  } catch {
    throw new ApiError(
      502,
      'Payment provider could not be reached.',
      [
        {
          code:
            'PAYMENT_PROVIDER_UNAVAILABLE',
        },
      ],
    )
  }

  const payload =
    await parseProviderJson(
      response,
    )

  if (
    !response.ok ||
    !payload?.id
  ) {
    throw new ApiError(
      502,
      'Payment provider rejected order creation.',
      [
        {
          code:
            'PAYMENT_PROVIDER_ORDER_FAILED',

          providerStatus:
            response.status,
        },
      ],
    )
  }

  return {
    providerOrderId:
      payload.id,

    amountMinor:
      Number(
        payload.amount,
      ),

    currency:
      String(
        payload.currency ||
          currency ||
          'INR',
      ).toUpperCase(),

    keyId:
      publicConfig.keyId,
  }
}

export async function fetchRazorpayPayment({
  providerPaymentId,
}) {
  const paymentId =
    String(
      providerPaymentId ||
        '',
    ).trim()

  if (
    !paymentId
  ) {
    throw new ApiError(
      400,
      'Payment provider payment ID is required.',
      [
        {
          code:
            'PAYMENT_PROVIDER_PAYMENT_ID_REQUIRED',
        },
      ],
    )
  }

  const {
    authorization,
    baseUrl,
  } =
    requireRazorpayConfiguration()

  let response

  try {
    response =
      await fetch(
        `${baseUrl}/v1/payments/${encodeURIComponent(
          paymentId,
        )}`,
        {
          method:
            'GET',

          headers: {
            authorization:
              `Basic ${authorization}`,

            accept:
              'application/json',
          },
        },
      )
  } catch {
    throw new ApiError(
      502,
      'Payment provider could not be reached while confirming payment.',
      [
        {
          code:
            'PAYMENT_PROVIDER_UNAVAILABLE',
        },
      ],
    )
  }

  const payload =
    await parseProviderJson(
      response,
    )

  if (
    !response.ok ||
    !payload?.id
  ) {
    throw new ApiError(
      502,
      'Payment provider could not confirm the payment.',
      [
        {
          code:
            'PAYMENT_PROVIDER_PAYMENT_FETCH_FAILED',

          providerStatus:
            response.status,
        },
      ],
    )
  }

  const status =
    String(
      payload.status ||
        '',
    )
      .trim()
      .toLowerCase()

  return {
    provider:
      'razorpay',

    providerPaymentId:
      String(
        payload.id,
      ),

    providerOrderId:
      String(
        payload.order_id ||
          '',
      ),

    amountMinor:
      Number(
        payload.amount,
      ),

    currency:
      String(
        payload.currency ||
          '',
      )
        .trim()
        .toUpperCase(),

    status,

    captured:
      payload.captured ===
        true ||
      status ===
        'captured',

    createdAt:
      Number.isFinite(
        Number(
          payload.created_at,
        ),
      )
        ? Number(
            payload.created_at,
          )
        : null,
  }
}

export function verifyRazorpayCheckoutSignature({
  providerOrderId,
  providerPaymentId,
  signature,
}) {
  const keySecret =
    envValue(
      'RAZORPAY_KEY_SECRET',
    )

  if (
    !keySecret
  ) {
    return false
  }

  const expected =
    crypto
      .createHmac(
        'sha256',
        keySecret,
      )
      .update(
        `${providerOrderId}|${providerPaymentId}`,
      )
      .digest(
        'hex',
      )

  return timingSafeHexEqual(
    expected,
    signature,
  )
}

export function verifyRazorpayWebhookSignature({
  rawBody,
  signature,
}) {
  const webhookSecret =
    envValue(
      'RAZORPAY_WEBHOOK_SECRET',
    )

  if (
    !webhookSecret ||
    !Buffer.isBuffer(
      rawBody,
    )
  ) {
    return false
  }

  const expected =
    crypto
      .createHmac(
        'sha256',
        webhookSecret,
      )
      .update(
        rawBody,
      )
      .digest(
        'hex',
      )

  return timingSafeHexEqual(
    expected,
    signature,
  )
}

export function hashProviderPayload(
  rawBody,
) {
  return crypto
    .createHash(
      'sha256',
    )
    .update(
      rawBody,
    )
    .digest(
      'hex',
    )
}