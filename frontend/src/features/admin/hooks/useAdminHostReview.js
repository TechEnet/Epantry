import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {
  useAdmin,
} from '../context/AdminContext'

import {
  approveAdminHost,
  getAdminHost,
  getAdminHosts,
  rejectAdminHost,
  suspendAdminHost,
} from '../services/admin.service'

/*
|--------------------------------------------------------------------------
| Host Review Permissions
|--------------------------------------------------------------------------
*/

export const ADMIN_HOST_REVIEW_PERMISSIONS =
  Object.freeze({
    READ:
      'host.review.read',

    APPROVE:
      'host.review.approve',

    REJECT:
      'host.review.reject',

    SUSPEND:
      'host.review.suspend',
  })

/*
|--------------------------------------------------------------------------
| Query Keys
|--------------------------------------------------------------------------
|
| All Host review cache stays below:
|
| ['admin', 'host-review']
|
| so a successful mutation can invalidate the whole Host review surface
| without affecting unrelated Admin queries.
|
*/

export const ADMIN_HOST_REVIEW_QUERY_KEYS =
  Object.freeze({
    root:
      Object.freeze([
        'admin',
        'host-review',
      ]),

    lists:
      Object.freeze([
        'admin',
        'host-review',
        'lists',
      ]),

    details:
      Object.freeze([
        'admin',
        'host-review',
        'details',
      ]),

    list({
      status,
      page,
      limit,
    }) {
      return [
        'admin',
        'host-review',
        'lists',
        {
          status,
          page,
          limit,
        },
      ]
    },

    detail(
      userId,
    ) {
      return [
        'admin',
        'host-review',
        'details',
        userId,
      ]
    },
  })

/*
|--------------------------------------------------------------------------
| Filter Normalization
|--------------------------------------------------------------------------
*/

const ADMIN_HOST_REVIEW_STATUSES =
  Object.freeze([
    'all',
    'pending',
    'active',
    'rejected',
    'suspended',
  ])

function normalizePositiveInteger(
  value,
  fallback,
  maximum =
    Number.MAX_SAFE_INTEGER,
) {
  const normalized =
    Number(
      value,
    )

  if (
    !Number.isInteger(
      normalized,
    ) ||
    normalized <
      1
  ) {
    return fallback
  }

  return Math.min(
    normalized,
    maximum,
  )
}

