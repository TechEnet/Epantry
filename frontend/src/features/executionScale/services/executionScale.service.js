import {
  apiClient,
} from '../../../api/apiClient'

function unwrap(
  response,
) {
  if (
    response?.data &&
    typeof response.data ===
      'object' &&
    Object.prototype
      .hasOwnProperty
      .call(
        response.data,
        'success',
      )
  ) {
    return response
      .data
      .data
  }

  return (
    response?.data ??
    response
  )
}

async function getCsrfToken() {
  const response =
    await apiClient.get(
      '/auth/csrf',
    )

  const data =
    unwrap(
      response,
    )

  if (!data?.csrfToken) {
    throw new Error(
      'Unable to initialize secure M22 execution request.',
    )
  }

  return data.csrfToken
}

function newIdempotencyKey(
  prefix,
) {
  const suffix =
    typeof crypto !==
      'undefined' &&
    typeof crypto.randomUUID ===
      'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()
          .toString(16)
          .slice(2)}`

  return `${prefix}:${suffix}`.slice(
    0,
    180,
  )
}

async function mutate({
  method = 'post',
  url,
  data = {},
  idempotencyPrefix = '',
}) {
  const csrfToken =
    await getCsrfToken()

  const headers = {
    'x-csrf-token':
      csrfToken,
  }

  if (idempotencyPrefix) {
    headers['idempotency-key'] =
      newIdempotencyKey(
        idempotencyPrefix,
      )
  }

  return unwrap(
    await apiClient.request({
      method,
      url,
      data,
      headers,
    }),
  )
}

function path(
  value,
) {
  return encodeURIComponent(
    String(
      value ||
      '',
    ).trim(),
  )
}

export function getExecutionScaleErrorMessage(
  error,
  fallback =
    'Unable to complete this M22 execution action right now.',
) {
  return (
    error?.response
      ?.data
      ?.message ||
    error?.message ||
    fallback
  )
}

export async function getHostExecutionScale() {
  return unwrap(
    await apiClient.get(
      '/host/execution-scale',
    ),
  )
}

export async function createPartnerConnection(
  input,
) {
  return mutate({
    url:
      '/host/execution-scale/partners',

    data:
      input,
  })
}

export async function runPartnerSync({
  partnerConnectionId,
  operation,
}) {
  return mutate({
    url:
      `/host/execution-scale/partners/${path(
        partnerConnectionId,
      )}/sync`,

    data: {
      operation,
    },

    idempotencyPrefix:
      `partner-sync:${operation}`,
  })
}

export async function createPurchaseOrders({
  procurementPlanId,
  reason,
}) {
  return mutate({
    url:
      `/host/execution-scale/procurement-plans/${path(
        procurementPlanId,
      )}/purchase-orders`,

    data: {
      reason,
    },

    idempotencyPrefix:
      'purchase-order-draft',
  })
}

export async function transitionPurchaseOrder({
  purchaseOrderId,
  action,
  reason,
  providerReference = '',
  observedTotalMinor = null,
  evidenceRefs = [],
}) {
  return mutate({
    url:
      `/host/execution-scale/purchase-orders/${path(
        purchaseOrderId,
      )}/transition`,

    data: {
      action,
      reason,
      providerReference,
      observedTotalMinor,
      evidenceRefs,
    },
  })
}

export async function submitPurchaseOrder({
  purchaseOrderId,
  partnerConnectionId,
}) {
  return mutate({
    url:
      `/host/execution-scale/purchase-orders/${path(
        purchaseOrderId,
      )}/submit`,

    data: {
      partnerConnectionId,
    },
  })
}