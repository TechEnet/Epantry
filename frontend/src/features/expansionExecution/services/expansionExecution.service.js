import {
  apiClient,
} from '../../../api/apiClient'

function unwrap(response) {
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
      'Unable to initialize secure M22 request.',
    )
  }

  return data.csrfToken
}

function path(value) {
  return encodeURIComponent(
    String(
      value ||
      '',
    ).trim(),
  )
}

function newIdempotencyKey(prefix) {
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
  url,
  data = {},
  method = 'post',
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
      url,
      method,
      data,
      headers,
    }),
  )
}

export function getExpansionExecutionErrorMessage(
  error,
  fallback =
    'Unable to complete this M22 action right now.',
) {
  return (
    error?.response
      ?.data
      ?.message ||
    error?.message ||
    fallback
  )
}

export async function decideSafeSponsoredPlacement(
  input,
) {
  return mutate({
    url:
      '/retail-media/safe-decision',

    data:
      input,
  })
}

export async function listCreatorSessions() {
  return unwrap(
    await apiClient.get(
      '/creator-sessions',
    ),
  )
}

export async function listMyCreatorSessions() {
  return unwrap(
    await apiClient.get(
      '/creator-sessions/mine',
    ),
  )
}

export async function listMyCreatorBookings() {
  return unwrap(
    await apiClient.get(
      '/creator-bookings/mine',
    ),
  )
}

export async function createCreatorSession(
  input,
) {
  return mutate({
    url:
      '/creator-sessions',

    data:
      input,
  })
}

export async function publishCreatorSession(
  sessionId,
) {
  return mutate({
    url:
      `/creator-sessions/${path(
        sessionId,
      )}/publish`,
  })
}

export async function bookCreatorSession(
  sessionId,
) {
  return mutate({
    url:
      `/creator-sessions/${path(
        sessionId,
      )}/book`,

    idempotencyPrefix:
      'creator-session-booking',
  })
}

export async function verifyCreatorBookingPayment({
  bookingId,
  providerOrderId,
  providerPaymentId,
  signature,
}) {
  return mutate({
    url:
      `/creator-bookings/${path(
        bookingId,
      )}/payment/verify`,

    data: {
      providerOrderId,
      providerPaymentId,
      signature,
    },
  })
}

export async function cancelCreatorBooking({
  bookingId,
  reason,
}) {
  return mutate({
    url:
      `/creator-bookings/${path(
        bookingId,
      )}/cancel`,

    data: {
      reason,
    },
  })
}

export async function recordCreatorAttendance({
  bookingId,
  reason,
}) {
  return mutate({
    url:
      `/creator-bookings/${path(
        bookingId,
      )}/attendance`,

    data: {
      reason,
    },
  })
}