import {
  apiClient,
} from '../../../api/apiClient'

function unwrap(
  response,
) {
  return (
    response?.data?.data ??
    response?.data ??
    null
  )
}

function normalizeString(
  value,
) {
  return String(
    value ||
      '',
  ).trim()
}

export async function runSmartSearch({
  query,
  mode =
    'all',
}) {
  const normalizedQuery =
    normalizeString(
      query,
    )

  if (
    normalizedQuery.length <
    2
  ) {
    throw new Error(
      'Enter at least 2 characters to search.',
    )
  }

  const response =
    await apiClient.post(
      '/search',
      {
        query:
          normalizedQuery,

        mode,
      },
    )

  return unwrap(
    response,
  )
}

export async function refineSmartSearch({
  sessionId,
  sessionToken,
  refinement,
  mode,
}) {
  if (
    !sessionId ||
    !sessionToken
  ) {
    throw new Error(
      'Search session is missing. Start a new search.',
    )
  }

  const payload = {
    sessionId,
    sessionToken,
    refinement:
      normalizeString(
        refinement,
      ),
  }

  if (
    mode
  ) {
    payload.mode =
      mode
  }

  const response =
    await apiClient.post(
      '/search/refine',
      payload,
    )

  return unwrap(
    response,
  )
}

export async function explainSearchDecision({
  sessionId,
  sessionToken,
  candidateType,
  candidateId,
}) {
  if (
    !sessionId ||
    !sessionToken
  ) {
    throw new Error(
      'Search session is missing. Start a new search.',
    )
  }

  const response =
    await apiClient.post(
      '/decision-explain',
      {
        sessionId,
        sessionToken,
        candidateType,
        candidateId,
      },
    )

  return unwrap(
    response,
  )
}

export function getSearchErrorMessage(
  error,
  fallback =
    'Unable to search right now.',
) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error?.message ||
    error?.message ||
    fallback
  )
}