export function normalizeAdminHostReviewFilters({
  status =
    'pending',

  page =
    1,

  limit =
    25,
} = {}) {
  const normalizedStatus =
    String(
      status ||
        'pending',
    )
      .trim()
      .toLowerCase()

  return {
    status:
      ADMIN_HOST_REVIEW_STATUSES.includes(
        normalizedStatus,
      )
        ? normalizedStatus
        : 'pending',

    page:
      normalizePositiveInteger(
        page,
        1,
      ),

    limit:
      normalizePositiveInteger(
        limit,
        25,
        100,
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Host Queue Query
|--------------------------------------------------------------------------
*/

export function useAdminHosts({
  status =
    'pending',

  page =
    1,

  limit =
    25,
} = {}) {
  const {
    isAdminAccessReady,
    hasAdminPermission,
  } = useAdmin()

  const filters =
    normalizeAdminHostReviewFilters({
      status,
      page,
      limit,
    })

  const canReadHosts =
    isAdminAccessReady &&
    hasAdminPermission(
      ADMIN_HOST_REVIEW_PERMISSIONS.READ,
    )

  const query =
    useQuery({
      queryKey:
        ADMIN_HOST_REVIEW_QUERY_KEYS.list(
          filters,
        ),

      queryFn:
        () =>
          getAdminHosts(
            filters,
          ),

      enabled:
        canReadHosts,

      placeholderData:
        keepPreviousData,

      staleTime:
        15 * 1000,
    })

  return {
    ...query,

    canReadHosts,

    filters,

    hosts:
      Array.isArray(
        query.data?.hosts,
      )
        ? query.data.hosts
        : [],

    pagination:
      query.data?.pagination ||
      null,

    responseFilter:
      query.data?.filter ||
      null,

    requestId:
      query.data?.requestId ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Host Detail Query
|--------------------------------------------------------------------------
*/

export function useAdminHost(
  userId,
) {
  const {
    isAdminAccessReady,
    hasAdminPermission,
  } = useAdmin()

  const normalizedUserId =
    String(
      userId ||
        '',
    ).trim()

  const canReadHost =
    isAdminAccessReady &&
    hasAdminPermission(
      ADMIN_HOST_REVIEW_PERMISSIONS.READ,
    )

  const query =
    useQuery({
      queryKey:
        ADMIN_HOST_REVIEW_QUERY_KEYS.detail(
          normalizedUserId,
        ),

      queryFn:
        () =>
          getAdminHost(
            normalizedUserId,
          ),

      enabled:
        canReadHost &&
        Boolean(
          normalizedUserId,
        ),

      staleTime:
        15 * 1000,
    })

  return {
    ...query,

    canReadHost,

    host:
      query.data?.host ||
      null,

    requestId:
      query.data?.requestId ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Cache Synchronization
|--------------------------------------------------------------------------
*/

async function refreshHostReviewCache(
  queryClient,
  host,
) {
  if (
    host?.id
  ) {
    queryClient.setQueryData(
      ADMIN_HOST_REVIEW_QUERY_KEYS.detail(
        String(
          host.id,
        ),
      ),

      (
        existing,
      ) => ({
        ...(
          existing ||
          {}
        ),

        host,
      }),
    )
  }

  await queryClient.invalidateQueries({
    queryKey:
      ADMIN_HOST_REVIEW_QUERY_KEYS.root,
  })
}

/*
|--------------------------------------------------------------------------
| Host Review Mutations
|--------------------------------------------------------------------------
|
| Backend independently enforces:
|
| recent MFA
| CSRF
| resolved admin authorization
| exact host.review.* permission
| controlled reason code
| immutable before/after audit
|
| These capability flags exist only for frontend UX.
|
*/

export function useAdminHostReviewActions() {
  const queryClient =
    useQueryClient()

  const {
    isAdminAccessReady,
    hasAdminPermission,
  } = useAdmin()

  const canApproveHost =
    isAdminAccessReady &&
    hasAdminPermission(
      ADMIN_HOST_REVIEW_PERMISSIONS.APPROVE,
    )

  const canRejectHost =
    isAdminAccessReady &&
    hasAdminPermission(
      ADMIN_HOST_REVIEW_PERMISSIONS.REJECT,
    )

  const canSuspendHost =
    isAdminAccessReady &&
    hasAdminPermission(
      ADMIN_HOST_REVIEW_PERMISSIONS.SUSPEND,
    )

  /*
  |--------------------------------------------------------------------------
  | Approve
  |--------------------------------------------------------------------------
  */

  const approveMutation =
    useMutation({
      mutationFn:
        ({
          userId,
          reasonDetails =
            null,
        }) =>
          approveAdminHost({
            userId,
            reasonDetails,
          }),

      onSuccess:
        async (
          result,
        ) => {
          await refreshHostReviewCache(
            queryClient,
            result?.host,
          )
        },
    })

  /*
  |--------------------------------------------------------------------------
  | Reject
  |--------------------------------------------------------------------------
  */

  const rejectMutation =
    useMutation({
      mutationFn:
        ({
          userId,
          reasonDetails =
            null,
        }) =>
          rejectAdminHost({
            userId,
            reasonDetails,
          }),

      onSuccess:
        async (
          result,
        ) => {
          await refreshHostReviewCache(
            queryClient,
            result?.host,
          )
        },
    })

  /*
  |--------------------------------------------------------------------------
  | Suspend
  |--------------------------------------------------------------------------
  */

  const suspendMutation =
    useMutation({
      mutationFn:
        ({
          userId,
          reasonDetails =
            null,
        }) =>
          suspendAdminHost({
            userId,
            reasonDetails,
          }),

      onSuccess:
        async (
          result,
        ) => {
          await refreshHostReviewCache(
            queryClient,
            result?.host,
          )
        },
    })

  /*
  |--------------------------------------------------------------------------
  | Combined Mutation State
  |--------------------------------------------------------------------------
  */

  const isMutatingHost =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    suspendMutation.isPending

  return {
    /*
    |--------------------------------------------------------------------------
    | UX Capabilities
    |--------------------------------------------------------------------------
    */

    canApproveHost,

    canRejectHost,

    canSuspendHost,

    /*
    |--------------------------------------------------------------------------
    | Mutations
    |--------------------------------------------------------------------------
    */

    approveHost:
      approveMutation.mutateAsync,

    rejectHost:
      rejectMutation.mutateAsync,

    suspendHost:
      suspendMutation.mutateAsync,

    approveMutation,

    rejectMutation,

    suspendMutation,

    /*
    |--------------------------------------------------------------------------
    | Combined State
    |--------------------------------------------------------------------------
    */

    isMutatingHost,
  }
}