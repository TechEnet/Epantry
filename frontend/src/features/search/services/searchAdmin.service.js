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

export async function getSearchAiQuality({
  page =
    1,
  limit =
    25,
  status =
    '',
} = {}) {
  const response =
    await apiClient.get(
      '/admin/search-ai/quality',
      {
        params: {
          page,
          limit,

          ...(status
            ? {
                status,
              }
            : {}),
        },
      },
    )

  return unwrap(
    response,
  )
}