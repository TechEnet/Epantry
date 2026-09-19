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

function normalizeHistory(
  history,
) {
  if (
    !Array.isArray(
      history,
    )
  ) {
    return []
  }

  return history
    .slice(
      -8,
    )
    .map(
      (
        item,
      ) => ({
        role:
          item.role ===
          'assistant'
            ? 'assistant'
            : 'user',

        content:
          String(
            item.content ||
              '',
          )
            .trim()
            .slice(
              0,
              1500,
            ),
      }),
    )
    .filter(
      (
        item,
      ) =>
        item.content,
    )
}

export async function sendCopilotMessage({
  message,
  history =
    [],
  searchSession =
    null,
}) {
  const normalizedMessage =
    String(
      message ||
        '',
    ).trim()

  if (
    !normalizedMessage
  ) {
    throw new Error(
      'Enter a message for Food Copilot.',
    )
  }

  const payload = {
    message:
      normalizedMessage,

    history:
      normalizeHistory(
        history,
      ),
  }

  if (
    searchSession?.id &&
    searchSession?.token
  ) {
    payload.searchSession = {
      id:
        searchSession.id,

      token:
        searchSession.token,
    }
  }

  const response =
    await apiClient.post(
      '/copilot/messages',
      payload,
    )

  return unwrap(
    response,
  )
}

export function getCopilotErrorMessage(
  error,
  fallback =
    'Food Copilot is unavailable right now. Normal Search still works.',
) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error?.message ||
    error?.message ||
    fallback
  )
}