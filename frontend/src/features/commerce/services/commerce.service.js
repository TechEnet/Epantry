import {
  apiClient,
} from '../../../api/apiClient'

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
    return response.data.data
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

function encodePathValue(
  value,
) {
  return encodeURIComponent(
    String(
      value ||
        '',
    ).trim(),
  )
}

async function getCsrfToken() {
  const response =
    await apiClient.get(
      '/auth/csrf',
    )

  const data =
    unwrapApiData(
      response,
    )

  if (
    !data?.csrfToken
  ) {
    throw new Error(
      'Unable to obtain CSRF protection token.',
    )
  }

  return data.csrfToken
}

function requireIdempotencyKey(
  value,
) {
  const normalized =
    String(
      value ||
        '',
    ).trim()

  if (
    normalized.length <
    8
  ) {
    throw new Error(
      'A valid idempotency key is required.',
    )
  }

  return normalized
}

async function csrfRequest({
  method,
  url,
  data,
  idempotencyKey,
}) {
  const csrfToken =
    await getCsrfToken()

  const headers = {
    'x-csrf-token':
      csrfToken,
  }

  if (
    idempotencyKey !==
    undefined
  ) {
    headers['Idempotency-Key'] =
      requireIdempotencyKey(
        idempotencyKey,
      )
  }

  const response =
    await apiClient.request({
      method,
      url,
      data,
      headers,
    })

  return unwrapApiData(
    response,
  )
}

export function createCommerceIdempotencyKey(
  prefix =
    'commerce',
) {
  if (
    typeof crypto !==
      'undefined' &&
    typeof crypto.randomUUID ===
      'function'
  ) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return [
    prefix,
    Date.now(),
    Math.random()
      .toString(
        36,
      )
      .slice(
        2,
      ),
  ].join(
    '-',
  )
}

export function getCommerceErrorMessage(
  error,
  fallback =
    'Unable to complete this commerce action right now.',
) {
  return (
    error?.response
      ?.data
      ?.message ||
    error?.message ||
    fallback
  )
}

export async function optimizeBasket({
  outcomePlanId,
  pincode,
  objective =
    'best_value',
  fulfillmentType,
  idempotencyKey,
}) {
  return csrfRequest({
    method:
      'post',

    url:
      '/basket-optimize',

    data: {
      outcomePlanId:
        String(
          outcomePlanId ||
            '',
        ).trim(),

      pincode:
        String(
          pincode ||
            '',
        ).trim(),

      objective,

      ...(fulfillmentType
        ? {
            fulfillmentType,
          }
        : {}),
    },

    idempotencyKey,
  })
}

export async function getBasketQuote(
  quoteId,
) {
  const response =
    await apiClient.get(
      `/basket-quotes/${encodePathValue(
        quoteId,
      )}`,
    )

  return unwrapApiData(
    response,
  )
}

export async function createDirectMarketplaceCart({
  cartId =
    null,
  packId,
  offerId,
  quantity =
    1,
  pincode,
  fulfillmentType =
    'delivery',
  idempotencyKey,
}) {
  return csrfRequest({
    method:
      'post',

    url:
      '/cart/direct',

    data: {
      ...(cartId
        ? {
            cartId:
              String(
                cartId,
              ).trim(),
          }
        : {}),

      packId:
        String(
          packId ||
            '',
        ).trim(),

      offerId:
        String(
          offerId ||
            '',
        ).trim(),

      quantity:
        Number(
          quantity,
        ),

      pincode:
        String(
          pincode ||
            '',
        ).trim(),

      fulfillmentType,
    },

    idempotencyKey,
  })
}


export async function updateDirectMarketplaceCartItem({
  cartId,
  itemId,
  operation,
  quantity,
}) {
  return csrfRequest({
    method:
      'patch',

    url:
      `/cart/${encodePathValue(
        cartId,
      )}/items/${encodePathValue(
        itemId,
      )}`,

    data: {
      operation,

      ...(
        quantity ===
          undefined ||
        quantity ===
          null
          ? {}
          : {
              quantity:
                Number(
                  quantity,
                ),
            }
      ),
    },
  })
}

