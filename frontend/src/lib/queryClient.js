import {
  QueryClient,
} from '@tanstack/react-query'

export const queryClient =
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: (attempt, error) => {
          if (attempt >= 1) return false
          const status = Number(error?.status ?? error?.response?.status)
          // 4xx (including rate-limited 429) cannot be fixed by refetching.
          return !(status >= 400 && status < 500 && status !== 408)
        },
        staleTime:
          30 * 1000,
        refetchOnWindowFocus:
          false,
        // Reconnect refetches stale data only, not every mounted query.
        refetchOnReconnect:
          true,
        networkMode:
          'online',
      },

      mutations: {
        retry: 0,

        /*
        |------------------------------------------------------------------
        | M25 Mobile Retry Boundary
        |------------------------------------------------------------------
        |
        | Mutation functions must fail visibly while offline instead of being
        | parked for an automatic replay. Existing API idempotency keys remain
        | the server-side protection when the user explicitly retries.
        |
        */

        networkMode:
          'always',
      },
    },
  })
