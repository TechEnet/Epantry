import {
  QueryClient,
} from '@tanstack/react-query'

export const queryClient =
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime:
          30 * 1000,
        refetchOnWindowFocus:
          false,
        refetchOnReconnect:
          'always',
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