export async function createMarketplaceCart({
  basketQuoteId,
  optionKey,
  idempotencyKey,
}) {
  return csrfRequest({
    method:
      'post',

    url:
      '/cart',

    data: {
      basketQuoteId:
        String(
          basketQuoteId ||
            '',
        ).trim(),

      optionKey,
    },

    idempotencyKey,
  })
}

export async function getMarketplaceCart(
  cartId,
) {
  const response =
    await apiClient.get(
      `/cart/${encodePathValue(
        cartId,
      )}`,
    )

  return unwrapApiData(
    response,
  )
}

export async function prepareCheckout({
  cartId,
  deliveryAddressId =
    null,
  idempotencyKey,
}) {
  return csrfRequest({
    method:
      'post',

    url:
      '/checkout',

    data: {
      cartId:
        String(
          cartId ||
            '',
        ).trim(),

      ...(deliveryAddressId
        ? {
            deliveryAddressId:
              String(
                deliveryAddressId,
              ).trim(),
          }
        : {}),
    },

    idempotencyKey,
  })
}

export async function createPaymentIntent({
  orderId,
  idempotencyKey,
}) {
  return csrfRequest({
    method:
      'post',

    url:
      '/payments/intents',

    data: {
      orderId:
        String(
          orderId ||
            '',
        ).trim(),
    },

    idempotencyKey,
  })
}

export async function verifyPayment({
  orderId,
  razorpayPaymentId,
  razorpayOrderId,
  razorpaySignature,
  idempotencyKey,
}) {
  return csrfRequest({
    method:
      'post',

    url:
      '/payments/verify',

    data: {
      orderId:
        String(
          orderId ||
            '',
        ).trim(),

      razorpayPaymentId,
      razorpayOrderId,
      razorpaySignature,
    },

    idempotencyKey,
  })
}

export async function getExternalHandoffPartners() {
  const response =
    await apiClient.get(
      '/external-handoff-partners',
    )

  return unwrapApiData(
    response,
  )
}

export async function createExternalHandoff({
  basketQuoteId,
  partnerId,
  idempotencyKey,
}) {
  return csrfRequest({
    method:
      'post',

    url:
      '/external-handoffs',

    data: {
      basketQuoteId:
        String(
          basketQuoteId ||
            '',
        ).trim(),

      partnerId:
        String(
          partnerId ||
            '',
        ).trim(),
    },

    idempotencyKey,
  })
}

export async function listOrders(
  params =
    {},
) {
  const response =
    await apiClient.get(
      '/orders',
      {
        params,
      },
    )

  return unwrapApiData(
    response,
  )
}

export async function getOrder(
  orderId,
) {
  const response =
    await apiClient.get(
      `/orders/${encodePathValue(
        orderId,
      )}`,
    )

  return unwrapApiData(
    response,
  )
}

export async function getOrderTracking(
  orderId,
) {
  const response =
    await apiClient.get(
      `/orders/${encodePathValue(
        orderId,
      )}/track`,
    )

  return unwrapApiData(
    response,
  )
}

export async function getHostCommercePolicy() {
  const response =
    await apiClient.get(
      '/host/commerce/policy',
    )

  return unwrapApiData(
    response,
  )
}

export async function saveHostCommercePolicy(
  input,
) {
  return csrfRequest({
    method:
      'put',

    url:
      '/host/commerce/policy',

    data:
      input,
  })
}

export async function listHostOrders(
  params =
    {},
) {
  const response =
    await apiClient.get(
      '/host/commerce/orders',
      {
        params,
      },
    )

  return unwrapApiData(
    response,
  )
}

export async function getHostOrder(
  orderId,
) {
  const response =
    await apiClient.get(
      `/host/commerce/orders/${encodePathValue(
        orderId,
      )}`,
    )

  return unwrapApiData(
    response,
  )
}

export async function updateHostOrderStatus({
  orderId,
  status,
  idempotencyKey,
}) {
  return csrfRequest({
    method:
      'post',

    url:
      `/host/commerce/orders/${encodePathValue(
        orderId,
      )}/status`,

    data: {
      status,
    },

    idempotencyKey,
  })
}